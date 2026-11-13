/**
 * Geolocalizacao do visitante: pais, UF e cidade.
 *
 * 1) Cabecalhos de localizacao da CDN, quando vierem (cf-ipcountry,
 *    cf-region-code, cf-ipcity). Nada sai do servidor: a borda ja sabe onde o
 *    visitante esta e manda junto com a requisicao.
 * 2) So quando eles nao vierem: lookup por IP via ip-api.com (free tier, 45
 *    req/min), com o IP validado (server/utils/client-ip.ts). Cache em memoria
 *    por IP (1h) — o mesmo visitante gera 2+ lookups em sequencia (GET /api/geo
 *    no load da home + POST /api/consulta), o cache colapsa tudo em 1 chamada
 *    externa.
 *
 * O formato de retorno e o mesmo nos dois caminhos.
 * Fail-open: timeout/erro retorna null e o chamador segue sem geo.
 */
import type { H3Event } from 'h3'
import { normalizarIp } from './client-ip'

export interface IpGeo {
  city: string | null
  uf: string | null
  country: string | null   // ISO-2, ex 'BR'
}

const cache = new Map<string, { geo: IpGeo | null; expiresAt: number }>()
const TTL = 60 * 60 * 1000
const CACHE_MAX = 5000

// A CDN manda 'XX' quando nao sabe o pais e 'T1' pra rede Tor.
const PAIS_INDEFINIDO = new Set(['XX', 'T1'])
// Cabecalhos que so existem com a localizacao do visitante LIGADA na CDN. O
// cf-ipcountry sozinho chega mesmo com ela desligada, e ai ele nao basta:
// usar so o pais faria a UF e a cidade sumirem. Com qualquer um destes
// presente, o que a CDN nao souber (cidade, regiao) fica null e pronto.
const SO_COM_LOCALIZACAO_LIGADA = [
  'cf-region-code', 'cf-ipcity', 'cf-region', 'cf-ipcontinent', 'cf-timezone',
  'cf-iplatitude', 'cf-iplongitude', 'cf-postal-code', 'cf-metro-code',
]

/** Texto de cabecalho: sem caractere de controle, espacos colapsados, com teto. */
function textoDeCabecalho(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  // O Node entrega o cabecalho lido como latin1; a CDN escreve acento em
  // UTF-8 ("São Paulo" chegaria "SÃ£o Paulo"). Se os bytes formam UTF-8
  // valido, usa essa leitura; senao fica como veio.
  const utf8 = Buffer.from(v, 'latin1').toString('utf8')
  const lido = utf8.includes('�') ? v : utf8
  const s = lido.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim()
  return s || null
}

/**
 * Localizacao a partir dos cabecalhos da CDN, ou null quando eles nao vieram
 * (ai quem chama cai no lookup por IP).
 */
export function geoDosCabecalhos(headers: Record<string, string | undefined> | null | undefined): IpGeo | null {
  if (!headers) return null
  const pais = String(headers['cf-ipcountry'] || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(pais) || PAIS_INDEFINIDO.has(pais)) return null
  if (!SO_COM_LOCALIZACAO_LIGADA.some((h) => headers[h])) return null
  const regiao = String(headers['cf-region-code'] || '').trim().toUpperCase()
  return {
    city: textoDeCabecalho(headers['cf-ipcity'], 80),
    uf: /^[A-Z0-9]{1,3}$/.test(regiao) ? regiao : null,
    country: pais,
  }
}

/**
 * `event` e a requisicao do visitante (pros cabecalhos da CDN). Sem ele, ou
 * sem os cabecalhos, vale o lookup por IP.
 */
export async function lookupIpGeo(ip: string, event?: H3Event | null): Promise<IpGeo | null> {
  if (event) {
    try {
      const daCdn = geoDosCabecalhos(getRequestHeaders(event))
      if (daCdn) return daCdn
    } catch { /* sem cabecalhos legiveis: segue pro lookup por IP */ }
  }

  // Lookup externo: so com um endereco de verdade. O IP entra numa URL.
  const ipValido = normalizarIp(ip)
  if (!ipValido) return null

  const cached = cache.get(ipValido)
  if (cached && cached.expiresAt > Date.now()) return cached.geo

  let geo: IpGeo | null = null
  try {
    const res = await $fetch<{
      status?: string; countryCode?: string; region?: string; city?: string
    }>(`http://ip-api.com/json/${ipValido}?fields=status,countryCode,region,city`, { timeout: 2000 })

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
  cache.set(ipValido, { geo, expiresAt: Date.now() + TTL })
  return geo
}
