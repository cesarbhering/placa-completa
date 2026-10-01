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
  // Proximas (base ainda nao no ar): 'nissan', 'yamaha'
]

const RE_MARCAS = new RegExp(`\\b(${MARCAS_RECALL_GRATIS.join('|')})\\b`, 'i')

/** A marca (texto do SENATRAN) tem base de recall no gratis? */
export function marcaTemRecallGratis(marca: string | null | undefined): boolean {
  return RE_MARCAS.test(String(marca || ''))
}
