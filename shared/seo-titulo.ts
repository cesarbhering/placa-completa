// Titles das paginas (auditoria Ahrefs, 08/out: ~120 paginas com 71 a 126
// caracteres, cortados no Google).
//
// Regra: 50 a 60 caracteres NO TOTAL, contando a marca. O sufixo
// " | PlacaCompleta" entra so quando cabe; senao o title vai sem ele (a marca
// ja aparece no site e no snippet). Palavra-chave no comeco, sem travessao.
//
// Como o modulo de SEO anexa o sufixo sozinho, quem usa estas funcoes devolve
// o title FINAL e desliga o template (titleTemplate: '%s').

export const SUFIXO_MARCA = ' | PlacaCompleta'
export const TITULO_MIN = 50
export const TITULO_MAX = 60

function cortar(texto: string): string {
  if (texto.length <= TITULO_MAX) return texto
  const corte = texto.slice(0, TITULO_MAX + 1)
  const fim = corte.lastIndexOf(' ')
  return corte.slice(0, fim > 30 ? fim : TITULO_MAX).replace(/[\s:,;.-]+$/, '')
}

/**
 * Title final a partir de variantes em ordem de preferencia (da mais completa
 * pra mais curta). A primeira variante que cair na faixa de 50 a 60 vence:
 * com o sufixo da marca se couber, senao sozinha. Nenhuma na faixa: a primeira
 * que caiba em 60 com sufixo, depois sem; por ultimo corta na palavra.
 */
export function escolherTitulo(variantes: string[]): string {
  const vs = variantes.map((v) => String(v || '').trim()).filter(Boolean)
  const naFaixa = (t: string) => t.length >= TITULO_MIN && t.length <= TITULO_MAX
  for (const v of vs) {
    if (naFaixa(v + SUFIXO_MARCA)) return v + SUFIXO_MARCA
    if (naFaixa(v)) return v
  }
  for (const v of vs) if ((v + SUFIXO_MARCA).length <= TITULO_MAX) return v + SUFIXO_MARCA
  const cabe = vs.find((v) => v.length <= TITULO_MAX)
  return cabe ?? cortar(vs[vs.length - 1] || '')
}

/** Title final ja na faixa? */
export function tituloNaFaixa(titulo: string): boolean {
  return titulo.length >= TITULO_MIN && titulo.length <= TITULO_MAX
}

// "no Rio Grande do Norte", "na Bahia", "em Alagoas": preposicao de cada UF.
const NA = new Set(['BA', 'PB'])
const NO = new Set(['AC', 'AP', 'AM', 'CE', 'DF', 'ES', 'MA', 'MT', 'MS', 'PA', 'PI', 'PR', 'RJ', 'RN', 'RS', 'TO'])
export function emEstado(uf: string, nome: string): string {
  if (NA.has(uf)) return `na ${nome}`
  if (NO.has(uf)) return `no ${nome}`
  return `em ${nome}`
}
