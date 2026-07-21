import { getClientIp } from '../utils/client-ip'
import { lookupIpGeo } from '../utils/ip-geo'

export default defineEventHandler(async (event) => {
  const ip = getClientIp(event)

  if (ip === 'unknown') {
    return { uf: 'SP' }
  }

  const geo = await lookupIpGeo(ip)
  if (geo?.country === 'BR' && geo.uf) {
    return { uf: geo.uf }
  }

  return { uf: 'SP' }
})
