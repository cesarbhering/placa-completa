import { getClientIp } from '../utils/client-ip'

export default defineEventHandler(async (event) => {
  const ip = getClientIp(event)

  if (ip === 'unknown') {
    return { uf: 'SP' }
  }

  try {
    const geo = await $fetch<{ regionName?: string; region?: string; status?: string }>(
      `http://ip-api.com/json/${ip}?fields=status,region,regionName`,
      { timeout: 3000 }
    )

    if (geo?.status === 'success' && geo.region) {
      return { uf: geo.region }
    }
  } catch {
    // Fallback silently
  }

  return { uf: 'SP' }
})
