import { describe, it, expect } from 'vitest'
import { placaEquivalente, formatoDaPlaca, placaParaSegundaTentativa, normalizarPlaca } from './placa-formato'

describe('conversao entre placa antiga e Mercosul', () => {
  it('antiga vira Mercosul pelo digito da quinta posicao', () => {
    expect(placaEquivalente('RJH1218')).toBe('RJH1C18')   // caso do pedido estornado
    expect(placaEquivalente('QNA9303')).toBe('QNA9D03')
    expect(placaEquivalente('ABC0123')).toBe('ABC0B23')
    expect(placaEquivalente('ABC1023')).toBe('ABC1A23')
    expect(placaEquivalente('ABC1923')).toBe('ABC1J23')
  })

  it('Mercosul volta pra antiga', () => {
    expect(placaEquivalente('RJH1C18')).toBe('RJH1218')
    expect(placaEquivalente('QNA9D03')).toBe('QNA9303')
    expect(placaEquivalente('ABC1A23')).toBe('ABC1023')
  })

  it('ida e volta devolve a placa original', () => {
    for (const p of ['RJH1218', 'QNA9303', 'XYZ7654']) {
      expect(placaEquivalente(placaEquivalente(p))).toBe(p)
    }
  })

  it('reconhece os dois formatos e recusa o que nao e placa', () => {
    expect(formatoDaPlaca('RJH1218')).toBe('antiga')
    expect(formatoDaPlaca('RJH1C18')).toBe('mercosul')
    expect(formatoDaPlaca('RJH12')).toBeNull()
    expect(formatoDaPlaca('')).toBeNull()
    expect(placaEquivalente('RJH12')).toBeNull()
    // Letra fora de A-J nao corresponde a digito nenhum: converter seria chute.
    expect(placaEquivalente('ABC1Z23')).toBeNull()
  })

  it('normaliza antes de decidir', () => {
    expect(normalizarPlaca(' rjh-1218 ')).toBe('RJH1218')
    expect(placaEquivalente('rjh-1218')).toBe('RJH1C18')
  })
})

describe('qual placa tentar depois do nao encontrado', () => {
  it('prefere a alternativa que a consulta gratis ja tinha visto', () => {
    expect(placaParaSegundaTentativa('RJH1C18', 'RJH1218')).toBe('RJH1218')
  })

  it('sem alternativa conhecida, converte', () => {
    expect(placaParaSegundaTentativa('RJH1C18')).toBe('RJH1218')
    expect(placaParaSegundaTentativa('RJH1C18', '')).toBe('RJH1218')
  })

  it('alternativa igual a placa nao vira segunda tentativa', () => {
    expect(placaParaSegundaTentativa('RJH1C18', 'RJH1C18')).toBeNull()
  })

  it('alternativa invalida cai na conversao, e sem conversao possivel devolve null', () => {
    expect(placaParaSegundaTentativa('RJH1C18', 'nao-e-placa')).toBe('RJH1218')
    expect(placaParaSegundaTentativa('ABC1Z23')).toBeNull()
  })
})
