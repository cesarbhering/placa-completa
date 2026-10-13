// Tarefas pos-entrega em voo (multas/DETRAN, recall, RENAJUD, aviso de venda...).
//
// Regra do Cesar (13/out): "as buscas em andamento tem prioridade, qualquer
// deploy tem que esperar". Caso SFC8G01: entregue 18:15 UTC, container trocado
// 18:17, a busca do DETRAN-GO (~30 s) morreu sem gravar nada.
//
// Toda tarefa solta depois da entrega passa por emVoo(): ela entra no registro
// ao comecar e sai ao terminar (sucesso ou erro). No SIGTERM, o plugin
// server/plugins/aguardar-em-voo.ts para de aceitar tarefa nova
// (pararDeAceitar) e espera as em voo terminarem (aguardarEmVoo, teto 120 s).
// O que for recusado ou nao terminar a tempo e pego pela rede de seguranca do
// boot (server/utils/rede-seguranca-boot.ts) no container novo.

type Registro = { nome: string; inicio: number }

const registro = new Map<number, Registro>()
let seq = 0
let aceitando = true

export const TETO_ESPERA_MS = 120_000

/** Roda `fn` registrada como em voo. Encerrando: nao comeca (devolve undefined). Nunca lanca. */
export function emVoo<T>(nome: string, fn: () => Promise<T>): Promise<T | undefined> {
  if (!aceitando) {
    console.warn(`[em-voo] encerrando: tarefa nova recusada (${nome}); a rede de seguranca do boot cobre`)
    return Promise.resolve(undefined)
  }
  const id = ++seq
  registro.set(id, { nome, inicio: Date.now() })
  let p: Promise<T>
  try { p = Promise.resolve(fn()) } catch (e) { p = Promise.reject(e) }
  return p
    .catch((e: any) => { console.warn(`[em-voo] ${nome} falhou:`, e?.message || e); return undefined })
    .finally(() => { registro.delete(id) })
}

export function quantasEmVoo(): number {
  return registro.size
}

/** Nomes e idade (s) das tarefas em voo, pro log e pro /api/health. */
export function listaEmVoo(agora = Date.now()): { nome: string; ha_s: number }[] {
  return [...registro.values()].map((r) => ({ nome: r.nome, ha_s: Math.round((agora - r.inicio) / 1000) }))
}

export function aceitandoTarefas(): boolean {
  return aceitando
}

export function pararDeAceitar(): void {
  aceitando = false
}

/**
 * Espera as tarefas em voo terminarem, ate `tetoMs`. Loga "aguardando N buscas"
 * no inicio e a cada 10 s. Devolve quantas ainda estavam em voo ao sair.
 */
export async function aguardarEmVoo(tetoMs = TETO_ESPERA_MS, opts: { passoMs?: number; log?: (m: string) => void } = {}): Promise<number> {
  const passo = opts.passoMs ?? 250
  const log = opts.log ?? ((m: string) => console.log(m))
  const inicio = Date.now()
  let ultimoLog = 0
  while (registro.size > 0 && Date.now() - inicio < tetoMs) {
    if (Date.now() - ultimoLog >= 10_000) {
      ultimoLog = Date.now()
      log(`[em-voo] aguardando ${registro.size} busca${registro.size > 1 ? 's' : ''}: ${listaEmVoo().map((t) => `${t.nome} (${t.ha_s}s)`).join(', ')}`)
    }
    await new Promise((r) => setTimeout(r, passo))
  }
  if (registro.size > 0) log(`[em-voo] teto de ${Math.round(tetoMs / 1000)} s: saindo com ${registro.size} em voo (a rede de seguranca do boot cobre multas)`)
  else log('[em-voo] nenhuma busca em voo, pode encerrar')
  return registro.size
}

/** So pra testes. */
export function _resetarEmVoo(): void {
  registro.clear()
  aceitando = true
}
