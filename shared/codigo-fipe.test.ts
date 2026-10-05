import { describe, it, expect } from 'vitest'
import { codigoFipeDoRelatorio } from './codigo-fipe'

const cands = { confianca: 'alta', decididoPor: 'haiku', candidatos: [
  { valor: 49326, modelo: 'ONIX HATCH Joy 1.0 8V Flex 5p Mec.', codigo_fipe: '004473-3' },
  { valor: 53269, modelo: 'ONIX HATCH LT 1.0 8V FlexPower 5p Mec.', codigo_fipe: '004424-5' },
] }

describe('codigo FIPE do relatorio', () => {
  it('snapshot novo: fipeCodigo direto', () => {
    expect(codigoFipeDoRelatorio({ fipe: 'R$ 1', fipeModelo: 'X', fipeCodigo: '001234-5' })).toBe('001234-5')
  })
  it('snapshot antigo: candidato com o mesmo modelo do valor', () => {
    expect(codigoFipeDoRelatorio({ fipe: 'R$ 49.326,00', fipeModelo: 'ONIX HATCH Joy 1.0 8V Flex 5p Mec.', fipeCandidato: cands })).toBe('004473-3')
  })
  it('versao ambigua ou confianca baixa: nada', () => {
    expect(codigoFipeDoRelatorio({ fipe: 'R$ 1', fipeModelo: 'ONIX HATCH Joy 1.0 8V Flex 5p Mec.', fipeCodigo: '004473-3', fipeCandidato: { ...cands, decididoPor: 'ambiguo' } })).toBeNull()
    expect(codigoFipeDoRelatorio({ fipe: 'R$ 1', fipeModelo: 'X', fipeCandidato: { ...cands, confianca: 'baixa' } })).toBeNull()
  })
  it('sem codigo, sem valor ou formato estranho: nada', () => {
    expect(codigoFipeDoRelatorio({ fipe: 'R$ 1', fipeModelo: 'Fiesta Sed. 1.6 8V Flex 4p', fipeCandidato: null })).toBeNull()
    expect(codigoFipeDoRelatorio({ fipe: null, fipeCodigo: '001234-5' })).toBeNull()
    expect(codigoFipeDoRelatorio({ fipe: 'R$ 1', fipeCodigo: '12345' })).toBeNull()
    expect(codigoFipeDoRelatorio(null)).toBeNull()
  })
})
