// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseMemoria } from '../../../../tests/helpers/supabase-memoria'

// The operator route runs the vehicle history through
// completarHistoricoVeicularOperador (its auction partner fallback never
// e-mails the customer, review 2 of PR #758), never through the regular path.
const { operador, regular } = vi.hoisted(() => ({
  operador: vi.fn(async () => ({ ok: true, status: 'ok', cacheHit: false, cobrada: false, custoCentavos: 0, code: null, bloco: null })),
  regular: vi.fn(async () => ({ ok: true, status: 'ok' })),
}))
vi.mock('../../../utils/parceiro-historico', () => ({ completarHistoricoVeicularOperador: operador, completarHistoricoVeicular: regular }))
vi.mock('../../../utils/admin-secret', () => ({ assertAdminSecret: () => {} }))

let sb: ReturnType<typeof supabaseMemoria>
vi.stubGlobal('defineEventHandler', (fn: any) => fn)
vi.stubGlobal('readBody', async (e: any) => e.body)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
vi.stubGlobal('useRuntimeConfig', () => ({ parceiroHistoricoKey: 'k' }))
vi.stubGlobal('usePremiumSupabase', () => sb)

const { default: rodar } = await import('./rodar.post')

beforeEach(() => {
  sb = supabaseMemoria()
  operador.mockClear()
  regular.mockClear()
})

describe('POST /api/premium/historico-veicular/rodar', () => {
  it('runs the operator path (fallback without a customer e-mail), never the regular one', async () => {
    sb.tab('pedidos_premium').push({ id: 'p1', placa: 'TST2B34', plano: 'completa', status: 'entregue' })
    const r: any = await rodar({ body: { pedido_id: 'p1' } } as any)
    expect(operador).toHaveBeenCalledOnce()
    expect((operador.mock.calls[0] as any)[1]).toEqual({ id: 'p1', placa: 'TST2B34', plano: 'completa' })
    expect((operador.mock.calls[0] as any)[2]).toMatchObject({ chave: 'k' })
    expect(regular).not.toHaveBeenCalled()
    expect(r).toMatchObject({ ok: true, status: 'ok', cobrada: false })
  })

  it('an order that is not delivered or not Completa never reaches the vehicle history', async () => {
    sb.tab('pedidos_premium').push({ id: 'p2', placa: 'TST2B34', plano: 'completa', status: 'pago' }, { id: 'p3', placa: 'TST2B34', plano: 'basica', status: 'entregue' })
    await expect(rodar({ body: { pedido_id: 'p2' } } as any)).rejects.toMatchObject({ statusCode: 409 })
    await expect(rodar({ body: { pedido_id: 'p3' } } as any)).rejects.toMatchObject({ statusCode: 409 })
    expect(operador).not.toHaveBeenCalled()
    expect(regular).not.toHaveBeenCalled()
  })
})
