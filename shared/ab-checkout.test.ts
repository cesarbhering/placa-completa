import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AB_CHECKOUT_KEY, decidirVarianteCheckout, varianteCheckoutAtual, linhaRiscoB, DESBLOQUEIA_B, GARANTIA_B,
} from './ab-checkout'
import { enfileirarEventoFunil, _filaFunil, _limparFilaFunil } from '~/composables/useAnalytics'

let store: Map<string, string>
function sessao(inicial?: string, ua = 'Mozilla/5.0') {
  store = new Map()
  if (inicial) store.set(AB_CHECKOUT_KEY, inicial)
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  })
  vi.stubGlobal('navigator', { userAgent: ua })
}

describe('ab_checkout: sorteio 50/50 e persistencia', () => {
  beforeEach(() => { vi.unstubAllGlobals(); _limparFilaFunil() })

  it('rnd < 0.5 vira A, >= 0.5 vira B', () => {
    sessao(); expect(decidirVarianteCheckout({ rnd: () => 0.49 })).toBe('A')
    sessao(); expect(decidirVarianteCheckout({ rnd: () => 0.5 })).toBe('B')
  })

  it('distribuicao perto de 50/50 com Math.random', () => {
    let b = 0
    for (let i = 0; i < 4000; i++) { sessao(); if (decidirVarianteCheckout() === 'B') b++ }
    expect(b / 4000).toBeGreaterThan(0.45)
    expect(b / 4000).toBeLessThan(0.55)
  })

  it('grava na sessao e nao re-sorteia', () => {
    sessao()
    expect(decidirVarianteCheckout({ rnd: () => 0.9 })).toBe('B')
    expect(store.get(AB_CHECKOUT_KEY)).toBe('B')
    expect(decidirVarianteCheckout({ rnd: () => 0.1 })).toBe('B')
    expect(varianteCheckoutAtual()).toBe('B')
  })

  it('valor invalido guardado e re-sorteado', () => {
    sessao('A2')
    expect(decidirVarianteCheckout({ rnd: () => 0.1 })).toBe('A')
  })

  it('app (opcao app) sempre A e nada gravado', () => {
    sessao()
    expect(decidirVarianteCheckout({ app: true, rnd: () => 0.9 })).toBe('A')
    expect(store.has(AB_CHECKOUT_KEY)).toBe(false)
  })

  it('app detectado pelo user-agent: sempre A, sem carimbo mesmo com B guardado', () => {
    sessao('B', 'Mozilla/5.0 PlacaCompletaApp/3')
    expect(decidirVarianteCheckout({ rnd: () => 0.9 })).toBe('A')
    expect(varianteCheckoutAtual()).toBeNull()
  })
})

describe('ab_checkout nos eventos do funil', () => {
  beforeEach(() => { vi.unstubAllGlobals(); _limparFilaFunil() })

  it('premium_checkout_open sorteia e ja sai carimbado; eventos seguintes herdam', () => {
    sessao()
    enfileirarEventoFunil('premium_checkout_open', { plano: 'completa' })
    const v = _filaFunil()[0]?.extra?.ab_checkout
    expect(v === 'A' || v === 'B').toBe(true)
    for (const ev of ['checkout_confirm_visto', 'pix_gerado', 'checkout_fechado_sem_pagar', 'email_informado', 'checklist_marcado']) {
      enfileirarEventoFunil(ev, { plano: 'completa' })
    }
    expect(_filaFunil().map(e => e.extra?.ab_checkout)).toEqual(Array(6).fill(v))
  })

  it('antes de abrir o checkout nao inventa variante', () => {
    sessao()
    enfileirarEventoFunil('resultado_exibido', { placa: 'ABC1D23' })
    expect(_filaFunil()[0]?.extra ?? null).toBeNull()
  })

  it('no app nada e carimbado', () => {
    sessao(undefined, 'PlacaCompletaApp/3')
    enfileirarEventoFunil('premium_checkout_open', { plano: 'completa' })
    expect(_filaFunil()[0]?.extra?.ab_checkout).toBeUndefined()
    expect(store.has(AB_CHECKOUT_KEY)).toBe(false)
  })
})

describe('copy da variante B', () => {
  it('linha de risco com o preco', () => {
    expect(linhaRiscoB('R$ 44,90')).toBe('Um carro que passou por leilão vale até 30% menos na revenda. Saber antes custa R$ 44,90.')
  })
  it('sem travessao, sem exclamacao, sem SENATRAN/DETRAN, cinco itens', () => {
    const tudo = [...DESBLOQUEIA_B, linhaRiscoB('R$ 1,00'), GARANTIA_B].join(' ')
    expect(tudo).not.toMatch(/[—!]/)
    expect(tudo).not.toMatch(/senatran|detran/i)
    expect(DESBLOQUEIA_B).toHaveLength(5)
  })
})

// Contrato do componente (mesmo estilo de PremiumInlineCheckout.pix.test.ts).
describe('PremiumInlineCheckout: variante B', () => {
  const src = readFileSync(join(process.cwd(), 'components/PremiumInlineCheckout.vue'), 'utf8')

  it('app sempre ve A: varianteB exige !isCapacitor e plano completa', () => {
    expect(src).toContain("const varianteB = computed(() => !isCapacitor.value && props.plano === 'completa' && abCheckout.value === 'B')")
    expect(src).toContain('decidirVarianteCheckout({ app: isCapacitor.value })')
  })

  it('cupom pela URL continua aplicado no B: abre o campo e valida sozinho', () => {
    const mount = src.slice(src.indexOf('const daUrl ='), src.indexOf('consultarPreview()\n})'))
    expect(mount).toContain('cupomAberto.value = true')
    expect(mount).toContain('validarCupom()')
    // No B o campo aberto e o mesmo input e mostra a mensagem de ok.
    const blocoB = src.slice(src.indexOf('<div v-if="varianteB" class="pic-cupom pic-cupom--b">'), src.indexOf('<!-- Logos de pagamento'))
    expect(blocoB.length).toBeGreaterThan(100)
    expect(blocoB).toContain('v-if="!cupomAberto"')
    expect(blocoB).toContain('Tenho um cupom')
    expect(blocoB).toContain('id="pic-cupom"')
    expect(blocoB).toContain("cupomValido ? 'pic-cupom__ok'")
    // cupom pessoal: o e-mail aparece junto, com o id que validarCheckout foca
    expect(blocoB).toContain('id="pic-email"')
  })

  it('pedido leva ab_checkout no Pix e no cartao', () => {
    expect(src.match(/ab_checkout: abCheckoutPedido\.value,/g)).toHaveLength(2)
  })

  it('B: e-mail fora da confirmacao, pedido na tela do QR; checklist some', () => {
    expect(src).toContain('<div v-if="!varianteB" class="pic-campo">')
    expect(src).toContain('<ul v-if="!varianteB" class="pic-conf">')
    expect(src).toContain('@click="salvarEmailNoPix"')
    expect(src).toMatch(/salvarEmailNoPix[\s\S]*\/api\/premium\/email[\s\S]*marcarEmailInformado\('pix'\)/)
  })
})
