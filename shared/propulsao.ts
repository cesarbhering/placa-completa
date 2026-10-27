// Hibrido NAO e eletrico (Cesar, 22/out/2026; caso THX8888, "I/GWM HAVAL H6
// HEV2"). HEV (Hybrid Electric Vehicle), PHEV (plug-in), MHEV e o "DM-i" da BYD
// sao hibridos: tem motor a combustao. So BEV (100% eletrico) e eletrico.
// Usado onde o relatorio decide "eletrico" (categoria do seguro, funil FIPE).

const RE_HIBRIDO = /\b(P?HEV\d*|MHEV|HIBRID\w*|H[IÍ]BRID\w*|HYBRID\w*|DM-?I)\b/i
const RE_ELETRICO = /el[eé]tric|electric|\bBEV\b|\bEV\b/i

/** Texto (nome, combustivel ou modelo FIPE) diz hibrido? */
export function ehHibrido(...textos: unknown[]): boolean {
  return textos.some((t) => RE_HIBRIDO.test(String(t ?? '')))
}

/** 100% eletrico (BEV): diz eletrico e NAO diz hibrido em nenhum dos textos. */
export function ehEletricoPuro(...textos: unknown[]): boolean {
  if (ehHibrido(...textos)) return false
  return textos.some((t) => RE_ELETRICO.test(String(t ?? '')))
}

/** 'eletrico' | 'hibrido' | null a partir de nome/combustivel/modelo FIPE. */
export function propulsao(...textos: unknown[]): 'eletrico' | 'hibrido' | null {
  if (ehHibrido(...textos)) return 'hibrido'
  return ehEletricoPuro(...textos) ? 'eletrico' : null
}
