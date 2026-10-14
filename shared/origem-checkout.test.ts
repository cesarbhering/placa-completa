import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const arq = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')
import { ORIGENS_CHECKOUT, sanearOrigemCheckout, origemDoCta, ROTULO_ORIGEM_CHECKOUT } from './origem-checkout'

describe('origem do checkout', () => {
  it('saneia: so o enum passa', () => {
    for (const o of ORIGENS_CHECKOUT) expect(sanearOrigemCheckout(o)).toBe(o)
    for (const o of ['home_hero', '', null, 42, 'bloco bloqueado', "x'; drop"]) expect(sanearOrigemCheckout(o)).toBeNull()
  })
  it('clique (origem_cta) -> origem do checkout', () => {
    expect(origemDoCta('bloco_bloqueado')).toBe('bloco_bloqueado')
    expect(origemDoCta('barra_fixa')).toBe('barra_fixa')
    expect(origemDoCta('layout_a')).toBe('bloco_bloqueado')
    expect(origemDoCta('tag')).toBe('bloco_bloqueado')
    expect(origemDoCta('qualquer')).toBe('outro')
  })
  it('todo rotulo existe, inclusive "nao medido"', () => {
    for (const o of ORIGENS_CHECKOUT) expect(ROTULO_ORIGEM_CHECKOUT[o]).toBeTruthy()
    expect(ROTULO_ORIGEM_CHECKOUT.nao_medido).toBe('não medido')
  })
})

describe('caminhos que abrem o checkout na home passam a origem', () => {
  const vue = arq('pages/index.vue')
  // tira comentarios HTML (botao da basica desativado fica em comentario)
  const semComentario = vue.replace(/<!--[\s\S]*?-->/g, '')
  it('openPremiumCheckout e consultFromGrid sempre com uma origem do enum', () => {
    const chamadas = [...semComentario.matchAll(/\b(openPremiumCheckout|consultFromGrid)\(([^)]*)\)/g)]
      .filter((m) => !/^\s*plano\?:/.test(m[2]) && !m[0].includes('function'))
    expect(chamadas.length).toBeGreaterThanOrEqual(6)
    for (const m of chamadas) {
      const args = m[2]
      const ok = /'(\w+)'\s*$/.exec(args)?.[1]
      const valida = (ok && (ORIGENS_CHECKOUT as readonly string[]).includes(ok)) || /origemDoCta\(|, origem$/.test(args.trim())
      expect(valida, `${m[0]} sem origem do enum`).toBeTruthy()
    }
  })
  it('cada porta esperada aparece', () => {
    for (const o of ['link_direto', 'hero_home', 'escada_planos', 'hero_apos_cta']) expect(semComentario).toContain(`'${o}'`)
    expect(semComentario).toContain("cliqueCtaCompleta('bloco_bloqueado')")
    expect(semComentario).toContain("cliqueCtaCompleta('barra_fixa')")
    expect(semComentario).toContain(':origem-checkout="premiumOrigem"')
  })
  it('a pagina /premium (recuperacao de Pix) e o checkout mandam origem_checkout', () => {
    expect(arq('pages/premium/index.vue')).toContain("origem_checkout: route.query.placa ? 'pix_recovery' : 'outro'")
    const ck = arq('components/PremiumInlineCheckout.vue')
    expect(ck.match(/origem_checkout: props\.origemCheckout/g)).toHaveLength(3) // Pix, cartao, Google Play
  })
})

describe('o pedido grava a porta de entrada (Pix, cartao, Play)', () => {
  it('cada endpoint que cria pedido saneia e grava origem_checkout', () => {
    for (const f of ['server/api/premium/checkout.post.ts', 'server/api/premium/cartao-intent.post.ts', 'server/api/premium/google-play/verificar.post.ts', 'server/api/premium/checkout-stripe.post.ts']) {
      expect(arq(f), f).toContain('origem_checkout: sanearOrigemCheckout(body.origem_checkout)')
    }
  })
})
