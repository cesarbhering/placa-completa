import { describe, it, expect } from 'vitest'
import { inicioTardioDoHistorico } from './historico-fipe'

const serie = (inicio: string) => [{ label: inicio, price: 1 }, { label: 'Out/26', price: 2 }]

describe('nota de historico FIPE incompleto', () => {
  it('Argo 2023 com serie desde Mai/25 (RVX0H18): avisa', () => {
    expect(inicioTardioDoHistorico(serie('Mai/25'), '2023')).toBe('Mai/25')
  })
  it('ano-modelo 2023 desde Set/22 (lancamento normal): nao avisa', () => {
    expect(inicioTardioDoHistorico(serie('Set/22'), 2023)).toBeNull()
  })
  it('carro antigo com serie desde Jan/21 (piso da fonte): nao avisa', () => {
    expect(inicioTardioDoHistorico(serie('Jan/21'), 2008)).toBeNull()
    expect(inicioTardioDoHistorico(serie('Mar/21'), 2015)).toBeNull()
  })
  it('carro antigo com serie so desde 2023: avisa', () => {
    expect(inicioTardioDoHistorico(serie('Out/23'), 2012)).toBe('Out/23')
  })
  it('entradas estranhas: nada', () => {
    expect(inicioTardioDoHistorico(null, 2023)).toBeNull()
    expect(inicioTardioDoHistorico(serie('Mai/25'), '32000')).toBeNull()
    expect(inicioTardioDoHistorico(serie('xx'), 2023)).toBeNull()
    expect(inicioTardioDoHistorico([{ label: 'Mai/25' }], 2023)).toBeNull()
  })
})
