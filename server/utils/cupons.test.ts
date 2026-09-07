import { describe, it, expect } from 'vitest'
import { validarCupom } from './cupons'

// Cupom de recuperacao e uma oferta PESSOAL: vale pra quem recebeu o e-mail,
// e vence em 24 horas. A placa NAO restringe (ela pode ter desistido de uma e
// comprar outra); o que nao pode e o codigo vazar num grupo e virar desconto
// geral sem ninguem ter decidido isso.
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
  placa_restrita: null,
  origem: 'pix_recover',
}

describe('cupom pessoal de recuperacao', () => {
  it('vale pro dono, na placa dele', async () => {
    const r = await validarCupom(supabaseCom(BASE), 'CUPOM10ABCDE', 'completa', 'dono@exemplo.com')
    expect(r.ok).toBe(true)
    expect(r.descontoCentavos).toBeGreaterThan(0)
  })

  it('ignora caixa e espaco no e-mail', async () => {
    const r = await validarCupom(supabaseCom(BASE), 'CUPOM10ABCDE', 'completa', '  Dono@Exemplo.COM ')
    expect(r.ok).toBe(true)
  })

  it('nao vale pra outra pessoa, mesmo com o codigo certo', async () => {
    const r = await validarCupom(supabaseCom(BASE), 'CUPOM10ABCDE', 'completa', 'outra@exemplo.com')
    expect(r.ok).toBe(false)
    expect(r.descontoCentavos).toBe(0)
    expect(r.motivo).toMatch(/pessoal/i)
  })

  it('vale pro dono em qualquer placa: a restricao e a pessoa, nao o veiculo', async () => {
    const r = await validarCupom(supabaseCom(BASE), 'CUPOM10ABCDE', 'completa', 'dono@exemplo.com')
    expect(r.ok).toBe(true)
  })

  it('sem e-mail (link do e-mail abre com o cupom pronto) mostra o desconto e pede o e-mail', async () => {
    const r = await validarCupom(supabaseCom(BASE), 'CUPOM10ABCDE', 'completa', undefined)
    expect(r.ok).toBe(true)
    expect(r.exigeEmail).toBe(true)
    expect(r.descontoCentavos).toBeGreaterThan(0)
  })

  it('cupom sem restricao continua valendo pra qualquer um', async () => {
    const aberto = { ...BASE, email_restrito: null, placa_restrita: null, origem: null }
    const r = await validarCupom(supabaseCom(aberto), 'CUPOM10ABCDE', 'completa', 'qualquer@exemplo.com')
    expect(r.ok).toBe(true)
  })

  it('vencido diz a data e a hora, nao um "invalido" generico', async () => {
    // 05/09/2026 as 18h30 em Brasilia (UTC-3) = 21:30Z.
    const vencido = { ...BASE, valido_ate: '2026-09-05T21:30:00.000Z' }
    const r = await validarCupom(supabaseCom(vencido), 'CUPOM10ABCDE', 'completa', 'dono@exemplo.com')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('Este cupom venceu em 05/09 as 18h30.')
  })

  it('ja utilizado diz que ja foi usado, nao que e invalido', async () => {
    const r = await validarCupom(supabaseCom(BASE, 1), 'CUPOM10ABCDE', 'completa', 'dono@exemplo.com')
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/ja foi utilizado/i)
  })

  it('desconto de 10% respeita o piso do plano', async () => {
    const r = await validarCupom(supabaseCom(BASE), 'CUPOM10ABCDE', 'completa', 'dono@exemplo.com')
    expect(r.precoLiquidoCentavos).toBeGreaterThanOrEqual(1490)
    expect(r.precoLiquidoCentavos).toBe(r.precoBrutoCentavos - r.descontoCentavos)
  })
})
