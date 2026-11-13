import { promoverSeSnapshotPronto } from '../../utils/entrega-pedido'
import { emVoo, rastrearEmVoo } from '../../utils/tarefas-em-voo'
import { gravarPagadorHash } from '../../utils/pagador-hash'
import { confirmarPagamentoDoPedido } from '../../utils/confirmar-pagamento'
// Status do pedido pelo token (polling da tela pendente). O token e a
// credencial, entao nao exige gate. Quando detecta o pagamento (via AbacatePay),
// DISPARA a consulta (fire-and-forget) - assim o fluxo completa mesmo sem webhook.
export default defineEventHandler(async (event) => {
  const { token } = getQuery(event)
  if (!token) throw createError({ statusCode: 400, message: 'token obrigatorio' })
  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('id,status,placa,email,token_entrega,abacatepay_id,pix_provider,forma_pagamento,stripe_session_id,google_play_order_id,expira_em,plano,ambiente,debug_trace,erro,preview,valor_centavos,gclid,msclkid,utm_source,utm_campaign,entregue_em,relatorio_snapshot,snapshot_em')
    .eq('token_entrega', String(token))
    .single()
  if (!pedido) throw createError({ statusCode: 404, message: 'Pedido nao encontrado' })

  let status = pedido.status
  // Preso em 'consultando' com o relatorio ja pronto (a gravacao da entrega
  // falhou): promove aqui, sem chamada paga, e a tela do checkout navega.
  const promovido = await promoverSeSnapshotPronto(supabase, pedido)
  if (promovido) {
    status = 'entregue'
    pedido.status = 'entregue'
    if (!pedido.entregue_em) pedido.entregue_em = pedido.snapshot_em
  }
  if (status === 'aguardando_pagamento') {
    const ehCartao = pedido.forma_pagamento === 'cartao'
    // The payment rule lives in server/utils/confirmar-pagamento.ts and is
    // shared with the Woovi webhook: card first (Stripe), then the Pix charge
    // recorded on the order, then the original Woovi charge as a safety net
    // (found paid there, the order is repointed to it). Here a provider that
    // did not answer counts as "not paid yet": the next poll asks again.
    const pago = (await confirmarPagamentoDoPedido(supabase, pedido)) === 'pago'

    if (pago) {
      // pagamento confirmado -> dispara a consulta (fire-and-forget; o container
      // segue processando apos a resposta). Claim atomico evita duplicar.
      // Registrada como em voo: o SIGTERM do deploy espera a consulta paga.
      rastrearEmVoo('processar-pedido', () => processarPedidoPago(supabase, pedido)).catch(() => {})
      // Identificador pseudonimizado do pagador (recorrencia sem e-mail).
      // Fire-and-forget e a parte: nunca segura nem quebra a confirmacao.
      void emVoo('pagador-hash', () => gravarPagadorHash(supabase, pedido))
      status = 'consultando'
    } else if (!ehCartao && pedido.expira_em && new Date(pedido.expira_em).getTime() < Date.now()) {
      // So o Pix expira pela janela do QR (15 min). Pedido de cartao NUNCA vira
      // 'expirado' por causa de um expira_em de Pix: a sessao Stripe tem prazo
      // proprio e a tela do cartao segue confirmando ate o pagamento cair.
      status = 'expirado'
      await supabase.from('pedidos_premium').update({ status }).eq('id', pedido.id)
    }
  }
  // Piso de loading: quando o registro traz recall e/ou multa (SP), a tela de
  // checkout segura a navegacao por ~40s pra os enriquecimentos rodarem e a
  // FIPE ganhar contexto, mostrando o que esta sendo buscado. Expomos as flags
  // e o entregue_em; o FLOOR e do cliente (so no fluxo recem-entregue, nunca
  // numa revisita de link antigo). So calcula na entrega (snapshot ja existe).
  let piso: Record<string, unknown> = {}
  if (status === 'entregue') {
    const resp = (pedido.relatorio_snapshot as any)?.consulta?.response
    piso = {
      entregue_em: pedido.entregue_em,
      temRecall: temRecallPendente(resp),
      temMultaSP: temMultaSP(resp),
    }
  }

  return {
    status,
    // Valor que a pessoa pagou (cupom incluido): a conversao dos anuncios usa
    // isto e nao dispara quando e 0 (cupom 100%).
    valorCentavos: pedido.valor_centavos ?? null,
    ...piso,
    ...(String(getQuery(event).debug) === '1' ? { debug_trace: pedido.debug_trace, erro: pedido.erro, ambiente: pedido.ambiente } : {}),
  }
})
