// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SEM from './__fixtures__/parceiro-historico-sem-registros.json'
import REAL from './__fixtures__/parceiro-leilao-real.json'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'
import { pedidosComCaminhos } from '../../tests/helpers/supabase-caminhos'

// Customer e-mails, captured: the late auction notice and the queue's "updated" e-mail.
const { avisos, atualizacoes } = vi.hoisted(() => ({ avisos: [] as any[], atualizacoes: [] as any[] }))
vi.mock('./premium-email', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  enviarAvisoLeilao: vi.fn(async (m: any) => { avisos.push(m); return true }),
  enviarAtualizacaoRelatorio: vi.fn(async (m: any) => { atualizacoes.push(m); return true }),
}))
// Engine number lookup of the plate (snapshot assembly): not part of these tests.
vi.mock('./placa-lookup', () => ({ consultarPlacaWdapi: async () => null, motorDoPayload: () => null }))

import { completarHistoricoVeicular, completarHistoricoVeicularOperador, iniciarHistoricoVeicular, _limparEmVooHistorico, _limparAlertaTetoHistorico } from './parceiro-historico'
import { cfgHistorico } from './parceiro-historico-env'
import { leilaoParceiroComoReserva, rodarJobParceiro, cfgParceiro, _limparTokenParceiro, _limparAlertaTeto, FONTE_CUSTO_PARCEIRO, FONTE_CACHE_PARCEIRO } from './parceiro-leilao'
import { executarJob, verificarFechamento } from './premium-jobs'
import { montarRelatorioSnapshot } from './relatorio-snapshot'
import { preencherCamposLazy } from './relatorio-lazy-fill'
import { rebuildLeilao } from './rebuild-leilao'
import { parsearRespostaHistorico } from '../../shared/historico-veicular'

// Cesar, 18/11/2026: when the vehicle history partner answers COMPLETE with a
// bank, finance company, leasing or insurer in the chain of owners, no auction
// record of its own and nothing in our auction base, the auction partner is
// called for the order, under all of its usual rules, and the reason is kept
// (partner state, cost detail, log). These tests run the real wiring: default
// deps, both partners behind a fake fetch, the real late auction notifier.
// Orders here are paid after the cutoff of the rule of 23/11/2026
// (CORTE_SEM_LEILAO) unless a test says otherwise.

// Payment dates (pago_em) after and before that cutoff.
const PAGO_NOVO = '2026-11-23T22:00:00.000Z'
const PAGO_ANTIGO = '2026-11-20T15:00:00.000Z'
const PLACA = 'TST2B34'
const OUTRA_PLACA = 'TST5C67'
const TERCEIRA_PLACA = 'TST8D90'
// VIN of the vehicle history fixture without records (fictitious).
const CHASSI = '9XXHV00000X000002' // ggignore
// The partner answers with the order's own VIN, as in a real hit. A different full VIN
// makes the card "possivel", and since 25/11/2026 a "possivel" card never triggers the
// late notice (aviso-leilao.test.ts covers that case).
const REAL_MESMO_CHASSI = { ...REAL, resultados: { ...REAL.resultados, leilao: { ...REAL.resultados.leilao, leiloes: REAL.resultados.leilao.leiloes.map((l: any) => ({ ...l, chassi: CHASSI })) } } }
const CONFIG = (x: Record<string, unknown> = {}) => ({
  parceiroLeilaoLigado: 'on', parceiroLeilaoUser: 'u', parceiroLeilaoPass: 'p', parceiroLeilaoTetoDia: '40',
  parceiroHistoricoLigado: 'on', parceiroHistoricoKey: 'k', public: {}, ...x,
})
const vazio = () => ({ resumo: { tem_indicio: false, nivel_max: null, n_confirmado: 0, n_provavel: 0, n_possivel: 0, possiveis_ambiguos: 0, fontes_com_passagem: [] }, passagens: [] as any[], indice_atualizado_em: null, aviso: null })
const comPassagem = () => ({ ...vazio(), resumo: { ...vazio().resumo, tem_indicio: true, nivel_max: 'provavel', n_provavel: 1 }, passagens: [{ nivel: 'provavel', fonte: 'detran_sp' }] })

// Vehicle history answers: the fixture without records is complete, with two
// owners (a company and a person), no bank, no insurer and no auction.
function comIndicador(base: any, codigo: string, ind: Record<string, unknown>) {
  const r = structuredClone(base)
  r.dados.indicadores = r.dados.indicadores.map((i: any) => (i.codigo === codigo ? { ...i, ...ind } : i))
  return r
}
function comPrimeiroDono(base: any, campos: Record<string, unknown>) {
  const r = structuredClone(base)
  r.dados.proprietarios.historico[0] = { ...r.dados.proprietarios.historico[0], ...campos }
  return r
}
const BANCO = comIndicador(SEM, 'P7', { status: 'positivo', conteudo: [{ ano: '2019', instituicao: 'BANCO FICTICIO S.A.', tipo: 'Instituição Financeira / Leasing na Cadeia Dominial' }] })
const SEGURADORA = comIndicador(SEM, 'P1', { status: 'positivo', conteudo: [{ seguradora: 'SEGURADORA FICTICIA S.A.', tipoEntidade: 'seguradora', tipoEvento: 'Titularidade', ano: '2020' }] })
const DONO_SEGURADORA = comPrimeiroDono(SEM, { classificacaoEntidade: 'seguradora' })
const BANCO_COM_EDITAL = comIndicador(BANCO, 'P11', { status: 'positivo', conteudo: [{ ano: 2021, leiloeiro: 'CASA FICTICIA LEILÕES', lote: '42' }] })
const SO_INDENIZACAO = comIndicador(SEM, 'P14', { status: 'positivo', conteudo: [{ seguradora: 'SEGURADORA FICTICIA S.A.', tipoEvento: 'Indenização Integral de Sinistro', ano: '2022' }] })
// One auction record of each kind in an answer otherwise like the one without
// records: a notice with a real lot, a public body auction without a lot, a
// salvage sale by an insurer.
const EDITAL_LOTE = comIndicador(SEM, 'P11', { status: 'positivo', conteudo: [{ ano: 2021, leiloeiro: 'CASA FICTICIA LEILÕES', lote: '42' }] })
const ORGAO_PUBLICO = (() => {
  const r = structuredClone(SEM)
  r.dados.outros_produtos.leiloes = [{ ano: 2006, leiloeiro: 'WEB - LEILOES ONLINE', lote: 'NADA CONSTA', comitente: 'PREFEITURA MUNICIPAL DE CIDADE EXEMPLO' }]
  return r
})()
const SALVADO = comIndicador(SEM, 'P1', { status: 'positivo', conteudo: [{ seguradora: 'SEGURADORA FICTICIA S.A.', tipoEntidade: 'seguradora', tipoEvento: 'Venda Direta / Remarketing', ano: '2020' }] })
/** Partial answer: the claims source of the vehicle history partner failed (charged, shown in part). */
function semSinistros(base: any) {
  const r = structuredClone(base)
  r.dados.raw_sources = { ...r.dados.raw_sources, infosinistrosSuccess: false }
  return r
}
// Auction partner answers (same shape as the real one): nothing at all, or only a damage sign.
const LEILAO_NADA = { consulta: REAL.consulta, resultados: { leilao: { placa: REAL.resultados.leilao.placa, temRegistro: false, leiloes: [] }, sinistro: { indicioDeSinistro: 0, mensagemSinistro: 'NAO EXISTE REGISTRO DE INDICIO DE SINISTRO' } } }
const LEILAO_SO_SINISTRO = { ...LEILAO_NADA, resultados: { ...LEILAO_NADA.resultados, sinistro: REAL.resultados.sinistro } }
/** The clean block of an answer, as the snapshot stores it. */
const bloco = (resposta: any) => ({ ...parsearRespostaHistorico(structuredClone(resposta))!, consultadoEm: '2026-11-18T12:00:00.000Z' })

let config: ReturnType<typeof CONFIG>
let historicoPorPlaca: Record<string, any>
let nossaBase: any
let leilaoForaDoAr: boolean
/** What the auction partner answers (the real answer: one auction and a damage sign). */
let respostaLeilao: any
let chamadasHistorico: string[]
/** Paid attempts of the auction partner (login not counted). */
let chamadasLeilao: string[]
let logs: string[]
let espiaLog: ReturnType<typeof vi.spyOn>
/** The snapshot write of the vehicle history block fails (the RPC writes nothing). */
let gravacaoFalha: boolean

/** In-memory database with the RPCs these paths use: named locks, the vehicle history ceiling and the two snapshot writes. */
function banco() {
  let seq = 0
  const sb: any = supabaseMemoria({
    rpc: (nome: string, a: any) => {
      if (nome === 'parceiro_historico_reservar') {
        const id = `reserva-${++seq}`
        sb.tab('parceiro_historico_chamadas').push({ id, pedido_id: a.p_pedido, placa: a.p_placa, em_andamento: true, cobrada: false, cache_hit: false, criado_em: new Date().toISOString() })
        return id
      }
      if (nome === 'snapshot_gravar_historico_veicular') {
        const linha = sb.tab('pedidos_premium').find((p: any) => p.id === a.p_pedido)
        if (gravacaoFalha || !linha?.relatorio_snapshot) return false
        if (linha.relatorio_snapshot.historicoVeicular?.status === 'ok' && a.p_valor?.status !== 'ok') return false
        linha.relatorio_snapshot = { ...linha.relatorio_snapshot, historicoVeicular: a.p_valor }
        return true
      }
      if (nome === 'preencher_snapshot_campo') {
        const linha = sb.tab('pedidos_premium').find((p: any) => p.token_entrega === a.p_token)
        if (linha) linha.relatorio_snapshot = { ...linha.relatorio_snapshot, [a.p_campo]: a.p_valor, [`${a.p_campo}_em`]: a.p_marcador_em }
        return true
      }
      // job_lock_pegar: every named lock is taken.
      return true
    },
  })
  return sb
}

/** A delivered Completa order, paid after the cutoff. The snapshot has our auction base empty and, unless given, no vehicle history yet. */
function pedido(sb: any, id = 'p1', x: Record<string, unknown> = {}, snap: Record<string, unknown> = {}) {
  const linha = {
    id, placa: PLACA, plano: 'completa', status: 'entregue', email: 'c@x.com', token_entrega: `TOK-${id}`, consulta_id: null, preview: null,
    pago_em: PAGO_NOVO, entregue_em: new Date(Date.now() - 3600_000).toISOString(), ...x,
    relatorio_snapshot: { consulta: { response: { chassi: CHASSI } }, historicoLeilao: vazio(), ...snap },
  }
  sb.tab('pedidos_premium').push(linha)
  return linha
}

const PEDIDO = (id = 'p1', placa = PLACA) => ({ id, placa, plano: 'completa' })
const parceiroDe = (sb: any, id = 'p1') => sb.tab('pedidos_premium').find((p: any) => p.id === id)!.relatorio_snapshot.historicoLeilao?.parceiro
const pagas = (sb: any) => sb.tab('parceiro_leilao_chamadas').filter((l: any) => l.cobrada)
const custosLeilao = (sb: any) => sb.tab('premium_custos').filter((c: any) => c.fonte === FONTE_CUSTO_PARCEIRO)
/** The step right after the delivery (and the queue job, with retentar), with its default deps. */
const depoisDaEntrega = (sb: any, id = 'p1', placa = PLACA) => completarHistoricoVeicular(sb, PEDIDO(id, placa), { cfg: cfgHistorico(config) })
/** The queue job of the vehicle history source (premium_jobs), with its default deps. */
const filaDoHistorico = (sb: any, id = 'p1', tentativas = 0) => executarJob(sb, { id: `job-${id}`, pedido_id: id, fonte: 'historico_veicular', tentativas, max_tentativas: 4 })
/** The retry job of the auction partner (plugin, every 15 min), with the default notifier. */
const retryDoJob = (sb: any) => rodarJobParceiro({ sb: pedidosComCaminhos(sb).fake, cfg: cfgParceiro(config, {}), agora: Date.now(), log: (m: string) => logs.push(m), dono: 'job', alertar: async () => {} })

beforeEach(() => {
  config = CONFIG()
  historicoPorPlaca = { [PLACA]: BANCO, [OUTRA_PLACA]: BANCO }
  nossaBase = vazio()
  leilaoForaDoAr = false
  respostaLeilao = REAL_MESMO_CHASSI
  gravacaoFalha = false
  chamadasHistorico = []
  chamadasLeilao = []
  logs = []
  avisos.length = 0
  atualizacoes.length = 0
  _limparTokenParceiro()
  _limparAlertaTeto()
  _limparAlertaTetoHistorico()
  _limparEmVooHistorico()
  espiaLog = vi.spyOn(console, 'info').mockImplementation((...a: any[]) => { logs.push(a.join(' ')) })
  vi.stubGlobal('useRuntimeConfig', () => config)
  vi.stubGlobal('sendErrorEmail', async () => {})
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
  // Nuxt auto-imports of the snapshot assembly: only our auction base matters here.
  vi.stubGlobal('getValorCusto', async () => null)
  vi.stubGlobal('detectarSegmento', () => 'carro')
  vi.stubGlobal('decodificarChassi', async () => null)
  vi.stubGlobal('corrigirAnoChassi', (x: any) => x)
  vi.stubGlobal('consultarHistoricoLeilao', async () => structuredClone(nossaBase))
  vi.stubGlobal('fetch', async (url: string) => {
    if (url.includes('/v1/e20?query=')) {
      const placa = decodeURIComponent(url.split('query=')[1] ?? '')
      chamadasHistorico.push(placa)
      return { status: 200, text: async () => JSON.stringify(historicoPorPlaca[placa]) }
    }
    if (url.endsWith('/api/Auth/login')) return { status: 200, text: async () => JSON.stringify({ token: 'jwt' }) }
    chamadasLeilao.push(url)
    return leilaoForaDoAr ? { status: 503, text: async () => 'fora' } : { status: 200, text: async () => JSON.stringify(respostaLeilao) }
  })
})

afterEach(() => {
  espiaLog.mockRestore()
  vi.unstubAllGlobals()
})

describe('auction partner when a complete vehicle history shows a bank or insurer in the chain', () => {
  it('1. complete with a bank in the chain and no auction: calls once, with the reason banco_na_cadeia', async () => {
    const sb = banco()
    // The paid query of the order; the vehicle history call starts with it and is ready before the assembly.
    sb.tab('senatran_consultas').push({ id: 'c1', placa: PLACA, created_at: '2026-11-18T12:00:00Z', response: { chassi: CHASSI, descricaoMarcaModelo: 'MARCA/MODELO', anoModelo: 2020, ufJurisdicao: 'SP' } })
    const linha: any = { id: 'p1', placa: PLACA, plano: 'completa', status: 'consultando', pago_em: PAGO_NOVO, email: 'c@x.com', token_entrega: 'TOK-p1', consulta_id: 'c1', preview: null }
    sb.tab('pedidos_premium').push(linha)
    expect(await iniciarHistoricoVeicular(sb, PEDIDO())).toMatchObject({ ok: true, status: 'ok' })

    // Snapshot assembly of the delivery: the complete block is here, our base is empty.
    const snap: any = await montarRelatorioSnapshot(sb, { placa: PLACA, plano: 'completa', consulta_id: 'c1', preview: null, id: 'p1' })
    expect(snap.historicoVeicular).toMatchObject({ status: 'ok', completa: true, uso: { financeiras: [{ ano: '2019' }] }, leilao: { registros: [] } })
    expect(snap.historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true, motivo: 'banco_na_cadeia' })
    expect(snap.historicoLeilao.passagens.length).toBeGreaterThan(0)
    expect(chamadasLeilao).toHaveLength(1)
    Object.assign(linha, { status: 'entregue', entregue_em: new Date().toISOString(), relatorio_snapshot: snap })

    // Every later path of the same order: step after the delivery, queue, retry job. No second call.
    expect(await depoisDaEntrega(sb)).toMatchObject({ pulado: 'ja tem' })
    expect(await filaDoHistorico(sb)).toEqual({ status: 'ok', code: 0 })
    await retryDoJob(sb)
    expect(chamadasLeilao).toHaveLength(1)
    expect(pagas(sb)).toHaveLength(1)
    // The reason: in the cost detail and in the log, never with the plate.
    expect(custosLeilao(sb)).toEqual([expect.objectContaining({ pedido_id: 'p1', preco: 6, detalhe: expect.stringMatching(/; motivo banco_na_cadeia$/) })])
    expect(logs.some((l) => /\[parceiro-leilao\] placa pedido=p1 .*motivo=banco_na_cadeia/.test(l))).toBe(true)
    expect(logs.join('\n')).not.toContain(PLACA)
    // The data was in the delivered report: no late notice.
    expect(avisos).toHaveLength(0)
  })

  it('2. complete with an insurer in the chain (holder or owner kind): calls, with the reason seguradora_na_cadeia', async () => {
    const sb = banco()
    historicoPorPlaca = { [PLACA]: SEGURADORA, [OUTRA_PLACA]: DONO_SEGURADORA }
    pedido(sb, 'p1')
    pedido(sb, 'p2', { placa: OUTRA_PLACA })
    // The block comes after the snapshot assembly: the step right after the delivery writes it.
    await depoisDaEntrega(sb, 'p1')
    await depoisDaEntrega(sb, 'p2', OUTRA_PLACA)
    expect(chamadasHistorico).toEqual([PLACA, OUTRA_PLACA])
    for (const id of ['p1', 'p2']) {
      expect(sb.tab('pedidos_premium').find((p: any) => p.id === id).relatorio_snapshot.historicoVeicular).toMatchObject({ status: 'ok', completa: true })
      expect(parceiroDe(sb, id)).toMatchObject({ status: 'ok', reserva: true, motivo: 'seguradora_na_cadeia' })
    }
    expect(pagas(sb)).toHaveLength(2)
    expect(custosLeilao(sb).map((c: any) => c.detalhe)).toEqual([expect.stringMatching(/; motivo seguradora_na_cadeia$/), expect.stringMatching(/; motivo seguradora_na_cadeia$/)])
    expect(logs.some((l) => /reserva do historico pedido=p1: ok motivo=seguradora_na_cadeia/.test(l))).toBe(true)
  })

  // Since 23/11/2026 such an answer calls too, for having no auction signal
  // (tests 14 on), but not as an institution in the chain: the reason says so.
  it('3. complete without a bank or insurer (an insurer indemnity alone included): not an institution in the chain, the reason is historico_sem_leilao', async () => {
    const sb = banco()
    historicoPorPlaca = { [PLACA]: SEM, [OUTRA_PLACA]: SO_INDENIZACAO }
    pedido(sb, 'p1')
    pedido(sb, 'p2', { placa: OUTRA_PLACA })
    await depoisDaEntrega(sb, 'p1')
    await depoisDaEntrega(sb, 'p2', OUTRA_PLACA)
    expect(sb.tab('pedidos_premium')[1].relatorio_snapshot.historicoVeicular.sinistro.indenizacoes).toHaveLength(1)
    for (const id of ['p1', 'p2']) {
      expect(parceiroDe(sb, id)).toMatchObject({ status: 'ok', reserva: true, motivo: 'historico_sem_leilao' })
      expect(await filaDoHistorico(sb, id)).toEqual({ status: 'ok', code: 0 })
      expect(await leilaoParceiroComoReserva(sb, id)).toBe('pulado')
    }
    await retryDoJob(sb)
    expect(chamadasLeilao).toHaveLength(2)
    expect(custosLeilao(sb).map((c: any) => c.detalhe)).toEqual([expect.stringMatching(/; motivo historico_sem_leilao$/), expect.stringMatching(/; motivo historico_sem_leilao$/)])
  })

  it('4. a bank in the chain but an auction record in the vehicle history itself: no call', async () => {
    const sb = banco()
    historicoPorPlaca = { [PLACA]: BANCO_COM_EDITAL }
    pedido(sb, 'p1')
    await depoisDaEntrega(sb, 'p1')
    const hv = sb.tab('pedidos_premium')[0].relatorio_snapshot.historicoVeicular
    expect(hv).toMatchObject({ completa: true, uso: { financeiras: [{ ano: '2019' }] }, leilao: { registros: [{ tipo: 'edital', lote: '42' }] } })
    expect(await filaDoHistorico(sb)).toEqual({ status: 'ok', code: 0 })
    expect(await leilaoParceiroComoReserva(sb, 'p1')).toBe('pulado')
    await retryDoJob(sb)
    expect(chamadasLeilao).toHaveLength(0)
    expect(parceiroDe(sb)).toBeUndefined()
  })

  it('5. a bank in the chain but a passage in our auction base: no call', async () => {
    const sb = banco()
    pedido(sb, 'p1', {}, { historicoLeilao: comPassagem() })
    await depoisDaEntrega(sb, 'p1')
    expect(sb.tab('pedidos_premium')[0].relatorio_snapshot.historicoVeicular).toMatchObject({ completa: true, uso: { financeiras: [{ ano: '2019' }] } })
    expect(await filaDoHistorico(sb)).toEqual({ status: 'ok', code: 0 })
    expect(await leilaoParceiroComoReserva(sb, 'p1')).toBe('pulado')
    // The snapshot assembly with the block ready and a passage in our base: no call either.
    nossaBase = comPassagem()
    sb.tab('senatran_consultas').push({ id: 'c1', placa: PLACA, created_at: '2026-11-18T12:00:00Z', response: { chassi: CHASSI } })
    const snap: any = await montarRelatorioSnapshot(sb, { placa: PLACA, plano: 'completa', consulta_id: 'c1', preview: null, id: 'p1' })
    expect(snap.historicoLeilao.parceiro).toBeUndefined()
    expect(chamadasLeilao).toHaveLength(0)
  })

  it('6. the auction partner already ran for the order (any state): no call', async () => {
    const sb = banco()
    const ja = [
      { status: 'ok', id_consulta: 'x', consultado_em: '2026-11-17T12:00:00Z' },
      { status: 'falhou', reserva: true, retentado: true },
    ]
    pedido(sb, 'p1', {}, { historicoLeilao: { ...vazio(), parceiro: ja[0] } })
    pedido(sb, 'p2', {}, { historicoLeilao: { ...vazio(), parceiro: ja[1] } })
    for (const id of ['p1', 'p2']) {
      await depoisDaEntrega(sb, id)
      expect(sb.tab('pedidos_premium').find((p: any) => p.id === id).relatorio_snapshot.historicoVeicular).toMatchObject({ completa: true })
      expect(await filaDoHistorico(sb, id)).toEqual({ status: 'ok', code: 0 })
      expect(await leilaoParceiroComoReserva(sb, id)).toBe('pulado')
    }
    await retryDoJob(sb)
    expect(chamadasLeilao).toHaveLength(0)
    expect(parceiroDe(sb, 'p1')).toEqual(ja[0])
    expect(parceiroDe(sb, 'p2')).toEqual(ja[1])
  })

  it('7. Basica plan: no call', async () => {
    const sb = banco()
    pedido(sb, 'p1', { plano: 'basica' }, { historicoVeicular: bloco(BANCO) })
    expect(await completarHistoricoVeicular(sb, { id: 'p1', placa: PLACA, plano: 'basica' }, { cfg: cfgHistorico(config) })).toMatchObject({ pulado: 'fora do plano' })
    expect(await filaDoHistorico(sb)).toMatchObject({ status: 'sem_dado', erro: 'fonte fora do plano' })
    expect(await leilaoParceiroComoReserva(sb, 'p1')).toBe('pulado')
    await retryDoJob(sb)
    expect(chamadasHistorico).toHaveLength(0)
    expect(chamadasLeilao).toHaveLength(0)
    expect(parceiroDe(sb)).toBeUndefined()
  })

  it('8. daily ceiling reached: no charge, the state is left for the retry job, which calls once the ceiling allows', async () => {
    const sb = banco()
    config = CONFIG({ parceiroLeilaoTetoDia: '1' })
    // One call already made today: the ceiling of 1 is reached.
    sb.tab('parceiro_leilao_chamadas').push({ id: 'hoje', pedido_id: 'outro', cobrada: true, cache_hit: false, criado_em: new Date().toISOString() })
    pedido(sb, 'p1', {}, { historicoVeicular: bloco(BANCO) })
    expect(await leilaoParceiroComoReserva(sb, 'p1')).toBe('teto')
    expect(parceiroDe(sb)).toMatchObject({ status: 'teto', reserva: true, motivo: 'banco_na_cadeia' })
    expect(chamadasLeilao).toHaveLength(0)
    expect(custosLeilao(sb)).toHaveLength(0)
    expect(avisos).toHaveLength(0)
    // The retry job, still at the ceiling: no call, and its one retry is not spent.
    await retryDoJob(sb)
    expect(chamadasLeilao).toHaveLength(0)
    expect(parceiroDe(sb)).toMatchObject({ status: 'teto', reserva: true })
    expect(parceiroDe(sb).retentado).toBeUndefined()
    // Next day (ceiling free): the job calls once, although the vehicle history is complete.
    sb.tab('parceiro_leilao_chamadas').length = 0
    expect(await retryDoJob(sb)).toMatchObject({ vistos: 1, completados: 1 })
    expect(parceiroDe(sb)).toMatchObject({ status: 'ok', reserva: true, motivo: 'banco_na_cadeia' })
    expect(pagas(sb)).toHaveLength(1)
    expect(custosLeilao(sb)).toEqual([expect.objectContaining({ preco: 6, detalhe: expect.stringMatching(/; motivo banco_na_cadeia$/) })])
    // The auction showed up after the delivery: one notice.
    expect(avisos).toHaveLength(1)
    await retryDoJob(sb)
    expect(chamadasLeilao).toHaveLength(1)
  })

  it('9. another order of the same plate with a valid cache: reused, no new charge, the reason kept', async () => {
    const sb = banco()
    pedido(sb, 'p1')
    pedido(sb, 'p2')
    await depoisDaEntrega(sb, 'p1')
    expect(pagas(sb)).toHaveLength(1)
    expect(sb.tab('fonte_cache').some((c: any) => c.fonte === FONTE_CACHE_PARCEIRO && c.chave === `placa:${PLACA}`)).toBe(true)
    // Second order: the vehicle history from its clean cache, the auction partner from its own.
    await depoisDaEntrega(sb, 'p2')
    expect(chamadasHistorico).toEqual([PLACA])
    expect(chamadasLeilao).toHaveLength(1)
    expect(parceiroDe(sb, 'p2')).toMatchObject({ status: 'ok', reserva: true, motivo: 'banco_na_cadeia' })
    expect(sb.tab('parceiro_leilao_chamadas').filter((l: any) => l.pedido_id === 'p2')).toEqual([expect.objectContaining({ cache_hit: true, cobrada: false, preco_centavos: 0 })])
    expect(pagas(sb)).toHaveLength(1)
    expect(custosLeilao(sb)).toHaveLength(1)
    expect(logs.some((l) => /\[parceiro-leilao\] cache placa pedido=p2 motivo=banco_na_cadeia/.test(l))).toBe(true)
  })

  it('10. the complete answer arrives after the delivery (queue): it calls and the customer is told once', async () => {
    const sb = banco()
    // The early call did not answer in time: the delivered snapshot has no vehicle history.
    pedido(sb, 'p1', {}, { historicoVeicular: { status: 'falhou', consultadoEm: null, motivo: 'erro' } })
    sb.tab('premium_jobs').push({ id: 'job-p1', pedido_id: 'p1', fonte: 'historico_veicular', status: 'rodando', tentativas: 1 })
    // The queue job brings it (retry of the vehicle history), complete with a bank.
    expect(await filaDoHistorico(sb, 'p1', 1)).toEqual({ status: 'ok', code: 200 })
    const linha = sb.tab('pedidos_premium')[0]
    expect(linha.relatorio_snapshot.historicoVeicular).toMatchObject({ status: 'ok', completa: true })
    expect(parceiroDe(sb)).toMatchObject({ status: 'ok', reserva: true, motivo: 'banco_na_cadeia' })
    expect(linha.relatorio_snapshot.historicoLeilao.passagens.length).toBeGreaterThan(0)
    expect(chamadasLeilao).toHaveLength(1)
    // One late auction notice.
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toMatchObject({ email: 'c@x.com', token: 'TOK-p1' })
    expect(linha.aviso_leilao_em).toBeTruthy()
    // The queue closes the order: the vehicle history leaves the "updated" e-mail (already told).
    Object.assign(sb.tab('premium_jobs')[0], { status: 'ok', ultimo_code: 200 })
    expect(await verificarFechamento(sb, 'p1')).toBe(false)
    expect(atualizacoes).toHaveLength(0)
    // Every later path: no second call, no second e-mail.
    expect(await filaDoHistorico(sb, 'p1', 2)).toEqual({ status: 'ok', code: 0 })
    expect(await depoisDaEntrega(sb)).toMatchObject({ pulado: 'ja tem' })
    await retryDoJob(sb)
    expect(chamadasLeilao).toHaveLength(1)
    expect(avisos).toHaveLength(1)
  })

  it('10b. the lazy fill of the auction section (our base was down at the delivery) uses the stored block: calls and tells once', async () => {
    const sb = banco()
    sb.tab('senatran_consultas').push({ id: 'c1', placa: PLACA, created_at: '2026-11-18T12:00:00Z', response: { chassi: CHASSI } })
    const linha = pedido(sb, 'p1', { consulta_id: 'c1' }, { historicoLeilao: null, historicoVeicular: bloco(BANCO) })
    // Nuxt auto-import in the lazy fill.
    vi.stubGlobal('montarRelatorioSnapshot', montarRelatorioSnapshot)
    const r = await preencherCamposLazy(sb, { token: 'TOK-p1', snap: linha.relatorio_snapshot, plano: 'completa', placa: PLACA, consulta_id: 'c1', campos: ['historicoLeilao'], pedidoId: 'p1' })
    expect(r.historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true, motivo: 'banco_na_cadeia' })
    expect(parceiroDe(sb)).toMatchObject({ status: 'ok', motivo: 'banco_na_cadeia' })
    expect(chamadasLeilao).toHaveLength(1)
    expect(avisos).toHaveLength(1)
  })

  it('11. operator route: calls once, the customer is never told, not even by the retry job', async () => {
    const sb = banco()
    pedido(sb, 'p1')
    pedido(sb, 'p2', { placa: OUTRA_PLACA })
    // Operator run that finds an auction right away: it goes in, no e-mail.
    await completarHistoricoVeicularOperador(sb, PEDIDO('p2', OUTRA_PLACA), cfgHistorico(config))
    expect(parceiroDe(sb, 'p2')).toMatchObject({ status: 'ok', reserva: true, semAviso: true, motivo: 'banco_na_cadeia' })
    expect(sb.tab('pedidos_premium')[1].relatorio_snapshot.historicoLeilao.passagens.length).toBeGreaterThan(0)
    expect(avisos).toHaveLength(0)
    // Operator run with the auction partner down: the state keeps the reason and the no-notice mark.
    leilaoForaDoAr = true
    await completarHistoricoVeicularOperador(sb, PEDIDO(), cfgHistorico(config))
    expect(sb.tab('pedidos_premium')[0].relatorio_snapshot.historicoVeicular).toMatchObject({ status: 'ok', completa: true })
    expect(parceiroDe(sb)).toMatchObject({ status: 'falhou', reserva: true, semAviso: true, motivo: 'banco_na_cadeia' })
    expect(pagas(sb).filter((l: any) => l.pedido_id === 'p1')).toHaveLength(0)
    // The retry job, partner back: the auction goes in, no e-mail.
    leilaoForaDoAr = false
    expect(await retryDoJob(sb)).toMatchObject({ vistos: 1, completados: 1 })
    expect(parceiroDe(sb)).toMatchObject({ status: 'ok', reserva: true, semAviso: true, motivo: 'banco_na_cadeia' })
    expect(sb.tab('pedidos_premium')[0].relatorio_snapshot.historicoLeilao.passagens.length).toBeGreaterThan(0)
    expect(pagas(sb).filter((l: any) => l.pedido_id === 'p1')).toHaveLength(1)
    // A second operator run: no second charge, still no e-mail.
    await completarHistoricoVeicularOperador(sb, PEDIDO(), cfgHistorico(config))
    expect(pagas(sb).filter((l: any) => l.pedido_id === 'p1')).toHaveLength(1)
    expect(avisos).toHaveLength(0)
    expect(sb.tab('pedidos_premium')[0].aviso_leilao_em ?? null).toBeNull()
  })
})

// Review of PR #761.
describe('auction partner from a bank or insurer in the chain: review of PR #761', () => {
  it('12. admin rebuild of an old order (complete, bank in the chain) with the auction partner down: the retry job finds the auction and sends no e-mail', async () => {
    const sb = banco()
    sb.tab('senatran_consultas').push({ id: 'c1', placa: PLACA, created_at: '2026-11-10T12:00:00Z', response: { chassi: CHASSI } })
    // Delivered before this rule: complete with a bank, our base empty, the auction partner never ran.
    const linha = pedido(sb, 'p1', { consulta_id: 'c1' }, { historicoVeicular: bloco(BANCO) })
    leilaoForaDoAr = true
    expect(await rebuildLeilao(sb, ['TOK-p1'])).toEqual([expect.objectContaining({ token: 'TOK-p1', ok: true })])
    // The rebuild started the call: its state carries the no-notice mark.
    expect(parceiroDe(sb)).toMatchObject({ status: 'falhou', reserva: true, semAviso: true, motivo: 'banco_na_cadeia' })
    expect(pagas(sb)).toHaveLength(0)
    // The retry job, partner back: the auction goes in, no e-mail.
    leilaoForaDoAr = false
    expect(await retryDoJob(sb)).toMatchObject({ vistos: 1, completados: 1 })
    expect(parceiroDe(sb)).toMatchObject({ status: 'ok', reserva: true, semAviso: true, motivo: 'banco_na_cadeia' })
    expect(linha.relatorio_snapshot.historicoLeilao.passagens.length).toBeGreaterThan(0)
    expect(pagas(sb)).toHaveLength(1)
    expect(avisos).toHaveLength(0)
    expect((linha as any).aviso_leilao_em ?? null).toBeNull()
  })

  it('13. the snapshot write of a complete block with a bank fails: the call keeps the reason of the block in hand, once', async () => {
    const sb = banco()
    pedido(sb, 'p1')
    gravacaoFalha = true
    // Step right after the delivery: the complete answer does not land in the snapshot.
    await depoisDaEntrega(sb)
    expect(sb.tab('pedidos_premium')[0].relatorio_snapshot.historicoVeicular).toBeUndefined()
    expect(parceiroDe(sb)).toMatchObject({ status: 'ok', reserva: true, motivo: 'banco_na_cadeia' })
    expect(custosLeilao(sb)).toEqual([expect.objectContaining({ preco: 6, detalhe: expect.stringMatching(/; motivo banco_na_cadeia$/) })])
    expect(logs.some((l) => /reserva do historico pedido=p1: ok motivo=banco_na_cadeia/.test(l))).toBe(true)
    // The queue's last attempt, the write failing again: no second call.
    expect(await filaDoHistorico(sb, 'p1', 3)).toMatchObject({ status: 'falha' })
    expect(chamadasHistorico).toEqual([PLACA])
    expect(chamadasLeilao).toHaveLength(1)
    expect(pagas(sb)).toHaveLength(1)
    expect(avisos).toHaveLength(1)
  })
})

// Cesar, 18/11/2026 ("Avisar sempre"): the late notice compares the auction
// section as the page shows it (merged with the vehicle history), on every path.
describe('late notice compares the page views', () => {
  it('lazy fill: an auction record of the vehicle history that the page shows only now is told once', async () => {
    const sb = banco()
    sb.tab('senatran_consultas').push({ id: 'c1', placa: PLACA, created_at: '2026-11-18T12:00:00Z', response: { chassi: CHASSI } })
    // Our base was down at the delivery (no auction section). The vehicle
    // history has its own auction record, so the auction partner is not called.
    const linha = pedido(sb, 'p1', { consulta_id: 'c1' }, { historicoLeilao: null, historicoVeicular: bloco(BANCO_COM_EDITAL) })
    vi.stubGlobal('montarRelatorioSnapshot', montarRelatorioSnapshot)
    const r = await preencherCamposLazy(sb, { token: 'TOK-p1', snap: linha.relatorio_snapshot, plano: 'completa', placa: PLACA, consulta_id: 'c1', campos: ['historicoLeilao'], pedidoId: 'p1' })
    // Our base came back empty; the page now shows the record of the vehicle history.
    expect(r.historicoLeilao.passagens).toHaveLength(0)
    expect(chamadasLeilao).toHaveLength(0)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].info).toMatchObject({ passagens: [{ nivel: 'confirmado' }] })
    expect((linha as any).aviso_leilao_em).toBeTruthy()
  })

  // Review of PR #763, finding 1: the damage sign of the vehicle history was
  // on the page since the delivery (its insurance block): not news.
  it('lazy fill: a damage sign the vehicle history already showed is not told; an auction record still is', async () => {
    const sb = banco()
    sb.tab('senatran_consultas').push({ id: 'c1', placa: PLACA, created_at: '2026-11-18T12:00:00Z', response: { chassi: CHASSI } })
    vi.stubGlobal('montarRelatorioSnapshot', montarRelatorioSnapshot)
    const lazy = (linha: any) => preencherCamposLazy(sb, { token: linha.token_entrega, snap: linha.relatorio_snapshot, plano: 'completa', placa: linha.placa, consulta_id: 'c1', campos: ['historicoLeilao'], pedidoId: linha.id })
    // Our base was down at the delivery; complete history with an insurer indemnity, no auction.
    const soIndicio = pedido(sb, 'p1', { consulta_id: 'c1' }, { historicoLeilao: null, historicoVeicular: bloco(SO_INDENIZACAO) })
    expect((soIndicio.relatorio_snapshot as any).historicoVeicular).toMatchObject({ completa: true, leilao: { registros: [], indicioSinistro: true } })
    // No auction signal anywhere, so the auction partner runs (23/11/2026); it
    // brings only a damage sign, which the page already showed.
    respostaLeilao = LEILAO_SO_SINISTRO
    const r = await lazy(soIndicio)
    expect(r.historicoLeilao.passagens).toHaveLength(0)
    expect(r.historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true, motivo: 'historico_sem_leilao' })
    expect(chamadasLeilao).toHaveLength(1)
    expect(avisos).toHaveLength(0)
    expect((soIndicio as any).aviso_sinistro_em ?? null).toBeNull()
    expect((soIndicio as any).aviso_leilao_em ?? null).toBeNull()
    // The same damage sign plus an auction record of the history: the auction is news.
    const comEdital = pedido(sb, 'p2', { consulta_id: 'c1', placa: OUTRA_PLACA }, { historicoLeilao: null, historicoVeicular: bloco(comIndicador(SO_INDENIZACAO, 'P11', { status: 'positivo', conteudo: [{ ano: 2021, leiloeiro: 'CASA FICTICIA LEILÕES', lote: '42' }] })) })
    await lazy(comEdital)
    expect(chamadasLeilao).toHaveLength(1)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].info).toMatchObject({ sinistro: true, passagens: [{ nivel: 'confirmado' }] })
    expect((comEdital as any).aviso_leilao_em).toBeTruthy()
  })
})

// Cesar, 23/11/2026: our auction API and the vehicle history partner are
// always called; only when neither has an auction signal for the vehicle is
// the auction partner called. A COMPLETE vehicle history with no auction
// record of its own and nothing in our auction base: the auction partner runs
// on every path, under all of its usual rules, with the reason
// historico_sem_leilao. A record of any kind there, even in a partial
// answer: never. Only for orders paid from the cutoff on (CORTE_SEM_LEILAO).
describe('auction partner when neither our base nor the vehicle history has an auction signal', () => {
  /** A Completa order paid (after the cutoff) and about to be delivered: the claim set pago_em, the paid query is in the database. */
  function pago(sb: any) {
    sb.tab('senatran_consultas').push({ id: 'c1', placa: PLACA, created_at: '2026-11-23T12:00:00Z', response: { chassi: CHASSI, descricaoMarcaModelo: 'MARCA/MODELO', anoModelo: 2020, ufJurisdicao: 'SP' } })
    const linha: any = { id: 'p1', placa: PLACA, plano: 'completa', status: 'consultando', pago_em: PAGO_NOVO, email: 'c@x.com', token_entrega: 'TOK-p1', consulta_id: 'c1', preview: null }
    sb.tab('pedidos_premium').push(linha)
    return linha
  }
  const montar = (sb: any) => montarRelatorioSnapshot(sb, { placa: PLACA, plano: 'completa', consulta_id: 'c1', preview: null, id: 'p1' }) as Promise<any>
  const entregar = (linha: any, snap: any) => Object.assign(linha, { status: 'entregue', entregue_em: new Date().toISOString(), relatorio_snapshot: snap })
  const esgotado = (sb: any, id = 'p1') => sb.tab('premium_jobs').push({ id: `job-${id}`, pedido_id: id, fonte: 'historico_veicular', status: 'esgotado', concluido_em: new Date().toISOString() })

  it('14. the queue closes the concluded source (complete, no auction record): the auction partner runs once, with the reason historico_sem_leilao', async () => {
    const sb = banco()
    historicoPorPlaca = { [PLACA]: SEM }
    // Delivered with the complete block and our base empty; the fallback never ran for it.
    const linha: any = pedido(sb, 'p1', {}, { historicoVeicular: bloco(SEM) })
    expect(await filaDoHistorico(sb)).toEqual({ status: 'ok', code: 0 })
    expect(chamadasHistorico).toHaveLength(0)
    expect(parceiroDe(sb)).toMatchObject({ status: 'ok', reserva: true, motivo: 'historico_sem_leilao' })
    expect(linha.relatorio_snapshot.historicoLeilao.passagens.length).toBeGreaterThan(0)
    expect(chamadasLeilao).toHaveLength(1)
    expect(custosLeilao(sb)).toEqual([expect.objectContaining({ pedido_id: 'p1', preco: 6, detalhe: expect.stringMatching(/; motivo historico_sem_leilao$/) })])
    expect(logs.some((l) => /reserva do historico pedido=p1: ok motivo=historico_sem_leilao/.test(l))).toBe(true)
    expect(logs.join('\n')).not.toContain(PLACA)
    // The auction showed up after the delivery: the late notice, same rules as before.
    expect(avisos).toHaveLength(1)
    expect(linha.aviso_leilao_em).toBeTruthy()
    // Every later path of the order: no second call, no second e-mail.
    expect(await filaDoHistorico(sb)).toEqual({ status: 'ok', code: 0 })
    expect(await depoisDaEntrega(sb)).toMatchObject({ pulado: 'ja tem' })
    esgotado(sb)
    await retryDoJob(sb)
    expect(chamadasLeilao).toHaveLength(1)
    expect(pagas(sb)).toHaveLength(1)
    expect(avisos).toHaveLength(1)
  })

  it('15. an auction record in the vehicle history (a notice with a lot, a public body auction, a salvage sale): no call on any path', async () => {
    for (const [tipo, resposta] of [['edital', EDITAL_LOTE], ['orgao', ORGAO_PUBLICO], ['salvado', SALVADO]] as const) {
      _limparEmVooHistorico()
      const sb = banco()
      historicoPorPlaca = { [PLACA]: resposta }
      const linha = pago(sb)
      // Snapshot assembly, the block ready.
      expect(await iniciarHistoricoVeicular(sb, PEDIDO())).toMatchObject({ ok: true, status: 'ok' })
      const snap = await montar(sb)
      expect(snap.historicoVeicular).toMatchObject({ status: 'ok', completa: true, leilao: { registros: [{ tipo }] } })
      expect(snap.historicoLeilao.parceiro).toBeUndefined()
      entregar(linha, snap)
      // Step after the delivery, the queue, its safety net, the retry job.
      expect(await depoisDaEntrega(sb)).toMatchObject({ pulado: 'ja tem' })
      expect(await filaDoHistorico(sb)).toEqual({ status: 'ok', code: 0 })
      expect(await leilaoParceiroComoReserva(sb, 'p1')).toBe('pulado')
      esgotado(sb)
      await retryDoJob(sb)
      expect(parceiroDe(sb)).toBeUndefined()
      expect(custosLeilao(sb)).toHaveLength(0)
    }
    expect(chamadasHistorico).toEqual([PLACA, PLACA, PLACA])
    expect(chamadasLeilao).toHaveLength(0)
  })

  it('16. snapshot assembly with the complete block ready: calls once there, the delivered report has it, no late notice', async () => {
    const sb = banco()
    historicoPorPlaca = { [PLACA]: SEM }
    const linha = pago(sb)
    expect(await iniciarHistoricoVeicular(sb, PEDIDO())).toMatchObject({ ok: true, status: 'ok' })
    const snap = await montar(sb)
    expect(snap.historicoVeicular).toMatchObject({ status: 'ok', completa: true, leilao: { registros: [] } })
    expect(snap.historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true, motivo: 'historico_sem_leilao' })
    expect(snap.historicoLeilao.passagens.length).toBeGreaterThan(0)
    expect(chamadasLeilao).toHaveLength(1)
    entregar(linha, snap)
    expect(await depoisDaEntrega(sb)).toMatchObject({ pulado: 'ja tem' })
    expect(await filaDoHistorico(sb)).toEqual({ status: 'ok', code: 0 })
    await retryDoJob(sb)
    expect(chamadasLeilao).toHaveLength(1)
    expect(custosLeilao(sb)).toEqual([expect.objectContaining({ pedido_id: 'p1', preco: 6, detalhe: expect.stringMatching(/; motivo historico_sem_leilao$/) })])
    expect(logs.some((l) => /\[parceiro-leilao\] placa pedido=p1 .*motivo=historico_sem_leilao/.test(l))).toBe(true)
    expect(avisos).toHaveLength(0)
  })

  it('17. the complete answer lands after the assembly (step after the delivery): calls right away; a finding is told once, nothing found is not', async () => {
    const sb = banco()
    historicoPorPlaca = { [PLACA]: SEM, [OUTRA_PLACA]: SEM }
    const achou: any = pedido(sb, 'p1')
    const nada: any = pedido(sb, 'p2', { placa: OUTRA_PLACA })
    await depoisDaEntrega(sb, 'p1')
    expect(achou.relatorio_snapshot.historicoVeicular).toMatchObject({ status: 'ok', completa: true })
    expect(parceiroDe(sb, 'p1')).toMatchObject({ status: 'ok', reserva: true, motivo: 'historico_sem_leilao' })
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toMatchObject({ email: 'c@x.com', token: 'TOK-p1' })
    expect(achou.aviso_leilao_em).toBeTruthy()
    // The auction partner finds nothing: the page says so, no e-mail.
    respostaLeilao = LEILAO_NADA
    await depoisDaEntrega(sb, 'p2', OUTRA_PLACA)
    expect(parceiroDe(sb, 'p2')).toMatchObject({ status: 'ok', reserva: true, motivo: 'historico_sem_leilao' })
    expect(nada.relatorio_snapshot.historicoLeilao.passagens).toHaveLength(0)
    expect(chamadasLeilao).toHaveLength(2)
    expect(avisos).toHaveLength(1)
    expect(nada.aviso_leilao_em ?? null).toBeNull()
    expect(nada.aviso_sinistro_em ?? null).toBeNull()
  })

  it('18. the vehicle history has not answered yet: the auction partner waits for it or for the queue to give up', async () => {
    const sb = banco()
    // Every vehicle history call fails (no charge).
    historicoPorPlaca = {}
    const linha = pago(sb)
    // Assembly: the early call is over and failed; no queue job yet.
    expect(await iniciarHistoricoVeicular(sb, PEDIDO())).toMatchObject({ ok: false, status: 'falhou' })
    const snap = await montar(sb)
    expect(snap.historicoLeilao.parceiro).toBeUndefined()
    entregar(linha, snap)
    // Step after the delivery and the queue before its last attempt: still failing.
    await depoisDaEntrega(sb)
    expect(linha.relatorio_snapshot.historicoVeicular).toMatchObject({ status: 'falhou' })
    sb.tab('premium_jobs').push({ id: 'job-p1', pedido_id: 'p1', fonte: 'historico_veicular', status: 'pendente', tentativas: 1 })
    expect(await filaDoHistorico(sb, 'p1', 1)).toMatchObject({ status: 'falha' })
    await retryDoJob(sb)
    expect(chamadasLeilao).toHaveLength(0)
    expect(parceiroDe(sb)).toBeUndefined()
    // The queue's last attempt fails too: now it gives up, and the auction partner covers the order.
    expect(await filaDoHistorico(sb, 'p1', 3)).toMatchObject({ status: 'falha' })
    expect(parceiroDe(sb)).toMatchObject({ status: 'ok', reserva: true, motivo: 'historico_sem_resposta' })
    expect(chamadasLeilao).toHaveLength(1)
  })

  it('19. lazy fill of the auction section (our base was down at the delivery): calls with the stored block and tells once', async () => {
    const sb = banco()
    sb.tab('senatran_consultas').push({ id: 'c1', placa: PLACA, created_at: '2026-11-23T12:00:00Z', response: { chassi: CHASSI } })
    const linha = pedido(sb, 'p1', { consulta_id: 'c1' }, { historicoLeilao: null, historicoVeicular: bloco(SEM) })
    vi.stubGlobal('montarRelatorioSnapshot', montarRelatorioSnapshot)
    const r = await preencherCamposLazy(sb, { token: 'TOK-p1', snap: linha.relatorio_snapshot, plano: 'completa', placa: PLACA, consulta_id: 'c1', campos: ['historicoLeilao'], pedidoId: 'p1' })
    expect(r.historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true, motivo: 'historico_sem_leilao' })
    expect(parceiroDe(sb)).toMatchObject({ status: 'ok', motivo: 'historico_sem_leilao' })
    expect(chamadasLeilao).toHaveLength(1)
    expect(avisos).toHaveLength(1)
  })

  it('20. safety net of the vehicle history jobs the queue gave up on in the last hour: a complete block stored since gets its call', async () => {
    const sb = banco()
    pedido(sb, 'p1', {}, { historicoVeicular: bloco(SEM) })
    esgotado(sb)
    expect(await retryDoJob(sb)).toMatchObject({ vistos: 1, completados: 1 })
    expect(parceiroDe(sb)).toMatchObject({ status: 'ok', reserva: true, motivo: 'historico_sem_leilao' })
    expect(chamadasLeilao).toHaveLength(1)
    await retryDoJob(sb)
    expect(chamadasLeilao).toHaveLength(1)
  })

  it('21. retry job: a failed fallback whose vehicle history is complete now retries with historico_sem_leilao; with an auction record the retry is spent without a call', async () => {
    const sb = banco()
    // Both fallbacks ran for a partial answer and failed (partner down); a complete answer was stored since.
    const falhou = { status: 'falhou', reserva: true, motivo: 'historico_parcial', consultado_em: '2026-11-23T10:00:00.000Z' }
    pedido(sb, 'p1', {}, { historicoVeicular: bloco(SEM), historicoLeilao: { ...vazio(), parceiro: falhou } })
    pedido(sb, 'p2', { placa: OUTRA_PLACA }, { historicoVeicular: bloco(EDITAL_LOTE), historicoLeilao: { ...vazio(), parceiro: falhou } })
    expect(await retryDoJob(sb)).toMatchObject({ vistos: 2, completados: 1 })
    expect(parceiroDe(sb, 'p1')).toMatchObject({ status: 'ok', reserva: true, motivo: 'historico_sem_leilao' })
    expect(parceiroDe(sb, 'p2')).toMatchObject({ status: 'falhou', reserva: true, retentado: true })
    expect(chamadasLeilao).toHaveLength(1)
    expect(custosLeilao(sb)).toEqual([expect.objectContaining({ pedido_id: 'p1', preco: 6, detalhe: expect.stringMatching(/; motivo historico_sem_leilao$/) })])
    expect(logs.some((l) => /job pedido=p2: historico veio completo \(sem chamada\)/.test(l))).toBe(true)
  })

  it('22. operator route: calls with historico_sem_leilao and never tells the customer', async () => {
    const sb = banco()
    historicoPorPlaca = { [PLACA]: SEM }
    const linha: any = pedido(sb, 'p1')
    await completarHistoricoVeicularOperador(sb, PEDIDO(), cfgHistorico(config))
    expect(parceiroDe(sb)).toMatchObject({ status: 'ok', reserva: true, semAviso: true, motivo: 'historico_sem_leilao' })
    expect(linha.relatorio_snapshot.historicoLeilao.passagens.length).toBeGreaterThan(0)
    expect(chamadasLeilao).toHaveLength(1)
    expect(avisos).toHaveLength(0)
    expect(linha.aviso_leilao_em ?? null).toBeNull()
  })

  it('23. Completa only and our base empty only: the Basica plan, or a passage in our base, never calls', async () => {
    const sb = banco()
    historicoPorPlaca = { [PLACA]: SEM }
    pedido(sb, 'p1', { plano: 'basica' }, { historicoVeicular: bloco(SEM) })
    pedido(sb, 'p2', {}, { historicoLeilao: comPassagem(), historicoVeicular: bloco(SEM) })
    expect(await completarHistoricoVeicular(sb, { id: 'p1', placa: PLACA, plano: 'basica' }, { cfg: cfgHistorico(config) })).toMatchObject({ pulado: 'fora do plano' })
    expect(await filaDoHistorico(sb, 'p1')).toMatchObject({ status: 'sem_dado', erro: 'fonte fora do plano' })
    expect(await depoisDaEntrega(sb, 'p2')).toMatchObject({ pulado: 'ja tem' })
    expect(await filaDoHistorico(sb, 'p2')).toEqual({ status: 'ok', code: 0 })
    for (const id of ['p1', 'p2']) {
      expect(await leilaoParceiroComoReserva(sb, id)).toBe('pulado')
      esgotado(sb, id)
    }
    await retryDoJob(sb)
    expect(chamadasHistorico).toHaveLength(0)
    expect(chamadasLeilao).toHaveLength(0)
    expect(parceiroDe(sb, 'p1')).toBeUndefined()
    expect(parceiroDe(sb, 'p2')).toBeUndefined()
  })

  it('24. one charge per plate: another order of the same plate reuses the auction partner answer from its cache', async () => {
    const sb = banco()
    historicoPorPlaca = { [PLACA]: SEM }
    pedido(sb, 'p1')
    pedido(sb, 'p2')
    await depoisDaEntrega(sb, 'p1')
    await depoisDaEntrega(sb, 'p2')
    expect(chamadasHistorico).toEqual([PLACA])
    expect(chamadasLeilao).toHaveLength(1)
    expect(parceiroDe(sb, 'p2')).toMatchObject({ status: 'ok', reserva: true, motivo: 'historico_sem_leilao' })
    expect(sb.tab('parceiro_leilao_chamadas').filter((l: any) => l.pedido_id === 'p2')).toEqual([expect.objectContaining({ cache_hit: true, cobrada: false, preco_centavos: 0 })])
    expect(pagas(sb)).toHaveLength(1)
    expect(custosLeilao(sb)).toHaveLength(1)
  })

  it('25. daily ceiling and switch: no call while capped or off; the retry job calls once the ceiling allows', async () => {
    const sb = banco()
    config = CONFIG({ parceiroLeilaoTetoDia: '1' })
    sb.tab('parceiro_leilao_chamadas').push({ id: 'hoje', pedido_id: 'outro', cobrada: true, cache_hit: false, criado_em: new Date().toISOString() })
    pedido(sb, 'p1', {}, { historicoVeicular: bloco(SEM) })
    expect(await leilaoParceiroComoReserva(sb, 'p1')).toBe('teto')
    expect(parceiroDe(sb)).toMatchObject({ status: 'teto', reserva: true, motivo: 'historico_sem_leilao' })
    expect(chamadasLeilao).toHaveLength(0)
    expect(custosLeilao(sb)).toHaveLength(0)
    // Switch off: nothing, not even the retry.
    config = CONFIG({ parceiroLeilaoTetoDia: '40', parceiroLeilaoLigado: 'off' })
    sb.tab('parceiro_leilao_chamadas').length = 0
    pedido(sb, 'p2', { placa: OUTRA_PLACA }, { historicoVeicular: bloco(SEM) })
    expect(await leilaoParceiroComoReserva(sb, 'p2')).toBe('pulado')
    expect(await retryDoJob(sb)).toMatchObject({ rodou: false })
    expect(chamadasLeilao).toHaveLength(0)
    // Back on, ceiling free: the retry job calls once for the capped order.
    config = CONFIG()
    expect(await retryDoJob(sb)).toMatchObject({ vistos: 1, completados: 1 })
    expect(parceiroDe(sb)).toMatchObject({ status: 'ok', reserva: true, motivo: 'historico_sem_leilao' })
    expect(parceiroDe(sb, 'p2')).toBeUndefined()
    expect(pagas(sb)).toHaveLength(1)
  })

  // Lead, 23/11/2026: a record in a partial answer is a signal too.
  it('26. a partial answer with an auction record is a signal already: no call on any path; a partial one without a record still calls (historico_parcial)', async () => {
    const sb = banco()
    historicoPorPlaca = { [PLACA]: semSinistros(EDITAL_LOTE), [OUTRA_PLACA]: semSinistros(SEM) }
    const comRegistro: any = pedido(sb, 'p1')
    pedido(sb, 'p2', { placa: OUTRA_PLACA })
    await depoisDaEntrega(sb, 'p1')
    expect(comRegistro.relatorio_snapshot.historicoVeicular).toMatchObject({ status: 'ok', completa: false, faltas: ['sinistros'], leilao: { registros: [{ tipo: 'edital', lote: '42' }] } })
    expect(await filaDoHistorico(sb, 'p1')).toEqual({ status: 'ok', code: 0 })
    expect(await leilaoParceiroComoReserva(sb, 'p1')).toBe('pulado')
    esgotado(sb, 'p1')
    await retryDoJob(sb)
    expect(parceiroDe(sb, 'p1')).toBeUndefined()
    expect(chamadasLeilao).toHaveLength(0)
    // Partial without any record: the fallback of 17/11/2026, as before.
    await depoisDaEntrega(sb, 'p2', OUTRA_PLACA)
    expect(parceiroDe(sb, 'p2')).toMatchObject({ status: 'ok', reserva: true, motivo: 'historico_parcial' })
    expect(chamadasLeilao).toHaveLength(1)
  })

  // Lead, 23/11/2026: no retroactive charge nor late notice to an old customer.
  it('27. order paid before the cutoff: complete without a record never calls on any path; a bank in the chain still does, a partial answer with a record does not (any order)', async () => {
    const sb = banco()
    historicoPorPlaca = { [PLACA]: SEM, [OUTRA_PLACA]: BANCO, [TERCEIRA_PLACA]: semSinistros(EDITAL_LOTE) }
    sb.tab('senatran_consultas').push({ id: 'c1', placa: PLACA, created_at: '2026-11-20T15:00:00Z', response: { chassi: CHASSI } })
    vi.stubGlobal('montarRelatorioSnapshot', montarRelatorioSnapshot)
    const antigo = { pago_em: PAGO_ANTIGO, consulta_id: 'c1' }
    // Step after the delivery (the complete answer arrives now), the queue, the operator route.
    const a1: any = pedido(sb, 'a1', antigo)
    expect(await depoisDaEntrega(sb, 'a1')).toMatchObject({ ok: true, status: 'ok' })
    expect(a1.relatorio_snapshot.historicoVeicular).toMatchObject({ status: 'ok', completa: true, leilao: { registros: [] } })
    expect(await filaDoHistorico(sb, 'a1')).toEqual({ status: 'ok', code: 0 })
    await completarHistoricoVeicularOperador(sb, PEDIDO('a1'), cfgHistorico(config))
    // Lazy fill of an auction section that never came.
    const a2: any = pedido(sb, 'a2', antigo, { historicoLeilao: null, historicoVeicular: bloco(SEM) })
    const r = await preencherCamposLazy(sb, { token: 'TOK-a2', snap: a2.relatorio_snapshot, plano: 'completa', placa: PLACA, consulta_id: 'c1', campos: ['historicoLeilao'], pedidoId: 'a2' })
    expect(r.historicoLeilao).toMatchObject({ passagens: [] })
    expect(r.historicoLeilao.parceiro).toBeUndefined()
    // Admin rebuild.
    pedido(sb, 'a3', antigo, { historicoVeicular: bloco(SEM) })
    expect(await rebuildLeilao(sb, ['TOK-a3'])).toEqual([expect.objectContaining({ token: 'TOK-a3', ok: true })])
    // Retry job of a fallback that failed on a partial answer (complete since),
    // and its safety net for a job the queue just gave up on.
    pedido(sb, 'a4', antigo, { historicoVeicular: bloco(SEM), historicoLeilao: { ...vazio(), parceiro: { status: 'falhou', reserva: true, motivo: 'historico_parcial' } } })
    esgotado(sb, 'a1')
    await retryDoJob(sb)
    expect(parceiroDe(sb, 'a4')).toMatchObject({ status: 'falhou', reserva: true, retentado: true })
    for (const id of ['a1', 'a2', 'a3']) expect(parceiroDe(sb, id)).toBeUndefined()
    expect(chamadasLeilao).toHaveLength(0)
    expect(custosLeilao(sb)).toHaveLength(0)
    expect(avisos).toHaveLength(0)
    // A bank in the chain still calls for an old order (as on main); a partial
    // answer with an auction record does not, for any order (the record is a signal).
    pedido(sb, 'a5', { ...antigo, placa: OUTRA_PLACA })
    const a6: any = pedido(sb, 'a6', { ...antigo, placa: TERCEIRA_PLACA })
    await depoisDaEntrega(sb, 'a5', OUTRA_PLACA)
    await depoisDaEntrega(sb, 'a6', TERCEIRA_PLACA)
    expect(parceiroDe(sb, 'a5')).toMatchObject({ status: 'ok', reserva: true, motivo: 'banco_na_cadeia' })
    expect(a6.relatorio_snapshot.historicoVeicular).toMatchObject({ status: 'ok', completa: false, leilao: { registros: [{ tipo: 'edital' }] } })
    expect(await filaDoHistorico(sb, 'a6')).toEqual({ status: 'ok', code: 0 })
    expect(parceiroDe(sb, 'a6')).toBeUndefined()
    expect(chamadasLeilao).toHaveLength(1)
  })

  it('28. order paid from the cutoff on, complete without a record: the lazy fill, the admin rebuild and the retry job call it', async () => {
    const sb = banco()
    for (const [id, placa] of [['c1', PLACA], ['c2', OUTRA_PLACA]]) sb.tab('senatran_consultas').push({ id, placa, created_at: '2026-11-23T22:00:00Z', response: { chassi: CHASSI } })
    vi.stubGlobal('montarRelatorioSnapshot', montarRelatorioSnapshot)
    // Lazy fill of an auction section that never came.
    const n1: any = pedido(sb, 'n1', { consulta_id: 'c1' }, { historicoLeilao: null, historicoVeicular: bloco(SEM) })
    const r = await preencherCamposLazy(sb, { token: 'TOK-n1', snap: n1.relatorio_snapshot, plano: 'completa', placa: PLACA, consulta_id: 'c1', campos: ['historicoLeilao'], pedidoId: 'n1' })
    expect(r.historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true, motivo: 'historico_sem_leilao' })
    // Admin rebuild: calls, never tells the customer.
    pedido(sb, 'n2', { consulta_id: 'c2', placa: OUTRA_PLACA }, { historicoVeicular: bloco(SEM) })
    expect(await rebuildLeilao(sb, ['TOK-n2'])).toEqual([expect.objectContaining({ token: 'TOK-n2', ok: true })])
    expect(parceiroDe(sb, 'n2')).toMatchObject({ status: 'ok', reserva: true, semAviso: true, motivo: 'historico_sem_leilao' })
    // Retry job of a fallback that failed on a partial answer (complete since).
    pedido(sb, 'n3', { placa: TERCEIRA_PLACA }, { historicoVeicular: bloco(SEM), historicoLeilao: { ...vazio(), parceiro: { status: 'falhou', reserva: true, motivo: 'historico_parcial' } } })
    expect(await retryDoJob(sb)).toMatchObject({ vistos: 1, completados: 1 })
    expect(parceiroDe(sb, 'n3')).toMatchObject({ status: 'ok', reserva: true, motivo: 'historico_sem_leilao' })
    expect(chamadasLeilao).toHaveLength(3)
    // The lazy fill and the retry job tell the customer; the rebuild never does.
    expect(avisos.map((a: any) => a.token)).toEqual(['TOK-n1', 'TOK-n3'])
  })
})
