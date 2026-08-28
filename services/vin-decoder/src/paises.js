// Faixas de pais por WMI (ISO 3780) — fallback pra quando o WMI exato nao
// esta na tabela `wmi` nem nos overrides. Sem isso, chassi argentino como o
// 8AW da SpaceFox saia com pais null e so "America do Sul" na regiao.
//
// Fonte: tabela de WMI por pais da Wikipedia (artigo Vehicle identification
// number, secao World manufacturer identifier), que reproduz a ISO 3780.
// So as faixas 8x/9x (America do Sul) entram aqui: sao as que aparecem em
// relatorio brasileiro e as unicas que conferi na fonte. Faixa sem fonte
// conferida NAO entra: pais errado e pior que pais nenhum.
const FAIXAS = [
  ['8', 'A', 'E', 'Argentina'],
  ['8', 'F', 'G', 'Chile'],
  ['8', 'L', 'N', 'Equador'],
  ['8', 'S', 'W', 'Peru'],
  ['8', 'X', 'Z', 'Venezuela'],
  ['8', '2', '2', 'Bolívia'],
  ['8', '4', '4', 'Costa Rica'],
  ['9', 'A', 'E', 'Brasil'],
  ['9', 'F', 'G', 'Colômbia'],
  ['9', 'S', 'V', 'Uruguai'],
  // 91-99 e 90 tambem sao Brasil (a fonte escreve a faixa como "91-90").
  ['9', '1', '9', 'Brasil'],
  ['9', '0', '0', 'Brasil'],
]

/** Pais provavel pelos 2 primeiros caracteres do WMI, ou null se fora das faixas conferidas. */
export function paisPorFaixaWmi(wmi) {
  const s = String(wmi || '').toUpperCase()
  if (s.length < 2) return null
  const [c1, c2] = [s[0], s[1]]
  for (const [prefixo, de, ate, pais] of FAIXAS) {
    if (c1 === prefixo && c2 >= de && c2 <= ate) return pais
  }
  return null
}
