import { describe, it, expect } from 'vitest'
import fipe from '../data/fipe-prices.json'
import { fipeBrands } from '../data/fipe-brands'
import { agregarPorAno, referenciaAtual, fraseAno, mesReferencia, rotuloAno, sujeitoModelo, faixaGeral, type EntradaHistorico } from './fipe-por-ano'

const d = fipe as Record<string, any>
const ref = { month: 10, year: 2026 }
const linha = (year: number, price: number, month = 10, y = 2026): EntradaHistorico => ({
  year, fuel: `${year} Flex`, prices: [{ month, year: y, price }],
})

describe('agregarPorAno', () => {
  it('junta versoes por ano com menor e maior valor', () => {
    const v = agregarPorAno([[linha(2015, 80000), linha(2014, 70000)], [linha(2015, 90000)]], ref)
    expect(v).toEqual([
      { ano: 2015, min: 80000, max: 90000, versoes: 2 },
      { ano: 2014, min: 70000, max: 70000, versoes: 1 },
    ])
  })
  it('descarta 0 km e ano com preco de mes antigo (congelado)', () => {
    const v = agregarPorAno([[linha(32000, 99000), linha(2020, 50000, 9, 2025), linha(2019, 40000)]], ref)
    expect(v.map((x) => x.ano)).toEqual([2019])
  })
  it('gasolina e flex da mesma versao no mesmo ano contam como uma versao', () => {
    const v = agregarPorAno([[linha(2008, 30000), { ...linha(2008, 31000), fuel: '2008 Gasolina' }]], ref)
    expect(v[0]).toEqual({ ano: 2008, min: 30000, max: 31000, versoes: 1 })
  })
  it('referenciaAtual pega o mes mais recente', () => {
    expect(referenciaAtual([[linha(2020, 1, 9, 2025)], [linha(2021, 1, 10, 2026)]])).toEqual(ref)
  })
})

describe('textos', () => {
  it('frase de ano com faixa e com valor unico, sem travessao', () => {
    const s = sujeitoModelo('Toyota', 'Corolla', 'carros')
    expect(fraseAno(s, { ano: 2015, min: 75936, max: 82651, versoes: 3 }, ref))
      .toBe('O Toyota Corolla 2015 vale de R$ 75.936 a R$ 82.651 na Tabela FIPE de outubro/2026, conforme a versão.')
    expect(fraseAno(sujeitoModelo('Honda Motos', 'CG 150', 'motos'), { ano: 2010, min: 9000, max: 9000, versoes: 1 }, ref))
      .toBe('A Honda CG 150 2010 vale R$ 9.000 na Tabela FIPE de outubro/2026.')
  })
  it('genero explicito e rotulos', () => {
    expect(sujeitoModelo('Fiat', 'Doblò', 'carros', 'f')).toBe('A Fiat Doblò')
    expect(mesReferencia({ month: 3, year: 2026 })).toBe('março/2026')
    expect(rotuloAno('32000 Flex')).toBe('0 km Flex')
    expect(rotuloAno('2015 Flex')).toBe('2015 Flex')
    expect(faixaGeral([])).toBeNull()
  })
})

describe('dados gerados (fipe-prices.json)', () => {
  it('modelos da prioridade A tem valor por ano nos anos das perguntas', () => {
    const anos: Record<string, number[]> = {
      'toyota-corolla': [2005, 2006, 2015],
      'hyundai-ix35': [2015],
      'ford-ka': [2011, 2013, 2015],
      'honda-civic': [1998, 2005, 2011],
      'hyundai-azera': [2010, 2011, 2012, 2015],
      'volkswagen-jetta': [2012],
      'honda-fit': [2008, 2010],
      'toyota-hilux-sw4': [2015],
    }
    for (const [slug, lista] of Object.entries(anos)) {
      const presentes = (d[slug]?.porAno || []).map((v: any) => v.ano)
      for (const a of lista) expect(presentes, `${slug} ${a}`).toContain(a)
    }
  })
  it('todo modelo com fipeCode tem preco, e nenhum ano tem min > max', () => {
    for (const b of Object.values(fipeBrands)) {
      for (const m of b.models) {
        if (!m.fipeCode && !m.fipeCodes?.length) continue
        const r = d[`${b.slug}-${m.slug}`]
        expect(r, `${b.slug}-${m.slug}`).toBeTruthy()
        expect(r.priceTable.length, `${b.slug}-${m.slug}`).toBeGreaterThan(0)
        for (const v of r.porAno) expect(v.min).toBeLessThanOrEqual(v.max)
      }
    }
  })
  it('tabela da versao nao tem linha com referencia velha', () => {
    for (const [slug, r] of Object.entries(d)) {
      for (const row of r.priceTable) {
        expect(row.referenceMonth * 1 + row.referenceYear * 100, slug).toBe(r.referencia.month + r.referencia.year * 100)
      }
    }
  })
})
