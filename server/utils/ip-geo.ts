/**
 * Lookup de geolocalizacao por IP via ip-api.com (free tier, 45 req/min).
 * Cache em memoria por IP (1h) — o mesmo visitante gera 2+ lookups em
 * sequencia (GET /api/geo no load da home + POST /api/consulta), o cache
 * colapsa tudo em 1 chamada externa.
 *
 * Fail-open: timeout/erro retorna null e o chamador segue sem geo.
 */

export interface IpGeo {
  city: string | null
  uf: string | null
  country: string | null   // ISO-2, ex 'BR'
}

const cache = new Map<string, { geo: IpGeo | null; expiresAt: number }>()
const TTL = 60 * 60 * 1000
const CACHE_MAX = 5000

export async function lookupIpGeo(ip: string): Promise<IpGeo | null> {
  if (!ip || ip === 'unknown') return null

  const cached = cache.get(ip)
  if (cached && cached.expiresAt > Date.now()) return cached.geo

  let geo: IpGeo | null = null
  try {
    const res = await $fetch<{
      status?: string; countryCode?: string; region?: string; city?: string
    }>(`http://ip-api.com/json/${ip}?fields=status,countryCode,region,city`, { timeout: 2000 })

    if (res?.status === 'success') {
      geo = {
        city: res.city || null,
        uf: res.region || null,
        country: res.countryCode || null,
      }
    }
  } catch {
    geo = null
  }

  if (cache.size >= CACHE_MAX) cache.clear()
  cache.set(ip, { geo, expiresAt: Date.now() + TTL })
  return geo
}
