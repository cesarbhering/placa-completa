import { describe, it, expect, vi, beforeEach } from 'vitest'

// O checkout Pix decide no servidor se o cupom exige e-mail: o de recompra nao
// exige; os outros sim. (So o portao do e-mail; o resto do checkout e mockado.)
let origemDoCodigo: Record<string, string | null> = {}
vi.mock('../../utils/cupom-recompra', () => ({
  origemDoCupom: () => ({}),
  cupomDispensaEmail: async (_sb: any, cod: string) => origemDoCodigo[String(cod).toUpperCase()] === 'recompra',
}))
let handler: any
let body: any
vi.stubGlobal('defineEventHandler', (fn: any) => { handler = fn; return fn })
vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
vi.stubGlobal('assertPremiumGate', () => {})
vi.stubGlobal('usePremiumSupabase', () => ({}))
vi.stubGlobal('useRuntimeConfig', () => ({ public: { homolog: false } }))
// Depois do portao: para a execucao aqui pra nao precisar mockar o resto.
vi.stubGlobal('validarCupom', async () => { throw new Error('PASSOU_DO_PORTAO') })

await import('./checkout.post')

describe('checkout: cupom sem e-mail', () => {
  beforeEach(() => { origemDoCodigo = { CARROABCDE: 'recompra', VOLTA15: 'volta' } })
  it('cupom de recompra sem e-mail passa do portao', async () => {
    body = { placa: 'ABC1D23', plano: 'completa', cupom: 'carroabcde' }
    await expect(handler({})).rejects.toThrow('PASSOU_DO_PORTAO')
  })
  it('outro cupom sem e-mail e recusado', async () => {
    body = { placa: 'ABC1D23', plano: 'completa', cupom: 'VOLTA15' }
    await expect(handler({})).rejects.toThrow('Informe o e-mail para usar um cupom.')
  })
})
