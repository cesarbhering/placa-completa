// "Cade meu relatorio": acha o pedido de uma compra do app pelo purchaseToken.
//
// Existe porque a Play pode devolver "pendente" pro app (Pix/boleto da loja),
// o servidor concluir sozinho pela notificacao (RTDN) e consumir a compra, e o
// app nunca ficar sabendo o token de entrega. Com isto o app pergunta pelo
// comprovante que guardou e recebe o token, mesmo com a compra ja consumida.
//
// So devolve o token de entrega (ele ja e a credencial do relatorio, como no
// /verificar). O purchaseToken e a credencial daqui: longo e impossivel de chutar.

export type PedidoPlay =
  | { tipo: 'pedido'; id: string; token_entrega: string; status: string; placa: string | null }
  | { tipo: 'pendente'; compraId: string }
  | { tipo: 'cancelada' }
  | null

const CAMPOS_PEDIDO = 'id,token_entrega,status,placa'

/** Comprovante aceitavel: nao vazio e sem lixo gigante. */
export function purchaseTokenValido(v: unknown): string | null {
  const t = String(v ?? '').trim()
  return t && t.length <= 1000 ? t : null
}

// Recusas definitivas gravadas pelo concluirCompraPlay: a compra nao vai virar
// pedido, entao o app pode parar de perguntar.
function compraMorta(c: any): boolean {
  if (c?.estado_google === 'cancelada') return true
  const m = String(c?.motivo || '')
  return m.startsWith('bloqueada') || m.startsWith('pedido na Play')
}

export async function localizarPedidoPlay(supabase: any, purchaseToken: string): Promise<PedidoPlay> {
  const { data: direto } = await supabase.from('pedidos_premium')
    .select(CAMPOS_PEDIDO).eq('google_play_purchase_token', purchaseToken).maybeSingle()
  if (direto?.token_entrega) return { tipo: 'pedido', ...direto }

  const { data: compra } = await supabase.from('google_play_compras')
    .select('id,pedido_id,estado_google,motivo').eq('purchase_token', purchaseToken).maybeSingle()
  if (!compra) return null
  if (compra.pedido_id) {
    const { data: p } = await supabase.from('pedidos_premium')
      .select(CAMPOS_PEDIDO).eq('id', compra.pedido_id).maybeSingle()
    if (p?.token_entrega) return { tipo: 'pedido', ...p }
  }
  if (compraMorta(compra)) return { tipo: 'cancelada' }
  return { tipo: 'pendente', compraId: compra.id }
}

/**
 * E-mail digitado no app pra uma compra que ainda nao virou pedido: fica na
 * compra, e o pedido nasce com ele (concluirCompraPlay le linha.email), entao a
 * entrega normal ja manda o relatorio. So preenche se estava vazio.
 */
export async function gravarEmailNaCompra(supabase: any, compraId: string, email: string): Promise<boolean> {
  const { data } = await supabase.from('google_play_compras')
    .update({ email, atualizado_em: new Date().toISOString() })
    .eq('id', compraId).is('email', null).select('id')
  return !!data?.length
}

/** Contrato HTTP comum ao GET e ao POST. So o token sai daqui, nunca dado do relatorio. */
export function responderPedidoPlay(event: any, achado: PedidoPlay): Record<string, any> {
  if (achado?.tipo === 'pedido') return { token_entrega: achado.token_entrega, status: achado.status, placa: achado.placa }
  if (achado?.tipo === 'pendente') { setResponseStatus(event, 202); return { pendente: true } }
  if (achado?.tipo === 'cancelada') { setResponseStatus(event, 410); return { cancelada: true } }
  throw createError({ statusCode: 404, message: 'Compra nao encontrada' })
}
