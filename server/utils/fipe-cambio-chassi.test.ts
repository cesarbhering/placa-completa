import { describe, it, expect, vi, beforeEach } from 'vitest'
import { escolherMelhorFipe } from './fipe-candidato'
import { cambioPeloChassi } from '../../shared/cambio-chassi'
import dados from '../../shared/cambio-chassi.json'

const REGRAS = (dados as any).regras as Record<string, string>
const AUTO = Object.keys(REGRAS).find((k) => REGRAS[k] === 'automatico')!
const MANUAL = Object.keys(REGRAS).find((k) => REGRAS[k] === 'manual')!

describe('cambioPeloChassi (camada 2)', () => {
  it('prefixo pos 1-8 com regra', () => {
    expect(cambioPeloChassi(AUTO + '0X0000000')).toBe('automatico')
    expect(cambioPeloChassi(MANUAL + '0X0000000')).toBe('manual')
  })
  it('sem regra, chassi curto ou vazio: null', () => {
    expect(cambioPeloChassi('ZZZZZZZZ0X0000000')).toBeNull()
    expect(cambioPeloChassi('9BG')).toBeNull()
    expect(cambioPeloChassi(null)).toBeNull()
  })
  it('o JSON so tem prefixo de 8, cambio valido, minimo 5 e 0 conflito declarados', () => {
    expect((dados as any).minimo).toBeGreaterThanOrEqual(5)
    expect((dados as any).conflitos).toBe(0)
    for (const [k, v] of Object.entries(REGRAS)) {
      expect(k).toMatch(/^[A-HJ-NPR-Z0-9]{8}$/)
      expect(['manual', 'automatico']).toContain(v)
    }
  })
})

describe('funil: o chassi so desempata manual x automatico', () => {
  beforeEach(() => vi.unstubAllGlobals())
  const universo = (modelos: string[]) => vi.fn(async (url: string) => {
    if (String(url).includes('/modelos')) return { ok: true, json: async () => ({ data: modelos.map((m, i) => ({ codigo_fipe: `00100${i}-0`, modelo: m, valor: 50000 + i })) }) } as any
    return { ok: false, json: async () => ({}) } as any
  })
  const base = { anoModelo: 2016, descricaoMarcaModelo: 'NISSAN/MARCH 16SV' }

  it('par Mec x Aut + prefixo com regra: decide por regra', async () => {
    vi.stubGlobal('fetch', universo(['MARCH SV 1.6 16V FlexStart 5p Aut.', 'MARCH SV 1.6 16V FlexStart 5p Mec.']))
    const r = await escolherMelhorFipe({ senatran: { ...base, chassi: AUTO + '0X0000000' }, wdapi: { marca: 'NISSAN', anoModelo: '2016', fipe: { dados: [] } }, fipeApiUrl: 'http://f', fipeApiToken: 't' })
    expect(r.decididoPor).toBe('regra')
    expect(r.escolhido?.modelo).toMatch(/Aut\./)
    expect(r.justificativa).toMatch(/chassi/)
  })
  it('sem regra pro prefixo: segue ambiguo (vai pra pergunta na tela)', async () => {
    vi.stubGlobal('fetch', universo(['MARCH SV 1.6 16V FlexStart 5p Aut.', 'MARCH SV 1.6 16V FlexStart 5p Mec.']))
    const r = await escolherMelhorFipe({ senatran: { ...base, chassi: 'ZZZZZZZZ0X0000000' }, wdapi: { marca: 'NISSAN', anoModelo: '2016', fipe: { dados: [] } }, fipeApiUrl: 'http://f', fipeApiToken: 't' })
    expect(r.decididoPor).toBe('ambiguo')
  })
  it('versoes que diferem em mais que o cambio: o chassi nao decide', async () => {
    vi.stubGlobal('fetch', universo(['MARCH SV 1.6 16V FlexStart 5p Aut.', 'MARCH SV 1.6 16V FlexStart 5p Mec.', 'MARCH SL 1.6 16V FlexStart 5p Aut.']))
    const r = await escolherMelhorFipe({ senatran: { descricaoMarcaModelo: 'NISSAN/MARCH 1.6', anoModelo: 2016, chassi: AUTO + '0X0000000' }, wdapi: { marca: 'NISSAN', anoModelo: '2016', fipe: { dados: [] } }, fipeApiUrl: 'http://f', fipeApiToken: 't' })
    expect(r.decididoPor).toBe('ambiguo')
  })
  it('o nome do cadastro tem prioridade sobre o chassi', async () => {
    vi.stubGlobal('fetch', universo(['MARCH SV 1.6 16V FlexStart 5p Aut.', 'MARCH SV 1.6 16V FlexStart 5p Mec.']))
    const r = await escolherMelhorFipe({ senatran: { descricaoMarcaModelo: 'NISSAN/MARCH 16SV MT', anoModelo: 2016, chassi: AUTO + '0X0000000' }, wdapi: { marca: 'NISSAN', anoModelo: '2016', fipe: { dados: [] } }, fipeApiUrl: 'http://f', fipeApiToken: 't' })
    expect(r.escolhido?.modelo).toMatch(/Mec\./)
  })
})
