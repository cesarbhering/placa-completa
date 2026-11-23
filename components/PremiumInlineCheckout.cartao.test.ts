import * as Vue from 'vue'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// Card payment of the inline checkout, with the component mounted: the amount
// check against the screen, the held intent paid on the next click (and
// dropped when what it was created for changes), the click lock, answers
// that arrive after the buyer changed the order, the decline message and the
// Pix offered after a failed attempt. Fake data only.

vi.mock('~/composables/useAnalytics', async (importOriginal) => {
  // The real rule of when a card payment converts on the spot (only "succeeded").
  const { cartaoConverteAgora } = await importOriginal<typeof import('~/composables/useAnalytics')>()
  return { enfileirarEventoFunil: vi.fn(), enviarFunil: vi.fn(), cartaoConverteAgora, trackConversaoPixGerado: vi.fn() }
})
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
let respostaPix: (b: any) => any
let confirmar: ReturnType<typeof vi.fn>
/** stripe.retrievePaymentIntent */
let ler: ReturnType<typeof vi.fn>
let assign: ReturnType<typeof vi.fn>
let trackConversionPaga: ReturnType<typeof vi.fn>
let histAdd: ReturnType<typeof vi.fn>
/** `change` listener of each Stripe card field, by field type. */
let aoMudar: Record<string, (e: any) => void> = {}
let homolog = false
const intents = () => chamadas.filter((c) => c.url === '/api/premium/cartao-intent')
const confirmados = () => confirmar.mock.calls.map((c: any) => c[0])
const cupomOk = () => ({ ok: true, descontoCentavos: DESC, precoLiquidoCentavos: COM_CUPOM, precoBrutoCentavos: CHEIO })
let n = 0
const intentDe = (valor: any) => (_o?: any) => ({ token: `tok${++n}`, plano: 'completa', valor, clientSecret: `sec${n}` })
function adiado<T>() { let soltar!: (v: T) => void; const p = new Promise<T>((r) => { soltar = r }); return { p, soltar } }

beforeEach(() => {
  chamadas = []; n = 0
  respostaCupom = cupomOk
  respostaIntent = intentDe(COM_CUPOM)
  respostaPix = () => ({ token: 'pixtok', valor: CHEIO, brCode: 'fake-br', brCodeBase64: 'data:image/png;base64,AAAA', expiresAt: null })
  confirmar = vi.fn(async () => ({ paymentIntent: { status: 'succeeded' } }))
  ler = vi.fn(async () => ({ paymentIntent: { status: 'requires_payment_method' } }))
  assign = vi.fn()
  trackConversionPaga = vi.fn()
  histAdd = vi.fn()
  homolog = false
  ;(globalThis as any).$fetch = vi.fn(async (url: string, opts: any = {}) => {
    chamadas.push({ url, body: opts.body })
    if (url === '/api/premium/preview') return { placa: opts.body.placa, encontrado: true, marca: 'Marca', modelo: 'Modelo', ano: 2020, raw: {} }
    if (url === '/api/premium/coupon') return await respostaCupom(opts.body)
    if (url === '/api/premium/cartao-intent') return await respostaIntent(opts)
    if (url === '/api/premium/checkout') return await respostaPix(opts.body)
    return {}
  })
  aoMudar = {}
  ;(window as any).Stripe = () => ({
    elements: () => ({ create: (tipo: string) => ({ mount() {}, on(ev: string, fn: (e: any) => void) { if (ev === 'change') aoMudar[tipo] = fn } }) }),
    confirmCardPayment: confirmar,
    retrievePaymentIntent: ler,
  })
  Object.assign(globalThis, {
    useWhatsappOculto: () => {},
    useRuntimeConfig: () => ({ public: { cartaoHabilitado: true, stripePublishableKey: 'pk_test_fake', homolog, gated: false } }),
    useAppMode: () => ({ isCapacitor: Vue.ref(false) }),
    usePlayBilling: () => ({}),
    useConsultaHistory: () => ({ add: histAdd, updateStatus: vi.fn(), remove: vi.fn(), sync: vi.fn(), itens: Vue.ref([]) }),
    useAnalytics: () => ({ trackBeginCheckout: vi.fn(), trackAddPaymentInfo: vi.fn(), trackPixGerado: vi.fn(), trackConversionPaga }),
    useRecuperacaoPlay: () => ({ checkoutAberto: Vue.ref(false), ultimoPendente: Vue.ref(null), verificar: vi.fn() }),
    useRoute: () => ({ query: {} }),
    navigateTo: vi.fn(),
  })
  vi.spyOn(window.location, 'assign').mockImplementation(assign as any)
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
const desabilitado = (sel: string) => w.find(sel).attributes('disabled') !== undefined
const abaPix = () => w.findAll('.pic-tab')[0]
const abaCartaoAtiva = () => w.findAll('.pic-tab')[1].attributes('aria-selected') === 'true'
const botaoPix = () => w.find('.pic-cartao-form .pic-cartao-pix')
const pixGerados = () => chamadas.filter((c) => c.url === '/api/premium/checkout')
/** The next card confirmation comes back with this Stripe error. */
const recusar = (error: any) => confirmar.mockImplementationOnce(async () => ({ error }))
/** Changes a field the way a script or autofill would, even while it is disabled. */
async function forcarValor(sel: string, v: string) {
  const el = w.find(sel).element as HTMLInputElement
  el.value = v
  el.dispatchEvent(new Event('input'))
  await flushPromises()
}

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
      respostaIntent = (o: any) => ({ token: 'tok-new', plano: o.body.plano, valor: 1, clientSecret: 'sec-new' })
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
    respostaIntent = (o: any) => ({ token: 'tok-new', plano: o.body.plano, valor: 1, clientSecret: 'sec-new' })
    await pagar() // amount differs from the screen: held
    await pagar()
    expect(confirmados()).toEqual(['sec-new'])
    expect(intents().map((c) => c.body.plano)).toEqual(['completa', 'basica'])
  })
})

describe('inline checkout: after the card is approved', () => {
  it('tracking that throws does not block the redirect nor show an error', async () => {
    trackConversionPaga.mockImplementation(() => { throw new Error('tag failure') })
    histAdd.mockImplementation(() => { throw new Error('storage failure') })
    await prontoComCupom()
    await pagar()
    expect(confirmados()).toEqual(['sec1'])
    expect(assign.mock.calls).toEqual([['/premium/tok1']])
    expect(erro()).toBe('')
    expect(desabilitado('.pic-cartao-form .pic-btn--primary')).toBe(true)
  })

  it('a redirect that fails leaves a link to the report, not an error', async () => {
    assign.mockImplementation(() => { throw new Error('blocked') })
    await prontoComCupom()
    await pagar()
    expect(confirmados()).toEqual(['sec1'])
    expect(erro()).toBe('')
    expect(w.find('a[href="/premium/tok1"]').exists()).toBe(true)
  })

  it('the button stays disabled after the approval (no second order)', async () => {
    await prontoComCupom()
    await pagar()
    expect(desabilitado('.pic-cartao-form .pic-btn--primary')).toBe(true)
    await botao().element.dispatchEvent(new Event('click')); await flushPromises()
    expect(intents()).toHaveLength(1)
    expect(confirmados()).toEqual(['sec1'])
  })
})

describe('inline checkout: card validation, price at the click, Pix at the same time', () => {
  it('coupon without e-mail on the card tab: after the coupon re-check the e-mail field gets the focus', async () => {
    await abrir()
    await digitarCupom('FAKE10')
    await abaCartao()
    const porta = adiado<any>()
    respostaCupom = () => porta.p
    await botao().trigger('click'); await flushPromises()
    expect(desabilitado('#pic-email')).toBe(true) // fields locked while the coupon is re-checked
    porta.soltar(cupomOk()); await flushPromises(); await flushPromises()
    expect(intents()).toHaveLength(0)
    expect(desabilitado('#pic-email')).toBe(false)
    expect((document.activeElement as HTMLElement | null)?.id).toBe('pic-email')
  })

  it('incomplete e-mail on the card tab: the e-mail field gets the focus', async () => {
    await abrir()
    await digitarEmail('buyer-at-example')
    await abaCartao()
    await pagar()
    await flushPromises()
    expect(intents()).toHaveLength(0)
    expect((document.activeElement as HTMLElement | null)?.id).toBe('pic-email')
  })

  it('coupon replaced and pay clicked right away: a higher amount than the button is held', async () => {
    await prontoComCupom()
    expect(botao().text()).toContain(reais(COM_CUPOM))
    respostaCupom = (b: any) => (b.codigo === 'FAKE01' ? { ok: true, descontoCentavos: 100, precoLiquidoCentavos: CHEIO - 100, precoBrutoCentavos: CHEIO } : cupomOk())
    respostaIntent = (o: any) => ({ token: 'tok-b', plano: 'completa', valor: o.body.cupom === 'FAKE01' ? CHEIO - 100 : COM_CUPOM, clientSecret: 'sec-b' })
    await w.find('#pic-cupom').setValue('FAKE01') // no blur: the screen still shows the old discount
    await pagar()
    expect(confirmados()).toEqual([])
    expect(erro()).toBe(`O valor do pagamento é ${reais(CHEIO - 100)}. Toque em pagar de novo para confirmar.`)
    expect(preco()).toBe(reais(CHEIO - 100))
    await pagar()
    expect(confirmados()).toEqual(['sec-b'])
    expect(intents()).toHaveLength(1)
  })

  it('a lower amount than the button at the click, equal to the screen, is confirmed', async () => {
    await prontoComCupom()
    respostaCupom = () => ({ ok: true, descontoCentavos: 900, precoLiquidoCentavos: CHEIO - 900, precoBrutoCentavos: CHEIO })
    respostaIntent = intentDe(CHEIO - 900)
    await w.find('#pic-cupom').setValue('FAKE20')
    await pagar()
    expect(confirmados()).toEqual(['sec1'])
  })

  it('Pix being generated: the card button is disabled and starts no order', async () => {
    await abrir()
    await digitarEmail(EMAIL)
    await abaCartao()
    const porta = adiado<any>()
    respostaPix = () => porta.p
    await abaPix().trigger('click'); await flushPromises()
    await abaCartao()
    expect(desabilitado('.pic-cartao-form .pic-btn--primary')).toBe(true)
    await botao().element.dispatchEvent(new Event('click')); await flushPromises()
    expect(intents()).toHaveLength(0)
    porta.soltar({ token: 'pixtok', valor: CHEIO, brCode: 'fake-br', brCodeBase64: 'data:image/png;base64,AAAA', expiresAt: null }); await flushPromises()
  })

  it('card processing: the Pix tab is disabled and starts no Pix', async () => {
    await abrir()
    await digitarEmail(EMAIL)
    await abaCartao()
    const porta = adiado<any>()
    respostaIntent = () => porta.p
    await botao().trigger('click'); await flushPromises()
    expect(desabilitado('.pic-tab')).toBe(true)
    await abaPix().element.dispatchEvent(new Event('click')); await flushPromises()
    expect(chamadas.filter((c) => c.url === '/api/premium/checkout')).toHaveLength(0)
    porta.soltar({ token: 't', plano: 'completa', valor: CHEIO, clientSecret: 'sec-ok' }); await flushPromises()
    expect(confirmados()).toEqual(['sec-ok'])
  })
})

describe('inline checkout: card lock is released on failures', () => {
  const livre = () => !desabilitado('.pic-cartao-form .pic-btn--primary') && !botao().text().includes('Processando')

  for (const [nome, falha, msg] of [
    ['network error', () => { throw Object.assign(new Error('fetch failed'), { name: 'FetchError' }) }, 'Não conseguimos processar o cartão agora. Use o Pix.'],
    ['timeout', () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }) }, 'Não conseguimos processar o cartão agora. Use o Pix.'],
    ['429 limit', () => { throw Object.assign(new Error('429'), { statusCode: 429, data: { message: 'Muitas tentativas com cartão para esta placa na última hora. Use o Pix ou tente de novo mais tarde.', data: { limite: true, motivo: 'cartao_placa' } } }) }, 'Muitas tentativas com cartão para esta placa na última hora. Use o Pix ou tente de novo mais tarde.'],
  ] as const) {
    it(`${nome}: message shown and the lock released`, async () => {
      await prontoComCupom()
      respostaIntent = falha as any
      await pagar()
      expect(erro()).toBe(msg)
      expect(livre()).toBe(true)
      expect(desabilitado('#pic-email')).toBe(false)
    })
  }

  it('409 already bought: the lock is released', async () => {
    await prontoComCupom()
    respostaIntent = () => { throw Object.assign(new Error('409'), { statusCode: 409, data: { ja_comprado: true, token_entrega: 'tok-old' } }) }
    await pagar()
    expect(confirmados()).toEqual([])
    expect(livre()).toBe(true)
  })

  it('the card intent request has a 25 s timeout', async () => {
    await prontoComCupom()
    let opts: any
    respostaIntent = (o: any) => { opts = o; return { token: 't', plano: 'completa', valor: COM_CUPOM, clientSecret: 's' } }
    await pagar()
    expect(opts.timeout).toBe(25_000)
  })

  it('a coupon refused by the validation: the lock is released', async () => {
    await prontoComCupom()
    respostaCupom = () => ({ ok: false, motivo: 'Cupom nao encontrado.' })
    await pagar()
    expect(intents()).toHaveLength(0)
    expect(livre()).toBe(true)
  })
})

describe('inline checkout: everything that is locked while the card is processing', () => {
  it('Pix tab, name, e-mail, coupon, plate pencil and button are disabled; enabled again afterwards', async () => {
    await prontoComCupom()
    const porta = adiado<any>()
    respostaIntent = () => porta.p
    await botao().trigger('click'); await flushPromises()
    const travados = ['.pic-tab', '#pic-card-nome', '#pic-email', '#pic-cupom', '.pic-lapis', '.pic-cartao-form .pic-btn--primary']
    for (const sel of travados) expect(desabilitado(sel), sel).toBe(true)
    porta.soltar({ token: 't', plano: 'completa', valor: CHEIO, clientSecret: 'sec-x' }); await flushPromises() // held: different amount
    for (const sel of travados) expect(desabilitado(sel), sel).toBe(false)
  })

  it('homolog: the environment select is disabled too, and changing it drops a late answer', async () => {
    homolog = true
    await prontoComCupom()
    const porta = adiado<any>()
    respostaIntent = () => porta.p
    await botao().trigger('click'); await flushPromises()
    expect(desabilitado('#pic-ambiente')).toBe(true)
    const sel = w.find('#pic-ambiente').element as HTMLSelectElement
    sel.value = 'producao'; sel.dispatchEvent(new Event('change')); await flushPromises()
    porta.soltar({ token: 'tok-old', plano: 'completa', valor: COM_CUPOM, clientSecret: 'sec-old' }); await flushPromises()
    expect(confirmados()).toEqual([])
    expect(erro()).toBe('Os dados do pedido mudaram. Confira e toque em pagar de novo.')
  })

  for (const caso of ['plate', 'e-mail', 'coupon'] as const) {
    it(`an intent answer that arrives after the ${caso} changed is dropped, never paid`, async () => {
      await prontoComCupom()
      const porta = adiado<any>()
      respostaIntent = () => porta.p
      await botao().trigger('click'); await flushPromises()
      if (caso === 'plate') { await w.setProps({ placa: OUTRA_PLACA }); await flushPromises() }
      if (caso === 'e-mail') await forcarValor('#pic-email', 'other@example.test')
      if (caso === 'coupon') await forcarValor('#pic-cupom', 'FAKE99')
      porta.soltar({ token: 'tok-old', plano: 'completa', valor: COM_CUPOM, clientSecret: 'sec-old' }); await flushPromises()
      expect(confirmados()).toEqual([])
      expect(erro()).toBe('Os dados do pedido mudaram. Confira e toque em pagar de novo.')
    })
  }
})

// What Stripe.js returned with locale pt-BR for these card errors (test mode, 23/11).
const ERROS_STRIPE = {
  insufficient_funds: { type: 'card_error', code: 'card_declined', decline_code: 'insufficient_funds', message: 'Não há saldo suficiente no cartão. Tente usar outro.' },
  expired_card: { type: 'card_error', code: 'expired_card', message: 'Seu cartão venceu. Tente usar outro.' },
  processing_error: { type: 'card_error', code: 'processing_error', message: 'Erro ao processar o cartão. Tente novamente.' },
  fraudulent: { type: 'card_error', code: 'card_declined', message: 'Seu cartão foi recusado. Fale com o emissor do cartão.' },
}
const RECUSADO = 'Cartão recusado. Confira os dados ou tente outro cartão.'
const MSG_LIMITE_CARTAO = 'Muitas tentativas com cartão para esta placa na última hora. Use o Pix ou tente de novo mais tarde.'
const MSG_LIMITE_PLACA = 'Muitas tentativas de pagamento para esta placa na última hora. Tente de novo mais tarde.'
/** Card intent refused by a checkout limit, the way the server marks it. */
const recusaPorLimite = (motivo: string, message: string) => () => {
  throw Object.assign(new Error('429'), { statusCode: 429, data: { message, data: { limite: true, motivo } } })
}
const pixOk = () => ({ token: 'pixtok', valor: COM_CUPOM, brCode: 'fake-br', brCodeBase64: 'data:image/png;base64,AAAA', expiresAt: null })
/** Card declined for lack of funds, with "Pagar com Pix" on screen. */
async function recusado() {
  await prontoComCupom()
  recusar(ERROS_STRIPE.insufficient_funds)
  await pagar()
  expect(botaoPix().exists()).toBe(true)
}

describe('inline checkout: card error message', () => {
  for (const [caso, erroStripe] of Object.entries(ERROS_STRIPE)) {
    it(`${caso}: the text Stripe.js wrote for the buyer is shown`, async () => {
      await prontoComCupom()
      recusar(erroStripe)
      await pagar()
      expect(erro()).toBe(erroStripe.message)
    })
  }

  for (const [caso, erroStripe, reserva] of [
    ['declined card without a message', { type: 'card_error', code: 'card_declined' }, RECUSADO],
    ['expired card without a message', { type: 'card_error', code: 'expired_card' }, 'Cartão vencido. Tente outro cartão.'],
    ['card error with a blank message', { type: 'card_error', code: 'processing_error', message: ' ' }, 'Não foi possível processar o cartão.'],
    ['another error type', { type: 'invalid_request_error', code: 'card_declined', message: 'Your card was declined.' }, RECUSADO],
  ] as const) {
    it(`${caso}: our fallback text`, async () => {
      await prontoComCupom()
      recusar(erroStripe)
      await pagar()
      expect(erro()).toBe(reserva)
    })
  }

  it('the red line is announced to screen readers (role="alert")', async () => {
    await recusado()
    expect(w.find('.pic-cartao-form .pic-cupom__erro').attributes('role')).toBe('alert')
  })
})

describe('inline checkout: "Pagar com Pix" after a failed card attempt', () => {
  for (const [nome, falhar] of [
    ['card declined', () => recusar(ERROS_STRIPE.insufficient_funds)],
    ['bank error', () => recusar(ERROS_STRIPE.processing_error)],
    ['3DS not completed', () => recusar({ type: 'invalid_request_error', code: 'payment_intent_authentication_failure', message: 'Não foi possível autenticar o pagamento.' })],
    ['payment not confirmed', () => confirmar.mockImplementationOnce(async () => ({ paymentIntent: { status: 'requires_payment_method' } }))],
    ['no client secret in the answer', () => { respostaIntent = () => ({ token: 't', plano: 'completa', valor: COM_CUPOM }) }],
    ['no numeric amount in the answer', () => { respostaIntent = () => ({ token: 't', plano: 'completa', clientSecret: 'sec-x' }) }],
    ['card attempt limit', () => { respostaIntent = recusaPorLimite('cartao_placa', MSG_LIMITE_CARTAO) }],
    ['network failure', () => { respostaIntent = () => { throw Object.assign(new Error('fetch failed'), { name: 'FetchError' }) } }],
  ] as const) {
    it(`${nome}: shown right under the red line`, async () => {
      await prontoComCupom()
      falhar()
      await pagar()
      expect(botaoPix().exists()).toBe(true)
      expect(botaoPix().text()).toBe('Pagar com Pix')
      expect(w.find('.pic-cartao-form .pic-cupom__erro').element.nextElementSibling).toBe(botaoPix().element)
    })
  }

  it('plate limit (it counts Pix orders too, so the Pix would be refused): not offered', async () => {
    await prontoComCupom()
    respostaIntent = recusaPorLimite('placa', MSG_LIMITE_PLACA)
    await pagar()
    expect(erro()).toBe(MSG_LIMITE_PLACA)
    expect(botaoPix().exists()).toBe(false)
  })

  it('a typing error in the card fields: not offered', async () => {
    await prontoComCupom()
    aoMudar.cardNumber({ empty: false, complete: false, error: { type: 'validation_error', code: 'invalid_number', message: 'O número do cartão é inválido.' } })
    await flushPromises()
    expect(erro()).toBe('O número do cartão é inválido.')
    expect(botaoPix().exists()).toBe(false)
  })

  it('card fields incomplete at the click (Stripe stops it before any charge): not offered', async () => {
    await prontoComCupom()
    recusar({ type: 'validation_error', code: 'incomplete_number', message: 'O número do cartão está incompleto.' })
    await pagar()
    expect(erro()).toBe('O número do cartão está incompleto.')
    expect(botaoPix().exists()).toBe(false)
  })

  it('a different amount held for the next click: not offered', async () => {
    await prontoComCupom()
    respostaIntent = intentDe(CHEIO)
    await pagar()
    expect(erro()).toContain('Toque em pagar de novo para confirmar.')
    expect(botaoPix().exists()).toBe(false)
  })

  it('gone as soon as a new attempt starts', async () => {
    await recusado()
    const porta = adiado<any>()
    respostaIntent = () => porta.p
    await botao().trigger('click'); await flushPromises()
    expect(botaoPix().exists()).toBe(false)
    porta.soltar({ token: 't', plano: 'completa', valor: COM_CUPOM, clientSecret: 'sec-ok' }); await flushPromises()
    expect(confirmados()).toEqual(['sec1', 'sec-ok'])
    expect(botaoPix().exists()).toBe(false)
  })

  it('a new attempt that ends with the amount held for the next click does not bring it back', async () => {
    await recusado()
    respostaIntent = intentDe(CHEIO)
    await pagar()
    expect(erro()).toContain('Toque em pagar de novo para confirmar.')
    expect(botaoPix().exists()).toBe(false)
  })

  for (const campo of ['cardNumber', 'cardExpiry', 'cardCvc'] as const) {
    it(`gone when the buyer edits the card field ${campo}`, async () => {
      await recusado()
      aoMudar[campo]({ empty: false, complete: false })
      await flushPromises()
      expect(botaoPix().exists()).toBe(false)
    })
  }

  it('gone when the edit leaves a typing error in the field (that message replaces the decline)', async () => {
    await recusado()
    aoMudar.cardCvc({ empty: false, complete: false, error: { type: 'validation_error', code: 'incomplete_cvc', message: 'O código de segurança do cartão está incompleto.' } })
    await flushPromises()
    expect(erro()).toBe('O código de segurança do cartão está incompleto.')
    expect(botaoPix().exists()).toBe(false)
  })

  it('gone when the buyer edits the name on the card', async () => {
    await recusado()
    await w.find('#pic-card-nome').setValue('Nome Teste')
    expect(botaoPix().exists()).toBe(false)
  })
})

describe('inline checkout: tapping "Pagar com Pix" after a failed card attempt', () => {
  it('switches to the Pix tab and generates the Pix the way the Pix tab does', async () => {
    await recusado()
    const porta = adiado<any>()
    respostaPix = () => porta.p
    await botaoPix().trigger('click'); await flushPromises()
    expect(abaPix().attributes('aria-selected')).toBe('true')
    expect(pixGerados()).toHaveLength(1)
    expect(pixGerados()[0].body).toMatchObject({ placa: PLACA, email: EMAIL, plano: 'completa', cupom: 'FAKE10' })
    porta.soltar(pixOk()); await flushPromises()
    expect(w.find('img.pic-qr').exists()).toBe(true)
  })

  it('disabled while the Pix is being generated', async () => {
    await recusado()
    const porta = adiado<any>()
    respostaPix = () => porta.p
    await botaoPix().trigger('click'); await flushPromises()
    expect(desabilitado('.pic-cartao-form .pic-cartao-pix')).toBe(true)
    porta.soltar(pixOk()); await flushPromises()
  })

  it('a second tap while the Pix is being generated starts nothing', async () => {
    await recusado()
    const porta = adiado<any>()
    respostaPix = () => porta.p
    const b = botaoPix()
    await b.trigger('click')
    b.element.dispatchEvent(new Event('click')); await flushPromises()
    porta.soltar(pixOk()); await flushPromises()
    expect(pixGerados()).toHaveLength(1)
  })

  it('a tap that reaches it while a new card attempt is processing starts no Pix and keeps the card tab', async () => {
    await recusado()
    const velho = botaoPix().element // removed from the page once the new attempt starts
    const porta = adiado<any>()
    respostaIntent = () => porta.p
    await botao().trigger('click'); await flushPromises()
    velho.dispatchEvent(new Event('click')); await flushPromises()
    expect(pixGerados()).toHaveLength(0)
    expect(abaCartaoAtiva()).toBe(true)
    porta.soltar({ token: 't', plano: 'completa', valor: COM_CUPOM, clientSecret: 'sec-ok' }); await flushPromises()
    expect(confirmados()).toEqual(['sec1', 'sec-ok'])
  })

  it('the usual checks still apply: an e-mail made incomplete after the decline stops the Pix', async () => {
    await recusado()
    await digitarEmail('buyer-at-example')
    await botaoPix().trigger('click'); await flushPromises()
    expect(pixGerados()).toHaveLength(0)
    expect((document.activeElement as HTMLElement | null)?.id).toBe('pic-email')
  })
})

describe('inline checkout: network or Stripe error on the card confirmation', () => {
  // The confirmation may have reached Stripe and charged with the answer lost
  // on the way back, so the intent is read before the buyer is told anything.
  const falhaApi = (type: string) => ({ type, message: 'Falha de conexão.' })

  for (const tipo of ['api_connection_error', 'api_error']) {
    it(`${tipo}, intent read as succeeded: the paid path (report, history, conversion), no Pix offer`, async () => {
      await prontoComCupom()
      recusar(falhaApi(tipo))
      ler.mockImplementationOnce(async () => ({ paymentIntent: { status: 'succeeded' } }))
      await pagar()
      expect(ler.mock.calls).toEqual([['sec1']])
      expect(assign.mock.calls).toEqual([['/premium/tok1']])
      expect(histAdd).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok1', status: 'consultando' }))
      expect(trackConversionPaga).toHaveBeenCalledTimes(1)
      expect(erro()).toBe('')
      expect(botaoPix().exists()).toBe(false)
      expect(desabilitado('.pic-cartao-form .pic-btn--primary')).toBe(true)
    })
  }

  it('intent read as processing: the paid path, the conversion left to the report page', async () => {
    await prontoComCupom()
    recusar(falhaApi('api_connection_error'))
    ler.mockImplementationOnce(async () => ({ paymentIntent: { status: 'processing' } }))
    await pagar()
    expect(assign.mock.calls).toEqual([['/premium/tok1']])
    expect(histAdd).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok1', status: 'consultando' }))
    expect(trackConversionPaga).not.toHaveBeenCalled()
    expect(erro()).toBe('')
    expect(botaoPix().exists()).toBe(false)
  })

  for (const [nome, leitura] of [
    ['read with another status', async () => ({ paymentIntent: { status: 'requires_payment_method' } })],
    ['that cannot be read (error answer)', async () => ({ error: { type: 'api_connection_error', message: 'Falha de conexão.' } })],
    ['that cannot be read (exception)', async () => { throw new Error('offline') }],
  ] as const) {
    it(`intent ${nome}: the message and the Pix offer, as before`, async () => {
      await prontoComCupom()
      recusar(falhaApi('api_connection_error'))
      ler.mockImplementationOnce(leitura)
      await pagar()
      expect(ler.mock.calls).toEqual([['sec1']])
      expect(assign).not.toHaveBeenCalled()
      expect(erro()).toBe('Falha de conexão.')
      expect(botaoPix().exists()).toBe(true)
    })
  }

  it('a card decline speaks for itself: the intent is not read', async () => {
    await prontoComCupom()
    recusar(ERROS_STRIPE.insufficient_funds)
    await pagar()
    expect(ler).not.toHaveBeenCalled()
  })
})
