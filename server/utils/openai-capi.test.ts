import { PLANOS } from '../../shared/planos'
import { describe, it, expect, vi } from 'vitest'
import { emailSha256, motivoParaNaoEnviar, montarEvento, montarLote, origemChatgpt, type PedidoCapi } from './openai-capi'

const agora = Date.parse('2026-10-03T12:00:00Z')
const base: PedidoCapi = {
  token_entrega: 'tok123', status: 'entregue', valor_centavos: 3990, plano: 'completa', email: '  Fulano@Exemplo.COM ',
  pago_em: '2026-10-03T11:00:00Z', ambiente: 'producao', ip_address: '200.1.2.3', google_play_order_id: null,
  oppref: 'opp_ABC-123', obref: '123e4567-e89b-42d3-a456-426614174000',
}

describe('OpenAI Ads Conversions API', () => {
  it('e-mail: trim + minusculas + sha256 hex', () => {
    // sha256("fulano@exemplo.com")
    expect(emailSha256('  Fulano@Exemplo.COM ')).toBe(emailSha256('fulano@exemplo.com'))
    expect(emailSha256('fulano@exemplo.com')).toMatch(/^[0-9a-f]{64}$/)
    expect(emailSha256('')).toBeNull()
    expect(emailSha256(null)).toBeNull()
  })
  it('payload do order_created', () => {
    const ev: any = montarEvento(base)
    expect(ev).toMatchObject({
      id: 'tok123', type: 'order_created', timestamp_ms: Date.parse('2026-10-03T11:00:00Z'), action_source: 'web',
      source_url: 'https://placacompleta.com.br/premium/tok123', oppref: 'opp_ABC-123',
      data: { type: 'contents', amount: 3990, currency: 'BRL' },
    })
    expect(ev.data.contents[0]).toMatchObject({ id: 'plano-completa', content_type: 'product', quantity: 1, amount: 3990, currency: 'BRL' })
    expect(ev.user).toEqual({ countries: ['BR'], emails_sha256: [emailSha256('fulano@exemplo.com')], obref: base.obref, ip_address: '200.1.2.3' })
    expect(JSON.stringify(ev)).not.toContain('Fulano')
    const lote = montarLote([base], true)
    expect(lote).toMatchObject({ integration_source: 'placacompleta-nuxt', validate_only: true })
  })
  it('sem oppref/obref/e-mail: campos somem', () => {
    const ev: any = montarEvento({ ...base, oppref: null, obref: null, email: null })
    expect(ev.oppref).toBeUndefined()
    expect(ev.user).toEqual({ countries: ['BR'], ip_address: '200.1.2.3' })
  })
  it('cupom 100%: o evento vai com o preco cheio do plano', () => {
    const ev: any = montarEvento({ ...base, valor_centavos: 0 })
    expect(JSON.stringify(ev)).toContain(String(PLANOS.completa.valorCentavos))
  })

  it('nao dispara: teste, nao entregue, app, velho', () => {
    const o = { agora, protegido: false }
    expect(motivoParaNaoEnviar(base, o)).toBeNull()
    // cupom 100% conta (Cesar 15/out): valor 0 nao bloqueia mais
    expect(motivoParaNaoEnviar({ ...base, valor_centavos: 0 }, o)).toBeNull()
    expect(motivoParaNaoEnviar({ ...base, ambiente: 'homolog' }, o)).toBe('teste')
    expect(motivoParaNaoEnviar({ ...base, status: 'consultando' }, o)).toBe('nao_entregue')
    expect(motivoParaNaoEnviar({ ...base, status: 'reembolsado' }, o)).toBe('nao_entregue')
    expect(motivoParaNaoEnviar({ ...base, google_play_order_id: 'GPA.1' }, o)).toBe('app')
    expect(motivoParaNaoEnviar({ ...base, pago_em: '2026-09-25T00:00:00Z' }, o)).toBe('velho')
  })
  it('homolog/staging: pedido de teste vai, mas como validate_only (o worker decide)', () => {
    expect(motivoParaNaoEnviar({ ...base, ambiente: 'homolog' }, { agora, protegido: true })).toBeNull()
  })
})

describe('piso de data do envio', async () => {
  vi.stubGlobal('defineNitroPlugin', (f: any) => f)
  const { pisoDeEnvio } = await import('../plugins/openai-capi')
  it('NUXT_OPENAI_ADS_DESDE fixa o piso; sem ele, a 1a vez com key e pid', () => {
    expect(pisoDeEnvio('2026-10-03T12:00:00-03:00', '2026-10-05T00:00:00.000Z')).toBe('2026-10-03T15:00:00.000Z')
    expect(pisoDeEnvio(undefined, '2026-10-05T00:00:00.000Z')).toBe('2026-10-05T00:00:00.000Z')
    expect(pisoDeEnvio('lixo', '2026-10-05T00:00:00.000Z')).toBe('2026-10-05T00:00:00.000Z')
  })
})

// Bug 03 a 09/out: toda venda virava order_created (42 enviados, 0 com oppref).
describe('so venda do ChatGPT Ads vira conversao', () => {
  const agora = Date.parse('2026-10-09T12:00:00Z')
  const o = { agora, protegido: false }
  const venda: PedidoCapi = {
    token_entrega: 'tokX', status: 'entregue', valor_centavos: 3990, plano: 'completa', email: 'a@b.com',
    pago_em: '2026-10-09T10:00:00Z', ambiente: 'producao', ip_address: null, google_play_order_id: null,
    oppref: null, obref: null, utm_source: null,
  }
  it('sem oppref e sem utm do ChatGPT: NAO envia', () => {
    expect(motivoParaNaoEnviar(venda, o)).toBe('sem_origem_chatgpt')
    expect(motivoParaNaoEnviar({ ...venda, utm_source: 'bing' }, o)).toBe('sem_origem_chatgpt')
    expect(motivoParaNaoEnviar({ ...venda, obref: 'x' }, o)).toBe('sem_origem_chatgpt')
  })
  it('com oppref ou utm_source=chatgpt_ads: envia, id = token', () => {
    expect(motivoParaNaoEnviar({ ...venda, oppref: 'opp_1' }, o)).toBeNull()
    expect(motivoParaNaoEnviar({ ...venda, utm_source: 'ChatGPT_Ads' }, o)).toBeNull()
    expect((montarEvento({ ...venda, oppref: 'opp_1' }) as any).id).toBe('tokX')
  })
  it('origemChatgpt', () => {
    expect(origemChatgpt({ oppref: '  ', utm_source: '' })).toBe(false)
    expect(origemChatgpt({ oppref: 'opp', utm_source: null })).toBe(true)
  })
})
