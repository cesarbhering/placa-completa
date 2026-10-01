import { PLANOS } from '../../../shared/planos'

// Gera um Pix novo para um pedido que ainda nao foi pago e cujo QR venceu.
//
// Antes, o beco sem saida: o Pix expirava e a tela so oferecia "fazer nova
// consulta", jogando fora um pedido que ja tem placa, plano e e-mail
// confirmados. O provedor nao cobra por QR gerado, entao renovar sai de graca.
//
// A credencial e o token de entrega, igual ao /report: quem tem o link e dono
// do pedido. Nao usa o gate de senha porque o link chega por e-mail, fora da
// sessao que passou pelo gate.
export default defineEventHandler(async (event) => {
  const { token } = await readBody(event)
  if (!token) throw createError({ statusCode: 400, message: 'token obrigatorio' })

  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('id,status,valor_centavos,expira_em,abacatepay_id,pix_provider,plano,forma_pagamento')
    .eq('token_entrega', String(token))
    .single()
  if (!pedido) throw createError({ statusCode: 404, message: 'Pedido nao encontrado' })

  // Pedido de CARTAO nao gera Pix. Sem esta trava, a tela do relatorio (que
  // renova o Pix de um pedido pendente sem br_code) criava uma cobranca Pix no
  // pedido de cartao ao voltar do Stripe — QR na tela em vez do relatorio e
  // risco de cobranca dupla (Pix + cartao no MESMO pedido). O cartao confirma
  // pela sessao Stripe, nunca por Pix.
  if (pedido.forma_pagamento === 'cartao') {
    throw createError({ statusCode: 409, message: 'Pedido de cartao nao gera Pix.' })
  }

  // So pedido pendente. Qualquer outro status significa que ja houve cobranca:
  // gerar Pix ali seria oferecer um segundo pagamento pelo mesmo relatorio.
  if (pedido.status !== 'aguardando_pagamento') {
    throw createError({ statusCode: 409, message: 'Este pedido nao esta aguardando pagamento.' })
  }

  // E so quando o atual ja nao serve. O relogio local decide o caso obvio;
  // quando ele diz "ainda vale", quem confirma e o PROVEDOR (/transparents/
  // check): cobranca cancelada ou expirada la fora com expira_em ainda no
  // futuro deixaria o cliente pagando um QR morto.
  const vencidoLocal = !pedido.expira_em || new Date(pedido.expira_em).getTime() < Date.now()
  if (!vencidoLocal) {
    const chk = pedido.abacatepay_id
      ? await provedorDoPedido((pedido as any).pix_provider).checarPix(pedido.abacatepay_id)
      : null
    // sem resposta do provedor, prevalece o relogio local (fail-safe: nao
    // gerar cobranca nova por causa de instabilidade de rede)
    if (!chk || /pending|created|aguard/i.test(chk.status || '')) {
      throw createError({ statusCode: 409, message: 'O pagamento atual ainda esta valido.' })
    }
    if (/paid|completed|pago/i.test(chk.status || '')) {
      throw createError({ statusCode: 409, message: 'Este pagamento ja foi confirmado.' })
    }
    // qualquer outro estado (expired/cancelled): segue pra renovacao
  }

  const planoPedido = (pedido.plano === 'basica' || pedido.plano === 'completa') ? pedido.plano : 'completa'
  // Mesmo failover do checkout: Woovi preferencial, AbacatePay salva-vidas. O
  // QR novo pode nascer num provedor diferente do da cobranca vencida, entao o
  // pix_provider e regravado — senao o status e o estorno desta cobranca nova
  // consultariam a porta errada.
  const { charge: pix, provedor } = await criarPixComFallback({
    amountCentavos: pedido.valor_centavos,
    pedidoId: pedido.id,
    expiresIn: 900,
    descricao: PLANOS[planoPedido].nome,
    metadata: { plano: planoPedido, externalId: `plano-${planoPedido}` },
  })
  await supabase
    .from('pedidos_premium')
    .update({ abacatepay_id: pix.id, br_code: pix.brCode, expira_em: pix.expiresAt, pix_provider: provedor.nome })
    .eq('id', pedido.id)

  return { brCode: pix.brCode, brCodeBase64: pix.brCodeBase64, expiresAt: pix.expiresAt, recebedor: provedor.nomeDoRecebedor() }
})
