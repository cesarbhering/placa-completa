// Aviso "Seu relatorio esta pronto" (RelatoriosProntos.vue): regras puras de
// quando ele aparece. A fonte e o historico local (useConsultaHistory): item
// entregue com `aberto === false` e um relatorio pago que a pessoa ainda nao
// abriu neste aparelho.
import type { ConsultaLocal } from '../composables/useConsultaHistory'
import { relatorioPendente } from '../composables/useConsultaHistory'
import { caminhoPt } from './idiomas'

export { relatorioPendente }

/** Chave em sessionStorage: tokens que ja apareceram no aviso nesta sessao. */
export const CHAVE_AVISO_MOSTRADOS = 'pc_aviso_prontos_mostrados'

/** Status que ainda podem virar "entregue" sem a pessoa abrir a pagina. */
export const STATUS_A_CAMINHO = ['pago', 'consultando']

export function relatoriosPendentes(itens: ConsultaLocal[]): ConsultaLocal[] {
  return itens.filter(relatorioPendente)
}

/** Itens nao abertos que valem uma pergunta ao servidor pelo status atual. */
export function aConferir(itens: ConsultaLocal[]): ConsultaLocal[] {
  return itens.filter((it) => it.aberto === false && STATUS_A_CAMINHO.includes(it.status))
}

/** Pagina do proprio relatorio, area de compra e telas internas: sem aviso. */
export function rotaSemAviso(path: string): boolean {
  const p = caminhoPt(String(path || '/'))
  return p.startsWith('/premium') || p.startsWith('/admin') || p.startsWith('/dash')
}

export interface ContextoAviso {
  itens: ConsultaLocal[]
  path: string
  /** App (Capacitor) ou site no celular. Desktop e tablet: nunca. */
  elegivel: boolean
  /** Checkout do app aberto: ele mesmo leva a pessoa ao relatorio. */
  checkoutAberto?: boolean
  /** Tokens que ja apareceram no aviso nesta sessao. */
  jaMostrados: string[]
}

/**
 * Tokens novos para o aviso: pendentes que ainda nao apareceram nesta sessao.
 * Vazio = nao abrir. Um item que chega depois (rodada da recuperacao do Play)
 * abre o aviso de novo, mesmo que outro ja tenha sido mostrado.
 */
export function tokensParaAvisar(c: ContextoAviso): string[] {
  if (!c.elegivel || c.checkoutAberto || rotaSemAviso(c.path)) return []
  const vistos = new Set(c.jaMostrados)
  return relatoriosPendentes(c.itens).map((it) => it.token).filter((t) => !vistos.has(t))
}

export function lerMostrados(store: Pick<Storage, 'getItem'> | null): string[] {
  try {
    const arr = JSON.parse(store?.getItem(CHAVE_AVISO_MOSTRADOS) || '[]')
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function gravarMostrados(store: Pick<Storage, 'setItem'> | null, tokens: string[]) {
  try { store?.setItem(CHAVE_AVISO_MOSTRADOS, JSON.stringify([...new Set(tokens)].slice(-50))) } catch { /* modo privado: fica so em memoria */ }
}
