import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buscarRecallDetalhe } from './recall-detalhe'

// Cada ida ao portal custa dinheiro de verdade. Estes testes existem pelos
// freios, nao pelo caminho feliz: cache, teto por placa e teto do dia.

type Linha = { placa: string; status: string; custo_usd: number; criado_em: string; campanhas?: any[]; texto_pagina?: string | null }

function fakeSupabase(linhas: Linha[]) {
  const inseridas: any[] = []
  return {
    inseridas,
    from() {
      const estado: any = { filtros: {}, lista: linhas }
      const api: any = {
        select: () => api,
        eq: (col: string, val: any) => { estado.filtros[col] = val; return api },
        in: (col: string, vals: any[]) => { estado.in = { col, vals }; return api },
        gte: (_c: string, v: string) => { estado.gte = v; return api },
        order: () => api,
        limit: () => api,
        insert: (linha: any) => { inseridas.push(linha); return Promise.resolve({ error: null }) },
        then: (resolve: any) => resolve({ data: aplicar(estado) }),
        maybeSingle: () => Promise.resolve({ data: aplicar(estado)[0] ?? null }),
      }
      return api
    },
  }
}

function aplicar(estado: any): any[] {
  let l = estado.lista as Linha[]
  if (estado.filtros.placa) l = l.filter((x) => x.placa === estado.filtros.placa)
  if (estado.in) l = l.filter((x: any) => estado.in.vals.includes(x[estado.in.col]))
  if (estado.gte) l = l.filter((x) => x.criado_em >= estado.gte)
  return l
}

const agora = () => new Date().toISOString()
const fetchSpy = vi.fn()

beforeEach(() => {
  process.env.NUXT_BROWSER_USE_API_KEY = 'chave-de-teste'
  vi.stubGlobal('fetch', fetchSpy)
  fetchSpy.mockReset()
})
afterEach(() => { delete process.env.NUXT_BROWSER_USE_API_KEY; vi.unstubAllGlobals() })

describe('freios da busca de recall', () => {
  it('cache de 30 dias responde sem ir ao portal', async () => {
    const sb = fakeSupabase([{ placa: 'OLO2I01', status: 'ok', custo_usd: 0.3, criado_em: agora(), campanhas: [{ montadora: 'FIAT' }], texto_pagina: 'x' }])
    const d = await buscarRecallDetalhe(sb, { placa: 'OLO2I01' })
    expect(d?.status).toBe('ok')
    expect(d?.campanhas).toHaveLength(1)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('duas tentativas na janela e o limite da placa', async () => {
    const sb = fakeSupabase([
      { placa: 'ABC1D23', status: 'captcha', custo_usd: 0.2, criado_em: agora() },
      { placa: 'ABC1D23', status: 'erro', custo_usd: 0.2, criado_em: agora() },
    ])
    expect(await buscarRecallDetalhe(sb, { placa: 'ABC1D23' })).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('teto de gasto do dia segura a proxima consulta, mesmo de outra placa', async () => {
    const sb = fakeSupabase([
      { placa: 'XXX1A11', status: 'ok', custo_usd: 1.6, criado_em: agora() },
      { placa: 'YYY2B22', status: 'ok', custo_usd: 1.5, criado_em: agora() },
    ])
    expect(await buscarRecallDetalhe(sb, { placa: 'ZZZ3C33' })).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sem chave configurada o relatorio segue sem o bloco', async () => {
    delete process.env.NUXT_BROWSER_USE_API_KEY
    expect(await buscarRecallDetalhe(fakeSupabase([]), { placa: 'ABC1D23' })).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('placa vazia nem chega a consultar', async () => {
    expect(await buscarRecallDetalhe(fakeSupabase([]), { placa: '' })).toBeNull()
  })

  it('provedor fora do ar nao derruba a entrega', async () => {
    fetchSpy.mockRejectedValue(new Error('rede caiu'))
    expect(await buscarRecallDetalhe(fakeSupabase([]), { placa: 'ABC1D23' })).toBeNull()
  })

  it('resposta completa e gravada com custo, para o teto do dia enxergar', async () => {
    const sb = fakeSupabase([])
    fetchSpy
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'run-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'completed', totalCostUsd: 0.31, result: '```json\n{"status":"ok","campanhas":[{"montadora":"FIAT"}]}\n```' }) })
    const d = await buscarRecallDetalhe(sb, { placa: 'OLO2I01', timeoutMs: 30000 })
    expect(d?.status).toBe('ok')
    expect(sb.inseridas[0]).toMatchObject({ placa: 'OLO2I01', status: 'ok', run_id: 'run-1', custo_usd: 0.31 })
  }, 20000)
})
