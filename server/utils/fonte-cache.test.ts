import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ttlDaFonte, chaveDePlaca, lerFonteCache, gravarFonteCache, comFonteCache } from './fonte-cache'
import { endpointSemDado, registrarChamada } from './api-chamadas'
import { fipePriceHistory, fipeGet } from './fipe-api'

const H = 3600_000, D = 24 * H

// fake minimo do supabase-js: tabelas em memoria, so os metodos usados
function fakeSb() {
  const tabelas: Record<string, any[]> = { fonte_cache: [], api_chamadas: [] }
  const from = (t: string) => {
    const filtros: [string, any][] = []
    const q: any = {
      select: () => q,
      eq: (c: string, v: any) => { filtros.push([c, v]); return q },
      maybeSingle: async () => ({ data: tabelas[t].find(r => filtros.every(([c, v]) => r[c] === v)) ?? null }),
      upsert: async (row: any) => {
        const i = tabelas[t].findIndex(r => r.fonte === row.fonte && r.chave === row.chave)
        if (i >= 0) tabelas[t][i] = row; else tabelas[t].push(row)
        return { error: null }
      },
      insert: (row: any) => { tabelas[t].push(row); return Promise.resolve({ error: null }) },
    }
    return q
  }
  return { from, tabelas }
}

describe('fonte-cache: TTL por fonte (regra do Cesar 14/out)', () => {
  it('multas 24 h, leilao e chassi 30 d, recall e fipe 7 d', () => {
    expect(ttlDaFonte('multas_sp')).toBe(24 * H)
    expect(ttlDaFonte('ipva_sefaz_al')).toBe(24 * H)
    expect(ttlDaFonte('leilao')).toBe(30 * D)
    expect(ttlDaFonte('chassi_origem')).toBe(30 * D)
    expect(ttlDaFonte('recall_montadora')).toBe(7 * D)
    expect(ttlDaFonte('fipe_historico')).toBe(7 * D)
    expect(ttlDaFonte('desconhecida')).toBe(24 * H)
  })
  it('chave de placa normalizada', () => expect(chaveDePlaca('abc-1d23')).toBe('ABC1D23'))

  it('grava, le dentro do TTL e ignora vencido', async () => {
    const sb = fakeSb(); const t0 = Date.parse('2026-10-14T12:00:00Z')
    await gravarFonteCache(sb, 'multas_sp', 'ABC1D23', { total: 3 }, 'ok', t0)
    expect((await lerFonteCache(sb, 'multas_sp', 'ABC1D23', t0 + 23 * H))?.payload).toEqual({ total: 3 })
    expect(await lerFonteCache(sb, 'multas_sp', 'ABC1D23', t0 + 25 * H)).toBeNull()
  })

  it('comFonteCache: 1a chama a fonte, 2a vem do cache; falha nao e cacheada', async () => {
    const sb = fakeSb(); const buscar = vi.fn(async () => ({ status: 'ok' as const, payload: { v: 1 } }))
    const a = await comFonteCache(sb, 'recall', 'X', buscar)
    const b = await comFonteCache(sb, 'recall', 'X', buscar)
    expect(a.cacheHit).toBe(false); expect(b.cacheHit).toBe(true); expect(buscar).toHaveBeenCalledTimes(1)
    expect(b.consultadoEm).toBe(a.consultadoEm)
    await expect(comFonteCache(sb, 'leilao', 'Y', async () => { throw new Error('504') })).rejects.toThrow('504')
    expect(sb.tabelas.fonte_cache.some(r => r.chave === 'Y')).toBe(false)
  })

  it('cache quebrado nunca derruba a consulta', async () => {
    const sb = { from: () => { throw new Error('db fora') } }
    expect(await lerFonteCache(sb, 'fipe', 'X')).toBeNull()
    expect(typeof await gravarFonteCache(sb, 'fipe', 'X', {})).toBe('string')
  })
})

describe('api_chamadas: endpoint sem dado', () => {
  it('troca placa, chassi, codigo FIPE, ids e tokens', () => {
    expect(endpointSemDado('/models/fipe/004473-3/price-history')).toBe('/models/fipe/:cod/price-history')
    expect(endpointSemDado('/consulta/ABC1D23/tok?x=1')).toBe('/consulta/:placa/tok')
    expect(endpointSemDado('/decode/9BWZZZ377VT004251')).toBe('/decode/:vin')
    expect(endpointSemDado('/models/123/insurance-estimate')).toBe('/models/:id/insurance-estimate')
    expect(endpointSemDado('/x/abcdefghijklmnopqrstuvwxyz')).toBe('/x/:token')
  })
  it('registrarChamada nunca lanca', () => {
    expect(() => registrarChamada({ from: () => { throw new Error('x') } }, { fonte: 'fipe', caminho: '/a', code: 200, ms: 1 })).not.toThrow()
    expect(() => registrarChamada(null, { fonte: 'fipe', caminho: '/a', code: 200, ms: 1 })).not.toThrow()
  })
})

describe('fipe-api: cache 7 d + log', () => {
  beforeEach(() => vi.stubGlobal('useRuntimeConfig', () => ({ fipeApiUrl: 'https://fipe.test', fipeApiToken: 't' })))

  it('price-history: chama 1x, cacheia, loga as duas (a 2a como cache_hit)', async () => {
    const sb = fakeSb()
    const fetcher: any = vi.fn(async () => ({ success: true, data: { model: { id: 9 }, price_history: [{ year: 2020, prices: [] }] } }))
    const a = await fipePriceHistory('004473-3', { sb, fetcher })
    const b = await fipePriceHistory('004473-3', { sb, fetcher })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe('https://fipe.test/models/fipe/004473-3/price-history')
    expect(fetcher.mock.calls[0][1].timeout).toBe(8000)
    expect(a.cacheHit).toBe(false); expect(b.cacheHit).toBe(true); expect(b.bruto.data.model.id).toBe(9)
    await new Promise(r => setTimeout(r, 0))
    expect(sb.tabelas.api_chamadas.map(r => [r.endpoint, r.code, r.cache_hit]))
      .toEqual([['/models/fipe/:cod/price-history', 200, false], ['/models/fipe/:cod/price-history', 200, true]])
  })

  it('erro: loga o code, propaga e nao cacheia', async () => {
    const sb = fakeSb()
    const fetcher: any = vi.fn(async () => { const e: any = new Error('boom'); e.statusCode = 502; throw e })
    await expect(fipePriceHistory('000001-1', { sb, fetcher })).rejects.toThrow('boom')
    await new Promise(r => setTimeout(r, 0))
    expect(sb.tabelas.fonte_cache).toHaveLength(0)
    expect(sb.tabelas.api_chamadas[0].code).toBe(502)
  })

  it('fipeGet repassa params e timeout', async () => {
    const fetcher: any = vi.fn(async () => ({ data: {} }))
    await fipeGet('/models/1/insurance-estimate', { sb: null, fetcher, params: { ano: 2020 }, timeoutMs: 3000 })
    expect(fetcher.mock.calls[0][1]).toMatchObject({ params: { ano: 2020 }, timeout: 3000 })
  })
})
