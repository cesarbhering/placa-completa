// Debounce da resposta (pedido do Cesar, 13/out): o Guilherme so responde 2 min
// depois da ULTIMA mensagem do cliente. Chegou outra dentro desse tempo, o
// relogio reinicia, e a resposta trata todas as mensagens acumuladas como uma
// so (o agente le o historico inteiro). Antes ele respondia linha a linha
// enquanto o cliente ainda digitava. Fila por conversa, em memoria (um
// container so atende a instancia).

export const DEBOUNCE_MS = 2 * 60 * 1000

const estado = new Map<string, { timer: ReturnType<typeof setTimeout> | null; rodando: boolean; pendente: boolean; fn: () => Promise<void> }>()

export function agendarResposta(chave: string, fn: () => Promise<void>, esperaMs: number = DEBOUNCE_MS): void {
  const e = estado.get(chave) ?? { timer: null, rodando: false, pendente: false, fn }
  e.fn = fn // sempre a mais recente
  estado.set(chave, e)
  // Respondendo agora: quando terminar, conta 2 min de novo a partir dai.
  if (e.rodando) { e.pendente = true; return }
  if (e.timer) clearTimeout(e.timer) // mensagem nova: reinicia o relogio
  e.timer = setTimeout(async () => {
    e.timer = null
    e.rodando = true
    try { await e.fn() } catch (err: any) { console.warn('[suporte] resposta falhou:', err?.message || err) }
    e.rodando = false
    if (e.pendente) { e.pendente = false; agendarResposta(chave, e.fn, esperaMs) }
  }, esperaMs)
}
