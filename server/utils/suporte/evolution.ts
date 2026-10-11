// Envio e bloqueio pela Evolution (instancia do WhatsApp da empresa). Fino e
// sem retry agressivo: o atendimento nao pode duplicar mensagem.

export interface CfgEvolution { baseUrl: string; apiKey: string; instance: string }

export function cfgEvolution(config: any): CfgEvolution | null {
  const baseUrl = String(config.evolutionApiUrl || '').replace(/\/+$/, '')
  const apiKey = String(config.evolutionApiKey || '')
  const instance = String(config.suporteEvolutionInstance || 'placa-completa')
  return baseUrl && apiKey ? { baseUrl, apiKey, instance } : null
}

/** "5511...@s.whatsapp.net" -> "5511..."; outros jids (lid) vao inteiros. */
export function numeroParaEvolution(jid: string): string {
  const j = String(jid || '')
  return j.endsWith('@s.whatsapp.net') ? j.split('@')[0] : j
}

async function post(cfg: CfgEvolution, path: string, body: any, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; status: number }> {
  try {
    const r = await fetchImpl(`${cfg.baseUrl}${path}`, {
      method: 'POST',
      headers: { apikey: cfg.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    return { ok: r.ok, status: r.status }
  } catch { return { ok: false, status: 0 } }
}

export function enviarTexto(cfg: CfgEvolution, jid: string, texto: string, fetchImpl?: typeof fetch) {
  return post(cfg, `/message/sendText/${encodeURIComponent(cfg.instance)}`, { number: numeroParaEvolution(jid), text: texto }, fetchImpl)
}

export function bloquearNumero(cfg: CfgEvolution, jid: string, fetchImpl?: typeof fetch) {
  return post(cfg, `/chat/updateBlockStatus/${encodeURIComponent(cfg.instance)}`, { number: numeroParaEvolution(jid), status: 'block' }, fetchImpl)
}

/** Texto de uma mensagem recebida (conversation/extendedText); null se nao for texto. */
export function textoDaMensagem(msg: any): string | null {
  const m = msg?.message || {}
  const t = m.conversation ?? m.extendedTextMessage?.text ?? m.ephemeralMessage?.message?.extendedTextMessage?.text ?? m.ephemeralMessage?.message?.conversation
  return typeof t === 'string' && t.trim() ? t.trim() : null
}
