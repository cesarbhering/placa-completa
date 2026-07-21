import { getClientIp } from '../utils/client-ip'

export default defineEventHandler(async (event) => {
  const ip = getClientIp(event)

  if (ip === 'unknown') {
    return { uf: 'SP' }
  }

  try {
    const geo = await $fetch<{ countryCode?: string; region?: string; status?: string }>(
      `http://ip-api.com/json/${ip}?fields=status,countryCode,region`,
      { timeout: 3000 }
    )

    // So usa a regiao quando o IP e brasileiro: pra visitante estrangeiro o
    // ip-api devolve codigo de regiao do pais dele (ex: "GES" na Franca),
    // que nao existe no select de UFs.
    if (geo?.status === 'success' && geo.countryCode === 'BR' && geo.region) {
      return { uf: geo.region }
    }
  } catch {
    // Fallback silently
  }

  return { uf: 'SP' }
})
