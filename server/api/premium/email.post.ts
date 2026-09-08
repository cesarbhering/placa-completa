import { entregaTardiaPendente } from '../../utils/email-entrega-tardia'

// Grava o e-mail de entrega de um pedido que ja existe. Nasceu porque o e-mail
// saiu da frente do Pix: agora ele e pedido na tela de pagamento, enquanto a
// pessoa paga, e chega aqui.
//
// O token de entrega e a credencial (mesma regra do relatorio): quem tem o
// token e quem esta com a tela do pedido aberta. Nao da pra descobrir o e-mail
// de ninguem por aqui, so gravar um.
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const token = String(body?.token || '').trim()
  const email = String(body?.email || '').trim().toLowerCase()

  if (!token || token.length < 8) throw createError({ statusCode: 404, message: 'Pedido nao encontrado' })
  if (!email.includes('@') || email.length > 200) {
    throw createError({ statusCode: 400, message: 'Informe um e-mail válido.' })
  }

  const supabase = usePremiumSupabase()

  // So preenche o que esta vazio. Trocar um e-mail ja gravado por outro seria
  // uma forma de desviar a entrega de um pedido alheio pra quem descobrisse o
  // token; quem digitou errado fala com o suporte.
  const { data } = await supabase
    .from('pedidos_premium')
    .update({ email })
    .eq('token_entrega', token)
    .is('email', null)
    .select('id,status,plano,placa,email_enviado_em')

  const pedido = data?.[0]
  if (pedido) {
    // Pedido que ja estava pago quando o e-mail chegou: o relatorio precisa
    // sair AGORA. Antes disto, quem pagava sem e-mail e informava depois
    // ficava so com a aba aberta, e a entrega tinha que ser feita a mao pelo
    // time (aconteceu de verdade, pedido de KCD1J29).
    const enviado = entregaTardiaPendente(pedido) ? await enviarEntregaTardia(supabase, pedido, email, token) : false
    return { ok: true, gravado: true, enviadoAgora: enviado }
  }

  // Sem linha atualizada: ou o pedido nao existe, ou ja tinha e-mail. O
  // segundo caso nao e erro pra quem esta na tela (ela ja vai receber), entao
  // so o pedido inexistente vira 404.
  const { data: existe } = await supabase
    .from('pedidos_premium')
    .select('id')
    .eq('token_entrega', token)
    .maybeSingle()
  if (!existe) throw createError({ statusCode: 404, message: 'Pedido nao encontrado' })
  return { ok: true, gravado: false, enviadoAgora: false }
})

/**
 * Envia o relatorio uma vez so. A trava e o proprio update condicionado a
 * email_enviado_em IS NULL, no banco: quem consegue carimbar e quem envia.
 * Duas requisicoes ao mesmo tempo, ou a pessoa saindo e voltando do campo,
 * nao geram dois e-mails.
 */
async function enviarEntregaTardia(
  supabase: ReturnType<typeof usePremiumSupabase>,
  pedido: { id: string; plano?: string | null; placa?: string | null },
  email: string,
  token: string,
): Promise<boolean> {
  const { data: reivindicado } = await supabase
    .from('pedidos_premium')
    .update({ email_enviado_em: new Date().toISOString() })
    .eq('id', pedido.id)
    .is('email_enviado_em', null)
    .select('id')
  if (!reivindicado?.length) return false

  const ok = await enviarRelatorioEmail({
    email,
    token,
    plano: pedido.plano || 'completa',
    placa: pedido.placa || '',
  }).catch(() => false)

  if (!ok) {
    // Solta a vaga pra uma proxima tentativa poder enviar. Falha de e-mail nao
    // pode custar a entrega de quem ja pagou.
    await supabase.from('pedidos_premium').update({ email_enviado_em: null }).eq('id', pedido.id)
    await sendErrorEmail({
      endpoint: '/premium/email',
      errorMessage: `E-mail informado depois do pagamento, mas o envio falhou. pedido=${pedido.id} token=${token}`,
    }).catch(() => {})
  }
  return ok
}
