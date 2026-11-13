import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { snakeCase } from 'scule'
// The same function Nitro runs at startup to override runtimeConfig from env.
import { applyEnv } from 'nitropack/runtime/internal/utils.env'
import { limitesCupomDoConfig } from './cupom-limite'
import { limitesDoConfig } from './checkout-limite'

// The documented env names of the checkout and coupon limits must be exactly
// the names Nitro derives from the runtimeConfig keys, otherwise setting the
// env on the running container has no effect.
const DOCUMENTADAS: Record<string, string> = {
  checkoutLimitePlacaHora: 'NUXT_CHECKOUT_LIMITE_PLACA_HORA',
  checkoutLimiteCartaoPlacaHora: 'NUXT_CHECKOUT_LIMITE_CARTAO_PLACA_HORA',
  checkoutDisjuntorCartao_10min: 'NUXT_CHECKOUT_DISJUNTOR_CARTAO_10MIN',
  cupomLimitePlacaHora: 'NUXT_CUPOM_LIMITE_PLACA_HORA',
  cupomLimiteGlobal_10min: 'NUXT_CUPOM_LIMITE_GLOBAL_10MIN',
}

describe('limit env names', () => {
  const salvo = { ...process.env }
  afterEach(() => { process.env = { ...salvo } })

  it('nuxt.config reads the documented env under a key Nitro maps to the same name', () => {
    const fonte = readFileSync('nuxt.config.ts', 'utf8')
    for (const [chave, env] of Object.entries(DOCUMENTADAS)) {
      expect(fonte, chave).toMatch(new RegExp(`\\n\\s+${chave}: process\\.env\\.${env} \\|\\| ""`))
      expect(`NUXT_${snakeCase(chave).toUpperCase()}`).toBe(env)
    }
  })

  it('the documented env reaches the limits at runtime', () => {
    const config: any = Object.fromEntries(Object.keys(DOCUMENTADAS).map((k) => [k, '']))
    process.env.NUXT_CUPOM_LIMITE_PLACA_HORA = '3'
    process.env.NUXT_CUPOM_LIMITE_GLOBAL_10MIN = '7'
    process.env.NUXT_CHECKOUT_DISJUNTOR_CARTAO_10MIN = '0'
    process.env.NUXT_CHECKOUT_LIMITE_PLACA_HORA = '4'
    applyEnv(config, { prefix: 'NUXT_', altPrefix: 'NITRO_' })
    expect(limitesCupomDoConfig(config)).toEqual({ placaHora: 3, global10min: 7 })
    expect(limitesDoConfig(config)).toMatchObject({ placaHora: 4, cartaoGlobal10min: 0 })
  })
})
