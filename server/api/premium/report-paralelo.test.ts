import { describe, it, expect, vi, beforeEach } from 'vitest'

// /api/premium/report: the final reads (placa_cache, premium_jobs,
// premium_custos, cupom) are independent and go out together, and the
// placa_cache row is read once even when both motor and logo need it.

const ATRASO = 60
const espera = () => new Promise((ok) => setTimeout(ok, ATRASO))
let leiturasPlacaCache = 0
let emVooAgora = 0
let picoEmVoo = 0
const rastrear = async <T>(f: () => T): Promise<T> => {
  emVooAgora++; picoEmVoo = Math.max(picoEmVoo, emVooAgora)
  try { await espera(); return f() } finally { emVooAgora-- }
}

vi.mock('../../utils/placa-lookup', () => ({
  lerPlacaCacheFresca: () => { leiturasPlacaCache++; return rastrear(() => ({ motor: 'MTR0000TESTE', logo: null })) },
  motorDoPayload: (c: any) => c?.motor ?? null,
}))
vi.mock('../../utils/cupom-recompra', () => ({ cupomRecompraDoPedido: () => rastrear(() => null) }))
vi.mock('../../utils/entrega-pedido', () => ({ promoverSeSnapshotPronto: async () => false }))
vi.mock('../../utils/relatorio-aberturas', () => ({ registrarAbertura: async () => {} }))
vi.mock('../../utils/tarefas-em-voo', () => ({ emVoo: () => {} }))
vi.mock('../../utils/aviso-restricao', () => ({ avisarRestricaoSemCopy: async () => {} }))
vi.mock('../../utils/premium-jobs', () => ({ fontesAplicaveis: () => [] }))

const PEDIDO = {
  id: 'pedido-teste', status: 'entregue', placa: 'TST1A23', plano: 'basica', valor_centavos: 1990, preview: {},
  consulta_id: null, entregue_em: '2026-11-01T00:00:00Z', criado_em: '2026-11-01T00:00:00Z', br_code: null, expira_em: null,
  snapshot_em: '2026-11-01T00:00:00Z', email: null, erro: null, forma_pagamento: 'pix', recall_sinal: null, recall_marca: null,
  ambiente: 'teste', relatorio_snapshot: { consulta: { response: { chassi: '' } }, camposRestantes: 0, recallBase: null },
}

function construtor(tab: string) {
  const b: any = {}
  for (const m of ['select', 'eq', 'like', 'order', 'limit', 'is', 'update']) b[m] = () => b
  const resultado = () => tab === 'pedidos_premium' ? { data: structuredClone(PEDIDO), error: null } : { data: [], error: null }
  b.single = () => rastrear(resultado)
  b.maybeSingle = () => rastrear(resultado)
  b.then = (ok: any, erro: any) => rastrear(resultado).then(ok, erro)
  return b
}

vi.stubGlobal('defineEventHandler', (f: any) => f)
vi.stubGlobal('getQuery', () => ({ token: 'TokenFicticioDeTeste0001' }))
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
vi.stubGlobal('useRuntimeConfig', () => ({ public: {}, anthropicApiKey: '' }))
vi.stubGlobal('usePremiumSupabase', () => ({ from: (t: string) => construtor(t) }))
vi.stubGlobal('podeReprocessar', () => false)
vi.stubGlobal('temRecallPendente', () => false)
vi.stubGlobal('temMultaSP', () => false)
vi.stubGlobal('completarRecallDepois', () => {})
vi.stubGlobal('completarMultasDepois', () => {})
vi.stubGlobal('camposLazyPendentes', () => [])
vi.stubGlobal('preencherCamposLazy', async () => ({}))
vi.stubGlobal('faltaPlanta', () => false)
vi.stubGlobal('enriquecerPlanta', async () => undefined)
vi.stubGlobal('corrigirAnoChassi', (c: any) => c)
vi.stubGlobal('montarRelatorioSnapshot', async () => { throw new Error('nao deveria montar') })
vi.stubGlobal('detectarSegmento', () => 'outro')

const { default: handler } = await import('./report.get')

describe('premium report final reads', () => {
  beforeEach(() => { leiturasPlacaCache = 0; picoEmVoo = 0; emVooAgora = 0 })

  it('reads placa_cache once for motor and logo', async () => {
    const r: any = await handler({} as any)
    expect(leiturasPlacaCache).toBe(1)
    expect(r.motor).toBe('MTR0000TESTE')
    expect(r.status).toBe('entregue')
  })

  it('runs the independent reads together instead of one after another', async () => {
    const t0 = Date.now()
    await handler({} as any)
    const ms = Date.now() - t0
    // pedido + (placa_cache | premium_custos | cupom) = 2 rounds; serial would be 4.
    expect(picoEmVoo).toBeGreaterThanOrEqual(3)
    expect(ms).toBeLessThan(ATRASO * 3.5)
  })
})
