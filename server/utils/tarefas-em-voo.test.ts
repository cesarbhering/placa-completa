// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { emVoo, quantasEmVoo, listaEmVoo, aguardarEmVoo, pararDeAceitar, aceitandoTarefas, _resetarEmVoo } from './tarefas-em-voo'

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

describe('plugin: hook close (SIGTERM) espera as buscas', () => {
  beforeEach(() => _resetarEmVoo())
  afterEach(() => vi.unstubAllGlobals())

  it('para de aceitar e so resolve quando a busca em voo termina', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.stubGlobal('defineNitroPlugin', (f: any) => f)
    const hooks: Record<string, () => Promise<void>> = {}
    const plugin = (await import('../plugins/aguardar-em-voo')).default as any
    plugin({ hooks: { hook: (n: string, f: any) => { hooks[n] = f } } })
    expect(process.env.NITRO_SHUTDOWN_TIMEOUT).toBeDefined()

    let terminou = false
    void emVoo('multas', async () => { await esperar(300); terminou = true })
    const t0 = Date.now()
    await hooks.close()
    expect(terminou).toBe(true)
    expect(Date.now() - t0).toBeGreaterThanOrEqual(250)
    expect(aceitandoTarefas()).toBe(false)
  })
})
