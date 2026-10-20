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

async function post(cfg: CfgEvolution, path: string, body: any, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; status: number; id?: string | null }> {
  try {
    const r = await fetchImpl(`${cfg.baseUrl}${path}`, {
      method: 'POST',
      headers: { apikey: cfg.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    // sendText devolve a mensagem criada: key.id e o que volta no webhook
    // (fromMe) e separa o envio do bot da mensagem que a equipe digitou.
    const j: any = await r.json().catch(() => null)
    const id = typeof j?.key?.id === 'string' ? j.key.id : null
    return { ok: r.ok, status: r.status, id }
  } catch { return { ok: false, status: 0 } }
}

export function enviarTexto(cfg: CfgEvolution, jid: string, texto: string, fetchImpl?: typeof fetch) {
  return post(cfg, `/message/sendText/${encodeURIComponent(cfg.instance)}`, { number: numeroParaEvolution(jid), text: texto }, fetchImpl)
}

export function bloquearNumero(cfg: CfgEvolution, jid: string, fetchImpl?: typeof fetch) {
  return post(cfg, `/chat/updateBlockStatus/${encodeURIComponent(cfg.instance)}`, { number: numeroParaEvolution(jid), status: 'block' }, fetchImpl)
}

export type TipoMidia = 'audio' | 'imagem' | 'video' | 'documento' | 'outro'
export type Recebida =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'reacao'; texto: string }
  | { tipo: 'figurinha' }
  | { tipo: 'midia'; midia: TipoMidia }
  | { tipo: 'ignorar' }

/**
 * O que chegou do WhatsApp. Reacao (👍 numa mensagem nossa) e figurinha nunca
 * pedem resposta; reacao REMOVIDA (texto vazio) e ignorada de vez. Audio,
 * imagem, video e documento pedem que a pessoa escreva.
 */
export function classificarMensagem(msg: any): Recebida {
  const m0 = msg?.message || {}
  const m = m0.ephemeralMessage?.message || m0.viewOnceMessage?.message || m0
  const tipo = String(msg?.messageType || '')
  if (m.reactionMessage || tipo === 'reactionMessage') {
    const t = String(m.reactionMessage?.text || '').trim()
    return t ? { tipo: 'reacao', texto: t } : { tipo: 'ignorar' }
  }
  if (m.stickerMessage || tipo === 'stickerMessage') return { tipo: 'figurinha' }
  const t = textoDaMensagem(msg)
  if (t) return { tipo: 'texto', texto: t }
  if (m.audioMessage || m.pttMessage || /audio|ptt/i.test(tipo)) return { tipo: 'midia', midia: 'audio' }
  if (m.imageMessage || /image/i.test(tipo)) return { tipo: 'midia', midia: 'imagem' }
  if (m.videoMessage || /video/i.test(tipo)) return { tipo: 'midia', midia: 'video' }
  if (m.documentMessage || m.documentWithCaptionMessage || /document/i.test(tipo)) return { tipo: 'midia', midia: 'documento' }
  if (m.protocolMessage || m.senderKeyDistributionMessage || /protocol/i.test(tipo)) return { tipo: 'ignorar' }
  return { tipo: 'midia', midia: 'outro' }
}

/** Texto de uma mensagem recebida (conversation/extendedText); null se nao for texto. */
export function textoDaMensagem(msg: any): string | null {
  const m = msg?.message || {}
  const t = m.conversation ?? m.extendedTextMessage?.text ?? m.ephemeralMessage?.message?.extendedTextMessage?.text ?? m.ephemeralMessage?.message?.conversation
  return typeof t === 'string' && t.trim() ? t.trim() : null
}
