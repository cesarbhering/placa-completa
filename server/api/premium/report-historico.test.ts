import { describe, it, expect, vi, beforeEach } from 'vitest'
import COM from '../../utils/__fixtures__/parceiro-historico-com-registros.json'
import { parsearRespostaHistorico } from '../../../shared/historico-veicular'
import { NOME_FORNECEDOR_HISTORICO_RE } from '../../utils/parceiro-historico-env'
import { supabaseMemoria } from '../../../tests/helpers/supabase-memoria'
import { completarIpvaSefazMg, completarNadaConstaRj } from '../../utils/infosimples-detran'

// /api/premium/report with the vehicle history partner: the clean block goes
// out through an allow-list, its auction part is merged into the auction
// section as "Base parceira", the Basica never gets any of it, and the report
// JSON never carries a name, a document or the vendor name.

vi.mock('../../utils/placa-lookup', () => ({ lerPlacaCacheParaRelatorio: async () => null, motorDoPayload: () => null }))
vi.mock('../../utils/cupom-recompra', () => ({ cupomRecompraDoPedido: async () => null }))
vi.mock('../../utils/entrega-pedido', () => ({ promoverSeSnapshotPronto: async () => false }))
vi.mock('../../utils/relatorio-aberturas', () => ({ registrarAbertura: async () => {} }))
const { emVooSpy } = vi.hoisted(() => ({ emVooSpy: vi.fn() }))
vi.mock('../../utils/tarefas-em-voo', () => ({ emVoo: emVooSpy }))
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
let reprocessar: (chave: string) => boolean = () => false
vi.stubGlobal('podeReprocessar', (chave: string) => reprocessar(chave))
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

  it('daily ceiling reached at delivery: the screen does not wait for it, and the queue job may not exist yet (review 1 item 2, review 2 item 4)', async () => {
    runtime.parceiroHistoricoLigado = 'on'; runtime.parceiroHistoricoKey = 'k'
    comPedido({}, { historicoVeicular: { status: 'teto', consultadoEm: null } })
    const r: any = await handler({} as any)
    expect(r.fontes).toEqual([{ fonte: 'historico_veicular', rotulo: 'Donos, leilão e sinistro', estado: 'chegando' }])
    // No "could not consult" line while it is arriving.
    expect(r.historicoLeilao.parceiro).toBeUndefined()
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

// IPVA in arrears at the DETRAN-MG (Cesar, 18/11/2026): the SEFAZ-MG is asked
// with the owner document read on the server from the partner answer. The
// report shows the open years and never the document nor the owner's name.
describe('report JSON with the calls made with the owner document', () => {
  it('shows the open years and never the owner name or document read from the partner answer', async () => {
    const CPF = '123.456.789-09' // ggignore
    const NOME = 'DONO FICTICIO MARCADO'
    const CHASSI = '9XXHV00000X000001' // ggignore
    const consulta = { response: { ufJurisdicao: 'MG', renavam: '987654321', chassi: CHASSI, placa: 'TST2B34', descricaoMarcaModelo: 'FIAT/PALIO ELX' } } // ggignore
    const multas = { status: 'ok', fonte: 'detran_mg', multas_total_centavos: 0, ipva_total_centavos: null, ipva_pago_ano: 2020, multas_itens: [], restricoes_detran: [], ipva_pendente_sefaz: true }
    // The real executor, on a database that has the partner answer (with the owner) in the restricted table.
    const sb: any = supabaseMemoria({ rpc: (nome: string) => nome === 'job_lock_pegar' })
    sb.tab('pedidos_premium').push({ id: 'pedido-teste', placa: 'TST2B34', plano: 'completa', relatorio_snapshot: { consulta, multas } })
    sb.tab('parceiro_historico_chamadas').push({
      pedido_id: 'pedido-teste', placa: 'TST2B34', cobrada: true, criado_em: new Date().toISOString(),
      resposta_bruta: { success: true, dados: { chassi: CHASSI, proprietarios: { total: 1, proprietario_atual: { nome: NOME, documento: '***.456.789-**', documentoOriginal: CPF } } } },
    })
    const fetchAntes = globalThis.fetch
    runtime.infosimplesToken = 't'
    globalThis.fetch = (async () => ({
      status: 200,
      json: async () => ({ code: 200, header: { price: '0.24', parameters: { cpf: '12345678909' } }, data: [{ identificacao: CPF, nome_razao_social: NOME, debitos_adm: [{ exercicio: '2025', normalizado_valor: 560.9 }], debitos_divida_ativa: [{ exercicio: '2023', normalizado_valor: 90.5 }] }] }), // ggignore
    })) as any
    try {
      expect(await completarIpvaSefazMg(sb, 'pedido-teste')).toMatchObject({ feito: 'ok' })
    } finally {
      globalThis.fetch = fetchAntes
      delete runtime.infosimplesToken
    }
    comPedido({}, { consulta, multas: sb.tab('pedidos_premium')[0].relatorio_snapshot.multas })
    const r: any = await handler({} as any)
    expect(r.multas).toMatchObject({
      ipva_fonte: 'sefaz_mg', ipva_total_centavos: 65140,
      ipva_itens: [{ ano: 2025, vencimento: null, valor_centavos: 56090 }, { ano: 2023, vencimento: null, valor_centavos: 9050, divida_ativa: true }],
    })
    const json = JSON.stringify(r)
    expect(json).not.toMatch(/DONO FICTICIO|123\.456\.789-09|12345678909|456\.789/) // ggignore
  })

  it('RJ: shows the unpaid fines from the nada consta and never the owner name or document', async () => {
    const CNPJ = '11.222.333/0001-81' // ggignore
    const NOME = 'DONO FICTICIO MARCADO'
    const CHASSI = '9XXHV00000X000001' // ggignore
    const consulta = { response: { ufJurisdicao: 'RJ', renavam: '987654321', chassi: CHASSI, placa: 'TST2B34', descricaoMarcaModelo: 'FIAT/PALIO ELX' } } // ggignore
    const multas = {
      status: 'ok', fonte: 'detran_rj', multas_total_centavos: null, ipva_total_centavos: null, licenciamento_centavos: null, multas_itens: [], restricoes_detran: [],
      debitos_indisponiveis: true, aviso_debitos: 'Multas e IPVA do RJ não estão disponíveis: o estado exige o documento do proprietário para essa consulta.', nada_consta_pendente: true,
    }
    const sb: any = supabaseMemoria({ rpc: (nome: string) => nome === 'job_lock_pegar' })
    sb.tab('pedidos_premium').push({ id: 'pedido-teste', placa: 'TST2B34', plano: 'completa', relatorio_snapshot: { consulta, multas } })
    sb.tab('parceiro_historico_chamadas').push({
      pedido_id: 'pedido-teste', placa: 'TST2B34', cobrada: true, criado_em: new Date().toISOString(),
      resposta_bruta: { success: true, dados: { chassi: CHASSI, proprietarios: { total: 1, proprietario_atual: { nome: NOME, razao_social: NOME, documento: CNPJ, documentoOriginal: CNPJ } } } },
    })
    const fetchAntes = globalThis.fetch
    runtime.infosimplesToken = 't'
    globalThis.fetch = (async () => ({
      status: 200,
      json: async () => ({
        code: 200, header: { price: '0.24', parameters: { cnpj: '11222333000181', renavam: '00987654321' } }, // ggignore
        data: [{ renavam: '00987654321', multas: [{ auto_de_infracao: 'E00000001', descricao: 'ESTACIONAR EM LOCAL PROIBIDO', data_infracao: '02/04/2026', hora: '09:05', local_da_infracao: 'AV FICTICIA 1000', orgao_emissor: 'ORGAO AUTUADOR TESTE', agente_emissor: 'AGENTE TESTE 000', valor_a_ser_pago: 'R$ 195,23', valor_original: 'R$ 195,23', situacao: 'EM ABERTO', status_de_pagamento: 'NÃO PAGO' }] }], // ggignore
      }),
    })) as any
    try {
      expect(await completarNadaConstaRj(sb, 'pedido-teste')).toMatchObject({ feito: 'ok' })
    } finally {
      globalThis.fetch = fetchAntes
      delete runtime.infosimplesToken
    }
    comPedido({}, { consulta, multas: sb.tab('pedidos_premium')[0].relatorio_snapshot.multas })
    const r: any = await handler({} as any)
    expect(r.multas).toMatchObject({
      multas_fonte: 'detran_rj_nada_consta', multas_total_centavos: 19523, debitos_indisponiveis: true, aviso_debitos: 'IPVA do RJ não está disponível nesta consulta.',
      multas_itens: [{ auto: 'E00000001', valor: 195.23, local: 'AV FICTICIA 1000', orgao: 'ORGAO AUTUADOR TESTE' }],
    })
    expect(JSON.stringify(r)).not.toMatch(/DONO FICTICIO|11\.222\.333|11222333000181|AGENTE/) // ggignore
  })

  // Review of PR #762: a call that got lost (process down, final write lost)
  // leaves the mark for good; reading the report resumes it after 15 minutes.
  it('a call with the owner document pending for more than 15 minutes is resumed when the report is read', async () => {
    const consulta = { response: { ufJurisdicao: 'MG', renavam: '987654321', chassi: '9XXHV00000X000001', placa: 'TST2B34', descricaoMarcaModelo: 'FIAT/PALIO ELX' } } // ggignore
    const pendenteHa = (min: number) => ({
      status: 'ok', fonte: 'detran_mg', multas_total_centavos: 0, ipva_total_centavos: null, ipva_pago_ano: 2020, multas_itens: [], restricoes_detran: [],
      ipva_pendente_sefaz: true, ipva_pendente_sefaz_em: new Date(Date.now() - min * 60_000).toISOString(),
    })
    const disparos = () => emVooSpy.mock.calls.map((c: any[]) => c[0])
    reprocessar = (chave) => chave.startsWith('documento:')
    try {
      emVooSpy.mockClear()
      comPedido({}, { consulta, multas: pendenteHa(1) })
      await handler({} as any)
      expect(disparos()).not.toContain('consulta-documento')
      comPedido({}, { consulta, multas: pendenteHa(16) })
      await handler({} as any)
      expect(disparos()).toContain('consulta-documento')
    } finally {
      reprocessar = () => false
    }
  })
})
