// Revisor final (Haiku) das restricoes do DETRAN que o classificador
// deterministico nao decide (shared/restricao-detran-classe.ts, classe 'duvida').
// Pedido do Cesar (16/out/2026): "use Haiku como revisor final em caso de duvida".
//
// Mesmo setup do juiz da FIPE (chave Anthropic da FIPE, claude-haiku-5-5, sem
// temperature, thinking desligado, structured output). Cache PERSISTENTE por
// texto normalizado em fonte_cache ('revisor_restricao_detran', 365 d): os
// textos se repetem entre relatorios, entao cada texto e revisto uma vez so.
// Falha (timeout, HTTP, sem chave): sem veredito; a tela mostra o texto como
// "informacao do DETRAN" neutra, nunca como restricao.

import { createHash } from 'node:crypto'
import { HAIKU_MODEL } from './fipe-candidato'
import { lerFonteCache, gravarFonteCache } from './fonte-cache'
import type { RestricaoClassificada, VereditosRevisor } from '../../shared/restricao-detran-classe'

export const FONTE_REVISOR = 'revisor_restricao_detran'
const TIMEOUT_MS = 4000

type Veredito = { classe: 'nega' | 'restricao' | 'duvida'; motivo: string }
const memoria = new Map<string, Veredito>()

const SCHEMA = {
  type: 'object',
  properties: {
    classe: { type: 'string', enum: ['nega', 'restricao', 'duvida'] },
    motivo: { type: 'string' },
  },
  required: ['classe', 'motivo'],
  additionalProperties: false,
}

export function promptRevisor(tipo: string, texto: string): string {
  return [
    'Você classifica um item que o DETRAN estadual devolveu no campo de restrições de um veículo.',
    `Categoria informada pela fonte: "${tipo || 'não informada'}".`,
    `Texto: "${texto}"`,
    '',
    'Responda com:',
    '- "nega" se o texto apenas afirma que NÃO há restrição, impedimento ou pendência;',
    '- "restricao" se o texto indica uma restrição, bloqueio, gravame, anotação ou pendência que existe no veículo;',
    '- "duvida" se não dá para saber.',
    'Cuidado com negação dupla e com frases como "não consta baixa", que indicam restrição ativa.',
    'Justificativa em até 15 palavras, em português.',
  ].join('\n')
}

async function perguntarHaiku(tipo: string, texto: string, chaveApi: string, fetcher: typeof fetch): Promise<Veredito | null> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetcher('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': chaveApi, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 200,
        thinking: { type: 'disabled' },
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{ role: 'user', content: promptRevisor(tipo, texto) }],
      }),
      signal: controller.signal,
    })
    if (!res.ok) { console.warn('[revisor-restricao] HTTP', res.status); return null }
    const body: any = await res.json()
    const bloco = (Array.isArray(body?.content) ? body.content : []).find((b: any) => b?.type === 'text')
    const v = JSON.parse(String(bloco?.text || '{}'))
    if (!['nega', 'restricao', 'duvida'].includes(v?.classe)) return null
    return { classe: v.classe, motivo: String(v.motivo || '').slice(0, 200) }
  } catch (e: any) {
    console.warn('[revisor-restricao]', e?.name === 'AbortError' ? `timeout ${TIMEOUT_MS} ms` : String(e?.message || e).slice(0, 120))
    return null
  } finally {
    clearTimeout(t)
  }
}

const hashChave = (chave: string) => createHash('sha256').update(chave).digest('hex').slice(0, 40)

/**
 * Vereditos pras duvidas (so 'nega'/'restricao' entram; 'duvida' do Haiku
 * vira informacao neutra igual a falha). Cache em memoria e em fonte_cache.
 */
export async function revisarRestricoesDetran(
  pendentes: RestricaoClassificada[],
  op: { sb?: { from: (t: string) => any } | null; chaveApi?: string | null; fetcher?: typeof fetch } = {},
): Promise<VereditosRevisor> {
  const out: VereditosRevisor = {}
  const unicos = [...new Map(pendentes.filter((p) => p.texto.trim()).map((p) => [p.chave, p])).values()].slice(0, 6)
  await Promise.all(unicos.map(async (p) => {
    let v = memoria.get(p.chave) || null
    if (!v && op.sb) {
      const hit = await lerFonteCache<Veredito>(op.sb, FONTE_REVISOR, hashChave(p.chave))
      if (hit?.payload?.classe) v = hit.payload
    }
    if (!v && op.chaveApi) {
      v = await perguntarHaiku(p.tipo, p.texto, op.chaveApi, op.fetcher || fetch)
      if (v && op.sb) await gravarFonteCache(op.sb, FONTE_REVISOR, hashChave(p.chave), v, 'ok')
    }
    if (v) memoria.set(p.chave, v)
    if (v && v.classe !== 'duvida') out[p.chave] = { classe: v.classe, motivo: v.motivo }
  }))
  return out
}
