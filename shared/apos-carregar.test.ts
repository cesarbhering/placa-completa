import { describe, it, expect, vi } from 'vitest'
import { aposCarregar } from './apos-carregar'

function janela(opts: { ric?: boolean; completo?: boolean }) {
  const ouvintes: Record<string, Function> = {}
  return {
    ouvintes,
    document: { readyState: opts.completo ? 'complete' : 'interactive' },
    addEventListener: (ev: string, f: Function) => { ouvintes[ev] = f },
    setTimeout: (f: Function, ms: number) => { (globalThis as any).__ms = ms; f() },
    ...(opts.ric ? { requestIdleCallback: (f: Function, o: any) => { (globalThis as any).__ric = o; f() } } : {}),
  }
}

describe('aposCarregar', () => {
  it('Safari (sem rIC): roda 200 ms depois do load, nao 2,5 s', () => {
    const w = janela({}); const fn = vi.fn()
    aposCarregar(fn, w)
    expect(fn).not.toHaveBeenCalled()
    w.ouvintes.load()
    expect(fn).toHaveBeenCalledTimes(1)
    expect((globalThis as any).__ms).toBe(200)
  })
  it('Chrome (com rIC): teto de 1 s', () => {
    const w = janela({ ric: true, completo: true }); const fn = vi.fn()
    aposCarregar(fn, w)
    expect(fn).toHaveBeenCalledTimes(1)
    expect((globalThis as any).__ric).toEqual({ timeout: 1000 })
  })
})
