// Regras de quem pode baixar o edital de um leilao, separadas do endpoint pra
// poderem ser testadas.
//
// O edital e documento publico do orgao de transito, mas o LINK nao: ele e
// assinado, vale 24h e sai de uma API que cobra por chave. Entao a pergunta que
// importa nao e "este edital existe?", e sim "este relatorio tem direito a
// ele?". Sem isso, um edital_ref copiado de um relatorio viraria download livre
// pra qualquer um com um token de outro pedido.

/** Quantos links por relatorio por hora. Um clique legitimo gera um; o resto e ruido. */
export const TETO_POR_TOKEN = 10
const JANELA_MS = 60 * 60 * 1000

const usos = new Map<string, { desde: number; n: number }>()

export function dentroDoTetoDeEdital(token: string, agora = Date.now()): boolean {
  if (!token) return false
  const atual = usos.get(token)
  if (!atual || agora - atual.desde >= JANELA_MS) {
    usos.set(token, { desde: agora, n: 1 })
    return true
  }
  atual.n += 1
  return atual.n <= TETO_POR_TOKEN
}

/** So pra teste. */
export function _limparTetoDeEdital() {
  usos.clear()
}

/**
 * O edital_ref precisa pertencer a uma passagem DESTE relatorio. Aceitar um ref
 * solto transformaria o nosso endpoint num proxy de download pra base inteira
 * de editais, pago pela nossa chave.
 */
export function refPertenceAoRelatorio(snapshot: any, ref: string): boolean {
  if (!ref) return false
  const passagens = snapshot?.historicoLeilao?.passagens
  if (!Array.isArray(passagens)) return false
  return passagens.some((p: any) => p?.edital_disponivel && p?.edital_ref && String(p.edital_ref) === ref)
}

/** Relatorio que ainda nao foi entregue nao tem edital nenhum pra oferecer. */
export function relatorioPodeBaixarEdital(pedido: { status?: string | null; plano?: string | null } | null): boolean {
  if (!pedido) return false
  // Mesma muralha do historico de leilao: e conteudo da completa.
  if (String(pedido.plano || 'completa') !== 'completa') return false
  return ['pago', 'consultando', 'entregue'].includes(String(pedido.status || ''))
}
