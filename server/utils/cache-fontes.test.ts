import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { consultarRecallEua, fabricadoNaAmericaDoNorte, ROTULO_NHTSA } from './nhtsa-recall'
import { decodificarChassi } from './vin-decoder'
import { consultarHistoricoLeilao } from './historico-leilao'

function fakeSb() {
  const tabelas: Record<string, any[]> = { fonte_cache: [], api_chamadas: [] }
  const from = (t: string) => {
    const filtros: [string, any][] = []
    const q: any = {
      select: () => q,
      eq: (c: string, v: any) => { filtros.push([c, v]); return q },
      maybeSingle: async () => ({ data: tabelas[t].find(r => filtros.every(([c, v]) => r[c] === v)) ?? null }),
      upsert: async (row: any) => { tabelas[t] = tabelas[t].filter(r => !(r.fonte === row.fonte && r.chave === row.chave)); tabelas[t].push(row); return { error: null } },
      insert: (row: any) => { tabelas[t].push(row); return Promise.resolve({ error: null }) },
    }
    return q
  }
  return { from, tabelas }
}

describe('NHTSA (recall EUA): so America do Norte, rotulo fixo, cache 30 d', () => {
  it('gate pelo WMI 1-5', () => {
    expect(fabricadoNaAmericaDoNorte('1HGCM82633A004352')).toBe(true)
    expect(fabricadoNaAmericaDoNorte('3VWFE21C04M000001')).toBe(true)     // Mexico
    expect(fabricadoNaAmericaDoNorte('9BWZZZ377VT004251')).toBe(false)    // Brasil
    expect(fabricadoNaAmericaDoNorte('WVWZZZ1JZXW000001')).toBe(false)    // Alemanha
    expect(fabricadoNaAmericaDoNorte('1HGCM826')).toBe(false)
  })

  it('chassi brasileiro nem chama a API', async () => {
    const fetcher = vi.fn()
    expect(await consultarRecallEua('9BWZZZ377VT004251', { sb: null, fetcher })).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('decodifica no vPIC, busca por marca/modelo/ano, monta o bloco e cacheia', async () => {
    const sb = fakeSb()
    const fetcher = vi.fn(async (url: string, o: any) => {
      if (url.includes('DecodeVinValues')) return { Results: [{ Make: 'HONDA', Model: 'Accord', ModelYear: '2003' }] }
      expect(o.query).toEqual({ make: 'HONDA', model: 'Accord', modelYear: 2003 })
      return { results: [{ NHTSACampaignNumber: '19V182000', Component: 'AIR BAGS', Summary: '  Inflator   may rupture ', ReportReceivedDate: '01/03/2019' }] }
    })
    const a = await consultarRecallEua('1HGCM82633A004352', { sb, fetcher })
    const b = await consultarRecallEua('1HGCM82633A004352', { sb, fetcher })
    expect(a).toMatchObject({ fonte: 'nhtsa', rotulo: ROTULO_NHTSA, marca: 'HONDA', modelo: 'Accord', ano: 2003, n_campanhas: 1 })
    expect(a!.campanhas[0]).toEqual({ numero: '19V182000', componente: 'AIR BAGS', resumo: 'Inflator may rupture', data: '01/03/2019' })
    expect(fetcher).toHaveBeenCalledTimes(2)      // 2a vez veio do cache
    expect(b!.consultadoEm).toBe(a!.consultadoEm)
    const linha = sb.tabelas.fonte_cache[0]
    expect(Date.parse(linha.expira_em) - Date.parse(linha.consultado_em)).toBe(30 * 86400_000)
    expect(sb.tabelas.api_chamadas.every(r => !r.endpoint.includes('1HGCM'))).toBe(true)   // log sem VIN
  })

  it('falha = null e nao cacheia', async () => {
    const sb = fakeSb()
    expect(await consultarRecallEua('1HGCM82633A004352', { sb, fetcher: async () => { throw new Error('503') } })).toBeNull()
    expect(sb.tabelas.fonte_cache).toHaveLength(0)
  })
})

describe('vin-decoder e leiloes-api: cache por fonte', () => {
  let sb: ReturnType<typeof fakeSb>
  beforeEach(() => {
    sb = fakeSb()
    vi.stubGlobal('useSupabaseServer', () => sb)
    vi.stubGlobal('useRuntimeConfig', () => ({ vinDecoderUrl: 'http://vin', leiloesApiUrl: 'http://leil', leiloesApiKey: 'k', public: {} }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('chassi: 2a consulta do mesmo VIN/modelo/ano vem do cache (30 d)', async () => {
    const f = vi.fn(async () => ({ valido: true, fabricante: 'VW', pais: 'Brasil', regiao: null, anoModelo: 2019, planta: 'T', plantaDetalhe: null, checksumOk: null }))
    vi.stubGlobal('$fetch', f)
    const a = await decodificarChassi('9BWZZZ377VT004251', { modelo: 'GOL', ano: 2019 })
    const b = await decodificarChassi('9BWZZZ377VT004251', { modelo: 'GOL', ano: 2019 })
    expect(f).toHaveBeenCalledTimes(1)
    expect(a?.fabricante).toBe('VW'); expect(b?.consultadoEm).toBe(a?.consultadoEm)
  })

  it('leilao: cache so quando pedido (relatorio pago); sem cache = sempre ao vivo (sinal do gratis)', async () => {
    const res = { resumo: { tem_indicio: true, nivel_max: null, n_confirmado: 1, n_provavel: 0, n_possivel: 0, possiveis_ambiguos: 0, fontes_com_passagem: [] }, passagens: [] }
    const f = vi.fn(async () => res)
    vi.stubGlobal('$fetch', f)
    const perfil: any = { placa: 'ABC1D23', chassi: '9BWZZZ377VT004251' }
    await consultarHistoricoLeilao(perfil, { cache: true })
    const c = await consultarHistoricoLeilao(perfil, { cache: true })
    expect(f).toHaveBeenCalledTimes(1); expect(c?.consultadoEm).toBeTruthy()
    await consultarHistoricoLeilao(perfil)
    await consultarHistoricoLeilao(perfil)
    expect(f).toHaveBeenCalledTimes(3)
  })
})
