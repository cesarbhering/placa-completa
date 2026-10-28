import { describe, it, expect } from 'vitest'
import { sanearOrigem, opprefDoPedido, horaDoOppref } from './origem-trafego'
import { origemChatgpt } from '../server/utils/openai-capi'

describe('oppref/obref na origem', () => {
  it('passam sem alteracao', () => {
    const o = sanearOrigem({ oppref: 'opp_AbC.123-x', obref: '123e4567-e89b-42d3-a456-426614174000', gclid: 'g' })
    expect(o.oppref).toBe('opp_AbC.123-x')
    expect(o.obref).toBe('123e4567-e89b-42d3-a456-426614174000')
  })
  it('grande demais ou estranho vira null (nunca truncado)', () => {
    expect(sanearOrigem({ oppref: 'x'.repeat(1001) }).oppref).toBeNull()
    expect(sanearOrigem({ oppref: 'a b' }).oppref).toBeNull()
    expect(sanearOrigem({}).obref).toBeNull()
  })
})

describe('oppref do pedido: link > cookie __oppref', () => {
  it('oppref do link vence o do cookie', () => {
    const r = opprefDoPedido(sanearOrigem({ oppref: 'opp_link' }), 'opp_cookie')
    expect(r).toEqual({ oppref: 'opp_link', oppref_origem: 'link' })
  })
  it('sem oppref no link, usa o cookie', () => {
    const r = opprefDoPedido(sanearOrigem({ utm_source: 'google' }), 'opp_cookie.1-x')
    expect(r).toEqual({ oppref: 'opp_cookie.1-x', oppref_origem: 'cookie' })
  })
  it('sem link e sem cookie: nada', () => {
    expect(opprefDoPedido(sanearOrigem({}), undefined)).toEqual({ oppref: null, oppref_origem: null })
    expect(opprefDoPedido(sanearOrigem(undefined), '')).toEqual({ oppref: null, oppref_origem: null })
  })
  it('cookie adulterado (grande ou com espaco) e ignorado', () => {
    expect(opprefDoPedido(sanearOrigem({}), 'x'.repeat(1001)).oppref).toBeNull()
    expect(opprefDoPedido(sanearOrigem({}), 'a b').oppref_origem).toBeNull()
  })
  it('pedido com oppref so do cookie conta como ChatGPT na CAPI', () => {
    const r = opprefDoPedido(sanearOrigem({}), 'opp_cookie')
    expect(origemChatgpt({ oppref: r.oppref, utm_source: null, toque_chatgpt: null })).toBe(true)
    expect(origemChatgpt({ oppref: null, utm_source: null, toque_chatgpt: null })).toBe(false)
  })
})

describe('oppref do cookie: janela de 30 dias pelo clique', () => {
  // Fernet real (prefixo) de um clique em 27/10/2026 11:17:15 UTC.
  const OPP = 'gAAAAABq4Ig7EZ9SbdcOUQcQEdsofoYB1RVLASCRsTwYAAWnk95Z9J7SQ58btJ-P_tA1Czob1_-cs4wt4kPOjCcokTof8YrTaIw'
  const CLIQUE = Date.UTC(2026, 9, 27, 11, 17, 15)
  const DIA = 24 * 60 * 60 * 1000
  it('le a hora do clique do token', () => {
    expect(horaDoOppref(OPP)).toBe(CLIQUE)
    expect(horaDoOppref('opp_sem_hora')).toBeNull()
  })
  it('clique com ate 30 dias vale', () => {
    expect(opprefDoPedido(sanearOrigem({}), OPP, CLIQUE + 30 * DIA).oppref_origem).toBe('cookie')
  })
  it('clique com mais de 30 dias e descartado', () => {
    expect(opprefDoPedido(sanearOrigem({}), OPP, CLIQUE + 30 * DIA + 1000)).toEqual({ oppref: null, oppref_origem: null })
  })
  it('link vence mesmo com cookie velho', () => {
    expect(opprefDoPedido(sanearOrigem({ oppref: 'opp_link' }), OPP, CLIQUE + 60 * DIA).oppref_origem).toBe('link')
  })
})
