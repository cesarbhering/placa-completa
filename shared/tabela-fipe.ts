// Tabela FIPE pelo codigo: carros comecam com 0, motos com 8, caminhoes e
// onibus com 5. Usado no servidor (filtro do universo de candidatos) e na tela
// (nao mostrar versao de outra tabela em relatorio ja entregue).

export type TabelaFipe = 'carros' | 'motos' | 'caminhoes'

const PREFIXO_TABELA: Record<TabelaFipe, string> = { carros: '0', motos: '8', caminhoes: '5' }

/** O codigo FIPE e da tabela? Codigo fora do padrao nao e descartado. */
export function codigoDaTabela(codigo: string | null | undefined, tabela: TabelaFipe): boolean {
  const c = String(codigo ?? '').trim()
  if (!/^\d{6}-\d$/.test(c)) return true
  return c.startsWith(PREFIXO_TABELA[tabela])
}

/** Tabela pelo segmento ja decidido (server/utils/segmento.ts). */
export function tabelaDoSegmento(segmento: string | null | undefined): TabelaFipe {
  if (segmento === 'caminhao') return 'caminhoes'
  if (segmento === 'moto') return 'motos'
  return 'carros'
}
