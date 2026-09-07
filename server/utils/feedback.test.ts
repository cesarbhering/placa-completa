import { describe, it, expect } from 'vitest'
import { tokenFeedbackPlausivel, normalizarResposta } from './feedback'

describe('token do link de feedback', () => {
  it('aceita token longo do e-mail', () => {
    expect(tokenFeedbackPlausivel('fb_7c2a91be4d0f38a5c1e6')).toBe(true)
  })
  it('recusa token curto: e chute, nao link truncado', () => {
    expect(tokenFeedbackPlausivel('abc123')).toBe(false)
  })
  it('recusa caractere estranho antes de tocar no banco', () => {
    expect(tokenFeedbackPlausivel("' or 1=1 --aaaaaaaaaaaaaaa")).toBe(false)
  })
  it('recusa vazio', () => {
    expect(tokenFeedbackPlausivel(undefined)).toBe(false)
  })
})

describe('resposta da pesquisa', () => {
  it('nota valida com comentario', () => {
    expect(normalizarResposta({ nota: 5, comentario: '  muito bom  ' }))
      .toEqual({ nota: 5, comentario: 'muito bom' })
  })
  it('comentario e opcional', () => {
    expect(normalizarResposta({ nota: 3, comentario: '   ' })).toEqual({ nota: 3, comentario: null })
  })
  it('nota fora da escala nao passa', () => {
    expect(normalizarResposta({ nota: 0 })).toHaveProperty('erro')
    expect(normalizarResposta({ nota: 6 })).toHaveProperty('erro')
    expect(normalizarResposta({ nota: 4.5 })).toHaveProperty('erro')
    expect(normalizarResposta({})).toHaveProperty('erro')
  })
  it('comentario gigante e cortado, nao recusado: a nota importa mais', () => {
    const r: any = normalizarResposta({ nota: 2, comentario: 'x'.repeat(5000) })
    expect(r.nota).toBe(2)
    expect(r.comentario).toHaveLength(2000)
  })
})
