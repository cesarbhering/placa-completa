// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { emVoo, quantasEmVoo, listaEmVoo, aguardarEmVoo, pararDeAceitar, aceitandoTarefas, marcarEncerrando, estaEncerrando, _resetarEmVoo } from './tarefas-em-voo'

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('registro de tarefas em voo', () => {
  beforeEach(() => _resetarEmVoo())

  it('entra ao comecar e sai ao terminar (sucesso ou erro, sem vazar excecao)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let soltar!: () => void
    const p1 = emVoo('multas', () => new Promise<string>((r) => { soltar = () => r('ok') }))
    const p2 = emVoo('recall', async () => { throw new Error('caiu') })
    expect(quantasEmVoo()).toBe(2)
    expect(listaEmVoo().map((t) => t.nome)).toEqual(['multas', 'recall'])
    await expect(p2).resolves.toBeUndefined()
    expect(quantasEmVoo()).toBe(1)
    soltar()
    await expect(p1).resolves.toBe('ok')
    expect(quantasEmVoo()).toBe(0)
  })

  it('tarefa em voo segura o encerramento ate terminar', async () => {
    void emVoo('detran-go', () => esperar(300))
    const t0 = Date.now()
    const restantes = await aguardarEmVoo(5000, { passoMs: 20, log: () => {} })
    expect(restantes).toBe(0)
    expect(Date.now() - t0).toBeGreaterThanOrEqual(250)
  })

  it('respeita o teto: sai com a tarefa ainda em voo', async () => {
    void emVoo('lenta', () => esperar(2000))
    const logs: string[] = []
    const restantes = await aguardarEmVoo(100, { passoMs: 20, log: (m) => logs.push(m) })
    expect(restantes).toBe(1)
    expect(logs[0]).toMatch(/aguardando 1 busca: lenta/)
    expect(logs.at(-1)).toMatch(/teto/)
  })

  it('encerrando: tarefa nova e recusada e nem comeca', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    pararDeAceitar()
    expect(aceitandoTarefas()).toBe(false)
    const fn = vi.fn(async () => 1)
    await expect(emVoo('nova', fn)).resolves.toBeUndefined()
    expect(fn).not.toHaveBeenCalled()
    expect(quantasEmVoo()).toBe(0)
  })
})

describe('plugin: SIGTERM continua servindo e so sai quando as buscas terminam', () => {
  beforeEach(() => _resetarEmVoo())
  afterEach(() => vi.unstubAllGlobals())

  it('marca encerrando (app-status 503), aceita tarefa nova, espera zerar, chama close e sai', async () => {
    vi.stubGlobal('defineNitroPlugin', (f: any) => f)
    const { instalarEncerramento } = await import('../plugins/aguardar-em-voo')
    const sinais: Record<string, () => void> = {}
    const processo: any = { once: (s: string, f: any) => { sinais[s] = f } }
    const eventos: string[] = []
    let saiu: number | null = null
    const nitroApp = { hooks: { callHook: async (n: string) => { eventos.push('hook:' + n) } } }
    const aoSinal = instalarEncerramento(nitroApp, { processo, sair: (c) => { saiu = c; eventos.push('sair') }, tetoMs: 5000, log: () => {} })
    expect(Object.keys(sinais).sort()).toEqual(['SIGINT', 'SIGTERM'])

    let terminou = false
    void emVoo('multas', async () => { await esperar(300); terminou = true; eventos.push('busca-fim') })
    const t0 = Date.now()
    const p = aoSinal('SIGTERM')
    expect(estaEncerrando()).toBe(true)
    // continua aceitando trabalho enquanto drena (trafego ainda chega pelo Traefik)
    expect(aceitandoTarefas()).toBe(true)
    const tardia = vi.fn(async () => { await esperar(50); eventos.push('tardia-fim') })
    void emVoo('aviso-venda', tardia)
    expect(tardia).toHaveBeenCalled()
    await p
    expect(terminou).toBe(true)
    expect(Date.now() - t0).toBeGreaterThanOrEqual(250)
    expect(eventos).toEqual(['tardia-fim', 'busca-fim', 'hook:close', 'sair'])
    expect(saiu).toBe(0)
  })

  it('app-status responde 503 so depois do SIGTERM', async () => {
    const status: number[] = []
    vi.stubGlobal('defineEventHandler', (f: any) => f)
    vi.stubGlobal('useRuntimeConfig', () => ({ forceAppUpdate: false }))
    vi.stubGlobal('setResponseHeader', () => {})
    vi.stubGlobal('setResponseStatus', (_e: any, c: number) => { status.push(c) })
    const h = (await import('../api/app-status.get')).default as any
    expect(h({})).toEqual({ forceUpdate: false })
    expect(status).toEqual([])
    marcarEncerrando()
    expect(h({})).toEqual({ forceUpdate: false, encerrando: true })
    expect(status).toEqual([503])
  })
})
