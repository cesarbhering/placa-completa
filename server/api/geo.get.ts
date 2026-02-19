export default defineEventHandler(async (event) => {
  const headers = getRequestHeaders(event)
  const ip = headers['x-forwarded-for']?.split(',')[0]?.trim()
    || headers['x-real-ip']
    || ''

  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'unknown') {
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
