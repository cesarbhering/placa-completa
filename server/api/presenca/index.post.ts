import { idPresencaValido, paginaPresenca } from '../../../shared/presenca'
import { getDispositivo } from '../../utils/dispositivo'
import { dispositivoPresenca, pareceRobo, registrarPresenca } from '../../utils/presenca'

// No body of ours comes near this: {"id":"<32 hex>","pagina":"<pattern>"}.
const CORPO_MAXIMO = 1024

/**
 * Presence beacon (plugins/presenca.client.ts): a visible tab says which page
 * it is on, every 30 s and on each route change. Feeds the "Agora no site"
 * card of the office TV through the operator route /api/presenca/resumo.
 *
 * Public and fail-open, like /api/evento: always 204 and nothing to read, so
 * it never slows or breaks a page. Kept, in this process's memory only
 * (server/utils/presenca.ts): the random tab id, the page reduced again to its
 * route pattern, the time and the device category. Not kept: IP, user agent,
 * query string, anything else the request carries.
 *
 * Not counted: the checkout probe (x-pc-sonda: 1, as in /api/evento), crawlers
 * and monitors (user agent), anything that is not JSON with a declared size of
 * at most 1 KB (never read), and anything without a valid tab id.
 */
export default defineEventHandler(async (event) => {
  setResponseStatus(event, 204)
  try {
    if (String(getHeader(event, 'x-pc-sonda') ?? '').trim() === '1') return null
    const ua = String(getHeader(event, 'user-agent') ?? '')
    if (!ua || pareceRobo(ua)) return null
    // Only our plugin's JSON: a form posted from another site (no CORS preflight) is not a tab of ours.
    if (!String(getHeader(event, 'content-type') ?? '').toLowerCase().startsWith('application/json')) return null
    // Declared size only: a body without Content-Length (chunked) or above the cap is never read (rev-804).
    const tamanho = Number(getHeader(event, 'content-length'))
    if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > CORPO_MAXIMO) return null
    const corpo: any = await readBody(event).catch(() => null)
    if (!corpo || typeof corpo !== 'object' || !idPresencaValido(corpo.id)) return null
    registrarPresenca(corpo.id, paginaPresenca(corpo.pagina), dispositivoPresenca(getDispositivo(event).dispositivo))
  } catch {
    // Measuring never breaks a page.
  }
  return null
})
