import { describe, it, expect, vi, beforeEach } from 'vitest'
import COM from '../../utils/__fixtures__/parceiro-historico-com-registros.json'
import { parsearRespostaHistorico } from '../../../shared/historico-veicular'
import { NOME_FORNECEDOR_HISTORICO_RE } from '../../utils/parceiro-historico-env'

// /api/premium/report with the vehicle history partner: the clean block goes
// out through an allow-list, its auction part is merged into the auction
// section as "Base parceira", the Basica never gets any of it, and the report
// JSON never carries a name, a document or the vendor name.

vi.mock('../../utils/placa-lookup', () => ({ lerPlacaCacheFresca: async () => null, motorDoPayload: () => null }))
vi.mock('../../utils/cupom-recompra', () => ({ cupomRecompraDoPedido: async () => null }))
vi.mock('../../utils/entrega-pedido', () => ({ promoverSeSnapshotPronto: async () => false }))
vi.mock('../../utils/relatorio-aberturas', () => ({ registrarAbertura: async () => {} }))
vi.mock('../../utils/tarefas-em-voo', () => ({ emVoo: () => {} }))
vi.mock('../../utils/aviso-restricao', () => ({ avisarRestricaoSemCopy: async () => {} }))
vi.mock('../../utils/premium-jobs', () => ({
  fontesAplicaveis: (_r: any, o: any = {}) => (o.historicoVeicular ? [{ fonte: 'historico_veicular', rotulo: 'Donos, leilão e sinistro' }] : []),
}))

const vazio = () => ({ resumo: { tem_indicio: false, nivel_max: null, n_confirmado: 0, n_provavel: 0, n_possivel: 0, possiveis_ambiguos: 0, fontes_com_passagem: [] }, passagens: [], linha_do_tempo: null })
const bloco = () => ({ ...parsearRespostaHistorico(structuredClone(COM))!, consultadoEm: '2026-10-02T15:00:00.000Z' })
let pedido: any
let jobs: any[] = []
const runtime: any = { public: {}, anthropicApiKey: '' }

function construtor(tab: string) {
  const b: any = {}
  for (const m of ['select', 'eq', 'like', 'order', 'limit', 'is', 'update']) b[m] = () => b
  const resultado = () => (tab === 'pedidos_premium' ? { data: structuredClone(pedido), error: null } : { data: tab === 'premium_jobs' ? jobs : [], error: null })
  b.single = async () => resultado()
  b.maybeSingle = async () => resultado()
  b.then = (ok: any, erro: any) => Promise.resolve(resultado()).then(ok, erro)
  return b
}

vi.stubGlobal('defineEventHandler', (f: any) => f)
vi.stubGlobal('getQuery', () => ({ token: 'TokenFicticioDeTeste0002' }))
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
vi.stubGlobal('useRuntimeConfig', () => runtime)
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
vi.stubGlobal('detectarSegmento', () => 'carro')

const { default: handler } = await import('./report.get')

function comPedido(x: any = {}, snap: any = {}) {
  pedido = {
    id: 'pedido-teste', status: 'entregue', placa: 'TST2B34', plano: 'completa', valor_centavos: 4490, preview: {},
    consulta_id: null, entregue_em: new Date(Date.now() - 60_000).toISOString(), criado_em: '2026-10-02T15:00:00Z', br_code: null, expira_em: null,
    snapshot_em: '2026-10-02T15:00:00Z', email: null, erro: null, forma_pagamento: 'pix', recall_sinal: null, recall_marca: null, ambiente: 'teste',
    relatorio_snapshot: { consulta: { response: { chassi: '9XXHV00000X000001', descricaoMarcaModelo: 'FIAT/PALIO ELX' } }, camposRestantes: 0, recallBase: null, historicoLeilao: vazio(), historicoVeicular: bloco(), ...snap },
    ...x,
  }
}

describe('report JSON with the vehicle history partner', () => {
  beforeEach(() => { runtime.parceiroHistoricoLigado = ''; runtime.parceiroHistoricoKey = ''; jobs = [] })

  it('Completa: the three blocks (allow-list) and the partner auction records as "Base parceira"', async () => {
    comPedido()
    const r: any = await handler({} as any)
    expect(r.historicoVeicular).toMatchObject({ status: 'ok', donos: { total: 12 }, sinistro: { parecer: 'alto' } })
    expect(r.historicoVeicular.leilao).toBeUndefined()
    expect(r.historicoLeilao.parceiro.status).toBe('ok')
    expect(r.historicoLeilao.sinistro_parceiro.indicio).toBe(true)
    expect(r.historicoLeilao.passagens.map((p: any) => [p.fonte_exibicao, p.ano_leilao, p.registro])).toEqual([['Base parceira', '2019', 'edital'], ['Base parceira', '2024', 'salvado']])
    const json = JSON.stringify(r)
    expect(json).not.toMatch(/FICTICIA|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)
    expect(json).not.toMatch(NOME_FORNECEDOR_HISTORICO_RE)
    // The block was already in, so the source is done (no wait on screen).
    expect(r.fontes).toEqual([{ fonte: 'historico_veicular', rotulo: 'Donos, leilão e sinistro', estado: 'ok' }])
  })

  it('Basica: nothing of it, even with the block in the snapshot', async () => {
    comPedido({ plano: 'basica' })
    const r: any = await handler({} as any)
    expect(r.historicoVeicular).toBeNull()
    expect(r.historicoLeilao.passagens).toEqual([])
    expect(r.historicoLeilao.parceiro).toBeUndefined()
    expect(r.fontes).toBeNull()
  })

  it('switch on, recent order without the block yet: the screen waits for it', async () => {
    runtime.parceiroHistoricoLigado = 'on'; runtime.parceiroHistoricoKey = 'k'
    comPedido({}, { historicoVeicular: undefined })
    const r: any = await handler({} as any)
    expect(r.historicoVeicular).toBeNull()
    expect(r.fontes).toEqual([{ fonte: 'historico_veicular', rotulo: 'Donos, leilão e sinistro', estado: 'consultando' }])
  })

  it('partner answered for another VIN: nothing of it, no damage flag, source done (review 1, item 8)', async () => {
    comPedido({}, { consulta: { response: { chassi: '9XXHV00000X999999', descricaoMarcaModelo: 'FIAT/PALIO ELX' } } })
    const r: any = await handler({} as any)
    expect(r.historicoVeicular).toEqual({ status: 'divergente', consultadoEm: '2026-10-02T15:00:00.000Z' })
    expect(r.historicoLeilao.passagens).toEqual([])
    expect(r.historicoLeilao.parceiro).toBeUndefined()
    expect(r.historicoLeilao.sinistro_parceiro).toBeUndefined()
    expect(r.fontes).toEqual([{ fonte: 'historico_veicular', rotulo: 'Donos, leilão e sinistro', estado: 'ok' }])
    expect(JSON.stringify(r)).not.toContain('9XXHV00000X000001')
  })

  it('daily ceiling reached at delivery: the screen does not wait for it (review 1, item 2)', async () => {
    runtime.parceiroHistoricoLigado = 'on'; runtime.parceiroHistoricoKey = 'k'
    comPedido({}, { historicoVeicular: { status: 'teto', consultadoEm: null } })
    const r: any = await handler({} as any)
    expect(r.fontes).toEqual([{ fonte: 'historico_veicular', rotulo: 'Donos, leilão e sinistro', estado: 'indisponivel' }])
  })

  it('early call failed (timeout or 5xx) with the queue still to try: "chegando" at once, no "could not consult" line yet', async () => {
    runtime.parceiroHistoricoLigado = 'on'; runtime.parceiroHistoricoKey = 'k'
    jobs = [{ fonte: 'historico_veicular', status: 'pendente' }]
    comPedido({}, { historicoVeicular: { status: 'falhou', consultadoEm: null, motivo: 'erro' } })
    const r: any = await handler({} as any)
    expect(r.fontes).toEqual([{ fonte: 'historico_veicular', rotulo: 'Donos, leilão e sinistro', estado: 'chegando' }])
    expect(r.historicoVeicular).toEqual({ status: 'falhou', consultadoEm: null })
    expect(r.historicoLeilao.parceiro).toBeUndefined()
    jobs = []
    comPedido({ entregue_em: '2026-10-01T00:00:00Z' }, { historicoVeicular: { status: 'falhou', consultadoEm: null } })
    const antigo: any = await handler({} as any)
    expect(antigo.fontes[0].estado).toBe('indisponivel')
    expect(antigo.historicoLeilao.parceiro).toEqual({ status: 'falhou', consultado_em: null })
  })
})
