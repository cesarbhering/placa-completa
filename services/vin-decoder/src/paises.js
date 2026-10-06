// Faixas de pais por WMI (ISO 3780): fallback pra quando o WMI exato nao esta
// na tabela `wmi` (vPIC), nos overrides BR nem na tabela curada do mundo
// (scripts/wmi-mundo.mjs). Sem isso, chassi japones de exportacao (JMY, da
// Mitsubishi pra America do Sul) saia com pais null num relatorio pago.
//
// Fonte: grade "WMI Regions" de Wikibooks, Vehicle Identification Numbers
// (VIN codes)/World Manufacturer Identifier (WMI), que reproduz a ISO 3780
// (https://standards.iso.org/iso/3780/). Gerada por programa a partir do
// wikitext (01/out/2026), sem digitacao manual. Faixa marcada na fonte so com
// a regiao generica ("Asia", "Africa", "South America"...) NAO entra: pais
// errado e pior que pais nenhum.
//
// ATENCAO na ordem: na ISO 3780 o 2o caractere vai A..Z (sem I, O, Q), depois
// 1..9 e por ultimo 0. A comparacao e por indice nessa ordem, nunca por codigo
// de caractere ("9 1-0 = Brasil" cobre 91..99 E 90).
const ORDEM = 'ABCDEFGHJKLMNPRSTUVWXYZ1234567890'

const FAIXAS = [
  ['A', 'A', 'H', 'África do Sul'],
  ['A', 'J', 'K', 'Costa do Marfim'],
  ['A', 'L', 'M', 'Lesoto'],
  ['A', 'N', 'P', 'Botsuana'],
  ['A', 'R', 'S', 'Namíbia'],
  ['A', 'T', 'U', 'Madagascar'],
  ['A', 'V', 'W', 'Maurício'],
  ['A', 'X', 'Y', 'Tunísia'],
  ['A', 'Z', '1', 'Chipre'],
  ['A', '2', '3', 'Zimbábue'],
  ['A', '4', '5', 'Moçambique'],
  ['B', 'A', 'B', 'Angola'],
  ['B', 'C', 'C', 'Etiópia'],
  ['B', 'F', 'G', 'Quênia'],
  ['B', 'H', 'H', 'Ruanda'],
  ['B', 'L', 'L', 'Nigéria'],
  ['B', 'R', 'R', 'Argélia'],
  ['B', 'T', 'T', 'Essuatíni'],
  ['B', 'U', 'U', 'Uganda'],
  ['B', '3', '4', 'Líbia'],
  ['C', 'A', 'B', 'Egito'],
  ['C', 'F', 'G', 'Marrocos'],
  ['C', 'L', 'M', 'Zâmbia'],
  ['E', 'A', '0', 'Rússia'],
  ['H', 'A', '0', 'China'],
  ['J', 'A', '0', 'Japão'],
  ['K', 'F', 'H', 'Israel'],
  ['K', 'L', 'R', 'Coreia do Sul'],
  ['K', 'S', 'T', 'Jordânia'],
  ['K', '1', '3', 'Coreia do Sul'],
  ['K', '5', '5', 'Quirguistão'],
  ['L', 'A', '0', 'China'],
  ['M', 'A', 'E', 'Índia'],
  ['M', 'F', 'K', 'Indonésia'],
  ['M', 'L', 'R', 'Tailândia'],
  ['M', 'S', 'S', 'Mianmar'],
  ['M', 'U', 'U', 'Mongólia'],
  ['M', 'X', 'X', 'Cazaquistão'],
  ['M', 'Y', '0', 'Índia'],
  ['N', 'A', 'E', 'Irã'],
  ['N', 'F', 'G', 'Paquistão'],
  ['N', 'J', 'J', 'Iraque'],
  ['N', 'L', 'R', 'Turquia'],
  ['N', 'S', 'T', 'Uzbequistão'],
  ['N', 'V', 'V', 'Azerbaijão'],
  ['N', 'X', 'X', 'Tadjiquistão'],
  ['N', 'Y', 'Y', 'Armênia'],
  ['N', '1', '5', 'Irã'],
  ['N', '7', '8', 'Turquia'],
  ['P', 'A', 'C', 'Filipinas'],
  ['P', 'F', 'G', 'Singapura'],
  ['P', 'L', 'R', 'Malásia'],
  ['P', 'S', 'T', 'Bangladesh'],
  ['P', '5', '0', 'Índia'],
  ['R', 'A', 'B', 'Emirados Árabes Unidos'],
  ['R', 'F', 'K', 'Taiwan'],
  ['R', 'L', 'N', 'Vietnã'],
  ['R', 'P', 'P', 'Laos'],
  ['R', 'S', 'T', 'Arábia Saudita'],
  ['R', 'U', 'W', 'Rússia'],
  ['R', '1', '7', 'Hong Kong'],
  ['S', 'A', 'M', 'Reino Unido'],
  ['S', 'N', 'T', 'Alemanha'],
  ['S', 'U', 'Z', 'Polônia'],
  ['S', '1', '2', 'Letônia'],
  ['S', '3', '3', 'Geórgia'],
  ['S', '4', '4', 'Islândia'],
  ['T', 'A', 'H', 'Suíça'],
  ['T', 'J', 'P', 'República Tcheca'],
  ['T', 'R', 'V', 'Hungria'],
  ['T', 'W', '2', 'Portugal'],
  ['T', '3', '5', 'Sérvia'],
  ['T', '6', '6', 'Andorra'],
  ['T', '7', '8', 'Países Baixos'],
  ['U', 'A', 'C', 'Espanha'],
  ['U', 'H', 'M', 'Dinamarca'],
  ['U', 'N', 'R', 'Irlanda'],
  ['U', 'U', 'X', 'Romênia'],
  ['U', '1', '2', 'Macedônia do Norte'],
  ['U', '5', '7', 'Eslováquia'],
  ['U', '8', '0', 'Bósnia e Herzegovina'],
  ['V', 'A', 'E', 'Áustria'],
  ['V', 'F', 'R', 'França'],
  ['V', 'S', 'W', 'Espanha'],
  ['V', 'X', '2', 'França'],
  ['V', '3', '5', 'Croácia'],
  ['V', '6', '8', 'Estônia'],
  ['W', 'A', '0', 'Alemanha'],
  ['X', 'A', 'C', 'Bulgária'],
  ['X', 'D', 'E', 'Rússia'],
  ['X', 'F', 'H', 'Grécia'],
  ['X', 'J', 'K', 'Rússia'],
  ['X', 'L', 'R', 'Países Baixos'],
  ['X', 'S', 'W', 'Rússia'],
  ['X', 'X', 'Y', 'Luxemburgo'],
  ['X', 'Z', '0', 'Rússia'],
  ['Y', 'A', 'E', 'Bélgica'],
  ['Y', 'F', 'K', 'Finlândia'],
  ['Y', 'N', 'N', 'Malta'],
  ['Y', 'S', 'W', 'Suécia'],
  ['Y', 'X', '2', 'Noruega'],
  ['Y', '3', '5', 'Belarus'],
  ['Y', '6', '8', 'Ucrânia'],
  ['Z', 'A', 'U', 'Itália'],
  ['Z', 'X', 'Z', 'Eslovênia'],
  ['Z', '1', '1', 'San Marino'],
  ['Z', '3', '5', 'Lituânia'],
  ['Z', '6', '0', 'Rússia'],
  ['1', 'A', '0', 'Estados Unidos'],
  ['2', 'A', '5', 'Canadá'],
  ['3', 'A', 'X', 'México'],
  ['3', '4', '4', 'Nicarágua'],
  ['3', '5', '5', 'República Dominicana'],
  ['3', '6', '6', 'Honduras'],
  ['3', '7', '7', 'Panamá'],
  ['3', '8', '9', 'Porto Rico'],
  ['4', 'A', '0', 'Estados Unidos'],
  ['5', 'A', '0', 'Estados Unidos'],
  ['6', 'A', 'X', 'Austrália'],
  ['6', 'Y', '1', 'Nova Zelândia'],
  ['7', 'A', 'E', 'Nova Zelândia'],
  ['7', 'F', '0', 'Estados Unidos'],
  ['8', 'A', 'E', 'Argentina'],
  ['8', 'F', 'G', 'Chile'],
  ['8', 'L', 'N', 'Equador'],
  ['8', 'S', 'T', 'Peru'],
  ['8', 'X', 'Z', 'Venezuela'],
  ['8', '2', '2', 'Bolívia'],
  ['8', '4', '4', 'Costa Rica'],
  ['9', 'A', 'E', 'Brasil'],
  ['9', 'F', 'G', 'Colômbia'],
  ['9', 'S', 'V', 'Uruguai'],
  ['9', '1', '0', 'Brasil'],
]

/** Pais provavel pelos 2 primeiros caracteres do WMI, ou null se fora das faixas da ISO 3780. */
export function paisPorFaixaWmi(wmi) {
  const s = String(wmi || '').toUpperCase()
  if (s.length < 2) return null
  const c1 = s[0]
  const i2 = ORDEM.indexOf(s[1])
  if (i2 < 0) return null
  for (const [prefixo, de, ate, pais] of FAIXAS) {
    if (c1 === prefixo && i2 >= ORDEM.indexOf(de) && i2 <= ORDEM.indexOf(ate)) return pais
  }
  return null
}

/**
 * O digito verificador (posicao 9) so e obrigatorio pra VIN da America do
 * Norte (EUA, Canada, Mexico: 1o caractere 1-5) e dos EUA na faixa 7F-70.
 * Fora disso a montadora nao e obrigada a calcular: o resultado do calculo
 * nao diz nada sobre o chassi estar certo ou errado.
 */
export function checksumAplicavel(vin) {
  const s = String(vin || '').toUpperCase()
  if (/^[1-5]/.test(s)) return true
  if (s[0] === '7') return ORDEM.indexOf(s[1]) >= ORDEM.indexOf('F')
  return false
}

// Nomes de pais do vPIC/NHTSA (tabela `wmi`, coluna country) em portugues.
// Lista fechada com os 53 valores distintos da base em 06/out/2026. Sem isso o
// relatorio recebia "ITALY", "UNITED STATES (USA)", "UNITED KINGDOM (UK)".
export const PAISES_VPIC_PT = {
  'UNITED STATES (USA)': 'Estados Unidos', 'UNITED STATES': 'Estados Unidos', USA: 'Estados Unidos',
  CHINA: 'China', CANADA: 'Canadá', MEXICO: 'México', JAPAN: 'Japão', GERMANY: 'Alemanha',
  'UNITED KINGDOM (UK)': 'Reino Unido', 'UNITED KINGDOM': 'Reino Unido', ENGLAND: 'Inglaterra',
  ITALY: 'Itália', 'HONG KONG': 'Hong Kong', TAIWAN: 'Taiwan', 'SOUTH KOREA': 'Coreia do Sul',
  THAILAND: 'Tailândia', FRANCE: 'França', BRAZIL: 'Brasil', VIETNAM: 'Vietnã', SWEDEN: 'Suécia',
  AUSTRALIA: 'Austrália', SPAIN: 'Espanha', 'SOUTH AFRICA': 'África do Sul', INDIA: 'Índia',
  TURKEY: 'Turquia', DENMARK: 'Dinamarca', BELGIUM: 'Bélgica', ARGENTINA: 'Argentina',
  URUGUAY: 'Uruguai', RUSSIA: 'Rússia', POLAND: 'Polônia', NORWAY: 'Noruega',
  SWITZERLAND: 'Suíça', 'SAUDI ARABIA': 'Arábia Saudita', 'PUERTO RICO': 'Porto Rico',
  'NEW ZEALAND': 'Nova Zelândia', NETHERLANDS: 'Países Baixos', FINLAND: 'Finlândia',
  ESTONIA: 'Estônia', 'CZECH REPUBLIC': 'República Tcheca', SLOVENIA: 'Eslovênia',
  SINGAPORE: 'Singapura', SERBIA: 'Sérvia', ROMANIA: 'Romênia', PORTUGAL: 'Portugal',
  PHILIPPINES: 'Filipinas', 'NORTH MACEDONIA': 'Macedônia do Norte', LUXEMBOURG: 'Luxemburgo',
  ISRAEL: 'Israel', IRELAND: 'Irlanda', INDONESIA: 'Indonésia', HUNGARY: 'Hungria',
  COLOMBIA: 'Colômbia', AUSTRIA: 'Áustria', SLOVAKIA: 'Eslováquia',
}

/**
 * Pais do vPIC em portugues. Nome fora do mapa: devolve null pro chamador cair
 * na faixa ISO 3780 (ja em PT) em vez de mostrar ingles cru.
 */
export function paisVpicPt(bruto) {
  const s = String(bruto || '').trim().toUpperCase()
  return s ? PAISES_VPIC_PT[s] || null : null
}
