/**
 * Celular pelo User-Agent, mesma regra de server/utils/dispositivo.ts:
 * tablet (iPad, Android sem "mobile") NAO e celular. `mobileHint` e o
 * navigator.userAgentData.mobile quando o navegador expoe.
 * (Veio de shared/ab-checkout.ts, aposentado em 10/nov/2026.)
 */
export function ehCelular(ua: string, mobileHint?: boolean): boolean {
  const u = String(ua || '').toLowerCase()
  if (/ipad|tablet|kindle|silk/.test(u) || (/android/.test(u) && !/mobile/.test(u))) return false
  return mobileHint === true || /mobile|iphone|ipod|android/.test(u)
}
