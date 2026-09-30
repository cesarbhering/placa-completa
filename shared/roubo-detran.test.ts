import { describe, it, expect } from 'vitest'
import { rouboFurtoPeloDetran, orgaoDaFonte } from './roubo-detran'

const DETRAN_MG = { fonte: 'detran_mg', alerta_roubo_furto: 'Restrição informada pelo DETRAN-MG: roubo/furto' }

describe('roubo/furto no resumo do topo: SENATRAN x DETRAN', () => {
  it('so SENATRAN acusa (indicador ligado): nada muda pelo DETRAN', () => {
    expect(rouboFurtoPeloDetran({ senatranLigado: true, temOcorrenciasSenatran: true, multas: { fonte: 'detran_mg', alerta_roubo_furto: null } })).toBeNull()
    expect(rouboFurtoPeloDetran({ senatranLigado: true, temOcorrenciasSenatran: false, multas: null })).toBeNull()
  })

  it('so DETRAN acusa (SENATRAN em NADA CONSTA): acende com a fonte explicita', () => {
    const r = rouboFurtoPeloDetran({ senatranLigado: false, temOcorrenciasSenatran: false, multas: DETRAN_MG })
    expect(r).toEqual({
      orgao: 'DETRAN-MG',
      valorCartao: 'Informado pelo DETRAN-MG',
      texto: 'Roubo/furto informado pelo DETRAN-MG. Confira a situação no DETRAN antes de negociar.',
      rotuloVeredito: 'roubo/furto informado pelo DETRAN-MG',
    })
  })

  it('ambos acusam: fica o do SENATRAN, sem duplicar', () => {
    expect(rouboFurtoPeloDetran({ senatranLigado: true, temOcorrenciasSenatran: true, multas: DETRAN_MG })).toBeNull()
  })

  it('SENATRAN com historico (indicador desligado, ocorrencia registrada) ja acusa: nao duplica', () => {
    expect(rouboFurtoPeloDetran({ senatranLigado: false, temOcorrenciasSenatran: true, multas: DETRAN_MG })).toBeNull()
  })

  it('ninguem acusa: nada', () => {
    expect(rouboFurtoPeloDetran({ senatranLigado: false, temOcorrenciasSenatran: false, multas: { fonte: 'detran_sp' } })).toBeNull()
  })

  it('copy nunca afirma roubo nem usa travessao', () => {
    const r = rouboFurtoPeloDetran({ senatranLigado: false, temOcorrenciasSenatran: false, multas: DETRAN_MG })!
    for (const t of [r.valorCartao, r.texto, r.rotuloVeredito]) {
      expect(t).not.toMatch(/—|é roubado|foi roubado|veículo roubado/i)
    }
  })

  it('orgao da fonte vale pra UF futura', () => {
    expect(orgaoDaFonte('detran_rj')).toBe('DETRAN-RJ')
    expect(orgaoDaFonte(null)).toBe('DETRAN')
  })
})
