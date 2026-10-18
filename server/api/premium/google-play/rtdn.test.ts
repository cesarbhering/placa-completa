import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseMemoria } from '../../../../tests/helpers/supabase-memoria'

const verificar = vi.fn(async () => ({ ok: true, claims: {} }) as any)
vi.mock('../../../utils/pubsub-oidc', () => ({ verificarOidc: (...a: any[]) => verificar(...(a as [])), chavesGoogle: async () => [] }))

let handler: any
let body: any
let sb: ReturnType<typeof supabaseMemoria>
let status: number | undefined
let config: any
vi.stubGlobal('defineEventHandler', (fn: any) => { handler = fn; return fn })
vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
vi.stubGlobal('getRequestHeader', () => 'Bearer x')
vi.stubGlobal('useRuntimeConfig', () => config)
vi.stubGlobal('usePremiumSupabase', () => sb)
vi.stubGlobal('setResponseStatus', (_e: any, s: number) => { status = s })

await import('./rtdn.post')

const msg = (n: any) => ({ message: { data: Buffer.from(JSON.stringify(n)).toString('base64'), messageId: '1' } })
const compraPlay = (o: any = {}) => msg({ packageName: 'br.com.placacompleta', oneTimeProductNotification: { version: '1.0', notificationType: 1, purchaseToken: 'tok-r', sku: 'consulta_completa', ...o } })

describe('POST /api/premium/google-play/rtdn', () => {
  beforeEach(() => {
    sb = supabaseMemoria({ unicos: { google_play_compras: ['purchase_token'] } })
    config = { googlePlayRtdnAudiencia: 'aud', googlePlayRtdnEmail: '' }
    status = undefined
    verificar.mockClear()
    verificar.mockImplementation(async () => ({ ok: true, claims: {} }))
  })

  it('sem audiencia configurada fica desligado (503)', async () => {
    config.googlePlayRtdnAudiencia = ''
    await expect(handler({})).rejects.toMatchObject({ statusCode: 503 })
  })

  it('token OIDC invalido: 401 e nada gravado', async () => {
    verificar.mockImplementation(async () => ({ ok: false, motivo: 'aud' }))
    body = compraPlay()
    await expect(handler({})).rejects.toMatchObject({ statusCode: 401 })
    expect(sb.tab('google_play_compras')).toHaveLength(0)
  })

  it('compra registrada (ONE_TIME_PRODUCT_PURCHASED) vai pra google_play_compras com origem rtdn', async () => {
    body = compraPlay()
    await handler({})
    expect(status).toBe(204)
    expect(sb.tab('google_play_compras')[0]).toMatchObject({ purchase_token: 'tok-r', origem: 'rtdn', product_id: 'consulta_completa' })
  })

  it('a mesma notificacao duas vezes nao duplica', async () => {
    body = compraPlay()
    await handler({}); await handler({})
    expect(sb.tab('google_play_compras')).toHaveLength(1)
  })

  it('teste do Console, outro app, outro produto ou mensagem torta: 204 sem gravar', async () => {
    for (const b of [
      msg({ packageName: 'br.com.placacompleta', testNotification: { version: '1.0' } }),
      msg({ packageName: 'com.outro', oneTimeProductNotification: { notificationType: 1, purchaseToken: 't', sku: 'consulta_completa' } }),
      compraPlay({ sku: 'outro' }),
      compraPlay({ notificationType: 2 }),
      { message: { data: '%%%' } },
      null,
    ]) {
      body = b
      status = undefined
      await handler({})
      expect(status).toBe(204)
    }
    expect(sb.tab('google_play_compras')).toHaveLength(0)
  })
})
