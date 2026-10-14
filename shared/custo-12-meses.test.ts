import { describe, expect, it } from 'vitest'
import { custo12Meses } from './custo-12-meses'

describe('custo de 12 meses', () => {
  it('sem FIPE: null', () => {
    expect(custo12Meses({ valorFipe: null })).toBeNull()
    expect(custo12Meses({ valorFipe: 0, aliquotaIpva: 0.04 })).toBeNull()
  })
  it('soma tudo e divide por 12', () => {
    const c = custo12Meses({ valorFipe: 50000, uf: 'sp', aliquotaIpva: 0.04, taxaLicenciamento: 160, seguroAnual: 3000, quedaAnoPct: -6, consumoKmL: 12, precoLitro: 6 })!
    expect(c.linhas.map((l) => [l.chave, l.anual])).toEqual([['ipva', 2000], ['licenciamento', 160], ['seguro', 3000], ['depreciacao', 3000], ['combustivel', 6000]])
    expect(c.anual).toBe(14160)
    expect(c.mensal).toBe(1180)
    expect(c.foraDaConta).toEqual([])
    expect(c.linhas[0].nota).toBe('4% do valor FIPE (SP)')
    expect(c.linhas[1].nota).toBe('taxa 2026 SP')
    expect(custo12Meses({ valorFipe: 50000, uf: 'AC', taxaLicenciamento: 194, licenciamentoOficial: false })!.linhas[0].nota).toBe('valor de referência AC, confira no DETRAN')
  })
  it('sem dado: fica de fora, nunca inventa', () => {
    const c = custo12Meses({ valorFipe: 50000, aliquotaIpva: 0.04 })!
    expect(c.linhas.map((l) => l.chave)).toEqual(['ipva'])
    expect(c.foraDaConta).toEqual(['Licenciamento', 'Seguro', 'Depreciação', 'Combustível'])
  })
  it('FIPE subiu: sem depreciacao, com o motivo', () => {
    const c = custo12Meses({ valorFipe: 50000, aliquotaIpva: 0.04, quedaAnoPct: 2 })!
    expect(c.linhas.some((l) => l.chave === 'depreciacao')).toBe(false)
    expect(c.observacoes[0]).toMatch(/não caiu/)
    expect(c.foraDaConta.some((f) => /Deprecia/.test(f))).toBe(false)
  })
  it('copy sem travessao', () => {
    const c = custo12Meses({ valorFipe: 50000, aliquotaIpva: 0.04, taxaLicenciamento: 160, seguroAnual: 3000, quedaAnoPct: -6, consumoKmL: 12, precoLitro: 6, motorConsumo: '1,0', combustivel: 'etanol', flex: true })!
    expect(c.linhas.at(-1)!.nota!.replace(/\s/g, ' ')).toBe('12.000 km/ano · 12 km/l, média de motor 1,0 · etanol a R$ 6,00, o mais barato por km na UF')
    expect(JSON.stringify(c)).not.toContain('—')
  })
})

describe('fase 1: consumo, combustivel e licenciamento', async () => {
  const { consumoMedio, combustivelPraConta, licenciamentoDaUf } = await import('./custo-12-meses')
  const { PRECO_COMBUSTIVEL_UF } = await import('./dados/combustivel-uf')
  it('tabelas completas', () => {
    expect(Object.keys(PRECO_COMBUSTIVEL_UF)).toHaveLength(27)
    expect(licenciamentoDaUf('sp')).toEqual({ valor: 174.08, oficial: true })
    expect(licenciamentoDaUf('MG')).toEqual({ valor: 35.62, oficial: true })
    expect(licenciamentoDaUf('AC')!.oficial).toBe(false)
    // sem valor oficial 2026: fora da conta; RR cobra por peso
    for (const uf of ['RJ', 'SC', 'BA', 'DF', 'PE', 'ES', 'RR']) expect(licenciamentoDaUf(uf)).toBeNull()
  })
  it('consumo por cilindrada', () => {
    expect(consumoMedio(999, false, false)).toBe(12.5)
    expect(consumoMedio(1598, false, false)).toBe(11)
    expect(consumoMedio(2776, true, true)).toBe(8.5)
    expect(consumoMedio(null, false, false)).toBeNull()
  })
  it('flex escolhe o mais barato por km; eletrico fica de fora', () => {
    const r = combustivelPraConta({ codigo: '16', cilindradaCc: 999, utilitario: false, precos: { gasolina: 6.5, etanol: 4.0 } })!
    expect(r.precoLitro).toBe(4.0)
    expect(r.consumoKmL).toBe(8.8)
    expect(r.combustivel).toBe('etanol')
    expect(r.flex).toBe(true)
    const g = combustivelPraConta({ codigo: '16', cilindradaCc: 999, utilitario: false, precos: { gasolina: 6.0, etanol: 4.9 } })!
    expect(g.precoLitro).toBe(6.0)
    expect(combustivelPraConta({ codigo: '6', cilindradaCc: 0, utilitario: false, precos: { gasolina: 6 } })).toBeNull()
    expect(combustivelPraConta({ codigo: '03', cilindradaCc: 2776, utilitario: true, precos: { diesel: 7 } })!.precoLitro).toBe(7)
  })
})
