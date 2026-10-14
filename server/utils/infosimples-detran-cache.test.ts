import { describe, it, expect, vi, afterEach } from 'vitest'
import { completarDetran } from './infosimples-detran'
import SC from './__fixtures__/infosimples-detran-sc.json'

// Cache de 24 h do bloco do DETRAN por placa (fonte_cache, fonte multas_<uf>).
const cfg = () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p' })
const resp = [{ ufJurisdicao: 'SC', renavam: '1095390000', indicadorMultaRenainf: true }]
const OK_SC = { code: 200, code_message: 'ok', header: { price: '0.28' }, data: [SC] }
const PROTEGIDO = { code: 620, code_message: 'Erro', header: { price: '0.28' }, errors: ['O veículo consultado está protegido.'] }

function fakeSb(cache: Record<string, any> = {}) {
  const inserts: any[] = []; const updates: any[] = []; const upserts: any[] = []
  const snap = { consulta: {} }
  return {
    inserts, updates, upserts, cache,
    from: (t: string) => t === 'fonte_cache'
      ? {
          select: () => {
            const f: any = {}
            const q: any = { eq: (k: string, v: string) => { f[k] = v; return q }, maybeSingle: async () => ({ data: cache[`${f.fonte}|${f.chave}`] ?? null }) }
            return q
          },
          upsert: async (row: any) => { upserts.push(row); cache[`${row.fonte}|${row.chave}`] = row; return { error: null } },
        }
      : {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: updates.at(-1)?.relatorio_snapshot ?? snap } }) }) }),
          insert: async (row: any) => { inserts.push(row); return { error: null } },
          update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
        },
  }
}

describe('DETRAN: cache de 24 h por placa', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
  const prep = (body: any) => {
    vi.stubGlobal('useRuntimeConfig', cfg)
    const fetchSpy = vi.fn(async () => ({ status: 200, json: async () => body }))
    vi.stubGlobal('fetch', fetchSpy)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    return fetchSpy
  }

  it('consulta nova grava no cache; segundo pedido da placa usa o cache sem chamada paga', async () => {
    const fetchSpy = prep(OK_SC)
    const sb = fakeSb()
    const r1 = await completarDetran(sb, { id: 'p1', placa: 'MES3261' }, { response: resp, ignorarGate: true })
    expect(r1.ok).toBe(true)
    expect(sb.upserts).toHaveLength(1)
    expect(sb.upserts[0]).toMatchObject({ fonte: 'multas_sc', chave: 'MES3261', status: 'ok' })
    expect(sb.upserts[0].payload.consultadoEm).toBeUndefined()
    const sb2 = fakeSb(sb.cache)
    const r2 = await completarDetran(sb2, { id: 'p2', placa: 'MES3261' }, { response: resp, ignorarGate: true })
    expect(r2).toMatchObject({ ok: true, preco: 0, cacheHit: true })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(sb2.inserts).toHaveLength(0) // sem custo
    expect(sb2.updates.at(-1).relatorio_snapshot.multas.consultadoEm).toBe(sb.upserts[0].consultado_em)
  })

  it('hit do cache: nao chama o Infosimples, nao registra custo, grava o bloco com consultadoEm', async () => {
    const fetchSpy = prep(OK_SC)
    const bloco = { status: 'ok', uf: 'SC', fonte: 'detran_sc', multas_itens: [], hodometro: [], restricoes_detran: [], multas_total_centavos: 0 }
    const sb = fakeSb({ 'multas_sc|MES3261': { payload: bloco, status: 'ok', consultado_em: '2026-10-14T10:00:00.000Z', expira_em: new Date(Date.now() + 3600e3).toISOString() } })
    const r = await completarDetran(sb, { id: 'p1', placa: 'MES3261' }, { response: resp, ignorarGate: true })
    expect(r).toMatchObject({ ok: true, preco: 0, cacheHit: true })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(sb.inserts).toHaveLength(0)
    expect(sb.updates.at(-1).relatorio_snapshot.multas).toMatchObject({ ...bloco, consultadoEm: '2026-10-14T10:00:00.000Z' })
  })

  it('cache vencido ou refazer: chama de novo', async () => {
    const bloco = { status: 'ok', uf: 'SC', fonte: 'detran_sc', multas_itens: [], hodometro: [], restricoes_detran: [] }
    let fetchSpy = prep(OK_SC)
    const vencido = fakeSb({ 'multas_sc|MES3261': { payload: bloco, status: 'ok', consultado_em: '2026-10-13T10:00:00.000Z', expira_em: new Date(Date.now() - 1000).toISOString() } })
    await completarDetran(vencido, { id: 'p1', placa: 'MES3261' }, { response: resp, ignorarGate: true })
    expect(fetchSpy).toHaveBeenCalled()
    vi.unstubAllGlobals(); vi.restoreAllMocks()
    fetchSpy = prep(OK_SC)
    const valido = fakeSb({ 'multas_sc|MES3261': { payload: bloco, status: 'ok', consultado_em: '2026-10-14T10:00:00.000Z', expira_em: new Date(Date.now() + 3600e3).toISOString() } })
    await completarDetran(valido, { id: 'p1', placa: 'MES3261' }, { response: resp, ignorarGate: true, refazer: true })
    expect(fetchSpy).toHaveBeenCalled()
  })

  it('protegido e indisponivel nunca entram no cache', async () => {
    prep(PROTEGIDO)
    const sb = fakeSb()
    await completarDetran(sb, { id: 'p1', placa: 'MES3261' }, { response: resp, ignorarGate: true, esperaRetryMs: 0 })
    expect(sb.upserts).toHaveLength(0)
    vi.unstubAllGlobals(); vi.restoreAllMocks()
    prep({ code: 609, code_message: 'erro na origem', header: { price: '0.28' } })
    const sb2 = fakeSb()
    await completarDetran(sb2, { id: 'p1', placa: 'MES3261' }, { response: resp, ignorarGate: true, esperaRetryMs: 0 })
    expect(sb2.upserts).toHaveLength(0)
    expect(sb2.updates.at(-1).relatorio_snapshot.multas.status).toBe('indisponivel')
  })
})
