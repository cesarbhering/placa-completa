import { describe, it, expect } from 'vitest'
import { sinalRecallDaResposta, fraseRecallNaTela } from './sinal-recall-resposta'

describe('sinalRecallDaResposta', () => {
  it('consta firme -> firme', () => {
    expect(sinalRecallDaResposta({ consta: true, nivel: 'firme' })).toEqual({ consta: true, nivel: 'firme' })
  })
  it('consta suave -> suave', () => {
    expect(sinalRecallDaResposta({ consta: true, nivel: 'suave' })).toEqual({ consta: true, nivel: 'suave' })
  })
  it('nivel ausente com consta true cai pra suave (nao inventa firme)', () => {
    expect(sinalRecallDaResposta({ consta: true })).toEqual({ consta: true, nivel: 'suave' })
  })
  it('consta false -> null (silencio, nao "nao consta")', () => {
    expect(sinalRecallDaResposta({ consta: false, nivel: null })).toBeNull()
  })
  it('indisponivel (sem consta) -> null', () => {
    expect(sinalRecallDaResposta({})).toBeNull()
    expect(sinalRecallDaResposta(null)).toBeNull()
    expect(sinalRecallDaResposta({ consta: null })).toBeNull()
  })
})

describe('fraseRecallNaTela (copy VAGA do Cesar)', () => {
  it('firme: aviso de risco + verifique se ja foi atendido', () => {
    const f = fraseRecallNaTela({ consta: true, nivel: 'firme' })
    expect(f).toContain('consta em uma campanha de recall')
    expect(f).toContain('Verifique se já foi atendido')
  })
  it('suave: modelo/ano teve campanha + confira pelo chassi', () => {
    const f = fraseRecallNaTela({ consta: true, nivel: 'suave' })
    expect(f).toContain('teve campanha de recall')
    expect(f).toContain('Confira pelo chassi')
  })
  it('nunca afirma pendente/atrasado', () => {
    for (const nivel of ['firme', 'suave'] as const) {
      const f = fraseRecallNaTela({ consta: true, nivel }).toLowerCase()
      expect(f).not.toContain('pendente')
      expect(f).not.toContain('atrasad')
      expect(f).not.toContain('—') // regra: sem travessao
    }
  })
  it('sem sinal -> string vazia', () => {
    expect(fraseRecallNaTela(null)).toBe('')
  })
})
