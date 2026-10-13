import { describe, it, expect } from 'vitest'
import fipe from '../data/fipe-prices.json'
import { fipeBrands } from '../data/fipe-brands'
import { states } from '../data/states'
import { capitals } from '../data/capitals'
import { emEstado } from './seo-titulo'
import {
  ABERTURA_CONSULTA, aberturaCapital, aberturaEstado, aberturaMarca, aberturaModelo,
  faixaDoModelo, h1Capital, h1Estado, h1Marca, h1Modelo, listaNatural,
} from './frases-abertura'

const d = fipe as Record<string, any>
const PROIBIDO = /—|--|senatran|detran|gr[aá]tis.*gr[aá]tis/i

function confere(texto: string) {
  expect(texto, texto).not.toMatch(PROIBIDO)
  expect(texto, texto).not.toMatch(/\s{2,}|\s[,.]/)
}

describe('frases de abertura (GEO 13/out)', () => {
  it('marca: exemplo do plano e todas as marcas', () => {
    expect(h1Marca('Citroën')).toBe('Tabela FIPE Citroën por modelo e ano')
    expect(aberturaMarca('Citroën', ['C3', 'C4 Cactus', 'Aircross'], 'carros'))
      .toBe('Consulte a tabela FIPE da Citroën por modelo e ano na Placa Completa: veja o valor médio de C3, C4 Cactus e Aircross, atualizado todo mês. Para saber o valor do seu veículo, informe a placa.')
    for (const b of Object.values(fipeBrands)) {
      const t = aberturaMarca(b.name, b.models.map((m) => m.name), b.type)
      confere(t)
      expect(t).toContain('na Placa Completa')
      expect(t).not.toMatch(/ e [^,]+ e outros/)
      if (b.type === 'motos') expect(t).toContain('da sua moto')
    }
    expect(aberturaMarca('Suzuki Motos', ['Intruder 125'], 'motos')).toContain('valor médio de Intruder 125, atualizado')
  })

  it('modelo: com e sem preco, em todas as paginas', () => {
    expect(h1Modelo('Honda Motos', 'CG 160')).toBe('Honda CG 160: valor na Tabela FIPE por ano')
    expect(aberturaModelo({ marca: 'Toyota', modelo: 'Corolla', tipo: 'carros', faixa: { min: 16882, max: 184877 }, referencia: { month: 10, year: 2026 } }))
      .toBe('O Toyota Corolla vale de R$ 16.882 a R$ 184.877 na Tabela FIPE de outubro/2026, conforme o ano de fabricação. A Placa Completa mostra o valor por ano e o valor exato do seu veículo pela placa.')
    expect(aberturaModelo({ marca: 'Yamaha', modelo: 'XT 660', tipo: 'motos', faixa: null, referencia: null }))
      .toBe('Veja quanto vale a Yamaha XT 660 na Tabela FIPE por ano. A Placa Completa mostra o valor atualizado da sua moto pela placa, com os dados do cadastro e indicadores de leilão.')
    for (const b of Object.values(fipeBrands)) {
      for (const m of b.models) {
        const r = d[`${b.slug}-${m.slug}`]
        const t = aberturaModelo({ marca: b.name, modelo: m.name, tipo: b.type, genero: m.genero, faixa: r ? faixaDoModelo(r.porAno || [], r.priceTable || []) : null, referencia: r?.referencia || null })
        confere(t)
        expect(t).toContain('A Placa Completa mostra')
        if (r) expect(t, `${b.slug}-${m.slug}`).toMatch(/R\$ \d/)
        confere(h1Modelo(b.name, m.name))
      }
    }
  })

  it('estado e capital: preposicao certa e todas as paginas', () => {
    expect(h1Estado('na Bahia', 'BA')).toBe('Consultar placa na Bahia (BA): marca, modelo, ano e FIPE')
    expect(h1Capital('Rio de Janeiro', 'RJ')).toBe('Consultar placa no Rio de Janeiro (RJ): dados do veículo e FIPE')
    expect(aberturaCapital('Rio de Janeiro')).toBe('Consulte na Placa Completa a placa de um veículo do Rio de Janeiro e veja marca, modelo, ano, situação e valor na Tabela FIPE antes de comprar. Informe a placa e receba o resultado em segundos.')
    expect(aberturaEstado('na Bahia')).toBe('Consulte na Placa Completa a placa de qualquer veículo emplacado na Bahia e veja marca, modelo, ano, cor e valor na Tabela FIPE. A consulta básica é grátis e o resultado sai em segundos.')
    expect(aberturaMarca('Citroën', ['C3', 'C4 Cactus', 'Aircross', 'C3 Aircross', 'C4 Lounge'], 'carros')).toContain('de C3, C4 Cactus, Aircross e outros 2 modelos, atualizado')
    expect(h1Capital('Fortaleza', 'CE')).toBe('Consultar placa em Fortaleza (CE): dados do veículo e FIPE')
    for (const s of Object.values(states)) {
      const em = emEstado(s.uf, s.name)
      confere(h1Estado(em, s.uf))
      confere(aberturaEstado(em))
      expect(aberturaEstado(em)).toContain('Consulte na Placa Completa')
    }
    for (const c of Object.values(capitals)) {
      confere(h1Capital(c.name, states[c.stateSlug].uf))
      confere(aberturaCapital(c.name))
    }
  })

  it('consulta-placa e lista', () => {
    confere(ABERTURA_CONSULTA)
    expect(ABERTURA_CONSULTA).toContain('na Placa Completa')
    expect(listaNatural(['A', 'B', 'C'])).toBe('A, B e C')
    expect(listaNatural(['A'])).toBe('A')
  })
})
