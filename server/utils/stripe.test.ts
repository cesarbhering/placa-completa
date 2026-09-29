import crypto from 'node:crypto'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { verificarAssinaturaStripe, reembolsarStripe } from './stripe'

// verificarAssinaturaStripe e a unica parte do cartao onde errar deixa alguem
// forjar um "pagamento confirmado". Testa o algoritmo do Stripe: header
// "t=<ts>,v1=<hmac>", signedPayload = `${t}.${raw}`, HMAC-SHA256 com o whsec.
const WHSEC = 'whsec_teste_1234567890'

function assinar(raw: string, secret: string, ts: number): string {
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex')
  return `t=${ts},v1=${sig}`
}

describe('verificarAssinaturaStripe', () => {
  const raw = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' })
  const agora = () => Math.floor(Date.now() / 1000)

  it('aceita uma assinatura valida e recente', () => {
    const header = assinar(raw, WHSEC, agora())
    expect(verificarAssinaturaStripe(raw, header, WHSEC)).toBe(true)
  })

  it('recusa corpo adulterado (um byte muda o HMAC)', () => {
    const header = assinar(raw, WHSEC, agora())
    const adulterado = raw.replace('evt_1', 'evt_2')
    expect(verificarAssinaturaStripe(adulterado, header, WHSEC)).toBe(false)
  })

  it('recusa assinatura feita com outro segredo', () => {
    const header = assinar(raw, 'whsec_outro_segredo', agora())
    expect(verificarAssinaturaStripe(raw, header, WHSEC)).toBe(false)
  })

  it('recusa timestamp velho (replay alem da tolerancia)', () => {
    const header = assinar(raw, WHSEC, agora() - 3600) // 1h atras
    expect(verificarAssinaturaStripe(raw, header, WHSEC)).toBe(false)
  })

  it('aceita quando ha varios v1 e um deles confere (rotacao de chave)', () => {
    const ts = agora()
    const bom = crypto.createHmac('sha256', WHSEC).update(`${ts}.${raw}`).digest('hex')
    const header = `t=${ts},v1=deadbeef,v1=${bom}`
    expect(verificarAssinaturaStripe(raw, header, WHSEC)).toBe(true)
  })

  it('recusa header ausente, vazio ou sem v1', () => {
    expect(verificarAssinaturaStripe(raw, null, WHSEC)).toBe(false)
    expect(verificarAssinaturaStripe(raw, '', WHSEC)).toBe(false)
    expect(verificarAssinaturaStripe(raw, `t=${agora()}`, WHSEC)).toBe(false)
  })

  it('recusa sem segredo ou sem corpo', () => {
    const header = assinar(raw, WHSEC, agora())
    expect(verificarAssinaturaStripe(raw, header, '')).toBe(false)
    expect(verificarAssinaturaStripe('', header, WHSEC)).toBe(false)
  })
})

// reembolsarStripe = estorno automatico do cartao (paridade com o Pix). Stuba
// useRuntimeConfig (segredo) e fetch (a session -> payment_intent, depois o
// POST /refunds). Confere o feliz e os motivos de falha.
describe('reembolsarStripe', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  function stub(secret: string, respostas: Array<{ ok: boolean; body: any }>) {
    vi.stubGlobal('useRuntimeConfig', () => ({ stripeSecretKey: secret }))
    let i = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      const r = respostas[Math.min(i++, respostas.length - 1)]
      return { ok: r.ok, status: r.ok ? 200 : 402, json: async () => r.body } as any
    }))
  }

  it('estorna: sessao paga -> refund succeeded => ok', async () => {
    stub('sk_test_x', [
      { ok: true, body: { id: 'cs_1', payment_intent: 'pi_1', payment_status: 'paid' } },
      { ok: true, body: { id: 're_1', status: 'succeeded' } },
    ])
    expect(await reembolsarStripe('cs_1', 'pedido-1')).toEqual({ ok: true })
  })

  it('refund pending também conta como ok (banco ainda processa)', async () => {
    stub('sk_test_x', [
      { ok: true, body: { id: 'cs_1', payment_intent: { id: 'pi_1' } } },
      { ok: true, body: { id: 're_1', status: 'pending' } },
    ])
    expect(await reembolsarStripe('cs_1', 'pedido-1')).toEqual({ ok: true })
  })

  it('sessao sem payment_intent (nao paga) => falha, sem chamar refund', async () => {
    stub('sk_test_x', [{ ok: true, body: { id: 'cs_1', payment_intent: null } }])
    const r = await reembolsarStripe('cs_1', 'pedido-1')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/payment_intent/)
  })

  it('refund status failed => falha', async () => {
    stub('sk_test_x', [
      { ok: true, body: { id: 'cs_1', payment_intent: 'pi_1' } },
      { ok: true, body: { id: 're_1', status: 'failed' } },
    ])
    const r = await reembolsarStripe('cs_1', 'pedido-1')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/failed/)
  })

  it('sem segredo configurado => falha, nao chama a Stripe', async () => {
    stub('', [])
    expect(await reembolsarStripe('cs_1', 'pedido-1')).toEqual({ ok: false, error: 'stripe nao configurado' })
  })
})
