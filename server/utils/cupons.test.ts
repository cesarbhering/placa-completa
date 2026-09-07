import { describe, it, expect } from 'vitest'
import { validarCupom } from './cupons'

// Cupom de recuperacao e uma oferta PESSOAL: vale pra quem recebeu o e-mail,
// naquela placa. Se o codigo vazar num grupo, tem que continuar sem valer pros
// outros, senao vira desconto geral sem ninguem ter decidido isso.
function supabaseCom(cupom: any, usos = 0) {
  return {
    from(tabela: string) {
      if (tabela === 'cupons_premium') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: cupom, error: null }) }) }) }
      }
      // cupons_premium_usos: contagem
      return {
        select: () => {
          const q: any = {
            eq: () => q,
            then: (fn: any) => fn({ count: usos }),
          }
          return q
        },
      }
    },
  } as any
}

const BASE = {
  id: 'c1',
  codigo: 'CUPOM10ABCDE',
  tipo: 'percentual',
  valor: 10,
  planos: ['basica', 'completa'],
  ativo: true,
  valido_de: null,
  valido_ate: null,
  limite_uso_global: 1,
  limite_uso_por_cliente: 1,
  permite_gratis: false,
  email_restrito: 'dono@exemplo.com',
  placa_restrita: 'ABC1D23',
  origem: 'pix_recover',
}

describe('cupom pessoal de recuperacao', () => {
  it('vale pro dono, na placa dele', async () => {
    const r = await validarCupom(supabaseCom(BASE), 'CUPOM10ABCDE', 'completa', 'dono@exemplo.com', 'ABC1D23')
    expect(r.ok).toBe(true)
    expect(r.descontoCentavos).toBeGreaterThan(0)
  })

  it('ignora caixa e espaco no e-mail', async () => {
    const r = await validarCupom(supabaseCom(BASE), 'CUPOM10ABCDE', 'completa', '  Dono@Exemplo.COM ', 'abc1d23')
    expect(r.ok).toBe(true)
  })

  it('nao vale pra outra pessoa, mesmo com o codigo certo', async () => {
    const r = await validarCupom(supabaseCom(BASE), 'CUPOM10ABCDE', 'completa', 'outra@exemplo.com', 'ABC1D23')
    expect(r.ok).toBe(false)
    expect(r.descontoCentavos).toBe(0)
    expect(r.motivo).toMatch(/pessoal/i)
  })

  it('nao vale pra outra placa da mesma pessoa', async () => {
    const r = await validarCupom(supabaseCom(BASE), 'CUPOM10ABCDE', 'completa', 'dono@exemplo.com', 'XYZ9K88')
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/placa/i)
  })

  it('sem e-mail informado, nao libera desconto pessoal na validacao previa', async () => {
    const r = await validarCupom(supabaseCom(BASE), 'CUPOM10ABCDE', 'completa', undefined, 'ABC1D23')
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/pessoal/i)
  })

  it('cupom sem restricao continua valendo pra qualquer um', async () => {
    const aberto = { ...BASE, email_restrito: null, placa_restrita: null, origem: null }
    const r = await validarCupom(supabaseCom(aberto), 'CUPOM10ABCDE', 'completa', 'qualquer@exemplo.com', 'QQQ0Q00')
    expect(r.ok).toBe(true)
  })

  it('cupom expirado nao vale nem pro dono', async () => {
    const vencido = { ...BASE, valido_ate: new Date(Date.now() - 86400000).toISOString() }
    const r = await validarCupom(supabaseCom(vencido), 'CUPOM10ABCDE', 'completa', 'dono@exemplo.com', 'ABC1D23')
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/expirado/i)
  })

  it('desconto de 10% respeita o piso do plano', async () => {
    const r = await validarCupom(supabaseCom(BASE), 'CUPOM10ABCDE', 'completa', 'dono@exemplo.com', 'ABC1D23')
    expect(r.precoLiquidoCentavos).toBeGreaterThanOrEqual(1490)
    expect(r.precoLiquidoCentavos).toBe(r.precoBrutoCentavos - r.descontoCentavos)
  })
})
