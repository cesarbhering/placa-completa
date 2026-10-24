import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'

// Worker do order_created: primeiro clique pela consulta gratis (EZJ9243),
// motivo especifico gravado e reavaliacao do 'nao_enviado' generico antigo.

let sb: ReturnType<typeof supabaseMemoria>
vi.stubGlobal('defineNitroPlugin', (f: any) => f)
vi.stubGlobal('useRuntimeConfig', () => ({ openaiAdsCapiKey: 'k', openaiAdsPixelId: 'pid', public: { gated: false } }))
vi.stubGlobal('usePremiumSupabase', () => sb)
const fetchMock = vi.fn(async () => ({ status: 200, text: async () => 'ok' }))
vi.stubGlobal('fetch', fetchMock)
const { rodar } = await import('./openai-capi')

const agora = Date.now()
const iso = (msAtras: number) => new Date(agora - msAtras).toISOString()
const pedido = (extra: Record<string, any>) => ({
  token_entrega: 'tok', status: 'entregue', valor_centavos: 4490, plano: 'completa', email: 'a@b.com', pago_em: iso(60 * 60_000),
  ambiente: 'producao', ip_address: null, google_play_order_id: null, oppref: null, obref: null, utm_source: null, placa: 'EZJ9243',
  openai_capi_em: null, openai_capi_erro: null, ...extra,
})

describe('worker openai-capi', () => {
  beforeEach(() => {
    sb = supabaseMemoria()
    fetchMock.mockClear()
    delete process.env.NUXT_OPENAI_ADS_DESDE
    process.env.NUXT_OPENAI_ADS_DESDE = iso(30 * 24 * 60 * 60_000)
  })

  it('EZJ9243: nao_enviado antigo com clique na consulta e reavaliado e enviado com o oppref da consulta', async () => {
    sb.tab('pedidos_premium').push(pedido({ token_entrega: 'r_FICTICIO000000000000a', utm_source: 'chatgpt.com', openai_capi_em: iso(50 * 60_000), openai_capi_erro: 'nao_enviado' }))
    sb.tab('consultas').push({ placa: 'EZJ9243', created_at: iso(68 * 60_000), oppref: 'opp_EZJ', obref: null, utm_source: 'chatgpt_ads' })
    await rodar()
    expect(fetchMock).toHaveBeenCalledOnce()
    const corpo = JSON.parse((fetchMock.mock.calls[0] as any)[1].body)
    expect(corpo.events[0]).toMatchObject({ id: 'r_FICTICIO000000000000a', oppref: 'opp_EZJ' })
    expect(sb.tab('pedidos_premium')[0].openai_capi_erro).toBeNull()
  })

  it('grava o motivo especifico em vez de nao_enviado, e nao reavalia de novo', async () => {
    sb.tab('pedidos_premium').push(
      pedido({ token_entrega: 'semorigem', placa: 'ABC1D23' }),
      pedido({ token_entrega: 'app', google_play_order_id: 'GPA.1', oppref: 'opp' }),
      pedido({ token_entrega: 'teste', ambiente: 'teste', oppref: 'opp' }),
      pedido({ token_entrega: 'jamarcado', openai_capi_em: iso(1000), openai_capi_erro: 'sem_origem_chatgpt', oppref: 'opp' }),
    )
    await rodar()
    const por = Object.fromEntries(sb.tab('pedidos_premium').map((p) => [p.token_entrega, p.openai_capi_erro]))
    expect(por).toEqual({ semorigem: 'sem_origem_chatgpt', app: 'app', teste: 'teste', jamarcado: 'sem_origem_chatgpt' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
