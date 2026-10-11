import { LIMITES } from './regras'

// 1 resposta a cada 10 s por conversa: mensagens em rajada sao juntadas e
// respondidas de uma vez (o agente le o historico inteiro). Fila por conversa,
// em memoria (um container so atende a instancia).

const estado = new Map<string, { ultima: number; timer: ReturnType<typeof setTimeout> | null; rodando: boolean; pendente: boolean; fn: () => Promise<void> }>()
const JUNTAR_MS = 2500

export function agendarResposta(chave: string, fn: () => Promise<void>, agora: () => number = Date.now): void {
  const e = estado.get(chave) ?? { ultima: 0, timer: null, rodando: false, pendente: false, fn }
  e.fn = fn // sempre a mais recente
  estado.set(chave, e)
  if (e.rodando) { e.pendente = true; return }
  if (e.timer) return
  const espera = Math.max(JUNTAR_MS, e.ultima + LIMITES.intervaloRespostaMs - agora())
  e.timer = setTimeout(async () => {
    e.timer = null
    e.rodando = true
    try { await e.fn() } catch (err: any) { console.warn('[suporte] resposta falhou:', err?.message || err) }
    e.ultima = agora()
    e.rodando = false
    if (e.pendente) { e.pendente = false; agendarResposta(chave, e.fn, agora) }
  }, espera)
}
