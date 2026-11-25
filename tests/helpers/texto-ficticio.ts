// Made-up Portuguese prose for tests of long campaign texts: single spaces,
// exactly n characters, never ending in a space. Each sentence carries its
// number, so the end of a text never repeats an earlier stretch of it.
const FRASES = [
  'A peça fictícia de teste pode falhar sem aviso',
  'o motorista perde parte do controle nas curvas',
  'procure a concessionária com o chassi em mãos',
]

export function madeUpText(n: number): string {
  let t = ''
  for (let i = 0; t.length < n; i++) t += (t ? ' ' : '') + `${FRASES[i % FRASES.length]} (${i}).`
  t = t.slice(0, n)
  return t.endsWith(' ') ? `${t.slice(0, -1)}.` : t
}
