import { promptDoSistema } from './conhecimento'

// Cerebro N0: Haiku 5.5 com structured outputs (mesmo jeito do juiz FIPE, #509).
// Ferramenta de leitura de pedido via acao "consultar_pedido": o servidor
// consulta e chama de novo com o resultado (no maximo 2 rodadas).

export const SUPORTE_MODELO = 'claude-haiku-5-5'
export const SUPORTE_TIMEOUT_MS = 8000
const MAX_TOKENS = 700

export type Acao = 'responder' | 'consultar_pedido' | 'chamar_n1' | 'escalar_n2' | 'fora_escopo' | 'empresa'
export type Categoria = 'venda' | 'pedido' | 'relatorio' | 'reclamacao' | 'fora_escopo' | 'empresa' | 'outro'

export interface Veredito {
  categoria: Categoria
  acao: Acao
  resposta: string
  consulta: { email: string; placa: string; token: string }
  resumo_n1: string
  motivo_n2: string
  /** O assunto do cliente foi resolvido e a conversa chegou ao fim. */
  atendimento_concluido: boolean
}

export const SCHEMA_VEREDITO = {
  type: 'object',
  properties: {
    categoria: { type: 'string', enum: ['venda', 'pedido', 'relatorio', 'reclamacao', 'fora_escopo', 'empresa', 'outro'] },
    acao: { type: 'string', enum: ['responder', 'consultar_pedido', 'chamar_n1', 'escalar_n2', 'fora_escopo', 'empresa'] },
    resposta: { type: 'string' },
    consulta: {
      type: 'object',
      properties: { email: { type: 'string' }, placa: { type: 'string' }, token: { type: 'string' } },
      required: ['email', 'placa', 'token'],
      additionalProperties: false,
    },
    resumo_n1: { type: 'string' },
    motivo_n2: { type: 'string' },
    atendimento_concluido: { type: 'boolean' },
  },
  required: ['categoria', 'acao', 'resposta', 'consulta', 'resumo_n1', 'motivo_n2', 'atendimento_concluido'],
  additionalProperties: false,
} as const

export interface MsgHistorico { de: 'cliente' | 'bot' | 'n1' | 'sistema'; texto: string }

/** Historico no formato do Messages API (cliente = user; bot/n1 = assistant; sistema = user marcado). */
export function mensagensParaApi(hist: MsgHistorico[], extra?: string): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = []
  const push = (role: 'user' | 'assistant', content: string) => {
    const ult = out[out.length - 1]
    if (ult && ult.role === role) ult.content += `\n${content}`
    else out.push({ role, content })
  }
  for (const m of hist) {
    if (m.de === 'cliente') push('user', m.texto)
    else if (m.de === 'sistema') push('user', `[SISTEMA] ${m.texto}`)
    else push('assistant', m.texto)
  }
  // O Messages API com structured outputs nao aceita terminar em assistant.
  while (!extra && out.length && out[out.length - 1].role === 'assistant') out.pop()
  if (extra) push('user', `[SISTEMA] ${extra}`)
  if (out[0]?.role === 'assistant') out.unshift({ role: 'user', content: '[SISTEMA] início da conversa' })
  return out
}

export function parseVeredito(texto: string): Veredito | null {
  try {
    const o = JSON.parse(String(texto || '').replace(/```(?:json)?/gi, '').trim())
    if (!o || typeof o !== 'object' || !o.acao) return null
    return {
      categoria: o.categoria || 'outro',
      acao: o.acao,
      resposta: String(o.resposta || ''),
      consulta: { email: String(o.consulta?.email || ''), placa: String(o.consulta?.placa || ''), token: String(o.consulta?.token || '') },
      resumo_n1: String(o.resumo_n1 || ''),
      motivo_n2: String(o.motivo_n2 || ''),
      atendimento_concluido: o.atendimento_concluido === true,
    }
  } catch { return null }
}

/** Uma chamada ao Haiku. null em qualquer falha (quem chama trata como N1). */
export async function perguntarAoAgente(
  hist: MsgHistorico[],
  apiKey: string,
  opts: { extra?: string; fetchImpl?: typeof fetch } = {},
): Promise<{ veredito: Veredito | null; falha: string | null }> {
  if (!apiKey) return { veredito: null, falha: 'sem chave' }
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), SUPORTE_TIMEOUT_MS)
  try {
    const res = await (opts.fetchImpl ?? fetch)('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: SUPORTE_MODELO,
        max_tokens: MAX_TOKENS,
        thinking: { type: 'disabled' },
        system: promptDoSistema(),
        messages: mensagensParaApi(hist, opts.extra),
        output_config: { format: { type: 'json_schema', schema: SCHEMA_VEREDITO } },
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      let tipo = ''
      try { tipo = String(((await res.json()) as any)?.error?.type || '') } catch { /* nada */ }
      return { veredito: null, falha: `HTTP ${res.status}${tipo ? ` ${tipo}` : ''}` }
    }
    const body: any = await res.json()
    const bloco = Array.isArray(body?.content) ? body.content.find((b: any) => b?.type === 'text') : null
    const v = parseVeredito(bloco?.text)
    return v ? { veredito: v, falha: null } : { veredito: null, falha: `JSON invalido stop_reason=${body?.stop_reason ?? '?'}` }
  } catch (e: any) {
    return { veredito: null, falha: e?.name === 'AbortError' ? `timeout ${SUPORTE_TIMEOUT_MS} ms` : 'erro de rede' }
  } finally {
    clearTimeout(t)
  }
}
