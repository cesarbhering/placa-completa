import { describe, it, expect } from 'vitest'
import fipe from '../data/fipe-prices.json'
import { tituloModelo, descricaoModelo, tituloMarca, descricaoMarca, anoMaisRecente } from './fipe-seo'

const d = fipe as Record<string, any>

describe('SEO /tabela-fipe/*', () => {
  it('ano-modelo: 0 km vira ano corrente', () => {
    expect(anoMaisRecente([{ year: 32000, price: 1 }, { year: 2025, price: 1 }], 2026)).toBe(2026)
    expect(anoMaisRecente([{ year: 2019, price: 1 }], 2026)).toBe(2019)
    expect(anoMaisRecente([], 2026)).toBeNull()
  })
  it('MT-03, Lander, Nivus e Gol: title com ano e Valor Atualizado, sem gratis', () => {
    for (const [slug, marca, modelo] of [['yamaha-mt-03', 'Yamaha', 'MT-03'], ['yamaha-lander', 'Yamaha', 'Lander'], ['volkswagen-nivus', 'Volkswagen', 'Nivus'], ['volkswagen-gol', 'Volkswagen', 'Gol']]) {
      const t = d[slug]?.priceTable || []
      const titulo = tituloModelo(marca, modelo, t, 2026)
      expect(titulo).toMatch(/^Tabela FIPE .+ \d{4}/)
      expect(titulo.length).toBeGreaterThanOrEqual(50)
      expect(titulo.length).toBeLessThanOrEqual(60)
      expect(titulo).not.toMatch(/gr[aá]tis|—/i)
      const desc = descricaoModelo(marca, modelo, t)
      expect(desc).toMatch(/na Tabela FIPE com valor atualizado/)
      expect(desc.length).toBeLessThanOrEqual(160)
      expect(desc).not.toMatch(/gr[aá]tis|—/i)
    }
  })
  it('todas as paginas de modelo: description <= 160 e title <= 70', () => {
    for (const [slug, v] of Object.entries(d)) {
      const t = tituloModelo(v.brandName || 'Marca', v.modelName?.split(' ')[0] || slug, v.priceTable || [], 2026)
      expect(t.length, slug).toBeLessThanOrEqual(70)
    }
  })
  it('todas as rotas de modelo reais: description <= 160', async () => {
    const { fipeBrands } = await import('../data/fipe-brands')
    for (const b of Object.values(fipeBrands as Record<string, any>)) for (const m of b.models) {
      const t = d[`${b.slug}-${m.slug}`]?.priceTable || d[m.slug]?.priceTable || []
      expect(descricaoModelo(b.name, m.name, t).length, `${b.slug} ${m.name}`).toBeLessThanOrEqual(160)
    }
  })
  it('Honda Motos vira Honda no modelo', () => {
    expect(tituloModelo('Honda Motos', 'NXR 160 Bros', [], 2026)).toMatch(/^Tabela FIPE Honda NXR 160 Bros/)
  })
  it('marca', () => {
    expect(tituloMarca('Yamaha', 2026)).toBe('Tabela FIPE Yamaha 2026: Valor Atualizado dos Modelos')
    expect(descricaoMarca('Yamaha', ['MT-03', 'Lander', 'Fazer', 'XTZ', 'R3', 'NMax'], 2026)).not.toMatch(/gr[aá]tis/i)
  })
})
