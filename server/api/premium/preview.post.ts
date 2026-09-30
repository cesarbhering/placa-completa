// Preview GRATIS pra confirmar o veiculo antes de pagar (marca/modelo/ano).
// Fonte free atual (wdapi2). NAO expoe nada de SENATRAN. Gated.
import { marcaExibicao } from '../../../shared/marca-exibicao'
import { mensagemLimiteGratis } from '../../utils/ip-wdapi-limit'
import { lerPlacaCacheFresca } from '../../utils/placa-lookup'
export default defineEventHandler(async (event) => {
  assertPremiumGate(event)
  const { placa } = await readBody(event)
  const placaClean = String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
  if (placaClean.length < 7) throw createError({ statusCode: 400, message: 'Placa invalida' })

  // Mesmo teto de 5/IP/hora do /api/consulta, e COMBINADO com ele (ver
  // server/utils/ip-wdapi-limit.ts): este endpoint tambem custa credito wdapi
  // e nao tinha nenhum limite antes — um bot podia raspar placas por aqui sem
  // esbarrar no rate-limit do /api/consulta. assertPremiumGate acima e no-op
  // em producao (so vale pra homolog/staging), entao sem isto o preview ficava
  // completamente aberto.
  const config = useRuntimeConfig()
  const ip = getClientIp(event)
  const supabase = useSupabaseServer()

  // Mesma blocklist do /api/consulta: sem ela, quem estava bloqueado la
  // continuava consultando por aqui, que bate na mesma fonte paga.
  if (estaBloqueado(ip)) {
    supabase.from('blocked_requests').insert({
      reason: 'blocklist',
      ip_address: ip,
      placa: placaClean || null,
      user_agent: getRequestHeader(event, 'user-agent') || null,
    }).then(({ error }: any) => { if (error) console.warn('[blocked_requests] insert falhou:', error.message) })
    throw createError({ statusCode: 403, message: 'Acesso não autorizado.' })
  }

  // Placa ja no cache (o normal: a pessoa acabou de consultar gratis e abriu o
  // checkout) nao custa wdapi, entao nao conta nem e barrada pelo teto. Sem
  // isso, com o teto em 5/h, quem consultou 5 placas nao conseguia COMPRAR.
  const emCache = await lerPlacaCacheFresca(placaClean)
  if (emCache) return montarPreview(placaClean, emCache)

  const limite = await checarLimiteIpWdapi(supabase, ip, { homolog: config.public.homolog })
  if (!limite.ok) {
    supabase.from('blocked_requests').insert({
      reason: 'rate_limit_ip_wdapi',
      ip_address: ip,
      placa: placaClean || null,
      user_agent: getRequestHeader(event, 'user-agent') || null,
    }).then(({ error }: any) => { if (error) console.warn('[blocked_requests] insert falhou:', error.message) })
    contarBloqueiosNaHora(supabase, ip).then((bloqueiosNaHora) => avisarAbuso({
      ip, rota: '/api/premium/preview', teto: limite.teto,
      userAgent: getRequestHeader(event, 'user-agent') || null, bloqueiosNaHora,
    }))
    throw createError({
      statusCode: 429,
      message: mensagemLimiteGratis(limite.teto!, limite.minutesUntilReset!),
    })
  }
  registrarChamadaPreviewWdapi(supabase, ip)

  // Fonte free (wdapi2), pagando so aqui: fora do cache.
  const r = await consultarPlacaWdapi(placaClean)
  if (r) return montarPreview(placaClean, r)
  return { placa: placaClean, encontrado: false }
})

function montarPreview(placaClean: string, r: any) {
  return {
    placa: placaClean,
    encontrado: true,
    // Importado traz codigo ("I") no campo MARCA; ver shared/marca-exibicao.
    marca: marcaExibicao(r) || null,
    modelo: r.MODELO || r.modelo || null,
    ano: r.anoModelo || r.ano || r.ANO || null,
    cor: r.cor || r.COR || null,
    // municipio/uf entram pra confirmacao pos-pagamento: sem a cidade, duas
    // placas parecidas do mesmo modelo e cor ficam indistinguiveis.
    municipio: r.municipio || null,
    uf: r.uf || null,
    // A mesma placa no outro formato, quando a fonte livre conhece as duas.
    // Vai junto para o pedido: se o registro responder "nao encontrado" para
    // o formato digitado, a consulta paga tenta este antes de estornar.
    placaAlternativa: r.placa_alternativa || r.placaAlternativa || null,
    raw: {
      marca: marcaExibicao(r), modelo: r.MODELO || r.modelo,
      ano: r.anoModelo || r.ano, cor: r.cor,
      municipio: r.municipio || null, uf: r.uf || null,
      placaAlternativa: r.placa_alternativa || r.placaAlternativa || null,
    },
  }
}
