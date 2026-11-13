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
let respostaPix: (b: any) => any
let confirmar: ReturnType<typeof vi.fn>
let assign: ReturnType<typeof vi.fn>
let trackConversionPaga: ReturnType<typeof vi.fn>
let histAdd: ReturnType<typeof vi.fn>
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
  ;(window as any).Stripe = () => ({ elements: () => ({ create: () => ({ mount() {}, on() {} }) }), confirmCardPayment: confirmar })
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
