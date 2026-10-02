import { tratarMensagem, MCP_PROTOCOLOS } from '../utils/mcp-llms'
import { getClientIp } from '../utils/client-ip'

// MCP remoto (Streamable HTTP, sem sessao, so JSON) em /mcp. Publico e so
// leitura: ver server/utils/mcp-llms.ts. Sem SSE: GET devolve 405.
// Teto por IP REAL (client-ip.ts): 60 chamadas por minuto.

const JANELA_MS = 60 * 1000
const MAX = 60
const teto = new Map<string, { n: number; ate: number }>()

function dentroDoTeto(ip: string, agora = Date.now()): boolean {
  const e = teto.get(ip)
  if (!e || agora > e.ate) {
    teto.set(ip, { n: 1, ate: agora + JANELA_MS })
    if (teto.size > 10000) for (const [k, v] of teto) if (agora > v.ate) teto.delete(k)
    return true
  }
  e.n++
  return e.n <= MAX
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'POST, OPTIONS')
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const metodo = getMethod(event)
  if (metodo === 'OPTIONS') { setResponseStatus(event, 204); return '' }
  if (metodo !== 'POST') {
    setResponseHeader(event, 'Allow', 'POST, OPTIONS')
    setResponseStatus(event, 405)
    return { jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Use POST (Streamable HTTP, sem SSE)' } }
  }
  const versao = getHeader(event, 'mcp-protocol-version')
  if (versao && !MCP_PROTOCOLOS.includes(versao)) {
    setResponseStatus(event, 400)
    return { jsonrpc: '2.0', id: null, error: { code: -32000, message: `Mcp-Protocol-Version nao suportada: ${versao.slice(0, 20)}` } }
  }
  if (!useRuntimeConfig().public.homolog && !dentroDoTeto(getClientIp(event))) {
    setResponseHeader(event, 'Retry-After', '60')
    setResponseStatus(event, 429)
    return { jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Muitas requisicoes. Tente em 1 minuto.' } }
  }

  let body: any
  try { body = await readBody(event) } catch {
    setResponseStatus(event, 400)
    return { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }
  }
  const { fipeApiToken, fipeApiUrl } = useRuntimeConfig()
  const cfg = { fipeApiToken, fipeApiUrl }
  const log = (a: any) => logAgentQuery(event, a, 'mcp')

  const lote = Array.isArray(body) ? body.slice(0, 20) : [body]
  if (!lote.length) { setResponseStatus(event, 400); return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } } }
  const respostas = (await Promise.all(lote.map((m: any) => tratarMensagem(m, cfg, log)))).filter((r) => r !== null)

  // So notificacoes/respostas: 202 sem corpo (spec Streamable HTTP).
  if (!respostas.length) { setResponseStatus(event, 202); return '' }
  setResponseHeader(event, 'Content-Type', 'application/json')
  return Array.isArray(body) ? respostas : respostas[0]
})
