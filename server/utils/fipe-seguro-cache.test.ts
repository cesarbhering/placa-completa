import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'

// Seguro estimado da fipe-api: cache de 14 dias por modelo+ano+regiao no
// fonte_cache; 404 (regiao sem amostra) fica cacheado como sem_dado; erro de
// rede nao e cacheado.

vi.stubGlobal('useRuntimeConfig', () => ({ fipeApiUrl: 'https://fipe.invalid', fipeApiToken: 't' }))
const { fipeSeguroEstimado } = await import('./fipe-api')
const { ttlDaFonte } = await import('./fonte-cache')

const OK = { data: { seguro: { premioMedioEstimado: 3210.5, franquiaMediaEstimada: 4000 }, regiao: { codigo: '11', descricao: 'SP' } } }
let sb: ReturnType<typeof supabaseMemoria>
beforeEach(() => { sb = supabaseMemoria() })

describe('fipeSeguroEstimado', () => {
  it('calls the API once and serves the second call from fonte_cache', async () => {
    const fetcher = vi.fn(async () => OK) as any
    expect(await fipeSeguroEstimado(123, 2020, '11', { sb, fetcher })).toEqual(OK)
    expect(await fipeSeguroEstimado(123, 2020, '11', { sb, fetcher })).toEqual(OK)
    expect(fetcher).toHaveBeenCalledOnce()
    const linha = sb.tab('fonte_cache').find((l: any) => l.fonte === 'seguro_estimado')
    expect(linha?.chave).toBe('123:2020:11')
    const hits = sb.tab('api_chamadas').filter((l: any) => l.cache_hit)
    expect(hits.length).toBeLessThanOrEqual(1)
  })

  it('keys by model, year and region', async () => {
    const fetcher = vi.fn(async () => OK) as any
    await fipeSeguroEstimado(123, 2020, '11', { sb, fetcher })
    await fipeSeguroEstimado(123, 2021, '11', { sb, fetcher })
    await fipeSeguroEstimado(123, 2020, '07', { sb, fetcher })
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('caches a 404 as no data so the region cascade does not retry it', async () => {
    const fetcher = vi.fn(async () => { throw Object.assign(new Error('nf'), { statusCode: 404 }) }) as any
    expect(await fipeSeguroEstimado(9, 2019, '05', { sb, fetcher })).toBeNull()
    expect(await fipeSeguroEstimado(9, 2019, '05', { sb, fetcher })).toBeNull()
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('does not cache a network failure', async () => {
    const fetcher = vi.fn(async () => { throw Object.assign(new Error('timeout'), { statusCode: 504 }) }) as any
    await expect(fipeSeguroEstimado(9, 2019, '05', { sb, fetcher })).rejects.toThrow()
    await expect(fipeSeguroEstimado(9, 2019, '05', { sb, fetcher })).rejects.toThrow()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(sb.tab('fonte_cache')).toHaveLength(0)
  })

  it('has a 14 day TTL', () => {
    expect(ttlDaFonte('seguro_estimado')).toBe(14 * 24 * 60 * 60 * 1000)
  })
})
