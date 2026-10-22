import { cupomRecompraDoPedido } from './cupom-recompra'
import { entregaTardiaPendente } from './email-entrega-tardia'

// E-mail que chega DEPOIS do pedido existir. Dois caminhos usam: a tela do Pix
// (/api/premium/email, pelo token de entrega) e o app, quando o pedido do
// Google Play nasceu pela notificacao da loja sem e-mail nenhum
// (/api/premium/google-play/pedido). A regra e a mesma nos dois, por isso mora
// aqui e nao em cada endpoint.

export interface ResultadoEmailTardio {
  /** Achou o pedido pelo token. */
  existe: boolean
  /** O e-mail foi gravado agora (o pedido estava sem). */
  gravado: boolean
  /** O relatorio saiu por e-mail nesta chamada. */
  enviadoAgora: boolean
}

/**
 * Grava o e-mail se o pedido ainda nao tem e, se o relatorio ja existe, envia
 * na hora. Nunca troca um e-mail ja gravado: isso seria um jeito de desviar a
 * entrega de um pedido alheio pra quem descobrisse a credencial; quem digitou
 * errado fala com o suporte. Idempotente: chamar de novo nao reenvia.
 */
export async function gravarEmailTardio(
  supabase: any,
  token: string,
  email: string,
  endpoint: string,
): Promise<ResultadoEmailTardio> {
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
    const enviado = entregaTardiaPendente(pedido) ? await enviarEntregaTardia(supabase, pedido, email, token, endpoint) : false
    return { existe: true, gravado: true, enviadoAgora: enviado }
  }

  // Sem linha atualizada: ou o pedido nao existe, ou ja tinha e-mail.
  const { data: existe } = await supabase
    .from('pedidos_premium')
    .select('id')
    .eq('token_entrega', token)
    .maybeSingle()
  return { existe: !!existe, gravado: false, enviadoAgora: false }
}

/**
 * Envia o relatorio uma vez so. A trava e o proprio update condicionado a
 * email_enviado_em IS NULL, no banco: quem consegue carimbar e quem envia.
 * Duas requisicoes ao mesmo tempo, ou a pessoa saindo e voltando do campo,
 * nao geram dois e-mails.
 */
async function enviarEntregaTardia(
  supabase: any,
  pedido: { id: string; plano?: string | null; placa?: string | null },
  email: string,
  token: string,
  endpoint: string,
): Promise<boolean> {
  const { data: reivindicado } = await supabase
    .from('pedidos_premium')
    .update({ email_enviado_em: new Date().toISOString() })
    .eq('id', pedido.id)
    .is('email_enviado_em', null)
    .select('id')
  if (!reivindicado?.length) return false

  const cupom = await cupomRecompraDoPedido(supabase, pedido.id)
  const ok = await enviarRelatorioEmail({
    email,
    token,
    plano: pedido.plano || 'completa',
    placa: pedido.placa || '',
    cupom,
  }).catch(() => false)

  if (!ok) {
    // Solta a vaga pra uma proxima tentativa poder enviar. Falha de e-mail nao
    // pode custar a entrega de quem ja pagou.
    await supabase.from('pedidos_premium').update({ email_enviado_em: null }).eq('id', pedido.id)
    await sendErrorEmail({
      endpoint,
      errorMessage: `E-mail informado depois do pagamento, mas o envio falhou. pedido=${pedido.id} token=${token}`,
    }).catch(() => {})
  }
  return ok
}
