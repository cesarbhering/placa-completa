// Consulta de pedido do agente: SO LEITURA. Devolve fatos minimos; o link do
// relatorio so sai quando o dono foi comprovado (e-mail do pedido ou CPF/CNPJ
// do pagador conferido por hash). Nunca devolve e-mail, hash ou dado do pagador.

export interface FatoPedido {
  placa: string
  plano: string | null
  status: string
  pago: boolean
  entregue: boolean
  pago_em: string | null
  entregue_em: string | null
  tem_email: boolean
  dono_comprovado: boolean
  /** So com dono comprovado. */
  link?: string
}

export interface ConsultaPedido { email?: string; placa?: string; token?: string; docHash?: string | null; pedidoComprovadoId?: string | null }

const soPlaca = (p: string) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const soEmail = (e: string) => String(e || '').trim().toLowerCase()

export function linkRelatorio(token: string): string {
  return `https://placacompleta.com.br/premium/${token}`
}

/** Decide o que o agente pode ver de UM pedido. Puro (testado sem banco). */
export function fatoDoPedido(p: any, c: ConsultaPedido): FatoPedido & { id: string } {
  const email = soEmail(c.email || '')
  const emailConfere = !!email && !!p.email && soEmail(p.email) === email
  const docConfere = !!c.docHash && !!p.pagador_hash && c.docHash === p.pagador_hash
  const tokenConfere = !!c.token && c.token === p.token_entrega
  const jaComprovado = !!c.pedidoComprovadoId && c.pedidoComprovadoId === p.id
  // Token do link: quem tem o link ja tem o relatorio; nao e prova de dono,
  // mas reenviar o mesmo link nao revela nada novo.
  const dono = emailConfere || docConfere || jaComprovado || tokenConfere
  const entregue = p.status === 'entregue'
  return {
    id: p.id,
    placa: p.placa,
    plano: p.plano ?? null,
    status: p.status,
    pago: !!p.pago_em || entregue,
    entregue,
    pago_em: p.pago_em ?? null,
    entregue_em: p.entregue_em ?? null,
    tem_email: !!p.email,
    dono_comprovado: dono,
    ...(dono && entregue && p.token_entrega ? { link: linkRelatorio(p.token_entrega) } : {}),
  }
}

const COLS = 'id,placa,plano,status,pago_em,entregue_em,email,token_entrega,pagador_hash,criado_em'

/** Busca por token, e-mail ou placa (ultimos 60 dias, 5 mais recentes). */
export async function consultarPedidos(supabase: any, c: ConsultaPedido): Promise<(FatoPedido & { id: string })[]> {
  const desde = new Date(Date.now() - 60 * 86400_000).toISOString()
  let q = supabase.from('pedidos_premium').select(COLS).gte('criado_em', desde).order('criado_em', { ascending: false }).limit(5)
  if (c.token) q = q.eq('token_entrega', c.token)
  else if (c.placa) q = q.eq('placa', soPlaca(c.placa))
  else if (c.email) q = q.eq('email', soEmail(c.email))
  else return []
  const { data, error } = await q
  if (error || !Array.isArray(data)) return []
  // Pedido que nunca foi pago (Pix gerado e abandonado) so confunde: fica de fora
  // quando ha algum pago.
  const lista = data.map((p: any) => fatoDoPedido(p, c))
  const pagos = lista.filter((f) => f.pago)
  return pagos.length ? pagos : lista.slice(0, 1)
}

/** Texto do resultado que volta pro agente (sem id interno). */
export function resultadoParaAgente(fatos: (FatoPedido & { id: string })[], c: ConsultaPedido): string {
  if (!fatos.length) return 'Consulta de pedido: nenhum pedido encontrado com os dados informados.'
  // Sem dono comprovado o agente nao sabe se foi pago nem entregue: so que
  // existe pedido pra placa e se ele tem e-mail.
  const linhas = fatos.map(({ id: _id, ...f }) => JSON.stringify(f.dono_comprovado ? f : { placa: f.placa, encontrado: true, tem_email: f.tem_email, dono_comprovado: false }))
  const doc = c.docHash ? (fatos.some((f) => f.dono_comprovado) ? ' O CPF/CNPJ informado CONFERE com o pagador.' : ' O CPF/CNPJ informado NAO confere com o pagador.') : ''
  return `Consulta de pedido (${fatos.length}):${doc}\n${linhas.join('\n')}`
}
