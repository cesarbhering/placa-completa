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
  // Chevrolet: o SENATRAN manda "CHEVROLET/..." e TAMBEM "CHEV/..." (288 placas
  // em 30 dias, mais que CHEVROLET). \bchev\b nao casa CHEVY/CHEVALIER.
  'chevrolet', 'chev', 'gm', 'general\\s*motors',
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
  // Mercedes-Benz (carros, vans, caminhoes e onibus): o SENATRAN manda
  // "M.BENZ/...", "MBENZ", "I/M.BENZ", "MERCEDES-BENZ".
  'm\\.?\\s*benz', 'mercedes',
  // Hyundai: "HYUNDAI/HB20", "I/HYUNDAI", "CAOA HYUNDAI".
  'hyundai',
  'iveco',
  // Proximas (base ainda nao no ar): 'bmw', 'audi', 'land\\s*rover', 'jaguar', 'porsche', 'volvo'
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
  if (m) return normalizarMarcaRecall(m[1].toUpperCase().replace(/\s+/g, ' ')).slice(0, 30)
  const primeira = s.replace(/^\s*I\s*\//i, '').split(/[\/\s]/).find(Boolean) || ''
  const limpa = primeira.toUpperCase().replace(/[^A-ZÀ-Ý-]/g, '').slice(0, 30)
  return limpa || null
}

/**
 * Marcas com modo AUTORITATIVO no pago (status por chassi na montadora, via
 * leiloes-api): GM/Chevrolet (inclui "CHEV"), VW, Fiat e Stellantis. Usado por
 * premium-processar e pelo backfill de recall (antes cada um tinha a regex copiada).
 */
const RE_AUTORITATIVO = /\b(chevrolet|chev|gm|general\s*motors|volkswagen|vw|fiat|peugeot|citro[eë]n|jeep|ram|dodge)\b/i
export function marcaTemAutoritativo(desc: string | null | undefined): boolean {
  return RE_AUTORITATIVO.test(String(desc || ''))
}

/**
 * Normaliza a marca do SENATRAN antes de mandar pra /v1/recall: "CHEV" vira
 * "CHEVROLET" ("CHEV/ONIX" -> "CHEVROLET/ONIX", "I/CHEV X" -> "I/CHEVROLET X").
 * O resto passa igual. (A leiloes-api tambem ganha o alias; aqui e a defesa.)
 */
export function normalizarMarcaRecall(marca: string | null | undefined): string {
  return String(marca || '').replace(/\bchev\b/gi, 'CHEVROLET')
}

/** A marca (texto do SENATRAN) tem base de recall no gratis? */
export function marcaTemRecallGratis(marca: string | null | undefined): boolean {
  return RE_MARCAS.test(String(marca || ''))
}
