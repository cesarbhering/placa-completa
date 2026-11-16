import { DESTINO_CONTATO } from '../../../shared/contato-form'
import { validarClique, assuntoClique, textoClique } from '../../../shared/whatsapp-clique'
import { pareceBot } from '../../../shared/ab-preco'
import { getClientIp } from '../../utils/client-ip'
import { classificarUA } from '../../utils/dispositivo'

// E-mail to Cesar on every click on the site's WhatsApp links (shared/whatsapp-clique.ts).
// Always answers 204: the beacon does not read it and a bot learns nothing.
// No e-mail for: the probe (x-pc-sonda: 1), bot user agents, invalid bodies, the same
// visitor (IP + user agent) again within 10 minutes, and anything past 40 e-mails per
// hour in this container. Per-IP limit in server/middleware/rate-limit.ts.
const REMETENTE = 'PlacaCompleta <contato@placacompleta.com.br>'
const REPETIDO_MS = 10 * 60 * 1000
const HORA_MS = 60 * 60 * 1000
const TETO_POR_HORA = 40
const vistos = new Map<string, number>()
let janela = { inicio: 0, enviados: 0 }

/** Tests only: clears the in-memory dedupe and hourly cap. */
export function _zerarAvisoWhatsapp(): void {
  vistos.clear()
  janela = { inicio: 0, enviados: 0 }
}

export default defineEventHandler(async (event) => {
  setResponseStatus(event, 204)
  if (String(getHeader(event, 'x-pc-sonda') ?? '').trim() === '1') return null
  const ua = String(getHeader(event, 'user-agent') ?? '')
  if (!ua || pareceBot(ua)) return null
  const d = classificarUA(ua)
  const clique = validarClique(await readBody(event).catch(() => null), d.canal === 'app' ? `${d.dispositivo} (app)` : d.dispositivo)
  if (!clique) return null

  const agora = Date.now()
  for (const [k, t] of vistos) if (agora - t >= REPETIDO_MS) vistos.delete(k)
  const chave = `${getClientIp(event)}|${ua.slice(0, 300)}`
  if (vistos.has(chave)) return null
  vistos.set(chave, agora)
  if (agora - janela.inicio >= HORA_MS) janela = { inicio: agora, enviados: 0 }
  if (janela.enviados >= TETO_POR_HORA) return null

  const config: any = useRuntimeConfig()
  if (!config.resendApiKey) {
    console.warn('[whatsapp-clique] no Resend key')
    return null
  }
  janela.enviados++
  try {
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: { from: REMETENTE, to: [DESTINO_CONTATO], subject: assuntoClique(clique), text: textoClique(clique, new Date(agora)) },
      timeout: 10000,
    })
  } catch (e: any) {
    console.warn('[whatsapp-clique] send failed:', e?.statusCode || e?.message || 'error')
  }
  return null
})
