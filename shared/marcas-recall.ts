// Marcas com base de recall na /v1/recall, liberadas no SINAL GRATIS. Lista
// UNICA, usada pelo server (marcaTemRecall, server/utils/sinal-recall.ts) e
// pela tela (pages/index.vue). Marca nova = uma linha aqui + teste.
//
// Cada item e um trecho de regex casado com fronteira de palavra (\b) contra
// a marca/modelo do SENATRAN ("VW/GOL", "I/RENAULT KWID", "HONDA/CG 160"):
// o "/" e nao-palavra, entao "I/" e "/<modelo>" casam sem regra extra.
// Token curto (RAM, GM, MMC) NAO casa no meio de palavra (RAMPA, TRAMONTINA).
//
// Modo autoritativo (pago) e outra lista, em premium-processar: aqui e so o
// sinal gratis com a copy vaga.
export const MARCAS_RECALL_GRATIS: readonly string[] = [
  'toyota', 'lexus',
  'chevrolet', 'gm', 'general\\s*motors',
  'volkswagen', 'vw',
  'fiat',
  // Stellantis
  'peugeot', 'citro[eë]n', 'jeep', 'ram', 'dodge',
  'honda',
  'renault',
  'ford',
  // Mitsubishi: o SENATRAN manda "MMC/L200 TRITON"; "MITSUBISHI" por extenso tambem.
  'mitsubishi', 'mmc',
  'nissan',
  // Yamaha: motos ("YAMAHA/FACTOR YBR125", "I/YAMAHA").
  'yamaha',
]

const RE_MARCAS = new RegExp(`\\b(${MARCAS_RECALL_GRATIS.join('|')})\\b`, 'i')

/**
 * Marca "curta" pra medicao (recall_marca): a marca casada na lista quando esta
 * no escopo (ex.: "I/NISSAN FRONTIER" -> "NISSAN"), senao a primeira palavra
 * da marca sem o "I/" de importado ("KAWASAKI/NINJA" -> "KAWASAKI"). So letras,
 * maiusculas, ate 30 caracteres. Vazio -> null.
 */
export function marcaParaMedicao(marca: string | null | undefined): string | null {
  const s = String(marca || '')
  const m = s.match(RE_MARCAS)
  if (m) return m[1].toUpperCase().replace(/\s+/g, ' ').slice(0, 30)
  const primeira = s.replace(/^\s*I\s*\//i, '').split(/[\/\s]/).find(Boolean) || ''
  const limpa = primeira.toUpperCase().replace(/[^A-ZÀ-Ý-]/g, '').slice(0, 30)
  return limpa || null
}

/** A marca (texto do SENATRAN) tem base de recall no gratis? */
export function marcaTemRecallGratis(marca: string | null | undefined): boolean {
  return RE_MARCAS.test(String(marca || ''))
}
