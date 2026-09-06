import { describe, it, expect, vi, beforeEach } from 'vitest'

// O que importa aqui e a marcacao de cache_hit: se ela errar, o relatorio de
// custo por canal passa a mentir, e mentir pra menos (cache marcado como
// chamada real) e o erro mais caro, porque justifica orcamento que nao existe.
let cacheRow: any = null
let apiChamada = 0

vi.stubGlobal('useRuntimeConfig', () => ({ placaApiToken: 'token' }))
vi.stubGlobal('useSupabaseServer', () => ({
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: cacheRow }) }) }),
    upsert: () => ({ then: (fn: any) => fn({ error: null }) }),
  }),
}))
vi.stubGlobal('$fetch', async () => { apiChamada++; return { MARCA: 'VW', MODELO: 'GOL' } })

const { consultarPlacaWdapiDetalhado, consultarPlacaWdapi } = await import('./placa-lookup')

describe('consultarPlacaWdapiDetalhado', () => {
  beforeEach(() => { cacheRow = null; apiChamada = 0 })

  it('cache fresco marca hit e nao chama a API', async () => {
    cacheRow = { payload: { MARCA: 'VW' }, encontrado: true, fetched_at: new Date().toISOString() }
    const r = await consultarPlacaWdapiDetalhado('ABC1D23')
    expect(r.cacheHit).toBe(true)
    expect(apiChamada).toBe(0)
  })

  it('cache vencido marca miss e chama a API', async () => {
    const antigo = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString()
    cacheRow = { payload: { MARCA: 'VW' }, encontrado: true, fetched_at: antigo }
    const r = await consultarPlacaWdapiDetalhado('ABC1D23')
    expect(r.cacheHit).toBe(false)
    expect(apiChamada).toBe(1)
  })

  it('sem cache marca miss', async () => {
    const r = await consultarPlacaWdapiDetalhado('ABC1D23')
    expect(r.cacheHit).toBe(false)
    expect(apiChamada).toBe(1)
  })

  it('nao-encontrada fresca no cache nao conta como hit nem chama a API', async () => {
    cacheRow = { payload: null, encontrado: false, fetched_at: new Date().toISOString() }
    const r = await consultarPlacaWdapiDetalhado('ABC1D23')
    expect(r.payload).toBeNull()
    expect(r.cacheHit).toBe(false)
    expect(apiChamada).toBe(0)
  })

  it('placa curta nem tenta', async () => {
    const r = await consultarPlacaWdapiDetalhado('ABC')
    expect(r).toEqual({ payload: null, cacheHit: false })
    expect(apiChamada).toBe(0)
  })

  it('a funcao antiga continua devolvendo so o payload', async () => {
    cacheRow = { payload: { MARCA: 'VW' }, encontrado: true, fetched_at: new Date().toISOString() }
    expect(await consultarPlacaWdapi('ABC1D23')).toEqual({ MARCA: 'VW' })
  })
})
