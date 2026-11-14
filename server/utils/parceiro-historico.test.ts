import { describe, it, expect, vi, beforeEach } from 'vitest'
import COM from './__fixtures__/parceiro-historico-com-registros.json'
import LEILAO_REAL from './__fixtures__/parceiro-leilao-real.json'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'
import {
  completarHistoricoVeicular, chamarHistorico, ehSaldoOuLimiteHistorico, _limparAlertaTetoHistorico, PRECO_RESERVA_CENTAVOS,
  iniciarHistoricoVeicular, historicoProntoParaSnapshot, _limparEmVooHistorico, motivoDaFalha,
} from './parceiro-historico'
import { MOTIVO_CHASSI_DIVERGENTE } from '../../shared/historico-veicular'
import { situacaoDasFontes } from '../../shared/fontes-relatorio'
import { FONTE_CACHE_HISTORICO, FONTE_CUSTO_HISTORICO, cfgHistorico } from './parceiro-historico-env'
import { complementarLeilaoParceiro, rodarJobParceiro, cfgParceiro, inicioDoDiaBrasilia, _limparTokenParceiro, type Http } from './parceiro-leilao'
import { pararDeAceitar, _resetarEmVoo } from './tarefas-em-voo'

// Vehicle history partner (Cesar, 13/11/2026): Completa only, behind its own
// switch, clean cache that neither calls nor pays, daily ceiling, one row per
// attempt with the whole answer only in the restricted table, and never at
// the same time as the auction partner.
const AGORA = Date.parse('2026-10-02T15:00:00Z')
const PLACA = 'TST2B34'
const cfg = (x: any = {}) => cfgHistorico({ parceiroHistoricoLigado: 'on', parceiroHistoricoKey: 'chave-de-teste', parceiroHistoricoTetoDia: '60', ...x })
const resp = (status: number, corpo: any) => ({ status, text: async () => (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)) })

// In-memory database with the RPCs of this source: named locks, the daily
// ceiling reservation (paid calls plus calls in progress) and the snapshot
// write that sets only its key (jsonb_set), as in the migration.
function sbHistorico(x: { lock?: (nome: string, dono: string) => boolean; falhaRpc?: string[] } = {}) {
  const base = supabaseMemoria()
  let seq = 0
  const rpc = async (nome: string, a: any) => {
    if (x.falhaRpc?.includes(nome)) return { data: null, error: { message: 'banco fora' } }
    if (nome === 'job_lock_pegar') return { data: x.lock ? x.lock(a.p_nome, a.p_dono) : true, error: null }
    if (nome === 'parceiro_historico_reservar') {
      const t = base.tab('parceiro_historico_chamadas')
      const feitas = t.filter((l) => !l.cache_hit && String(l.criado_em) >= a.p_desde && (l.cobrada || l.em_andamento)).length
      if (feitas >= a.p_teto) return { data: null, error: null }
      const id = `reserva-${++seq}`
      t.push({ id, pedido_id: a.p_pedido, placa: a.p_placa, em_andamento: true, cobrada: false, cache_hit: false, sucesso: false, custo_centavos: 0, motivo_erro: 'em andamento', criado_em: new Date(AGORA).toISOString() })
      return { data: id, error: null }
    }
    if (nome === 'snapshot_gravar_historico_veicular') {
      const linha = base.tab('pedidos_premium').find((p) => p.id === a.p_pedido)
      const atual = linha?.relatorio_snapshot
      if (!atual || typeof atual !== 'object') return { data: false, error: null }
      if (atual.historicoVeicular?.status === 'ok' && a.p_valor?.status !== 'ok') return { data: false, error: null }
      linha.relatorio_snapshot = { ...atual, historicoVeicular: a.p_valor }
      return { data: true, error: null }
    }
    return { data: true, error: null }
  }
  return Object.assign(base, { rpc })
}

/** Real named locks with owners (job_lock_pegar). */
function travas() {
  const donos = new Map<string, string>()
  return (nome: string, dono: string) => {
    const atual = donos.get(nome)
    if (!atual || atual === dono) { donos.set(nome, dono); return true }
    return false
  }
}

let sb: ReturnType<typeof sbHistorico>
let chamadas: { url: string; headers: Record<string, string> }[]
const alertar = vi.fn(async () => {})
const httpCom = (f: () => any): Http => async (url, init) => { chamadas.push({ url, headers: init.headers }); return f() }
const ok = () => httpCom(() => resp(200, COM))
const pedido = (id = 'p1', x: any = {}) => ({ id, placa: PLACA, plano: 'completa', ...x })
const deps = (http: Http, x: any = {}) => ({ cfg: cfg(), http, alertar, agora: AGORA, log: () => {}, esperar: async () => {}, ...x })
const linhas = () => sb.tab('parceiro_historico_chamadas')
const custos = () => sb.tab('premium_custos')
const snap = (id = 'p1') => sb.tab('pedidos_premium').find((p) => p.id === id)?.relatorio_snapshot
function comPedidos(...ids: string[]) {
  for (const id of ids) sb.tab('pedidos_premium').push({ id, relatorio_snapshot: { consulta: { response: { chassi: '9XXHV00000X000001' } }, historicoLeilao: null } })
}

beforeEach(() => {
  sb = sbHistorico()
  chamadas = []
  alertar.mockClear()
  _limparAlertaTetoHistorico()
  _limparEmVooHistorico()
  comPedidos('p1', 'p2')
})

describe('when it does NOT call', () => {
  it('switch off, no key, outside the Completa plan, no snapshot', async () => {
    const http = ok()
    expect(await completarHistoricoVeicular(sb, pedido(), deps(http, { cfg: cfg({ parceiroHistoricoLigado: '' }) }))).toMatchObject({ ok: false, pulado: 'desligado' })
    expect(await completarHistoricoVeicular(sb, pedido(), deps(http, { cfg: cfg({ parceiroHistoricoKey: '' }) }))).toMatchObject({ ok: false, pulado: 'desligado' })
    expect(await completarHistoricoVeicular(sb, pedido('p1', { plano: 'basica' }), deps(http))).toMatchObject({ ok: false, pulado: 'fora do plano' })
    expect(await completarHistoricoVeicular(sb, pedido('sem-snapshot'), deps(http))).toMatchObject({ ok: false, pulado: 'sem snapshot' })
    expect(chamadas).toHaveLength(0)
    expect(linhas()).toHaveLength(0)
    expect(custos()).toHaveLength(0)
    expect(snap().historicoVeicular).toBeUndefined()
  })

  it('config: everything empty by default (off, ceiling 60, default host)', () => {
    const c = cfgHistorico({})
    expect(c).toMatchObject({ ligado: false, chave: '', tetoDia: 60 })
    expect(c.base).toMatch(/^https:\/\/api\./)
    expect(cfgHistorico({ parceiroHistoricoLigado: 'on' }).ligado).toBe(false) // no key, no source
    expect(cfgHistorico({ parceiroHistoricoLigado: 'on', parceiroHistoricoKey: 'k', parceiroHistoricoTetoDia: '5', parceiroHistoricoUrl: 'https://x.test/' })).toMatchObject({ ligado: true, tetoDia: 5, base: 'https://x.test' })
  })
})

describe('the call', () => {
  it('by plate with the key header: clean block in the snapshot, raw answer only in the restricted table, cost', async () => {
    const r = await completarHistoricoVeicular(sb, pedido(), deps(ok()))
    expect(r).toMatchObject({ ok: true, status: 'ok', cobrada: true, custoCentavos: 190, code: 200, cacheHit: false })
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].url).toMatch(/\/v1\/e20\?query=TST2B34$/)
    expect(chamadas[0].headers['x-api-key']).toBe('chave-de-teste')
    const b = snap().historicoVeicular
    expect(b).toMatchObject({ status: 'ok', consultadoEm: '2026-10-02T15:00:00.000Z', donos: { total: 12 } })
    expect(JSON.stringify(snap())).not.toMatch(/FICTICIA|000\.000\.000-00/)
    expect(linhas()).toHaveLength(1)
    expect(linhas()[0]).toMatchObject({ pedido_id: 'p1', placa: PLACA, http_status: 200, sucesso: true, cobrada: true, custo_centavos: 190, cache_hit: false, em_andamento: false, motivo_erro: null, id_consulta_parceiro: '00000000-0000-0000-0000-000000000000' })
    expect(linhas()[0].resposta_bruta.dados.proprietarios.historico[0].nome).toBe('PESSOA FICTICIA')
    expect(custos()).toEqual([expect.objectContaining({ pedido_id: 'p1', fonte: FONTE_CUSTO_HISTORICO, preco: 1.9, code: 200 })])
    const cache = sb.tab('fonte_cache')
    expect(cache).toHaveLength(1)
    expect(cache[0]).toMatchObject({ fonte: FONTE_CACHE_HISTORICO, chave: PLACA, status: 'ok' })
    expect(JSON.stringify(cache[0].payload)).not.toMatch(/FICTICIA|000\.000\.000-00|proprietario_nome|documento/)
  })

  it('cost from the answer; reserve when the answer does not say it', async () => {
    const semCusto = { ...COM, custo_debitado: undefined }
    const c = await chamarHistorico(cfg(), PLACA, httpCom(() => resp(200, semCusto)))
    expect(c).toMatchObject({ cobrada: true, custoCentavos: PRECO_RESERVA_CENTAVOS })
    const caro = await chamarHistorico(cfg(), PLACA, httpCom(() => resp(200, { ...COM, custo_debitado: 2.35 })))
    expect(caro.custoCentavos).toBe(235)
  })

  it('valid cache (second order of the same plate): no call, no charge, row as cache hit', async () => {
    await completarHistoricoVeicular(sb, pedido('p1'), deps(ok()))
    chamadas = []
    const r = await completarHistoricoVeicular(sb, pedido('p2'), deps(httpCom(() => resp(500, 'nao devia'))))
    expect(r).toMatchObject({ ok: true, cacheHit: true, cobrada: false, custoCentavos: 0 })
    expect(chamadas).toHaveLength(0)
    expect(snap('p2').historicoVeicular).toMatchObject({ status: 'ok', donos: { total: 12 } })
    expect(linhas().filter((l) => l.cobrada)).toHaveLength(1)
    expect(linhas().find((l) => l.pedido_id === 'p2')).toMatchObject({ cache_hit: true, cobrada: false, custo_centavos: 0, resposta_bruta: null })
    expect(custos().filter((c) => c.preco > 0)).toHaveLength(1)
  })

  it('order already has the block: nothing to do', async () => {
    await completarHistoricoVeicular(sb, pedido(), deps(ok()))
    chamadas = []
    expect(await completarHistoricoVeicular(sb, pedido(), deps(ok()))).toMatchObject({ ok: true, pulado: 'ja tem' })
    expect(chamadas).toHaveLength(0)
    expect(linhas()).toHaveLength(1)
  })

  it('paid row of this order but no cache (cache write failed): reuses it, no new charge', async () => {
    linhas().push({ id: 'velha', pedido_id: 'p1', cobrada: true, cache_hit: false, resposta_bruta: structuredClone(COM), criado_em: '2026-10-02T14:00:00Z' })
    const r = await completarHistoricoVeicular(sb, pedido(), deps(httpCom(() => resp(500, 'nao devia'))))
    expect(r).toMatchObject({ ok: true, cobrada: false })
    expect(chamadas).toHaveLength(0)
    expect(snap().historicoVeicular).toMatchObject({ status: 'ok', consultadoEm: '2026-10-02T14:00:00Z' })
  })

  it('error: not charged, cost 0, state failed in the snapshot; never over a block that is ok', async () => {
    const r = await completarHistoricoVeicular(sb, pedido(), deps(httpCom(() => resp(503, 'fora do ar'))))
    expect(r).toMatchObject({ ok: false, status: 'falhou', cobrada: false, code: 503, erro: 'HTTP 503' })
    expect(linhas()[0]).toMatchObject({ http_status: 503, sucesso: false, cobrada: false, custo_centavos: 0, resposta_bruta: 'fora do ar' })
    expect(custos()[0]).toMatchObject({ preco: 0, code: 503 })
    expect(snap().historicoVeicular).toEqual({ status: 'falhou', consultadoEm: '2026-10-02T15:00:00.000Z', motivo: 'erro' })
    const r2 = await completarHistoricoVeicular(sb, pedido(), deps(ok()))
    expect(r2.ok).toBe(true)
    expect(snap().historicoVeicular.status).toBe('ok')
  })

  it('timeout and answer without success: not charged', async () => {
    const lenta: Http = async () => { const e: any = new Error('aborted'); e.name = 'AbortError'; throw e }
    const t = await chamarHistorico(cfg(), PLACA, lenta)
    expect(t).toMatchObject({ http: null, cobrada: false, custoCentavos: 0 })
    expect(t.erro).toMatch(/^timeout/)
    const s = await chamarHistorico(cfg(), PLACA, httpCom(() => resp(200, { success: false, message: 'erro' })))
    expect(s).toMatchObject({ http: 200, cobrada: false, bloco: null, erro: 'resposta sem sucesso' })
  })

  it('balance or quota answer: alert right away', async () => {
    await completarHistoricoVeicular(sb, pedido(), deps(httpCom(() => resp(402, { message: 'Saldo insuficiente' }))))
    expect(alertar.mock.calls.some((c: any) => /SALDO OU LIMITE/.test(c[0]))).toBe(true)
    // 402 with no text in the body is balance too.
    alertar.mockClear()
    await completarHistoricoVeicular(sb, pedido('p2'), deps(httpCom(() => resp(402, ''))))
    expect(alertar.mock.calls.some((c: any) => /SALDO OU LIMITE/.test(c[0]))).toBe(true)
    expect(ehSaldoOuLimiteHistorico({ http: 500, bruto: 'saldo' })).toBe(false)
  })
})

describe('daily ceiling', () => {
  it('reached: no call, state "teto" in the snapshot, ONE alert per day', async () => {
    for (let i = 0; i < 3; i++) linhas().push({ id: `h${i}`, cache_hit: false, cobrada: true, criado_em: '2026-10-02T12:00:00Z' })
    linhas().push({ id: 'ontem', cache_hit: false, criado_em: '2026-10-01T12:00:00Z' })
    linhas().push({ id: 'cache', cache_hit: true, criado_em: '2026-10-02T12:00:00Z' })
    const c = cfg({ parceiroHistoricoTetoDia: '3' })
    const r1 = await completarHistoricoVeicular(sb, pedido('p1'), deps(ok(), { cfg: c }))
    const r2 = await completarHistoricoVeicular(sb, pedido('p2'), deps(ok(), { cfg: c }))
    expect(r1).toMatchObject({ ok: false, status: 'teto' })
    expect(r2).toMatchObject({ ok: false, status: 'teto' })
    expect(chamadas).toHaveLength(0)
    expect(snap('p1').historicoVeicular).toEqual({ status: 'teto', consultadoEm: '2026-10-02T15:00:00.000Z' })
    expect(alertar.mock.calls.filter((x: any) => /TETO DIARIO/.test(x[0]))).toHaveLength(1)
    expect(inicioDoDiaBrasilia(AGORA)).toBe('2026-10-02T03:00:00.000Z')
  })
  it('below the ceiling: calls; attempts with an error never count (review 1, item 3)', async () => {
    for (let i = 0; i < 2; i++) linhas().push({ id: `p${i}`, cache_hit: false, cobrada: true, criado_em: '2026-10-02T12:00:00Z' })
    for (let i = 0; i < 5; i++) linhas().push({ id: `e${i}`, cache_hit: false, cobrada: false, em_andamento: false, http_status: 503, criado_em: '2026-10-02T12:00:00Z' })
    expect((await completarHistoricoVeicular(sb, pedido(), deps(ok(), { cfg: cfg({ parceiroHistoricoTetoDia: '3' }) }))).ok).toBe(true)
    expect(chamadas).toHaveLength(1)
  })

  it('simultaneous calls never pass the ceiling: the slot is reserved before calling (review 1, item 3)', async () => {
    sb.tab('pedidos_premium').push({ id: 'p3', relatorio_snapshot: { consulta: { response: {} } } })
    const c = cfg({ parceiroHistoricoTetoDia: '1' })
    // Three orders of three plates at the same time, ceiling 1: one call, two capped.
    const lenta: Http = async (url, init) => { chamadas.push({ url, headers: init.headers }); await new Promise((r) => setTimeout(r, 20)); return resp(200, COM) as any }
    const rs = await Promise.all(['p1', 'p2', 'p3'].map((id, i) => completarHistoricoVeicular(sb, { id, placa: `TST${i}A00`, plano: 'completa' }, deps(lenta, { cfg: c }))))
    expect(chamadas).toHaveLength(1)
    expect(rs.map((r) => r.status).sort()).toEqual(['ok', 'teto', 'teto'])
    expect(linhas().filter((l) => l.cobrada)).toHaveLength(1)
  })
})

describe('one charge per order', () => {
  it('delivery and queue job at the same time: one paid call, the other reuses it', async () => {
    sb = sbHistorico({ lock: travas() })
    comPedidos('p1')
    let pagas = 0
    const lenta: Http = async (url, init) => { chamadas.push({ url, headers: init.headers }); pagas++; await new Promise((r) => setTimeout(r, 30)); return resp(200, COM) as any }
    const esperar = () => new Promise<void>((r) => setTimeout(r, 20))
    const [a, b] = await Promise.all([
      completarHistoricoVeicular(sb, pedido(), deps(lenta, { dono: 'entrega', esperar })),
      completarHistoricoVeicular(sb, pedido(), deps(lenta, { dono: 'fila', esperar })),
    ])
    expect(pagas).toBe(1)
    expect(a.ok && b.ok).toBe(true)
    expect(linhas().filter((l) => l.cobrada)).toHaveLength(1)
    expect(custos().filter((c) => c.preco > 0)).toHaveLength(1)
  })

  it('two orders of the same plate at the same time: one call, the other takes the clean cache (review 1, item 4)', async () => {
    sb = sbHistorico({ lock: travas() })
    comPedidos('p1', 'p2')
    let pagas = 0
    const lenta: Http = async (url, init) => { chamadas.push({ url, headers: init.headers }); pagas++; await new Promise((r) => setTimeout(r, 30)); return resp(200, COM) as any }
    const esperar = () => new Promise<void>((r) => setTimeout(r, 15))
    const [a, b] = await Promise.all([
      completarHistoricoVeicular(sb, pedido('p1'), deps(lenta, { dono: 'pedido-1', esperar })),
      completarHistoricoVeicular(sb, pedido('p2'), deps(lenta, { dono: 'pedido-2', esperar })),
    ])
    expect(pagas).toBe(1)
    expect(a.ok && b.ok).toBe(true)
    expect([a.cacheHit, b.cacheHit].sort()).toEqual([false, true])
    expect(snap('p1').historicoVeicular.status).toBe('ok')
    expect(snap('p2').historicoVeicular.status).toBe('ok')
    expect(linhas().filter((l) => l.cobrada)).toHaveLength(1)
  })

  it('lock RPC down: does not call', async () => {
    sb = Object.assign(supabaseMemoria(), { rpc: async () => ({ data: null, error: { message: 'fora' } }) }) as any
    comPedidos('p1')
    expect(await completarHistoricoVeicular(sb, pedido(), deps(ok()))).toMatchObject({ ok: false, erro: 'sem lock' })
    expect(chamadas).toHaveLength(0)
  })

  it('the database refuses a second paid row: stored as duplicate and alert', async () => {
    const orig = sb.from.bind(sb)
    ;(sb as any).from = (t: string) => {
      const q = orig(t)
      if (t !== 'parceiro_historico_chamadas') return q
      const upd = q.update
      // As if another run had stored its paid row in between (lock lost).
      q.update = (l: any) => (l.cobrada ? { eq: async () => ({ error: { code: '23505', message: 'duplicate' } }) } : upd(l))
      return q
    }
    await completarHistoricoVeicular(sb, pedido(), deps(ok()))
    const dup = linhas().find((l) => /COBRANCA DUPLICADA/.test(l.motivo_erro || ''))
    expect(dup).toMatchObject({ cobrada: false, custo_centavos: 190 })
    expect(alertar.mock.calls.some((c: any) => /COBRANCA DUPLICADA/.test(c[0]))).toBe(true)
  })

  it('paid answer without usable data: never called (and paid) again for the same order', async () => {
    linhas().push({ id: 'velha', pedido_id: 'p1', cobrada: true, resposta_bruta: { success: true, custo_debitado: 1.9 }, criado_em: '2026-10-02T10:00:00Z', cache_hit: false })
    const r = await completarHistoricoVeicular(sb, pedido(), deps(ok()))
    expect(r).toMatchObject({ ok: false, status: 'falhou', erro: 'resposta paga sem dados' })
    expect(chamadas).toHaveLength(0)
  })
})

describe('started together with the paid query (Cesar, 13/11/2026)', () => {
  // A call that answers only when the test lets it (the paid query and the
  // snapshot assembly happen meanwhile).
  function httpSegurado(corpo: () => any = () => resp(200, COM)) {
    let soltar!: () => void
    const portao = new Promise<void>((ok) => { soltar = ok })
    const http: Http = async (url, init) => { chamadas.push({ url, headers: init.headers }); await portao; return corpo() as any }
    return { http, soltar }
  }
  const semSnapshot = () => { sb.tab('pedidos_premium').length = 0 }

  it('call in flight + snapshot assembly + step after the delivery = ONE call; the block lands in the snapshot', async () => {
    semSnapshot()
    const { http, soltar } = httpSegurado()
    const voo = iniciarHistoricoVeicular(sb, pedido(), deps(http))
    expect(voo).not.toBeNull()
    expect(iniciarHistoricoVeicular(sb, pedido(), deps(http))).toBe(voo) // one per order
    // The paid query answered and the snapshot is assembled while the call is out: no wait, no call.
    expect(await historicoProntoParaSnapshot(sb, pedido(), cfg(), AGORA)).toBeNull()
    comPedidos('p1') // the delivery wrote the snapshot without the block
    const depois = completarHistoricoVeicular(sb, pedido(), deps(ok())) // step right after the delivery
    soltar()
    expect(await depois).toMatchObject({ ok: true, status: 'ok' })
    expect(chamadas).toHaveLength(1)
    expect(snap().historicoVeicular).toMatchObject({ status: 'ok', donos: { total: 12 } })
    expect(linhas().filter((l) => l.cobrada)).toHaveLength(1)
    expect(custos().filter((c) => c.preco > 0)).toHaveLength(1)
  })

  it('call finished before the assembly: the snapshot takes it, nothing else is called', async () => {
    semSnapshot()
    expect(await iniciarHistoricoVeicular(sb, pedido(), deps(ok()))).toMatchObject({ ok: true, status: 'ok' })
    expect(await historicoProntoParaSnapshot(sb, pedido(), cfg(), AGORA)).toMatchObject({ status: 'ok', consultadoEm: '2026-10-02T15:00:00.000Z', donos: { total: 12 } })
    comPedidos('p1')
    expect(await completarHistoricoVeicular(sb, pedido(), deps(ok()))).toMatchObject({ ok: true })
    expect(chamadas).toHaveLength(1)
  })

  it('snapshot assembled before the answer: the block is written later, the other blocks stay', async () => {
    sb.tab('pedidos_premium')[0].relatorio_snapshot = { consulta: { response: {} }, multas: { status: 'ok' }, recall: { campanhas: 1 } }
    const { http, soltar } = httpSegurado()
    iniciarHistoricoVeicular(sb, pedido(), deps(http))
    const depois = completarHistoricoVeicular(sb, pedido(), deps(ok()))
    await new Promise((r) => setTimeout(r, 5)) // it has read the snapshot and waits for the call
    expect(chamadas).toHaveLength(1)
    // Another slow source writes its block while the call is out.
    const linha = sb.tab('pedidos_premium')[0]
    linha.relatorio_snapshot = { ...linha.relatorio_snapshot, renajudDetalhe: { status: 'ok', itens: [] } }
    soltar()
    await depois
    expect(snap()).toMatchObject({ multas: { status: 'ok' }, recall: { campanhas: 1 }, renajudDetalhe: { status: 'ok' }, historicoVeicular: { status: 'ok' } })
    expect(chamadas).toHaveLength(1)
  })

  it('no snapshot when the answer arrives (refund): the cost is recorded and the clean cache keeps it', async () => {
    semSnapshot()
    expect(await iniciarHistoricoVeicular(sb, pedido(), deps(ok()))).toMatchObject({ ok: true })
    expect(custos()).toEqual([expect.objectContaining({ pedido_id: 'p1', preco: 1.9 })])
    expect(sb.tab('fonte_cache')).toHaveLength(1)
    // Another process (no call in flight there) also finds it, in the clean cache.
    _limparEmVooHistorico()
    expect(await historicoProntoParaSnapshot(sb, pedido('p9'), cfg(), AGORA)).toMatchObject({ status: 'ok' })
    expect(await historicoProntoParaSnapshot(sb, pedido('p9'), cfg({ parceiroHistoricoLigado: '' }), AGORA)).toBeNull()
  })

  it('early call failed: the step after the delivery does not call again; the queue job does', async () => {
    expect(await iniciarHistoricoVeicular(sb, pedido(), deps(httpCom(() => resp(503, 'fora'))))).toMatchObject({ ok: false, status: 'falhou' })
    expect(await historicoProntoParaSnapshot(sb, pedido(), cfg(), AGORA)).toEqual({ status: 'falhou', consultadoEm: '2026-10-02T15:00:00.000Z', motivo: 'erro' })
    expect(await completarHistoricoVeicular(sb, pedido(), deps(ok()))).toMatchObject({ ok: false, status: 'falhou' })
    expect(chamadas).toHaveLength(1)
    expect(snap().historicoVeicular.status).toBe('falhou')
    expect(await completarHistoricoVeicular(sb, pedido(), deps(ok(), { retentar: true }))).toMatchObject({ ok: true })
    expect(chamadas).toHaveLength(2)
    expect(snap().historicoVeicular.status).toBe('ok')
  })

  it('only for the Completa plan, with the switch on', () => {
    expect(iniciarHistoricoVeicular(sb, pedido('p1', { plano: 'basica' }), deps(ok()))).toBeNull()
    expect(iniciarHistoricoVeicular(sb, pedido(), deps(ok(), { cfg: cfg({ parceiroHistoricoLigado: '' }) }))).toBeNull()
    expect(chamadas).toHaveLength(0)
  })
})

describe('review 1 of PR #752', () => {
  // Item 2: what kind of failure (the screen does not wait for balance, key or ceiling).
  it('failure kind: balance or quota, key refused, anything else', async () => {
    expect(motivoDaFalha({ http: 402, bruto: '' })).toBe('saldo')
    expect(motivoDaFalha({ http: 403, bruto: { message: 'Saldo insuficiente' } })).toBe('saldo')
    expect(motivoDaFalha({ http: 401, bruto: { message: 'unauthorized' } })).toBe('autenticacao')
    expect(motivoDaFalha({ http: 403, bruto: 'forbidden' })).toBe('autenticacao')
    expect(motivoDaFalha({ http: 503, bruto: 'fora' })).toBe('erro')
    expect(motivoDaFalha({ http: null, bruto: null })).toBe('erro')
    await completarHistoricoVeicular(sb, pedido(), deps(httpCom(() => resp(401, { message: 'invalid key' }))))
    expect(snap().historicoVeicular).toEqual({ status: 'falhou', consultadoEm: '2026-10-02T15:00:00.000Z', motivo: 'autenticacao' })
  })

  it('early call ended in 5xx or timeout: the screen stops waiting for it at once (review 1, item 2)', async () => {
    const aplicaveis = [{ fonte: 'historico_veicular' as const, rotulo: 'Donos, leilão e sinistro' }]
    const estado = (historicoVeicular: any, jobs: any[]) => situacaoDasFontes({ entregueEm: new Date(AGORA).toISOString(), agora: AGORA + 30_000, aplicaveis, snapshot: { historicoVeicular }, jobs }).fontes[0].estado
    expect(await iniciarHistoricoVeicular(sb, pedido(), deps(httpCom(() => resp(503, 'fora'))))).toMatchObject({ status: 'falhou' })
    const b503 = await historicoProntoParaSnapshot(sb, pedido(), cfg(), AGORA)
    expect(b503).toEqual({ status: 'falhou', consultadoEm: '2026-10-02T15:00:00.000Z', motivo: 'erro' })
    expect(estado(b503, [{ fonte: 'historico_veicular', status: 'pendente' }])).toBe('chegando')
    expect(estado(b503, [])).toBe('chegando') // inside the wait the job may not exist yet
    const nunca: Http = async () => new Promise(() => {}) as any
    expect(await iniciarHistoricoVeicular(sb, pedido('p2'), deps(nunca, { prazoMs: 30 }))).toMatchObject({ status: 'falhou', erro: 'timeout 30 ms' })
    const bTimeout = await historicoProntoParaSnapshot(sb, pedido('p2'), cfg(), AGORA)
    expect(bTimeout).toEqual({ status: 'falhou', consultadoEm: '2026-10-02T15:00:00.000Z', motivo: 'erro' })
    expect(estado(bTimeout, [{ fonte: 'historico_veicular', status: 'pendente' }])).toBe('chegando')
    expect(estado(bTimeout, [])).toBe('chegando')
    // While the call is still out, the screen waits for it.
    expect(estado(undefined, [])).toBe('consultando')
  })

  // Review 2, item 3: every way of not calling leaves a failure block (the screen stops waiting).
  it('lock or ceiling RPC down: the snapshot gets a failure, nothing is called', async () => {
    for (const rpc of ['job_lock_pegar', 'parceiro_historico_reservar']) {
      sb = sbHistorico({ falhaRpc: [rpc] })
      comPedidos('p1')
      const r = await completarHistoricoVeicular(sb, pedido(), deps(ok()))
      expect(r).toMatchObject({ ok: false, status: 'falhou', erro: rpc === 'job_lock_pegar' ? 'sem lock' : 'sem reserva do teto' })
      expect(snap().historicoVeicular).toEqual({ status: 'falhou', consultadoEm: '2026-10-02T15:00:00.000Z', motivo: 'erro' })
    }
    expect(chamadas).toHaveLength(0)
  })
  it('another order of the same plate holds the call and it fails: a failure, not a silent skip', async () => {
    const t = travas()
    t('historico-placa:TST2B34', 'outro-pedido') // the other order is calling and never fills the cache
    sb = sbHistorico({ lock: t })
    comPedidos('p1')
    const r = await completarHistoricoVeicular(sb, pedido(), deps(ok()))
    expect(r).toMatchObject({ ok: false, status: 'falhou', erro: 'em andamento' })
    expect(snap().historicoVeicular).toMatchObject({ status: 'falhou', motivo: 'erro' })
    expect(chamadas).toHaveLength(0)
  })
  it('early call refused while the server shuts down: a failure block for the snapshot', async () => {
    pararDeAceitar()
    try {
      expect(await iniciarHistoricoVeicular(sb, pedido(), deps(ok()))).toMatchObject({ ok: false, status: 'falhou', erro: 'nao rodou' })
      expect(await historicoProntoParaSnapshot(sb, pedido(), cfg(), AGORA)).toEqual({ status: 'falhou', consultadoEm: '2026-10-02T15:00:00.000Z', motivo: 'erro' })
      expect(chamadas).toHaveLength(0)
    } finally { _resetarEmVoo() }
  })

  // Item 5: the deadline covers the body; a paid answer stays paid even if the parse breaks.
  it('a body that never ends: the deadline covers it, nothing charged', async () => {
    const corpoInfinito: Http = async () => ({ status: 200, text: () => new Promise<string>(() => {}) }) as any
    const t0 = Date.now()
    const c = await chamarHistorico(cfg(), PLACA, corpoInfinito, 40)
    expect(Date.now() - t0).toBeLessThan(2000)
    expect(c).toMatchObject({ http: null, cobrada: false, custoCentavos: 0, erro: 'timeout 40 ms' })
  })
  it('the parse breaks on a paid answer: still charged, raw answer kept, never paid again', async () => {
    const c = await chamarHistorico(cfg(), PLACA, ok(), 1000, () => { throw new Error('quebrou') })
    expect(c).toMatchObject({ http: 200, cobrada: true, custoCentavos: 190, bloco: null, erro: 'resposta sem dados' })
    expect(c.bruto.dados.placa).toBe('TST2B34')
  })

  // Item 8: another VIN, only the reason goes in (no VIN, no data).
  it('the partner answered for another VIN: the snapshot gets only the reason', async () => {
    sb.tab('pedidos_premium')[0].relatorio_snapshot = { consulta: { response: { chassi: '9XXHV00000X999999' } } }
    const r = await completarHistoricoVeicular(sb, pedido(), deps(ok()))
    expect(r).toMatchObject({ ok: false, status: 'divergente' })
    expect(snap().historicoVeicular).toEqual({ status: 'divergente', consultadoEm: '2026-10-02T15:00:00.000Z', motivo: MOTIVO_CHASSI_DIVERGENTE })
    expect(JSON.stringify(snap().historicoVeicular)).not.toContain('9XXHV')
    // Final answer: the queue (or a second run) does not call again.
    expect(await completarHistoricoVeicular(sb, pedido(), deps(ok(), { retentar: true }))).toMatchObject({ pulado: 'ja tem', status: 'divergente' })
    expect(chamadas).toHaveLength(1)
    // Snapshot assembly with the early call or the clean cache: the same.
    _limparEmVooHistorico()
    expect(await historicoProntoParaSnapshot(sb, { id: 'p2', placa: PLACA, chassi: '9XXHV00000X999999' }, cfg(), AGORA)).toMatchObject({ status: 'divergente' })
    expect(await historicoProntoParaSnapshot(sb, { id: 'p2', placa: PLACA, chassi: '9XXHV00000X000001' }, cfg(), AGORA)).toMatchObject({ status: 'ok' })
  })

  // Item 14: only the key of this source is written, never the whole snapshot.
  it('the snapshot is written by the RPC on its own key, never by rewriting it', async () => {
    const orig = sb.from.bind(sb)
    const reescritas: any[] = []
    ;(sb as any).from = (t: string) => {
      const q = orig(t)
      if (t === 'pedidos_premium') { const upd = q.update; q.update = (u: any) => { reescritas.push(u); return upd(u) } }
      return q
    }
    const rpc = vi.spyOn(sb, 'rpc')
    await completarHistoricoVeicular(sb, pedido(), deps(ok()))
    expect(reescritas).toEqual([])
    expect(rpc.mock.calls.some((c) => c[0] === 'snapshot_gravar_historico_veicular')).toBe(true)
    expect(snap().historicoVeicular.status).toBe('ok')
  })
})

describe('operator run before turning it on', () => {
  it('runs with the switch off when asked, never without the key', async () => {
    const desligada = cfg({ parceiroHistoricoLigado: '' })
    expect((await completarHistoricoVeicular(sb, pedido(), deps(ok(), { cfg: desligada, ignorarChave: true }))).ok).toBe(true)
    expect(chamadas).toHaveLength(1)
    expect(await completarHistoricoVeicular(sb, pedido('p2'), deps(ok(), { cfg: cfg({ parceiroHistoricoLigado: '', parceiroHistoricoKey: '' }), ignorarChave: true }))).toMatchObject({ pulado: 'desligado' })
  })
})

describe('never both partners', () => {
  const vazio = () => ({ resumo: { tem_indicio: false, nivel_max: null, n_confirmado: 0, n_provavel: 0, n_possivel: 0, possiveis_ambiguos: 0, fontes_com_passagem: [] }, passagens: [], indice_atualizado_em: null, aviso: null })
  const config = (historico: string) => ({ parceiroLeilaoLigado: 'on', parceiroLeilaoUser: 'u', parceiroLeilaoPass: 'p', parceiroHistoricoLigado: historico, parceiroHistoricoKey: 'k' })
  let leilaoChamadas: string[]
  const httpLeilao: Http = async (url) => {
    leilaoChamadas.push(url)
    if (url.endsWith('/api/Auth/login')) return resp(200, { token: 'jwt' }) as any
    return resp(200, LEILAO_REAL) as any
  }
  beforeEach(() => { leilaoChamadas = []; _limparTokenParceiro() })

  it('vehicle history on: the auction partner is not called, even with its own switch on', async () => {
    const c = cfgParceiro(config('on'), {})
    expect(c).toMatchObject({ ligado: true, historicoLigado: true })
    const h = await complementarLeilaoParceiro({ id: 'p1', placa: PLACA, plano: 'completa' }, vazio(), {}, { sb, cfg: c, http: httpLeilao, alertar, agora: AGORA, log: () => {} })
    expect(h.parceiro).toBeUndefined()
    const job = await rodarJobParceiro({ sb, cfg: c, http: httpLeilao, alertar, agora: AGORA, log: () => {}, dono: 'x' })
    expect(job.rodou).toBe(false)
    expect(leilaoChamadas).toHaveLength(0)
  })

  it('vehicle history off again: the auction partner runs through its own switch', async () => {
    const c = cfgParceiro(config(''), {})
    expect(c.historicoLigado).toBe(false)
    const h = await complementarLeilaoParceiro({ id: 'p1', placa: PLACA, plano: 'completa' }, vazio(), {}, { sb, cfg: c, http: httpLeilao, alertar, agora: AGORA, log: () => {} })
    expect(h.parceiro.status).toBe('ok')
    expect(leilaoChamadas.length).toBeGreaterThan(0)
  })
})
