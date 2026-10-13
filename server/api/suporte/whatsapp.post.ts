import { timingSafeEqual } from 'node:crypto'
import { depsReais, suporteLigado } from '../../utils/suporte/servidor'
import { receberMensagem, responderConversa } from '../../utils/suporte/fluxo'
import { classificarMensagem } from '../../utils/suporte/evolution'
import { agendarResposta } from '../../utils/suporte/agenda'
import { hashNumero } from '../../utils/suporte/regras'

// POST /api/suporte/whatsapp: webhook INTERNO do Evolution (rede Docker).
// - Header secreto x-suporte-secret (NUXT_SUPORTE_SECRET).
// - Nada que venha pela Cloudflare (cf-connecting-ip): a rota nao e publica.
// - So messages.upsert de conversa individual, de fora (fromMe = false).
// Responde 200 na hora; o atendimento roda depois, 1 resposta a cada 10 s.

const docRecente = new Map<string, { hash: string; em: number }>()

function segredoConfere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(String(recebido || '')), b = Buffer.from(String(esperado || ''))
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b)
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!suporteLigado(config)) throw createError({ statusCode: 404 })
  if (getHeader(event, 'cf-connecting-ip')) throw createError({ statusCode: 404 })
  if (!segredoConfere(getHeader(event, 'x-suporte-secret') || '', String(config.suporteSecret))) throw createError({ statusCode: 401 })

  const body: any = await readBody(event).catch(() => null)
  const evento = String(body?.event || '').toLowerCase().replace('_', '.')
  if (evento !== 'messages.upsert') return { ok: true, ignorado: 'evento' }
  const instancia = String(body?.instance || '')
  if (config.suporteEvolutionInstance && instancia && instancia !== config.suporteEvolutionInstance) return { ok: true, ignorado: 'instancia' }

  const msgs = Array.isArray(body?.data) ? body.data : [body?.data]
  const deps = depsReais(config, usePremiumSupabase())
  if (!deps) return { ok: true, ignorado: 'desligado' }

  for (const m of msgs) {
    const jid = String(m?.key?.remoteJid || '')
    if (!jid || m?.key?.fromMe) continue
    if (jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) continue
    const rec = classificarMensagem(m)
    if (rec.tipo === 'ignorar') continue
    try {
      const r = await receberMensagem({
        jid,
        texto: rec.tipo === 'texto' || rec.tipo === 'reacao' ? rec.texto : null,
        tipo: rec.tipo,
        midia: rec.tipo === 'midia' ? rec.midia : undefined,
        msgId: m?.key?.id,
      }, deps)
      const chave = hashNumero(jid, deps.segredo)
      if (r.docHash) docRecente.set(chave, { hash: r.docHash, em: Date.now() })
      if (!r.responder) continue
      agendarResposta(chave, async () => {
        const c = await deps.repo.obterConversa(chave)
        if (!c || c.status === 'bloqueada') return
        const doc = docRecente.get(chave)
        docRecente.delete(chave)
        const docHash = doc && Date.now() - doc.em < 10 * 60_000 ? doc.hash : null
        await responderConversa(c, jid, docHash, deps)
      })
    } catch (e: any) {
      console.warn('[suporte] webhook falhou:', e?.message || e)
    }
  }
  return { ok: true }
})
