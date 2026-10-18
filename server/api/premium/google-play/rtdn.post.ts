import { PACKAGE_NAME, PRODUTO_COMPLETA } from '../../../utils/google-play'
import { decodificarRtdn, registrarCompra } from '../../../utils/google-play-compras'
import { chavesGoogle, verificarOidc } from '../../../utils/pubsub-oidc'

// Real-time Developer Notifications da Play (push do Pub/Sub), 18/out/2026.
//
// Serve pra compra cujo app nunca chamou o /verificar (Pix da Play pendente,
// app fechado). Aqui so REGISTRA o token em google_play_compras; quem pergunta
// a Google e cria o pedido e o job (server/utils/google-play-compras.ts), pelo
// mesmo caminho do /verificar.
//
// Autenticacao: token OIDC do Pub/Sub (assinatura push com "autenticacao"
// ligada). Audiencia em NUXT_GOOGLE_PLAY_RTDN_AUDIENCIA; e-mail da conta de
// servico da assinatura em NUXT_GOOGLE_PLAY_RTDN_EMAIL. Sem audiencia
// configurada, o endpoint fica desligado (503).
//
// Respostas: 2xx confirma a mensagem pro Pub/Sub (nao reenvia). Mensagem
// torta ou de outro app tambem leva 204: reenviar nao conserta. Erro nosso
// (banco) leva 500, e o Pub/Sub tenta de novo.
export default defineEventHandler(async (event) => {
  const config: any = useRuntimeConfig()
  const audiencia = String(config.googlePlayRtdnAudiencia || '')
  if (!audiencia) throw createError({ statusCode: 503, message: 'RTDN nao configurado.' })

  const auth = await verificarOidc(getRequestHeader(event, 'authorization'), {
    audiencia,
    email: String(config.googlePlayRtdnEmail || ''),
    chaves: chavesGoogle,
  })
  if (!auth.ok) {
    console.warn(`[google-play] rtdn recusada: ${auth.motivo}`)
    throw createError({ statusCode: 401, message: 'Nao autorizado.' })
  }

  const body: any = await readBody(event).catch(() => null)
  const n = decodificarRtdn(body)
  setResponseStatus(event, 204)
  if (!n) return null
  if (n.packageName !== PACKAGE_NAME) return null
  if (n.testNotification) {
    console.info('[google-play] rtdn de teste recebida')
    return null
  }
  const o = n.oneTimeProductNotification
  if (!o?.purchaseToken) return null
  if (o.sku && o.sku !== PRODUTO_COMPLETA) return null
  const tipo = Number(o.notificationType)
  if (tipo === 1) {
    // ONE_TIME_PRODUCT_PURCHASED: registra; o job conclui em ate 2 min.
    await registrarCompra(usePremiumSupabase(), String(o.purchaseToken), { product_id: o.sku || PRODUTO_COMPLETA }, 'rtdn')
    console.info('[google-play] rtdn: compra registrada')
  } else if (tipo === 2) {
    console.info('[google-play] rtdn: compra cancelada (o job confere na Google)')
  }
  return null
})
