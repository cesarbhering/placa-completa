import { describe, it, expect, vi, afterEach } from 'vitest'
import { consultarRecallToyota } from './recall-toyota'
import { madeUpText } from '../../tests/helpers/texto-ficticio'

// Risk and what-to-do texts of each campaign (24/11/2026): the report folds
// them in a closed accordion, so they come whole. Only a safety cap of 3000
// characters is left, cut at the end of a word with "…". Before, they stopped
// at 600 characters in the middle of a word. All data below is made up.

function apiDevolve(campanha: Record<string, unknown>) {
  vi.stubGlobal('useRuntimeConfig', () => ({ leiloesApiUrl: 'http://api.teste', leiloesApiKey: 'chave-teste', public: { gated: false } }))
  vi.stubGlobal('$fetch', vi.fn(async () => ({
    matches: [{
      recall_id: 1, code: 'T01', name: 'Campanha fictícia', model: 'MODELO TESTE', model_year: '2019',
      start_date: '2020-01-01', nivel: 'firme', situacao: 'consta_em_campanha', pdf_r2: null, ...campanha,
    }],
  })))
}

describe('campaign texts from the recall base', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('a 650-character risk and what to do come whole', async () => {
    const t = madeUpText(650)
    apiDevolve({ risco: t, o_que_fazer: t })
    const r = await consultarRecallToyota({ marca: 'TOYOTA' })
    expect(r!.matches[0].risco).toBe(t)
    expect(r!.matches[0].o_que_fazer).toBe(t)
  })

  it('a text above the cap is cut at the end of a word, with "…"', async () => {
    const longo = madeUpText(3600)
    apiDevolve({ risco: longo })
    const r = await consultarRecallToyota({ marca: 'TOYOTA' })
    const risco = r!.matches[0].risco!
    expect(risco.length).toBeLessThanOrEqual(3000)
    expect(risco.endsWith('…')).toBe(true)
    const corpo = risco.slice(0, -1)
    expect(longo.startsWith(corpo)).toBe(true)
    expect(longo[corpo.length]).toMatch(/[ .,;:]/)
  })

  it('spaces are still collapsed and an empty text is dropped', async () => {
    apiDevolve({ risco: '  O freio   fictício\n pode falhar.  ', o_que_fazer: '   ' })
    const r = await consultarRecallToyota({ marca: 'TOYOTA' })
    expect(r!.matches[0].risco).toBe('O freio fictício pode falhar.')
    expect(r!.matches[0]).not.toHaveProperty('o_que_fazer')
  })
})
