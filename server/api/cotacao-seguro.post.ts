import { comTagAmbiente } from '../utils/ambiente-alerta'
import { Resend } from 'resend'
import { normalizePhoneForWhatsApp, sendWhatsAppText } from '../utils/evolutionApi'
import { REGIOES } from '../utils/regiao-susep'
import { getClientIp } from '../utils/client-ip'
import { lookupIpGeo } from '../utils/ip-geo'

/**
 * Lead de cotacao real de seguro: o usuario viu a estimativa SUSEP no
 * modal pos-consulta e deixou o telefone pra receber contato de corretor.
 * Grava em cotacoes_seguro e notifica (email + WhatsApp, fire-and-forget).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { phone, placa, veiculo, seguro, consultaId, origem } = body || {}
  let { email } = body || {}

  // origem do lead: 'premium' quando vem do relatorio pago (usuario ja pagou,
  // intencao mais alta); 'gratis' e o default (modal pos-consulta gratuita).
  const origemLead = origem === 'premium' ? 'premium' : 'gratis'

  const normalizedPhone = phone ? normalizePhoneForWhatsApp(String(phone)) : null
  if (!normalizedPhone) {
    throw createError({ statusCode: 400, message: 'Telefone inválido. Confira o DDD e o número.' })
  }

  const placaClean = typeof placa === 'string'
    ? placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7)
    : null

  // Cidade/UF de quem esta pedindo a cotacao (geo do IP na hora; fail-open)
  const ipGeo = await lookupIpGeo(getClientIp(event))
  let cidadeLead = ipGeo?.country === 'BR' && ipGeo.city ? `${ipGeo.city} - ${ipGeo.uf}` : null

  const supabase = useSupabaseServer()

  // Lead vindo da pagina /cotacao (link do email): resolve o email da
  // consulta server-side pelo uuid, sem nunca expor o email completo no front
  if (typeof consultaId === 'string' && /^[0-9a-f-]{36}$/i.test(consultaId)) {
    const { data: consulta } = await supabase
      .from('consultas')
      .select('email, geo_city, geo_uf')
      .eq('id', consultaId)
      .maybeSingle()
    if (consulta) {
      if (!email && consulta.email) email = consulta.email
      if (!cidadeLead && consulta.geo_city) cidadeLead = `${consulta.geo_city} - ${consulta.geo_uf ?? ''}`.trim()
    }
  }

  // Dedupe: mesmo telefone + placa na ultima hora = duplo clique/reenvio
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('cotacoes_seguro')
    .select('id', { count: 'exact', head: true })
    .eq('phone', normalizedPhone)
    .eq('placa', placaClean)
    .gte('created_at', oneHourAgo)
  if ((count ?? 0) > 0) {
    return { success: true }
  }

  const row = {
    email: typeof email === 'string' ? email.trim().toLowerCase().slice(0, 200) : null,
    phone: normalizedPhone,
    placa: placaClean,
    marca: veiculo?.marca ? String(veiculo.marca).slice(0, 100) : null,
    modelo: veiculo?.modelo ? String(veiculo.modelo).slice(0, 150) : null,
    ano_modelo: veiculo?.ano ? parseInt(String(veiculo.ano), 10) || null : null,
    regiao_code: seguro?.regiao?.codigo ? String(seguro.regiao.codigo).slice(0, 4) : null,
    premio_estimado: typeof seguro?.premioAnual === 'number' ? seguro.premioAnual : null,
    franquia_estimada: typeof seguro?.franquia === 'number' ? seguro.franquia : null,
    origem: origemLead,
  }

  const { error } = await supabase.from('cotacoes_seguro').insert(row)
  if (error) {
    console.error('[cotacao-seguro] insert falhou:', error.message)
    throw createError({ statusCode: 500, message: 'Não conseguimos registrar. Tente novamente.' })
  }

  // Notificacoes fire-and-forget: lead ja esta salvo, resposta nao espera
  notifyLead({ ...row, cidade: cidadeLead }).catch((e) => console.warn('[cotacao-seguro] notificacao falhou:', e?.message))

  return { success: true }
})

async function notifyLead(row: {
  email: string | null
  phone: string
  placa: string | null
  marca: string | null
  modelo: string | null
  ano_modelo: number | null
  premio_estimado: number | null
  franquia_estimada: number | null
  regiao_code: string | null
  cidade: string | null
  origem: string
}) {
  const config = useRuntimeConfig()
  const veiculo = [row.marca, row.modelo, row.ano_modelo].filter(Boolean).join(' ')
  const premio = row.premio_estimado ? `R$ ${row.premio_estimado.toFixed(2)}` : '-'
  const fone = `+${row.phone}`
  const isPremium = row.origem === 'premium'
  // lead premium = usuario que pagou o relatorio: sinaliza no topo pra priorizar
  const selo = isPremium ? 'PREMIUM (consulta paga)' : 'gratis'

  const resumo = [
    `Origem: ${selo}`,
    `Veículo: ${veiculo || row.placa || '-'}`,
    `Placa: ${row.placa || '-'}`,
    `Telefone: ${fone}`,
    `Cidade (via IP): ${row.cidade || '-'}`,
    `Email: ${row.email || '-'}`,
    `Estimativa exibida: ${premio}/ano (região ${row.regiao_code ? `${row.regiao_code} - ${REGIOES[row.regiao_code] || '?'}` : '-'})`,
  ].join('\n')

  // Email
  try {
    const resend = new Resend(config.resendApiKey)
    await resend.emails.send({
      from: 'PlacaCompleta Leads <leads@placacompleta.com.br>',
      to: 'cesar.bhering@placacompleta.com.br',
      subject: comTagAmbiente(`${isPremium ? '⭐🔥 Lead PREMIUM' : '🔥 Lead'} de seguro: ${veiculo || row.placa} · ${fone}`),
      text: comTagAmbiente(`Novo pedido de cotação real de seguro:\n\n${resumo}\n\nStatus no Supabase: cotacoes_seguro (marcar como contatado depois).`),
    })
  } catch (e: any) {
    console.warn('[cotacao-seguro] email de notificacao falhou:', e?.message)
  }

  // WhatsApp pro corretor (env SEGURO_LEAD_NOTIFY_PHONE; ausente = pula)
  const notifyPhone = process.env.SEGURO_LEAD_NOTIFY_PHONE
  if (notifyPhone) {
    const r = await sendWhatsAppText(notifyPhone, comTagAmbiente(`${isPremium ? '⭐ Lead PREMIUM de seguro!' : '🔥 Lead de seguro!'}\n\n${resumo}`))
    if (!r.ok) console.warn('[cotacao-seguro] whatsapp de notificacao falhou:', r.error)
  }
}
