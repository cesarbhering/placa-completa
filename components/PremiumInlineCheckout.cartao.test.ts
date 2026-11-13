import * as Vue from 'vue'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// Card payment of the inline checkout, with the component mounted: the amount
// check against the screen, the held intent paid on the next click (and
// dropped when what it was created for changes), the click lock, and answers
// that arrive after the buyer changed the order. Fake data only.

vi.mock('~/composables/useAnalytics', () => ({ enfileirarEventoFunil: vi.fn(), enviarFunil: vi.fn(), cartaoConverteAgora: () => true, trackConversaoPixGerado: vi.fn() }))
vi.mock('~/composables/useRecuperacaoPlay', () => ({
  EVENTO_PENDENTE: 'e1', EVENTO_PRONTO: 'e2', EVENTO_RESUME: 'e3', PREFIXO_PROVISORIO: 'prov-', STATUS_PROCESSANDO_PLAY: 'processando_play',
  compraDaPlaca: () => null, consultarPedidoPlay: async () => ({ tipo: 'pendente' }), emailValido: (e: string) => /@/.test(e), criarIntencaoPlay: async () => 'i',
  esquecerCompra: () => {}, placaLimpa: (p: string) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), provisorioDaCompra: () => null, proximoIntervalo: () => 5000,
}))

Object.assign(globalThis, { ref: Vue.ref, computed: Vue.computed, watch: Vue.watch, onMounted: Vue.onMounted, onUnmounted: Vue.onUnmounted, nextTick: Vue.nextTick })

const PLACA = 'TST1A23'
const OUTRA_PLACA = 'TST9Z99'
const EMAIL = 'buyer@example.test'
const CHEIO = 4490
const DESC = 449
const COM_CUPOM = CHEIO - DESC

let chamadas: { url: string; body: any }[] = []
let respostaCupom: (b: any) => any
let respostaIntent: (b: any) => any
let confirmar: ReturnType<typeof vi.fn>
const intents = () => chamadas.filter((c) => c.url === '/api/premium/cartao-intent')
const confirmados = () => confirmar.mock.calls.map((c: any) => c[0])
const cupomOk = () => ({ ok: true, descontoCentavos: DESC, precoLiquidoCentavos: COM_CUPOM, precoBrutoCentavos: CHEIO })
let n = 0
const intentDe = (valor: any) => () => ({ token: `tok${++n}`, plano: 'completa', valor, clientSecret: `sec${n}` })
function adiado<T>() { let soltar!: (v: T) => void; const p = new Promise<T>((r) => { soltar = r }); return { p, soltar } }

beforeEach(() => {
  chamadas = []; n = 0
  respostaCupom = cupomOk
  respostaIntent = intentDe(COM_CUPOM)
  confirmar = vi.fn(async () => ({ paymentIntent: { status: 'succeeded' } }))
  ;(globalThis as any).$fetch = vi.fn(async (url: string, opts: any = {}) => {
    chamadas.push({ url, body: opts.body })
    if (url === '/api/premium/preview') return { placa: opts.body.placa, encontrado: true, marca: 'Marca', modelo: 'Modelo', ano: 2020, raw: {} }
    if (url === '/api/premium/coupon') return await respostaCupom(opts.body)
    if (url === '/api/premium/cartao-intent') return await respostaIntent(opts.body)
    return {}
  })
  ;(window as any).Stripe = () => ({ elements: () => ({ create: () => ({ mount() {}, on() {} }) }), confirmCardPayment: confirmar })
  Object.assign(globalThis, {
    useWhatsappOculto: () => {},
    useRuntimeConfig: () => ({ public: { cartaoHabilitado: true, stripePublishableKey: 'pk_test_fake', homolog: false, gated: false } }),
    useAppMode: () => ({ isCapacitor: Vue.ref(false) }),
    usePlayBilling: () => ({}),
    useConsultaHistory: () => ({ add: vi.fn(), updateStatus: vi.fn(), remove: vi.fn(), sync: vi.fn(), itens: Vue.ref([]) }),
    useAnalytics: () => ({ trackBeginCheckout: vi.fn(), trackAddPaymentInfo: vi.fn(), trackPixGerado: vi.fn(), trackConversionPaga: vi.fn() }),
    useRecuperacaoPlay: () => ({ checkoutAberto: Vue.ref(false), ultimoPendente: Vue.ref(null), verificar: vi.fn() }),
    useRoute: () => ({ query: {} }),
    navigateTo: vi.fn(),
  })
  try { vi.spyOn(window.location, 'assign').mockImplementation(() => {}) } catch { /* not spyable here */ }
})

let w: any
afterEach(() => { w?.unmount(); document.body.innerHTML = '' })

const Comp = (await import('./PremiumInlineCheckout.vue')).default
async function abrir(props: any = {}) {
  w = mount(Comp, {
    props: { placa: PLACA, plano: 'completa', ...props },
    attachTo: document.body,
    global: { stubs: { NuxtLink: true, LogosPagamento: true, OfertaSegundaPlaca: true, WhatsappDuvidas: true }, config: { warnHandler: () => {} } },
  })
  await flushPromises()
  return w
}
async function digitarCupom(codigo: string) {
  if (!w.find('#pic-cupom').exists()) await w.find('.pic-link--cupom').trigger('click')
  await w.find('#pic-cupom').setValue(codigo)
  await w.find('#pic-cupom').trigger('blur'); await flushPromises()
}
const digitarEmail = (e: string) => w.find('#pic-email').setValue(e)
async function abaCartao() { await w.findAll('.pic-tab')[1].trigger('click'); await flushPromises() }
const botao = () => w.find('.pic-cartao-form .pic-btn--primary')
async function pagar() { await botao().trigger('click'); await flushPromises() }
const preco = () => w.find('.pic-faixa__preco b').text()
const erro = () => w.findAll('.pic-cartao-form .pic-cupom__erro').map((e: any) => e.text()).join(' | ')
const reais = (c: number) => 'R$ ' + (c / 100).toFixed(2).replace('.', ',')

/** Checkout with e-mail and a coupon shown as applied, on the card tab. */
async function prontoComCupom(props: any = {}) {
  await abrir(props)
  await digitarEmail(EMAIL)
  await digitarCupom('FAKE10')
  await abaCartao()
  expect(preco()).toBe(reais(COM_CUPOM))
}

describe('inline checkout: card amount check and held intent', () => {
  it('different amount: held with the real amount; the next click pays that same intent (one order)', async () => {
    await prontoComCupom()
    respostaIntent = intentDe(CHEIO)
    await pagar()
    expect(confirmados()).toEqual([])
    expect(preco()).toBe(reais(CHEIO))
    expect(erro()).toBe(`O cupom não pôde ser aplicado. O valor do pagamento é ${reais(CHEIO)}. Toque em pagar de novo para confirmar.`)
    await pagar()
    expect(confirmados()).toEqual(['sec1'])
    expect(intents()).toHaveLength(1)
  })

  it('same amount: confirmed on the first click', async () => {
    await prontoComCupom()
    await pagar()
    expect(confirmados()).toEqual(['sec1'])
  })

  it('without a typed coupon the message is neutral', async () => {
    await abrir()
    await digitarEmail(EMAIL)
    await abaCartao()
    respostaIntent = intentDe(CHEIO - 100)
    await pagar()
    expect(erro()).toBe(`O valor do pagamento é ${reais(CHEIO - 100)}. Toque em pagar de novo para confirmar.`)
    expect(confirmados()).toEqual([])
  })

  it('no numeric amount in the answer: never confirmed', async () => {
    await prontoComCupom()
    respostaIntent = () => ({ token: 't', plano: 'completa', clientSecret: 'sec-x' })
    await pagar()
    expect(confirmados()).toEqual([])
    expect(erro()).toBe('Não conseguimos iniciar o pagamento. Tente de novo ou use o Pix.')
  })

  it('held intent: a coupon now refused by the coupon endpoint does not block paying it', async () => {
    await prontoComCupom()
    respostaIntent = intentDe(CHEIO)
    await pagar()
    respostaCupom = () => ({ ok: false, motivo: 'Cupom esgotado.' })
    await pagar()
    expect(confirmados()).toEqual(['sec1'])
    expect(intents()).toHaveLength(1)
  })

  it('held intent paid and the card declined: the price goes back to the screen and no false warning follows', async () => {
    await prontoComCupom()
    respostaIntent = intentDe(CHEIO)
    await pagar()
    confirmar.mockImplementationOnce(async () => ({ error: { code: 'card_declined', message: 'declined' } }))
    await pagar()
    expect(confirmados()).toEqual(['sec1'])
    expect(preco()).toBe(reais(COM_CUPOM))
    respostaIntent = intentDe(COM_CUPOM)
    await pagar()
    expect(erro()).toBe('')
    expect(confirmados()).toEqual(['sec1', 'sec2'])
  })

  for (const caso of ['coupon', 'e-mail', 'plan', 'plate'] as const) {
    it(`changing the ${caso} after the warning drops the held intent`, async () => {
      await prontoComCupom()
      respostaIntent = intentDe(CHEIO)
      await pagar()
      if (caso === 'coupon') { respostaCupom = () => ({ ok: true, descontoCentavos: 900, precoLiquidoCentavos: CHEIO - 900, precoBrutoCentavos: CHEIO }); await digitarCupom('FAKE20') }
      if (caso === 'e-mail') await digitarEmail('other@example.test')
      if (caso === 'plan') { await w.setProps({ plano: 'basica' }); await flushPromises() }
      if (caso === 'plate') {
        await w.find('.pic-lapis').trigger('click')
        await w.find('#pic-placa-edit').setValue(OUTRA_PLACA)
        await w.find('.pic-campo .pic-btn').trigger('click')
        await flushPromises()
        await abaCartao()
      }
      respostaIntent = (b: any) => ({ token: 'tok-new', plano: b.plano, valor: 1, clientSecret: 'sec-new' })
      await pagar()
      expect(intents()).toHaveLength(2)
      expect(confirmados()).not.toContain('sec1')
    })
  }
})

describe('inline checkout: card click lock and answers after a change', () => {
  it('double click while the coupon re-check is in flight: one order, one confirmation', async () => {
    await prontoComCupom()
    const portas: any[] = []
    respostaCupom = () => { const a = adiado<any>(); portas.push(a); return a.p }
    const b = botao()
    await b.trigger('click'); await flushPromises()
    expect(b.attributes('disabled')).toBeDefined()
    // A click that reaches the handler anyway (no disabled attribute yet) is ignored.
    await b.element.dispatchEvent(new Event('click'))
    for (let i = 0; i < 5; i++) { portas.splice(0).forEach((a) => a.soltar(cupomOk())); await flushPromises() }
    expect(intents()).toHaveLength(1)
    expect(confirmados()).toEqual(['sec1'])
  })

  it('double click with a held intent: paid once, no new order', async () => {
    await prontoComCupom()
    respostaIntent = intentDe(CHEIO)
    await pagar()
    const atraso = adiado<any>()
    confirmar.mockImplementationOnce(async () => { await atraso.p; return { paymentIntent: { status: 'succeeded' } } })
    await botao().trigger('click')
    await botao().element.dispatchEvent(new Event('click'))
    atraso.soltar(null); await flushPromises()
    await botao().element.dispatchEvent(new Event('click')); await flushPromises() // after success: still locked
    expect(confirmados()).toEqual(['sec1'])
    expect(intents()).toHaveLength(1)
  })

  it('fields and the plate pencil are disabled while the card is processing', async () => {
    await prontoComCupom()
    const porta = adiado<any>()
    respostaIntent = () => porta.p
    await botao().trigger('click'); await flushPromises()
    for (const sel of ['.pic-lapis', '#pic-email', '#pic-cupom']) expect(w.find(sel).attributes('disabled'), sel).toBeDefined()
    porta.soltar({ token: 't', plano: 'completa', valor: COM_CUPOM, clientSecret: 'sec-ok' }); await flushPromises()
  })

  it('an intent answer that arrives after the plan changed is dropped, never paid', async () => {
    await prontoComCupom()
    const porta = adiado<any>()
    respostaIntent = () => porta.p
    await botao().trigger('click'); await flushPromises()
    await w.setProps({ plano: 'basica' }); await flushPromises()
    porta.soltar({ token: 'tok-old', plano: 'completa', valor: CHEIO, clientSecret: 'sec-old' }); await flushPromises()
    expect(confirmados()).toEqual([])
    expect(erro()).toBe('Os dados do pedido mudaram. Confira e toque em pagar de novo.')
    respostaIntent = (b: any) => ({ token: 'tok-new', plano: b.plano, valor: 1, clientSecret: 'sec-new' })
    await pagar() // amount differs from the screen: held
    await pagar()
    expect(confirmados()).toEqual(['sec-new'])
    expect(intents().map((c) => c.body.plano)).toEqual(['completa', 'basica'])
  })
})
