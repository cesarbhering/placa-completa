import { ambienteDaConsultaPaga } from '../../../utils/gcc-reserva'
import { PRODUTO_COMPLETA, consultarCompra, consultarPedidoGoogle, consumirCompra } from '../../../utils/google-play'
import { concluirCompraPlay, ordensBloqueadasDoEnv } from '../../../utils/google-play-compras'

// Compra feita dentro do app Android, cobrada pelo Google Play.
//
// O app nao tem Pix: quem cobra e a loja, e a unica coisa que ele consegue
// mandar pra ca e o purchaseToken. Este endpoint faz o que o webhook do Pix
// faz no site: confirma com quem recebeu o dinheiro, cria o pedido pago e
// dispara a entrega. Nada e entregue sem a Google confirmar.
//
// Toda chamada (inclusive recusada) grava a compra em google_play_compras
// (server/utils/google-play-compras.ts). Pagamento pendente responde 202
// {pendente: true}: a compra fica registrada e o job do servidor conclui
// sozinho quando a Google confirmar; o app acha o pedido pelo token depois.
//
// Idempotencia: o purchaseToken e unique em pedidos_premium. Se o app
// reenviar, a segunda chamada devolve o MESMO token_entrega.
export default defineEventHandler(async (event) => {
  assertPremiumGate(event)
  const body = await readBody(event)
  const placa = String(body.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
  const email = String(body.email || '').trim().toLowerCase()
  const purchaseToken = String(body.purchaseToken || '').trim()
  const orderId = String(body.orderId || '').trim() || null
  const productId = String(body.productId || '').trim()

  if (placa.length < 7) throw createError({ statusCode: 400, message: 'Placa invalida' })
  if (!purchaseToken || purchaseToken.length > 1000) throw createError({ statusCode: 400, message: 'Compra sem comprovante.' })
  // Um unico produto existe no app. Aceitar outro id seria aceitar um preco
  // que nao e o nosso.
  if (productId !== PRODUTO_COMPLETA) throw createError({ statusCode: 400, message: 'Produto invalido.' })
  if (email && !email.includes('@')) throw createError({ statusCode: 400, message: 'E-mail invalido' })

  const supabase = usePremiumSupabase()
  const config = useRuntimeConfig()

  let r
  try {
    r = await concluirCompraPlay({
      purchaseToken,
      productId,
      orderId,
      placa,
      email: email || null,
      origem: 'app',
      dadosApp: {
        preview: body.preview || null,
        origin: body.origin || null,
        origem_checkout: body.origem_checkout || null,
        ambiente: body.ambiente || null,
      },
      extrasPedido: { ip_address: getClientIp(event), ...getDispositivo(event) },
    }, {
      supabase,
      consultar: consultarCompra,
      consultarPedido: consultarPedidoGoogle,
      processar: processarPedidoPago,
      consumir: consumirCompra,
      // Fora do homolog sempre 'producao' (ver ambienteDaConsultaPaga).
      ambienteDoPedido: (a) => ambienteDaConsultaPaga(a, config),
      ordensBloqueadas: ordensBloqueadasDoEnv(),
    })
  } catch {
    throw createError({ statusCode: 500, message: 'Falha ao criar pedido' })
  }

  if (r.tipo === 'entregue') {
    return { token_entrega: r.token_entrega, ...(r.repetido ? { repetido: true } : {}), ...(r.valor_centavos ? { valor_centavos: r.valor_centavos } : {}) }
  }
  if (r.tipo === 'pendente') {
    setResponseStatus(event, 202)
    return { pendente: true, message: MENSAGEM_PENDENTE }
  }
  // sem_placa nao acontece aqui (placa e obrigatoria acima); fica por garantia.
  throw createError({ statusCode: 402, message: mensagemDeFalha(r.tipo === 'recusada' ? r.motivo : null) })
})

const MENSAGEM_PENDENTE = 'Seu pagamento está em processamento no Google. Assim que ele for confirmado, o relatório fica pronto e aparece aqui no app.'

function mensagemDeFalha(motivo: string | null): string {
  if (motivo === 'compra cancelada') return 'Esta compra foi cancelada pelo Google.'
  if (motivo === 'compra nao encontrada') return 'Nao encontramos esta compra no Google Play.'
  return 'Nao conseguimos confirmar sua compra agora. Tente de novo em instantes.'
}
