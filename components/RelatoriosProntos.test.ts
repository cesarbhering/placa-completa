import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, reactive } from 'vue'
import { CHAVE_AVISO_MOSTRADOS } from '../shared/relatorio-pendente'

const estados = new Map<string, any>()
const rota = reactive({ path: '/' })
const isCapacitor = ref(false)
const aviso = ref<any>(null)
const checkoutAberto = ref(false)
const navegou: string[] = []
const fetchMock = vi.fn(async () => ({ status: 'pago' }))

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('useState', (k: string, init: () => any) => {
  if (!estados.has(k)) estados.set(k, ref(init()))
  return estados.get(k)
})
vi.stubGlobal('useRoute', () => rota)
vi.stubGlobal('useAppMode', () => ({ isCapacitor }))
vi.stubGlobal('useRecuperacaoPlay', () => ({ aviso, checkoutAberto }))
vi.stubGlobal('useIdioma', () => ({ t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k) }))
vi.stubGlobal('navigateTo', (to: string) => { navegou.push(to) })
vi.stubGlobal('$fetch', fetchMock)

const { useConsultaHistory } = await import('../composables/useConsultaHistory')
vi.stubGlobal('useConsultaHistory', useConsultaHistory)
const { default: RelatoriosProntos } = await import('./RelatoriosProntos.vue')

const UA_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
let ua = UA_PHONE
Object.defineProperty(window.navigator, 'userAgent', { get: () => ua, configurable: true })

const KEY = 'pc_consultas_v1'
const salvar = (itens: any[]) => localStorage.setItem(KEY, JSON.stringify(itens.map((i) => ({ veiculo: null, criadoEm: '', atualizadoEm: '', ...i }))))
const card = () => document.body.querySelector('.rpr-card')

let w: VueWrapper | null = null
async function montar() {
  w = mount(RelatoriosProntos, { attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  estados.clear()
  rota.path = '/'
  isCapacitor.value = false
  aviso.value = null
  checkoutAberto.value = false
  navegou.length = 0
  fetchMock.mockClear()
  ua = UA_PHONE
})
afterEach(() => { w?.unmount(); w = null; document.body.innerHTML = '' })

describe('RelatoriosProntos (ready report notice)', () => {
  it('shows on a phone with the plate and an open button, as an accessible dialog', async () => {
    salvar([{ token: 'tok-1', placa: 'AAA1A11', status: 'entregue', aberto: false }])
    await montar()
    const c = card()!
    expect(c).toBeTruthy()
    expect(c.getAttribute('role')).toBe('dialog')
    expect(c.getAttribute('aria-modal')).toBe('true')
    expect(c.textContent).toContain('relatoriosProntos.tituloUm')
    expect(c.textContent).toContain('AAA1A11')
    expect(document.activeElement?.closest('.rpr-card')).toBe(c)
  })

  it('lists each pending report with its own button and uses the plural title', async () => {
    salvar([
      { token: 'tok-1', placa: 'AAA1A11', status: 'entregue', aberto: false },
      { token: 'tok-2', placa: 'BBB2B22', status: 'entregue', aberto: false },
      { token: 'tok-3', placa: 'CCC3C33', status: 'entregue' },
    ])
    await montar()
    expect(card()!.textContent).toContain('relatoriosProntos.tituloVarios')
    expect(document.body.querySelectorAll('.rpr-acao')).toHaveLength(2)
    expect(card()!.textContent).not.toContain('CCC3C33')
  })

  it('does not show for legacy items without the opened field', async () => {
    salvar([{ token: 'tok-old', placa: 'AAA1A11', status: 'entregue' }])
    await montar()
    expect(card()).toBeNull()
  })

  it('does not show on desktop', async () => {
    ua = UA_DESKTOP
    salvar([{ token: 'tok-1', placa: 'AAA1A11', status: 'entregue', aberto: false }])
    await montar()
    expect(card()).toBeNull()
  })

  it('shows in the app even without a phone user agent', async () => {
    ua = UA_DESKTOP
    isCapacitor.value = true
    salvar([{ token: 'tok-1', placa: 'AAA1A11', status: 'entregue', aberto: false }])
    await montar()
    expect(card()).toBeTruthy()
  })

  it('does not show on /premium pages', async () => {
    rota.path = '/premium/tok-1'
    salvar([{ token: 'tok-1', placa: 'AAA1A11', status: 'entregue', aberto: false }])
    await montar()
    expect(card()).toBeNull()
  })

  it('shows once per session: closed, it stays closed on the next mount', async () => {
    salvar([{ token: 'tok-1', placa: 'AAA1A11', status: 'entregue', aberto: false }])
    await montar()
    ;(document.body.querySelector('.rpr-x') as HTMLButtonElement).click()
    await nextTick()
    expect(card()).toBeNull()
    expect(JSON.parse(sessionStorage.getItem(CHAVE_AVISO_MOSTRADOS)!)).toEqual(['tok-1'])
    w!.unmount(); w = null
    estados.clear()
    await montar()
    expect(card()).toBeNull()
  })

  it('Escape closes the dialog', async () => {
    salvar([{ token: 'tok-1', placa: 'AAA1A11', status: 'entregue', aberto: false }])
    await montar()
    card()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(card()).toBeNull()
  })

  it('the open button marks the report as opened and goes to it', async () => {
    salvar([{ token: 'tok-1', placa: 'AAA1A11', status: 'entregue', aberto: false }])
    await montar()
    ;(document.body.querySelector('.rpr-acao') as HTMLButtonElement).click()
    await nextTick()
    expect(navegou).toEqual(['/premium/tok-1'])
    expect(JSON.parse(localStorage.getItem(KEY)!)[0].aberto).toBe(true)
    expect(card()).toBeNull()
  })

  it('shows after a Google Play recovery round adds a ready report, not only on first mount', async () => {
    isCapacitor.value = true
    await montar()
    expect(card()).toBeNull()
    useConsultaHistory().add({ token: 'tok-play', placa: 'DDD4D44', status: 'entregue', aberto: false })
    aviso.value = { token: 'tok-play', placa: 'DDD4D44' }
    await nextTick(); await nextTick()
    expect(card()!.textContent).toContain('DDD4D44')
    // the small Play toast would repeat the same message under the dialog
    expect(aviso.value).toBeNull()
  })

  it('shows again when the app comes back from the background', async () => {
    isCapacitor.value = true
    salvar([{ token: 'tok-1', placa: 'AAA1A11', status: 'entregue', aberto: false }])
    await montar()
    ;(document.body.querySelector('.rpr-x') as HTMLButtonElement).click()
    await nextTick()
    expect(card()).toBeNull()
    window.dispatchEvent(new Event('pc-app-resume'))
    await flushPromises(); await nextTick()
    expect(card()).toBeTruthy()
  })

  it('re-checks unopened paid orders with the server and shows them once delivered', async () => {
    fetchMock.mockResolvedValueOnce({ status: 'entregue' } as any)
    salvar([{ token: 'tok-1', placa: 'AAA1A11', status: 'consultando', aberto: false }])
    await montar()
    await flushPromises(); await nextTick()
    expect(fetchMock).toHaveBeenCalledWith('/api/premium/status', { query: { token: 'tok-1' } })
    expect(card()).toBeTruthy()
  })
})
