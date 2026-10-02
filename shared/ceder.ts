// Devolve o controle ao navegador antes de um trabalho pesado disparado por
// toque (INP). O handler do clique termina na hora, o navegador pinta, e o
// re-render grande (formulario -> carregando, abrir o checkout) roda na tarefa
// seguinte, fora da interacao. scheduler.yield quando existe, senao setTimeout 0.
export function cederAoNavegador(): Promise<void> {
  const s: any = typeof globalThis !== 'undefined' ? (globalThis as any).scheduler : undefined
  if (s && typeof s.yield === 'function') return s.yield()
  return new Promise((r) => setTimeout(r, 0))
}
