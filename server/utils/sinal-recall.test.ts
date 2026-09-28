import { describe, it, expect } from 'vitest'
import { sinalDoRecall, marcaTemRecall, RECALL_VAZIO, RECALL_INDISPONIVEL } from './sinal-recall'
import type { RecallResposta } from './recall-toyota'

const resp = (matches: any[]): RecallResposta => ({ matches })

describe('sinalDoRecall', () => {
  it('sem resposta (null) -> INDISPONIVEL (nao sabemos)', () => {
    expect(sinalDoRecall(null)).toEqual(RECALL_INDISPONIVEL)
    expect(sinalDoRecall(undefined)).toEqual(RECALL_INDISPONIVEL)
    expect(sinalDoRecall({} as any)).toEqual(RECALL_INDISPONIVEL) // sem matches[]
  })
  it('respondeu com zero matches -> VAZIO (nao consta)', () => {
    expect(sinalDoRecall(resp([]))).toEqual(RECALL_VAZIO)
  })
  it('so suave -> consta suave', () => {
    expect(sinalDoRecall(resp([{ nivel: 'suave' }]))).toEqual({ consta: true, nivel: 'suave' })
  })
  it('firme tem precedencia sobre suave', () => {
    expect(sinalDoRecall(resp([{ nivel: 'suave' }, { nivel: 'firme' }]))).toEqual({ consta: true, nivel: 'firme' })
  })
})

describe('marcaTemRecall (so Toyota/Lexus por ora)', () => {
  it('Toyota e Lexus passam', () => {
    expect(marcaTemRecall('TOYOTA')).toBe(true)
    expect(marcaTemRecall('toyota')).toBe(true)
    expect(marcaTemRecall('Lexus')).toBe(true)
  })
  it('outras marcas e vazio nao passam', () => {
    expect(marcaTemRecall('HONDA')).toBe(false)
    expect(marcaTemRecall('')).toBe(false)
    expect(marcaTemRecall(null)).toBe(false)
  })
})
