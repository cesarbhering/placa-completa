import { describe, it, expect } from 'vitest'
import { codigoBump, cupomBumpDoPedido, pedidoElegivelBump, descontoBumpCentavos, VALIDADE_BUMP_MS } from './cupom-bump'
import { origemDoCupom } from './cupom-recompra'
import { aplicarCupom } from '../../shared/planos'
import { linkBump, veioDoBump, PRECO_BUMP_CENTAVOS } from '../../shared/cupom-bump'
import { sanearOrigemCheckout } from '../../shared/origem-checkout'

const PED = { id: '00000000-0000-4000-8000-000000000001', status: 'entregue', email: 'Comprador@Exemplo.com', valor_centavos: 4490 }
const T0 = Date.UTC(2026, 10, 4, 15, 0, 0)

function fakeSb(opts: { cupom?: any; usos?: number } = {}) {
  let cupom = opts.cupom ?? null
  const inserts: any[] = []
  return {
    inserts,
    from: (t: string) => {
      if (t === 'cupons_premium_usos') return { select: () => ({ eq: async () => ({ count: opts.usos ?? 0 }) }) }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: cupom }) }) }),
        insert: async (row: any) => { inserts.push(row); cupom = { id: 'c1', codigo: row.codigo, valido_ate: row.valido_ate, ativo: true }; return { error: null } },
      }
    },
  }
}

describe('pedido acoplado (segunda placa por R$ 29,90)', () => {
  it('codigo deterministico por pedido, sem caracteres ambiguos', () => {
    expect(codigoBump(PED.id)).toBe(codigoBump(PED.id))
    expect(codigoBump(PED.id)).toMatch(/^SEGUNDA[A-HJ-NP-Z2-9]{6}$/)
    expect(codigoBump('outro')).not.toBe(codigoBump(PED.id))
  })

  it('desconto fixo leva a completa a 29,90 pelo calculo de sempre', () => {
    expect(descontoBumpCentavos()).toBe(1500)
    expect(aplicarCupom('completa', { tipo: 'fixo', valor: descontoBumpCentavos(), planos: ['completa'] }).precoLiquidoCentavos).toBe(PRECO_BUMP_CENTAVOS)
  })

  it('cria cupom preso ao e-mail, 1 uso, 24 h, so a completa, sem pedido_origem_id', async () => {
    const sb = fakeSb()
    const c = await cupomBumpDoPedido(sb, PED, T0)
    expect(c).toEqual({ codigo: codigoBump(PED.id), validoAte: new Date(T0 + VALIDADE_BUMP_MS).toISOString(), precoCentavos: 2990 })
    expect(sb.inserts[0]).toMatchObject({
      tipo: 'fixo', valor: 1500, planos: ['completa'], ativo: true, limite_uso_global: 1, limite_uso_por_cliente: 1,
      permite_gratis: false, email_restrito: 'comprador@exemplo.com', origem: 'bump',
    })
    expect(sb.inserts[0]).not.toHaveProperty('pedido_origem_id')
  })

  it('segunda chamada devolve o mesmo cupom sem criar outro; prazo nao reinicia', async () => {
    const existente = { id: 'c1', codigo: codigoBump(PED.id), valido_ate: new Date(T0 + VALIDADE_BUMP_MS).toISOString(), ativo: true }
    const sb = fakeSb({ cupom: existente })
    const c = await cupomBumpDoPedido(sb, PED, T0 + 60 * 60 * 1000)
    expect(c?.validoAte).toBe(existente.valido_ate)
    expect(sb.inserts).toHaveLength(0)
  })

  it('vencido ou ja usado: sem oferta', async () => {
    const existente = { id: 'c1', codigo: codigoBump(PED.id), valido_ate: new Date(T0).toISOString(), ativo: true }
    expect(await cupomBumpDoPedido(fakeSb({ cupom: existente }), PED, T0 + 1)).toBeNull()
    const valido = { ...existente, valido_ate: new Date(T0 + 1000).toISOString() }
    expect(await cupomBumpDoPedido(fakeSb({ cupom: valido, usos: 1 }), PED, T0)).toBeNull()
  })

  it('elegibilidade: pago, com e-mail, fora do app e nao vindo de outro bump', () => {
    expect(pedidoElegivelBump(PED)).toBe(true)
    expect(pedidoElegivelBump({ ...PED, status: 'consultando' })).toBe(true)
    expect(pedidoElegivelBump({ ...PED, status: 'aguardando_pagamento' })).toBe(false)
    expect(pedidoElegivelBump({ ...PED, status: 'reembolsado' })).toBe(false)
    expect(pedidoElegivelBump({ ...PED, email: null })).toBe(false)
    expect(pedidoElegivelBump({ ...PED, valor_centavos: 0 })).toBe(false)
    expect(pedidoElegivelBump({ ...PED, pix_provider: 'google_play' })).toBe(false)
    expect(pedidoElegivelBump({ ...PED, cupom_origem: 'cupom_bump' })).toBe(false)
    expect(pedidoElegivelBump({ ...PED, cupom_origem: 'cupom_recompra' })).toBe(true)
  })

  it('pedido pago com o cupom de bump sai marcado; origem do checkout e link', () => {
    expect(origemDoCupom({ ok: true, origem: 'bump' })).toEqual({ cupom_origem: 'cupom_bump' })
    expect(origemDoCupom({ ok: false, origem: 'bump' })).toEqual({})
    expect(sanearOrigemCheckout('bump')).toBe('bump')
    expect(linkBump('SEGUNDAABC234')).toBe('/?plano=completa&cupom=SEGUNDAABC234&origem=bump')
    expect(veioDoBump({ origem: 'bump' })).toBe(true)
    expect(veioDoBump({ origem: 'x' })).toBe(false)
    expect(veioDoBump({})).toBe(false)
  })
})

describe('pedido acoplado de ponta a ponta: cupom criado passa pela validacao do checkout', async () => {
  const { validarCupom } = await import('./cupons')
  // Banco em memoria: o insert do bump vira a linha que o validarCupom le.
  function banco() {
    let linha: any = null
    let usos = 0
    return {
      usar() { usos++ },
      from(t: string) {
        if (t === 'cupons_premium_usos') {
          return { select: () => { const q: any = { eq: () => q, then: (fn: any) => fn({ count: usos }) }; return q } }
        }
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: linha, error: null }) }) }),
          insert: async (row: any) => { linha = { id: 'c1', valido_de: null, ...row }; return { error: null } },
        }
      },
    } as any
  }

  it('comprador paga 29,90 na completa; outro e-mail, a basica e o segundo uso sao recusados', async () => {
    const db = banco()
    const agora = Date.now()
    const c = await cupomBumpDoPedido(db, PED, agora)
    expect(c).not.toBeNull()
    const ok = await validarCupom(db, c!.codigo, 'completa', 'comprador@exemplo.com')
    expect(ok).toMatchObject({ ok: true, precoLiquidoCentavos: 2990, descontoCentavos: 1500, origem: 'bump' })
    expect(origemDoCupom(ok)).toEqual({ cupom_origem: 'cupom_bump' })
    expect((await validarCupom(db, c!.codigo, 'completa', 'outra@pessoa.com')).ok).toBe(false)
    expect((await validarCupom(db, c!.codigo, 'basica', 'comprador@exemplo.com')).ok).toBe(false)
    // Sem e-mail ainda (link abriu o checkout): mostra o desconto, mas exige o e-mail.
    expect(await validarCupom(db, c!.codigo, 'completa')).toMatchObject({ ok: true, exigeEmail: true })
    db.usar()
    expect((await validarCupom(db, c!.codigo, 'completa', 'comprador@exemplo.com')).motivo).toBe('Este cupom ja foi utilizado.')
    // Usado: a oferta some da tela.
    expect(await cupomBumpDoPedido(db, PED, agora + 1000)).toBeNull()
  })
})
