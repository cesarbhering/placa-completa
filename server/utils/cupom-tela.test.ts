import { describe, it, expect, beforeEach } from 'vitest'
import {
  emitirCupomTela, cupomTelaValido, gerarTokenCupomTela, resolverDescontoTela, precoComCupomTela,
  segredoCupomTela, colunasCupomTela, _zerarMemoriaCupomTela, CUPOM_TELA_JANELA_MS,
} from './cupom-tela'
import { relogioCupomTela, mostrarCupomTela } from '../../shared/cupom-tela'

const S = 'segredo-de-teste'
const P = 'AAA0A00'
const T0 = Date.UTC(2026, 10, 4, 13, 0, 0)

describe('cupom de tela', () => {
  beforeEach(() => _zerarMemoriaCupomTela())

  it('emite token que vale 30 min para a mesma placa', () => {
    const e = emitirCupomTela(S, P, '1.1.1.1', T0)!
    expect(e.expiraEm).toBe(new Date(T0 + CUPOM_TELA_JANELA_MS).toISOString())
    expect(cupomTelaValido(S, e.token, P, T0 + 29 * 60 * 1000)).toBe(true)
    expect(cupomTelaValido(S, e.token, 'aaa-0a00', T0 + 1000)).toBe(true)
  })

  it('vence depois de 30 min (prazo aplicado no servidor)', () => {
    const e = emitirCupomTela(S, P, '1.1.1.1', T0)!
    expect(cupomTelaValido(S, e.token, P, T0 + CUPOM_TELA_JANELA_MS + 1)).toBe(false)
  })

  it('recusa outra placa, outro segredo, token adulterado ou do futuro', () => {
    const e = emitirCupomTela(S, P, '1.1.1.1', T0)!
    expect(cupomTelaValido(S, e.token, 'BBB0B00', T0)).toBe(false)
    expect(cupomTelaValido('outro', e.token, P, T0)).toBe(false)
    const [v, , sig] = e.token.split('.')
    expect(cupomTelaValido(S, `${v}.${T0 + 10 * 60 * 1000}.${sig}`, P, T0 + 11 * 60 * 1000)).toBe(false)
    const futuro = gerarTokenCupomTela(S, P, T0 + 5 * 60 * 1000)
    expect(cupomTelaValido(S, futuro, P, T0)).toBe(false)
    expect(cupomTelaValido(S, 'lixo', P, T0)).toBe(false)
    expect(cupomTelaValido(S, null, P, T0)).toBe(false)
    expect(cupomTelaValido('', e.token, P, T0)).toBe(false)
  })

  it('reconsultar nao reinicia o relogio; depois da janela nao emite de novo', () => {
    const a = emitirCupomTela(S, P, '1.1.1.1', T0)!
    const b = emitirCupomTela(S, P, '1.1.1.1', T0 + 10 * 60 * 1000)!
    expect(b.expiraEm).toBe(a.expiraEm)
    expect(emitirCupomTela(S, P, '1.1.1.1', T0 + 31 * 60 * 1000)).toBeNull()
    // outro IP ou outra placa tem relogio proprio
    expect(emitirCupomTela(S, P, '2.2.2.2', T0 + 31 * 60 * 1000)).not.toBeNull()
    // passadas 24 h, a janela volta
    expect(emitirCupomTela(S, P, '1.1.1.1', T0 + 25 * 60 * 60 * 1000)).not.toBeNull()
  })

  it('desligado sem segredo ou com placa invalida', () => {
    expect(emitirCupomTela('', P, '1.1.1.1', T0)).toBeNull()
    expect(emitirCupomTela(S, 'AB', '1.1.1.1', T0)).toBeNull()
    expect(segredoCupomTela({})).toBe('')
    expect(segredoCupomTela({ cupomTelaSecret: 'x' })).toBe('x')
    const derivado = segredoCupomTela({ premiumSupabaseKey: 'k' })
    expect(derivado).toMatch(/^[0-9a-f]{64}$/)
    expect(derivado).not.toContain('k')
  })

  it('5% com o piso do plano', () => {
    expect(precoComCupomTela('completa')).toEqual({ precoBrutoCentavos: 4490, descontoCentavos: 225, precoLiquidoCentavos: 4265 })
    expect(precoComCupomTela('basica')).toEqual({ precoBrutoCentavos: 2990, descontoCentavos: 150, precoLiquidoCentavos: 2840 })
  })

  it('nao acumula com cupom de e-mail: vale o maior', () => {
    const carro15 = { ok: true, descontoCentavos: 674 }
    expect(resolverDescontoTela('completa', carro15, true)).toEqual({ cupom: carro15, tela: null })
    const cinco = { ok: true, descontoCentavos: 135 } // 3%, menor que a tela
    const r = resolverDescontoTela('completa', cinco, true)
    expect(r.cupom).toBeNull()
    expect(r.tela?.precoLiquidoCentavos).toBe(4265)
    // empate fica com o cupom
    const dez = { ok: true, descontoCentavos: 225 }
    expect(resolverDescontoTela('completa', dez, true).cupom).toBe(dez)
    // cupom invalido nao bloqueia o de tela
    expect(resolverDescontoTela('completa', { ok: false, descontoCentavos: 0 }, true).tela).not.toBeNull()
    // sem token valido, nada muda
    expect(resolverDescontoTela('completa', cinco, false)).toEqual({ cupom: cinco, tela: null })
    expect(resolverDescontoTela('completa', null, false)).toEqual({ cupom: null, tela: null })
  })

  it('marca o pedido so quando a tela venceu', () => {
    expect(colunasCupomTela(precoComCupomTela('completa'))).toEqual({ cupom_origem: 'cupom_tela' })
    expect(colunasCupomTela(null)).toEqual({})
  })

  it('relogio e regra de exibicao', () => {
    expect(relogioCupomTela(29 * 60 * 1000 + 41 * 1000 + 500)).toBe('29:41')
    expect(relogioCupomTela(-5)).toBe('00:00')
    expect(mostrarCupomTela(undefined, false)).toBe(true)
    expect(mostrarCupomTela('CARRO15', false)).toBe(false)
    expect(mostrarCupomTela(['X'], false)).toBe(false)
    expect(mostrarCupomTela(undefined, true)).toBe(false)
  })
})
