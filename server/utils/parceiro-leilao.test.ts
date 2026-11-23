import { describe, it, expect, vi, beforeEach } from 'vitest'
import REAL from './__fixtures__/parceiro-leilao-real.json'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'
import { pedidosComCaminhos as sbJob } from '../../tests/helpers/supabase-caminhos'
import { avisarLeilaoTardio } from './aviso-leilao'
import HIST_COM from './__fixtures__/parceiro-historico-com-registros.json'
import HIST_SEM from './__fixtures__/parceiro-historico-sem-registros.json'
import { parsearRespostaHistorico } from '../../shared/historico-veicular'
import {
  complementarLeilaoParceiro, rodarJobParceiro, cfgParceiro, inicioDoDiaBrasilia, ehSaldoOuLimite,
  _limparTokenParceiro, _limparAlertaTeto, FONTE_CUSTO_PARCEIRO, FONTE_CACHE_PARCEIRO, type Http,
  leilaoParceiroComoReserva, jobParceiroDeveRodar, chamarParceiro, PARCEIRO_MAX_POR_RODADA,
} from './parceiro-leilao'

// Regras do Cesar (20/out/2026): so Completa, so com a nossa base vazia, teto
// diario, cache que nao cobra, placa e depois chassi, uma linha por tentativa.
const AGORA = Date.parse('2026-10-20T19:00:00Z')
const CHASSI = '9XXAA00000X000001'
const cfg = (x: any = {}) => cfgParceiro({ parceiroLeilaoLigado: 'on', parceiroLeilaoUser: 'u', parceiroLeilaoPass: 'p', parceiroLeilaoTetoDia: '40', ...x }, {})
const vazio = () => ({ resumo: { tem_indicio: false, nivel_max: null, n_confirmado: 0, n_provavel: 0, n_possivel: 0, possiveis_ambiguos: 0, fontes_com_passagem: [] }, passagens: [], indice_atualizado_em: null, aviso: null })
const resp = (status: number, corpo: any) => ({ status, text: async () => (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)) })

let sb: ReturnType<typeof supabaseMemoria>
let chamadas: string[]
const alertar = vi.fn(async () => {})
function httpCom(porParam: (p: string) => any): Http {
  return async (url) => {
    chamadas.push(url)
    if (url.endsWith('/api/Auth/login')) return resp(200, { token: 'jwt' }) as any
    const p = decodeURIComponent(url.split('parametro=')[1] || '')
    return porParam(p)
  }
}
const pedido = (id = 'p1') => ({ id, placa: 'ABC1D23', plano: 'completa' })
const deps = (http: Http, x: any = {}) => ({ sb, cfg: cfg(), http, alertar, agora: AGORA, log: () => {}, ...x })
const linhas = () => sb.tab('parceiro_leilao_chamadas')
const custos = () => sb.tab('premium_custos')

beforeEach(() => {
  sb = supabaseMemoria()
  chamadas = []
  alertar.mockClear()
  _limparTokenParceiro()
  _limparAlertaTeto()
})

describe('quando NAO chama', () => {
  it('nossa base trouxe algo, nao respondeu, plano basica ou desligado', async () => {
    const http = httpCom(() => resp(200, REAL))
    const comAlgo = { ...vazio(), passagens: [{ nivel: 'possivel' }] }
    expect(await complementarLeilaoParceiro(pedido(), comAlgo, { chassi: CHASSI }, deps(http))).toBe(comAlgo)
    expect(await complementarLeilaoParceiro(pedido(), { ...vazio(), resumo: { ...vazio().resumo, tem_indicio: true } }, {}, deps(http)).then((h: any) => h.parceiro)).toBeUndefined()
    expect(await complementarLeilaoParceiro(pedido(), null, {}, deps(http))).toBeNull()
    expect(await complementarLeilaoParceiro({ ...pedido(), plano: 'basica' }, vazio(), {}, deps(http)).then((h: any) => h.parceiro)).toBeUndefined()
    expect(await complementarLeilaoParceiro(pedido(), vazio(), {}, deps(http, { cfg: cfg({ parceiroLeilaoLigado: '' }) })).then((h: any) => h.parceiro)).toBeUndefined()
    expect(chamadas).toHaveLength(0)
    expect(linhas()).toHaveLength(0)
  })
})

describe('chamada', () => {
  it('pela placa: junta ao historico, uma linha, custo 6,00 com o idConsulta, bruto no cache', async () => {
    const h = await complementarLeilaoParceiro(pedido(), vazio(), { chassi: CHASSI }, deps(httpCom(() => resp(200, REAL))))
    expect(h.parceiro).toMatchObject({ status: 'ok', id_consulta: '00000000-0000-4000-8000-000000000001' })
    expect(h.passagens[0]).toMatchObject({ fonte: 'parceiro', fonte_exibicao: 'Base parceira', nivel: 'confirmado' })
    expect(h.sinistro_parceiro.indicio).toBe(true)
    expect(linhas()).toHaveLength(1)
    expect(linhas()[0]).toMatchObject({ pedido_id: 'p1', parametro_enviado: 'ABC1D23', tipo_parametro: 'placa', http_status: 200, cobrada: true, preco_centavos: 600, id_consulta_parceiro: '00000000-0000-4000-8000-000000000001', tem_registro_leilao: true, n_leiloes: 1, indicio_sinistro: true, nossa_base_vazia: true, cache_hit: false })
    expect(linhas()[0].resposta_bruta).toEqual(REAL)
    expect(custos()).toEqual([expect.objectContaining({ pedido_id: 'p1', fonte: FONTE_CUSTO_PARCEIRO, preco: 6, code: 200, detalhe: 'idConsulta 00000000-0000-4000-8000-000000000001' })])
    expect(sb.tab('fonte_cache')[0]).toMatchObject({ fonte: FONTE_CACHE_PARCEIRO, chave: 'placa:ABC1D23' })
  })

  it('cache hit: nao chama nem cobra, mas grava a linha (cache_hit)', async () => {
    await complementarLeilaoParceiro(pedido('p1'), vazio(), { chassi: CHASSI }, deps(httpCom(() => resp(200, REAL))))
    chamadas = []
    const h = await complementarLeilaoParceiro(pedido('p2'), vazio(), { chassi: CHASSI }, deps(httpCom(() => resp(500, 'nao devia'))))
    expect(h.parceiro.status).toBe('ok')
    expect(chamadas).toHaveLength(0)
    expect(linhas()[1]).toMatchObject({ pedido_id: 'p2', cache_hit: true, cobrada: false, preco_centavos: 0 })
    expect(custos()).toHaveLength(1)
  })

  it('erro pela placa e ha chassi: tenta o chassi; erro custa 0', async () => {
    const h = await complementarLeilaoParceiro(pedido(), vazio(), { chassi: CHASSI }, deps(httpCom((p) => (p === 'ABC1D23' ? resp(500, 'erro interno') : resp(200, REAL)))))
    expect(h.parceiro.status).toBe('ok')
    expect(linhas().map((l) => [l.tipo_parametro, l.http_status, l.cobrada])).toEqual([['placa', 500, false], ['chassi', 200, true]])
    expect(custos().map((c) => c.preco)).toEqual([0, 6])
  })

  it('falha nas duas: historico marcado falhou (o job tenta depois)', async () => {
    const h = await complementarLeilaoParceiro(pedido(), vazio(), { chassi: CHASSI }, deps(httpCom(() => resp(503, 'fora'))))
    expect(h.parceiro.status).toBe('falhou')
    expect(h.passagens).toHaveLength(0)
    expect(linhas()).toHaveLength(2)
  })

  it('401: refaz o login uma vez', async () => {
    let n = 0
    const h = await complementarLeilaoParceiro(pedido(), vazio(), {}, deps(httpCom(() => (n++ === 0 ? resp(401, '') : resp(200, REAL)))))
    expect(h.parceiro.status).toBe('ok')
    expect(chamadas.filter((u) => u.endsWith('/login'))).toHaveLength(2)
  })

  it('400 de saldo ou limite: alerta na hora e nao tenta o chassi', async () => {
    const h = await complementarLeilaoParceiro(pedido(), vazio(), { chassi: CHASSI }, deps(httpCom(() => resp(400, { title: 'Saldo insuficiente' }))))
    expect(h.parceiro.status).toBe('falhou')
    expect(alertar).toHaveBeenCalledOnce()
    expect((alertar.mock.calls[0] as any)[0]).toMatch(/SALDO OU LIMITE/)
    expect(linhas()).toHaveLength(1)
    expect(ehSaldoOuLimite({ http: 400, bruto: 'parametro obrigatorio' })).toBe(false)
  })

  it('pedido que ja pagou (reabertura/job): reaproveita a resposta, sem nova cobranca', async () => {
    sb.tab('parceiro_leilao_chamadas').push({ id: 'x', pedido_id: 'p1', cobrada: true, resposta_bruta: REAL, tipo_parametro: 'placa', criado_em: '2026-10-20T18:00:00Z', cache_hit: false })
    const h = await complementarLeilaoParceiro(pedido(), vazio(), {}, deps(httpCom(() => resp(500, 'nao devia'))))
    expect(h.parceiro.status).toBe('ok')
    expect(chamadas).toHaveLength(0)
  })
})

describe('teto diario', () => {
  it('atingido: nao chama, segue sem a fonte e alerta uma vez por dia', async () => {
    const hoje = inicioDoDiaBrasilia(AGORA)
    for (let i = 0; i < 40; i++) sb.tab('parceiro_leilao_chamadas').push({ id: `t${i}`, cache_hit: false, criado_em: hoje })
    const http = httpCom(() => resp(200, REAL))
    const h1 = await complementarLeilaoParceiro(pedido('p1'), vazio(), {}, deps(http))
    const h2 = await complementarLeilaoParceiro(pedido('p2'), vazio(), {}, deps(http))
    expect(h1.parceiro.status).toBe('teto')
    expect(h2.parceiro.status).toBe('teto')
    expect(chamadas).toHaveLength(0)
    expect(alertar).toHaveBeenCalledOnce()
    expect((alertar.mock.calls[0] as any)[0]).toMatch(/TETO DIARIO/)
  })
  it('cache hit e chamada de ontem nao contam', async () => {
    for (let i = 0; i < 40; i++) sb.tab('parceiro_leilao_chamadas').push({ id: `t${i}`, cache_hit: true, criado_em: inicioDoDiaBrasilia(AGORA) })
    sb.tab('parceiro_leilao_chamadas').push({ id: 'ontem', cache_hit: false, criado_em: '2026-10-19T12:00:00Z' })
    expect((await complementarLeilaoParceiro(pedido(), vazio(), {}, deps(httpCom(() => resp(200, REAL))))).parceiro.status).toBe('ok')
  })
  it('dia de Brasilia', () => {
    expect(inicioDoDiaBrasilia(Date.parse('2026-10-21T02:00:00Z'))).toBe('2026-10-20T03:00:00.000Z')
    expect(inicioDoDiaBrasilia(Date.parse('2026-10-21T04:00:00Z'))).toBe('2026-10-21T03:00:00.000Z')
  })
})

describe('job de complemento', () => {
  function sbComPedidos(pedidos: any[]) {
    const salvos: any[] = []
    const fake: any = {
      ...sb,
      rpc: async () => ({ data: true, error: null }),
      from: (t: string) => {
        if (t !== 'pedidos_premium') return sb.from(t)
        const q: any = {
          select: () => q, eq: () => q, gte: () => q, in: () => q, order: () => q,
          limit: async () => ({ data: pedidos, error: null }),
          update: (u: any) => ({ eq: async (_c: string, id: string) => { salvos.push({ id, ...u }); return { error: null } } }),
          maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: {}, historicoLeilao: pedidos[0].historicoLeilao } } }),
        }
        return q
      },
    }
    return { fake, salvos }
  }
  it('tenta uma vez o pedido que falhou; completa e grava so historicoLeilao', async () => {
    const { fake, salvos } = sbComPedidos([{ id: 'p9', placa: 'ABC1D23', plano: 'completa', chassi: CHASSI, historicoLeilao: { ...vazio(), parceiro: { status: 'falhou' } } }])
    const r = await rodarJobParceiro({ sb: fake, cfg: cfg(), http: httpCom(() => resp(200, REAL)), alertar, agora: AGORA, log: () => {}, dono: 'c1' })
    expect(r).toMatchObject({ rodou: true, vistos: 1, completados: 1 })
    expect(salvos[0].relatorio_snapshot.historicoLeilao.parceiro.status).toBe('ok')
    expect(salvos[0].relatorio_snapshot.consulta).toEqual({})
  })
  it('falhou de novo: marca retentado e nao tenta mais', async () => {
    const { fake, salvos } = sbComPedidos([{ id: 'p9', placa: 'ABC1D23', plano: 'completa', chassi: null, historicoLeilao: { ...vazio(), parceiro: { status: 'falhou' } } }])
    await rodarJobParceiro({ sb: fake, cfg: cfg(), http: httpCom(() => resp(503, 'x')), alertar, agora: AGORA, log: () => {}, dono: 'c1' })
    expect(salvos[0].relatorio_snapshot.historicoLeilao.parceiro).toMatchObject({ status: 'falhou', retentado: true })
    const { fake: f2 } = sbComPedidos([{ id: 'p9', placa: 'ABC1D23', plano: 'completa', historicoLeilao: { ...vazio(), parceiro: { status: 'falhou', retentado: true } } }])
    chamadas = []
    const r = await rodarJobParceiro({ sb: f2, cfg: cfg(), http: httpCom(() => resp(200, REAL)), alertar, agora: AGORA, log: () => {}, dono: 'c1' })
    expect(r.vistos).toBe(0)
    expect(chamadas).toHaveLength(0)
  })
})

describe('cobranca unica por pedido (21/out/2026, BCK2C28 cobrado 2x)', () => {
  // Lock de verdade em memoria: job_lock_pegar com dono e prazo.
  function sbComLock() {
    const locks = new Map<string, string>()
    const base = supabaseMemoria({ unicos: {} })
    return Object.assign(base, {
      rpc: async (nome: string, a: any) => {
        if (nome !== 'job_lock_pegar') return { data: true, error: null }
        const atual = locks.get(a.p_nome)
        if (!atual || atual === a.p_dono) { locks.set(a.p_nome, a.p_dono); return { data: true, error: null } }
        return { data: false, error: null }
      },
    })
  }

  it('duas geracoes concorrentes do mesmo pedido: uma chamada paga, a outra reaproveita', async () => {
    sb = sbComLock() as any
    let pagas = 0
    // A chamada demora (como na producao: 2,2 s e 4,6 s); a segunda chega no meio.
    const lenta: Http = async (url) => {
      chamadas.push(url)
      if (url.endsWith('/api/Auth/login')) return resp(200, { token: 'jwt' }) as any
      pagas++
      await new Promise((ok) => setTimeout(ok, 30))
      return resp(200, REAL) as any
    }
    const esperar = () => new Promise<void>((ok) => setTimeout(ok, 20))
    const [a, b] = await Promise.all([
      complementarLeilaoParceiro(pedido('p1'), vazio(), { chassi: CHASSI }, deps(lenta, { dono: 'geracao', esperar })),
      complementarLeilaoParceiro(pedido('p1'), vazio(), { chassi: CHASSI }, deps(lenta, { dono: 'pagina', esperar })),
    ])
    expect(pagas).toBe(1)
    expect(a.parceiro.status).toBe('ok')
    expect(b.parceiro.status).toBe('ok')
    expect(linhas().filter((l) => l.cobrada)).toHaveLength(1)
    expect(custos().filter((c) => c.preco > 0)).toHaveLength(1)
  })

  it('sem conseguir o lock (rpc fora): nao chama, marca falhou para o job', async () => {
    sb = Object.assign(supabaseMemoria(), { rpc: async () => ({ data: null, error: { message: 'fora' } }) }) as any
    const h = await complementarLeilaoParceiro(pedido('p1'), vazio(), {}, deps(httpCom(() => resp(200, REAL))))
    expect(h.parceiro.status).toBe('falhou')
    expect(chamadas).toHaveLength(0)
  })

  it('outra geracao segura o lock e nao termina: segue sem chamar e sem marcar estado', async () => {
    sb = Object.assign(supabaseMemoria(), { rpc: async () => ({ data: false, error: null }) }) as any
    const h = await complementarLeilaoParceiro(pedido('p1'), vazio(), {}, deps(httpCom(() => resp(200, REAL)), { esperar: async () => {} }))
    expect(h.parceiro).toBeUndefined()
    expect(chamadas).toHaveLength(0)
  })

  it('banco barra a 2a linha cobrada: grava como duplicada e alerta', async () => {
    sb = supabaseMemoria({ unicos: {} })
    // simula o indice unico parcial: segunda linha cobrada do mesmo pedido falha
    const orig = sb.from.bind(sb)
    ;(sb as any).from = (t: string) => {
      const q = orig(t)
      if (t !== 'parceiro_leilao_chamadas') return q
      const ins = q.insert
      q.insert = (l: any) => (l.cobrada && sb.tab(t).some((x: any) => x.pedido_id === l.pedido_id && x.cobrada)
        ? { then: (ok: any) => Promise.resolve({ error: { code: '23505', message: 'duplicate' } }).then(ok) }
        : ins(l))
      return q
    }
    sb.tab('parceiro_leilao_chamadas').push({ id: 'velha', pedido_id: 'p1', cobrada: true, resposta_bruta: 'torta', criado_em: '2026-10-21T00:00:00Z', cache_hit: false })
    await complementarLeilaoParceiro(pedido('p1'), vazio(), {}, deps(httpCom(() => resp(200, REAL))))
    const dup = linhas().find((l) => /COBRANCA DUPLICADA/.test(l.motivo_erro || ''))
    expect(dup).toMatchObject({ cobrada: false, preco_centavos: 600 })
    expect(alertar.mock.calls.some((c: any) => /COBRANCA DUPLICADA/.test(c[0]))).toBe(true)
  })
})

// Cesar, 17/11/2026: with the vehicle history partner on, this source runs only
// as its fallback, for an order where it failed, under the same rules.
describe('fallback of the vehicle history partner', () => {
  const cfgHist = (x: any = {}) => cfg({ parceiroHistoricoLigado: 'on', parceiroHistoricoKey: 'k', ...x })
  const pagas = () => chamadas.filter((u) => !u.endsWith('/login')).length
  let avisos: any[]
  const avisarLeilao = async (_sb: any, id: string, antes: any, depois: any) => { avisos.push({ id, antes, depois }) }
  const comPedido = (x: any = {}, snap: any = {}) => {
    sb.tab('pedidos_premium').push({ id: 'p1', placa: 'ABC1D23', plano: 'completa', status: 'entregue', ...x, relatorio_snapshot: { consulta: { response: { chassi: CHASSI } }, historicoLeilao: vazio(), multas: { status: 'ok' }, ...snap } })
  }
  const snapP1 = () => sb.tab('pedidos_premium').find((p) => p.id === 'p1')!.relatorio_snapshot
  beforeEach(() => { avisos = [] })

  it('vehicle history on: no call without the fallback flag; with it, the same rules and the state marked', async () => {
    const http = httpCom(() => resp(200, REAL))
    expect(cfgHist().historicoLigado).toBe(true)
    const sem = await complementarLeilaoParceiro(pedido(), vazio(), { chassi: CHASSI }, deps(http, { cfg: cfgHist() }))
    expect(sem.parceiro).toBeUndefined()
    expect(chamadas).toHaveLength(0)
    const com = await complementarLeilaoParceiro(pedido(), vazio(), { chassi: CHASSI }, deps(http, { cfg: cfgHist(), reservaDoHistorico: true }))
    expect(com.parceiro).toMatchObject({ status: 'ok', reserva: true })
    expect(custos()).toEqual([expect.objectContaining({ fonte: FONTE_CUSTO_PARCEIRO, preco: 6 })])
    // Same rules as before: Basica, something in our base or our base down = no call.
    chamadas = []
    expect((await complementarLeilaoParceiro({ ...pedido('p2'), plano: 'basica' }, vazio(), {}, deps(http, { cfg: cfgHist(), reservaDoHistorico: true }))).parceiro).toBeUndefined()
    expect(await complementarLeilaoParceiro(pedido('p2'), null, {}, deps(http, { cfg: cfgHist(), reservaDoHistorico: true }))).toBeNull()
    const comAlgo = { ...vazio(), passagens: [{ nivel: 'possivel' }] }
    expect(await complementarLeilaoParceiro(pedido('p2'), comAlgo, {}, deps(http, { cfg: cfgHist(), reservaDoHistorico: true }))).toBe(comAlgo)
    expect(chamadas).toHaveLength(0)
    // Failure and ceiling are marked too (the retry job takes only these).
    const falha = await complementarLeilaoParceiro({ ...pedido('p3'), placa: 'QWE1R23' }, vazio(), {}, deps(httpCom(() => resp(503, 'fora')), { cfg: cfgHist(), reservaDoHistorico: true }))
    expect(falha.parceiro).toMatchObject({ status: 'falhou', reserva: true })
  })

  it('leilaoParceiroComoReserva: one call, only historicoLeilao written, the customer told once', async () => {
    comPedido()
    expect(await leilaoParceiroComoReserva(sb, 'p1', deps(httpCom(() => resp(200, REAL)), { cfg: cfgHist(), avisarLeilao }))).toBe('ok')
    expect(snapP1().historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true })
    expect(snapP1().multas).toEqual({ status: 'ok' })
    expect(pagas()).toBe(1)
    expect(linhas()[0]).toMatchObject({ pedido_id: 'p1', cobrada: true, tipo_parametro: 'placa' })
    expect(avisos).toHaveLength(1)
    expect(avisos[0].antes.passagens).toHaveLength(0)
    expect(avisos[0].depois.sinistro_parceiro.indicio).toBe(true)
    // Already tried for this order: the retry belongs to the job; no second call nor notice.
    expect(await leilaoParceiroComoReserva(sb, 'p1', deps(httpCom(() => resp(200, REAL)), { cfg: cfgHist(), avisarLeilao }))).toBe('pulado')
    expect(pagas()).toBe(1)
    expect(avisos).toHaveLength(1)
  })

  it('leilaoParceiroComoReserva: a clean answer is written and sends no e-mail; a failed call leaves the state for the job', async () => {
    const limpo = { ...REAL, resultados: { leilao: { temRegistro: false, leiloes: [] }, sinistro: { indicioDeSinistro: 0, mensagemSinistro: 'NADA CONSTA' } } }
    const enviados: any[] = []
    // Records what the notifier got, then runs the real one (sender injected).
    const avisarGravando = async (s: any, id: string, a: any, d: any) => {
      avisos.push({ id, antes: a, depois: d })
      return avisarLeilaoTardio(s, id, a, d, { enviar: async (m: any) => { enviados.push(m); return true }, ligado: true, log: () => {} })
    }
    comPedido({ email: 'c@x.com', token_entrega: 'TOK' })
    expect(await leilaoParceiroComoReserva(sb, 'p1', deps(httpCom(() => resp(200, limpo)), { cfg: cfgHist(), avisarLeilao: avisarGravando }))).toBe('ok')
    expect(snapP1().historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true })
    expect(avisos).toHaveLength(1)
    expect(avisos[0].depois.passagens).toHaveLength(0)
    expect(avisos[0].depois.sinistro_parceiro.indicio).toBe(false)
    expect(enviados).toHaveLength(0)
    expect(sb.tab('pedidos_premium')[0].aviso_leilao_em ?? null).toBeNull()
    sb = supabaseMemoria()
    comPedido()
    expect(await leilaoParceiroComoReserva(sb, 'p1', deps(httpCom(() => resp(503, 'fora')), { cfg: cfgHist(), avisarLeilao }))).toBe('falhou')
    expect(snapP1().historicoLeilao.parceiro).toMatchObject({ status: 'falhou', reserva: true })
  })

  it('leilaoParceiroComoReserva skips: Basica, something in our base, our base down, no snapshot, switch off', async () => {
    const http = httpCom(() => resp(200, REAL))
    comPedido({ plano: 'basica' })
    expect(await leilaoParceiroComoReserva(sb, 'p1', deps(http, { cfg: cfgHist() }))).toBe('pulado')
    sb = supabaseMemoria(); comPedido({}, { historicoLeilao: { ...vazio(), passagens: [{ nivel: 'provavel' }] } })
    expect(await leilaoParceiroComoReserva(sb, 'p1', deps(http, { cfg: cfgHist() }))).toBe('pulado')
    sb = supabaseMemoria(); comPedido({}, { historicoLeilao: null })
    expect(await leilaoParceiroComoReserva(sb, 'p1', deps(http, { cfg: cfgHist() }))).toBe('pulado')
    sb = supabaseMemoria()
    expect(await leilaoParceiroComoReserva(sb, 'p1', deps(http, { cfg: cfgHist() }))).toBe('pulado')
    sb = supabaseMemoria(); comPedido()
    expect(await leilaoParceiroComoReserva(sb, 'p1', deps(http, { cfg: cfgHist({ parceiroLeilaoLigado: '' }) }))).toBe('pulado')
    expect(chamadas).toHaveLength(0)
  })

  it('e-mail: ONE late notice when the fallback finds an auction or damage after the delivery; none when it finds nothing', async () => {
    const enviados: any[] = []
    const avisarReal = (s: any, id: string, a: any, d: any) => avisarLeilaoTardio(s, id, a, d, { enviar: async (m: any) => { enviados.push(m); return true }, ligado: true, log: () => {} })
    comPedido({ email: 'c@x.com', token_entrega: 'TOK' })
    expect(await leilaoParceiroComoReserva(sb, 'p1', deps(httpCom(() => resp(200, REAL)), { cfg: cfgHist(), avisarLeilao: avisarReal }))).toBe('ok')
    expect(enviados).toHaveLength(1)
    expect(enviados[0]).toMatchObject({ email: 'c@x.com', token: 'TOK' })
    expect(sb.tab('pedidos_premium')[0].aviso_leilao_em).toBeTruthy()
    // Any later change (job retry, lazy fill, a second fallback): already told, no second e-mail.
    expect(await avisarReal(sb, 'p1', vazio(), snapP1().historicoLeilao)).toBe('ja_avisado')
    expect(await leilaoParceiroComoReserva(sb, 'p1', deps(httpCom(() => resp(200, REAL)), { cfg: cfgHist(), avisarLeilao: avisarReal }))).toBe('pulado')
    expect(enviados).toHaveLength(1)
    // Nothing found by the fallback: no e-mail at all.
    sb = supabaseMemoria()
    comPedido({ email: 'c@x.com', token_entrega: 'TOK', placa: 'QWE1R23' })
    const limpo = { ...REAL, resultados: { leilao: { temRegistro: false, leiloes: [] }, sinistro: { indicioDeSinistro: 0, mensagemSinistro: 'NADA CONSTA' } } }
    expect(await leilaoParceiroComoReserva(sb, 'p1', deps(httpCom(() => resp(200, limpo)), { cfg: cfgHist(), avisarLeilao: avisarReal }))).toBe('ok')
    expect(enviados).toHaveLength(1)
    expect(sb.tab('pedidos_premium')[0].aviso_leilao_em ?? null).toBeNull()
  })

  it('the job and the plugin run with the vehicle history on, only for orders in fallback (the query filters them)', async () => {
    expect(jobParceiroDeveRodar(cfgHist())).toBe(true)
    expect(jobParceiroDeveRodar(cfg())).toBe(true)
    expect(jobParceiroDeveRodar(cfgHist({ parceiroLeilaoLigado: '' }))).toBe(false)
    const linhaPedido = (id: string, placa: string, parceiro: any) => ({
      id, placa, plano: 'completa', status: 'entregue', entregue_em: new Date(AGORA - 3600_000).toISOString(),
      relatorio_snapshot: { consulta: { response: { chassi: CHASSI } }, historicoLeilao: { ...vazio(), parceiro }, historicoVeicular: { status: 'ok', completa: false, faltas: ['sinistros'] } },
    })
    sb.tab('pedidos_premium').push(linhaPedido('outro', 'XYZ9A99', { status: 'falhou' }), linhaPedido('reserva', 'ABC1D23', { status: 'falhou', reserva: true }))
    const { fake, filtros } = sbJob(sb)
    const r = await rodarJobParceiro({ sb: fake, cfg: cfgHist(), http: httpCom((p) => { expect(p).toBe('ABC1D23'); return resp(200, REAL) }), alertar, agora: AGORA, log: () => {}, dono: 'c1', avisarLeilao })
    // The query itself asks only for orders marked as the fallback.
    expect(filtros).toContain('eq relatorio_snapshot->historicoLeilao->parceiro->>reserva true')
    expect(r).toMatchObject({ rodou: true, vistos: 1, completados: 1 })
    const porId = (id: string) => sb.tab('pedidos_premium').find((p) => p.id === id)!.relatorio_snapshot.historicoLeilao.parceiro
    expect(porId('reserva')).toMatchObject({ status: 'ok', reserva: true })
    expect(porId('outro')).toEqual({ status: 'falhou' })
    expect(avisos).toHaveLength(1)
    // Vehicle history off: the old behavior, no reserva filter, every failed order.
    const { fake: f2, filtros: q2 } = sbJob(sb)
    _limparTokenParceiro()
    await rodarJobParceiro({ sb: f2, cfg: cfg(), http: httpCom(() => resp(200, REAL)), alertar, agora: AGORA, log: () => {}, dono: 'c1', avisarLeilao })
    expect(q2.some((f) => f.includes('->>reserva'))).toBe(false)
    expect(porId('outro')).toMatchObject({ status: 'ok' })
  })

  it('job retry of a fallback order whose vehicle history came complete since, with an auction record of its own: no call, the retry is spent', async () => {
    const completo = { ...parsearRespostaHistorico(structuredClone(HIST_COM))!, consultadoEm: '2026-10-20T18:00:00Z' }
    expect(completo.completa).toBe(true)
    expect(completo.leilao!.registros.length).toBeGreaterThan(0)
    sb.tab('pedidos_premium').push({
      id: 'p1', placa: 'ABC1D23', plano: 'completa', status: 'entregue', entregue_em: new Date(AGORA - 3600_000).toISOString(),
      relatorio_snapshot: { consulta: { response: { chassi: CHASSI } }, historicoLeilao: { ...vazio(), parceiro: { status: 'falhou', reserva: true } }, historicoVeicular: completo },
    })
    const { fake } = sbJob(sb)
    await rodarJobParceiro({ sb: fake, cfg: cfgHist(), http: httpCom(() => resp(200, REAL)), alertar, agora: AGORA, log: () => {}, dono: 'c1', avisarLeilao })
    expect(chamadas).toHaveLength(0)
    expect(snapP1().historicoLeilao.parceiro).toMatchObject({ status: 'falhou', reserva: true, retentado: true })
    expect(avisos).toHaveLength(0)
  })

  it('job safety net: a vehicle history job the queue just gave up on gets its fallback once', async () => {
    comPedido()
    sb.tab('premium_jobs').push({ id: 'j1', pedido_id: 'p1', fonte: 'historico_veicular', status: 'esgotado', concluido_em: new Date(AGORA - 10 * 60_000).toISOString() })
    sb.tab('premium_jobs').push({ id: 'j2', pedido_id: 'velho', fonte: 'historico_veicular', status: 'esgotado', concluido_em: new Date(AGORA - 3 * 3600_000).toISOString() })
    const http = httpCom(() => resp(200, REAL))
    const r = await rodarJobParceiro({ sb, cfg: cfgHist(), http, alertar, agora: AGORA, log: () => {}, dono: 'c1', avisarLeilao })
    expect(r).toMatchObject({ rodou: true, vistos: 1, completados: 1 })
    expect(snapP1().historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true })
    expect(pagas()).toBe(1)
    // Next round: already tried, nothing else.
    await rodarJobParceiro({ sb, cfg: cfgHist(), http, alertar, agora: AGORA, log: () => {}, dono: 'c1', avisarLeilao })
    expect(pagas()).toBe(1)
    expect(avisos).toHaveLength(1)
    // Vehicle history off: no safety net needed (the source runs in the generation).
    sb = supabaseMemoria(); comPedido(); sb.tab('premium_jobs').push({ id: 'j1', pedido_id: 'p1', fonte: 'historico_veicular', status: 'esgotado', concluido_em: new Date(AGORA).toISOString() })
    await rodarJobParceiro({ sb, cfg: cfg(), http, alertar, agora: AGORA, log: () => {}, dono: 'c1', avisarLeilao })
    expect(pagas()).toBe(1)
  })
})

// Review 1 of PR #758 (items 2 to 6).
describe('fallback of the vehicle history partner: review 1 of PR #758', () => {
  const cfgHist = (x: any = {}) => cfg({ parceiroHistoricoLigado: 'on', parceiroHistoricoKey: 'k', ...x })
  const pagas = () => chamadas.filter((u) => !u.endsWith('/login')).length
  const historicoDe = (fixture: any, fontes: Record<string, unknown> = {}) => {
    const r = structuredClone(fixture)
    r.dados.raw_sources = { ...r.dados.raw_sources, ...fontes }
    return { ...parsearRespostaHistorico(r)!, consultadoEm: '2026-10-20T18:00:00Z' }
  }
  const comPedido = (x: any = {}, snap: any = {}, id = 'p1') => {
    sb.tab('pedidos_premium').push({ id, placa: 'ABC1D23', plano: 'completa', status: 'entregue', email: 'c@x.com', token_entrega: 'TOK', ...x, relatorio_snapshot: { consulta: { response: { chassi: CHASSI } }, historicoLeilao: vazio(), ...snap } })
  }
  const snapDe = (id = 'p1') => sb.tab('pedidos_premium').find((p) => p.id === id)!.relatorio_snapshot
  let enviados: any[]
  // The real notifier (aviso_leilao_em guard, tipoDoAviso), with the sender injected.
  const avisarReal = (s: any, id: string, a: any, d: any) => avisarLeilaoTardio(s, id, a, d, { enviar: async (m: any) => { enviados.push(m); return true }, ligado: true, log: () => {} })
  beforeEach(() => { enviados = [] })

  it('item 3: a complete vehicle history for this vehicle, with an auction record of its own, needs no fallback: leilaoParceiroComoReserva and the safety net skip it', async () => {
    expect(historicoDe(HIST_COM).leilao!.registros.length).toBeGreaterThan(0)
    comPedido({}, { historicoVeicular: historicoDe(HIST_COM) })
    sb.tab('premium_jobs').push({ id: 'j1', pedido_id: 'p1', fonte: 'historico_veicular', status: 'esgotado', concluido_em: new Date(AGORA - 5 * 60_000).toISOString() })
    const http = httpCom(() => resp(200, REAL))
    expect(await leilaoParceiroComoReserva(sb, 'p1', deps(http, { cfg: cfgHist(), avisarLeilao: avisarReal }))).toBe('pulado')
    const r = await rodarJobParceiro({ sb, cfg: cfgHist(), http, alertar, agora: AGORA, log: () => {}, dono: 'c1', avisarLeilao: avisarReal })
    expect(r).toMatchObject({ rodou: true, vistos: 0 })
    expect(pagas()).toBe(0)
    expect(snapDe().historicoLeilao.parceiro).toBeUndefined()
    expect(enviados).toHaveLength(0)
    // Partial, other VIN, failed: it runs.
    for (const [id, hv] of [['p2', historicoDe(HIST_COM, { infosinistrosSuccess: false })], ['p3', { status: 'divergente', consultadoEm: null }], ['p4', { status: 'falhou', consultadoEm: null }]] as const) {
      comPedido({}, { historicoVeicular: hv }, id)
      expect(await leilaoParceiroComoReserva(sb, id, deps(http, { cfg: cfgHist(), avisarLeilao: async () => {} }))).toBe('ok')
    }
  })

  it('item 4: no e-mail when the page already showed an auction from a partial vehicle history; one when it shows up only now', async () => {
    // Partial answer whose auction part already shows records and a damage sign on the page.
    const comLeilao = historicoDe(HIST_COM, { infosinistrosSuccess: false })
    expect(comLeilao.leilao!.registros.length + (comLeilao.leilao!.indicioSinistro ? 1 : 0)).toBeGreaterThan(0)
    // Same VIN as the vehicle history fixture (another VIN would hide that part from the page).
    const chassiHist = { consulta: { response: { chassi: '9XXHV00000X000001' } } }
    comPedido({}, { ...chassiHist, historicoVeicular: comLeilao })
    expect(await leilaoParceiroComoReserva(sb, 'p1', deps(httpCom(() => resp(200, REAL)), { cfg: cfgHist(), avisarLeilao: avisarReal }))).toBe('ok')
    expect(snapDe().historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true })
    expect(enviados).toHaveLength(0)
    expect(sb.tab('pedidos_premium')[0].aviso_leilao_em ?? null).toBeNull()
    // Partial answer with nothing on the page: the auction found now is news.
    sb = supabaseMemoria()
    const semNada = historicoDe(HIST_SEM, { e5Success: false })
    expect(semNada.leilao!.registros).toHaveLength(0)
    expect(semNada.leilao!.indicioSinistro).toBe(false)
    comPedido({}, { consulta: { response: { chassi: '9XXHV00000X000002' } }, historicoVeicular: semNada })
    expect(await leilaoParceiroComoReserva(sb, 'p1', deps(httpCom(() => resp(200, REAL)), { cfg: cfgHist(), avisarLeilao: avisarReal }))).toBe('ok')
    expect(enviados).toHaveLength(1)
  })

  it('item 5: the safety net takes the most recently exhausted jobs first', async () => {
    const n = PARCEIRO_MAX_POR_RODADA + 2
    for (let i = 0; i < n; i++) {
      comPedido({}, {}, `p${i}`)
      sb.tab('premium_jobs').push({ id: `j${i}`, pedido_id: `p${i}`, fonte: 'historico_veicular', status: 'esgotado', concluido_em: new Date(AGORA - (40 - i) * 60_000).toISOString() })
    }
    await rodarJobParceiro({ sb, cfg: cfgHist(), http: httpCom(() => resp(200, REAL)), alertar, agora: AGORA, log: () => {}, dono: 'c1', avisarLeilao: async () => {} })
    const tentados = Array.from({ length: n }, (_, i) => `p${i}`).filter((id) => snapDe(id).historicoLeilao.parceiro)
    expect(tentados).toEqual(Array.from({ length: PARCEIRO_MAX_POR_RODADA }, (_, i) => `p${i + 2}`))
  })

  it('item 6: a body that never ends is cut by the deadline (call and login), nothing charged', async () => {
    const corpoInfinito: Http = async (url) => {
      chamadas.push(url)
      if (url.endsWith('/api/Auth/login')) return resp(200, { token: 'jwt' }) as any
      return { status: 200, text: () => new Promise<string>(() => {}) } as any
    }
    const t0 = Date.now()
    const c = await chamarParceiro(cfgHist(), 'ABC1D23', 'placa', corpoInfinito, AGORA, Date.now() + 60)
    expect(Date.now() - t0).toBeLessThan(2000)
    expect(c).toMatchObject({ http: null, resposta: null })
    expect(c.erro).toMatch(/^timeout/)
    _limparTokenParceiro()
    const loginInfinito: Http = async () => ({ status: 200, text: () => new Promise<string>(() => {}) }) as any
    const l = await chamarParceiro(cfgHist(), 'ABC1D23', 'placa', loginInfinito, AGORA, Date.now() + 60)
    expect(l.erro).toMatch(/^timeout/)
    expect(Date.now() - t0).toBeLessThan(4000)
  })

  it('item 6: all the calls of one order end before the lock lease: no VIN attempt without time left', async () => {
    const pendurado: Http = async (url) => {
      chamadas.push(url)
      if (url.endsWith('/api/Auth/login')) return resp(200, { token: 'jwt' }) as any
      return new Promise(() => {}) as any
    }
    const t0 = Date.now()
    const h = await complementarLeilaoParceiro(pedido(), vazio(), { chassi: CHASSI }, deps(pendurado, { prazoTotalMs: 80 }))
    expect(Date.now() - t0).toBeLessThan(2000)
    expect(h.parceiro.status).toBe('falhou')
    // Only the plate was attempted: the VIN would start with no time left.
    expect(linhas().map((l) => l.tipo_parametro)).toEqual(['placa'])
    expect(linhas()[0]).toMatchObject({ cobrada: false, http_status: null })
    expect(custos()[0]).toMatchObject({ preco: 0 })
  })

  it('retry job (review 2, S2): compares the page views, so a partial answer that already showed the auction sends no e-mail', async () => {
    const linhaReserva = (id: string, placa: string, chassi: string, hv: any) => ({
      id, placa, plano: 'completa', status: 'entregue', email: 'c@x.com', token_entrega: 'TOK', entregue_em: new Date(AGORA - 3600_000).toISOString(),
      relatorio_snapshot: { consulta: { response: { chassi } }, historicoLeilao: { ...vazio(), parceiro: { status: 'falhou', reserva: true } }, historicoVeicular: hv },
    })
    // Partial answer whose auction part was already on the page (its own VIN, so it is shown).
    const comLeilao = historicoDe(HIST_COM, { infosinistrosSuccess: false })
    expect(comLeilao.leilao!.registros.length).toBeGreaterThan(0)
    sb.tab('pedidos_premium').push(linhaReserva('ja-mostrava', 'ABC1D23', '9XXHV00000X000001', comLeilao))
    const { fake } = sbJob(sb)
    const r = await rodarJobParceiro({ sb: fake, cfg: cfgHist(), http: httpCom(() => resp(200, REAL)), alertar, agora: AGORA, log: () => {}, dono: 'c1', avisarLeilao: avisarReal })
    expect(r).toMatchObject({ vistos: 1, completados: 1 })
    expect(snapDe('ja-mostrava').historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true })
    // Compared raw (the stored auction section was empty), this would be an e-mail.
    expect(enviados).toHaveLength(0)
    expect(sb.tab('pedidos_premium')[0].aviso_leilao_em ?? null).toBeNull()
    // Partial answer with nothing on the page: the auction is news, one e-mail.
    sb = supabaseMemoria()
    _limparTokenParceiro()
    sb.tab('pedidos_premium').push(linhaReserva('nada', 'QWE1R23', '9XXHV00000X000002', historicoDe(HIST_SEM, { e5Success: false })))
    const { fake: f2 } = sbJob(sb)
    await rodarJobParceiro({ sb: f2, cfg: cfgHist(), http: httpCom(() => resp(200, REAL)), alertar, agora: AGORA, log: () => {}, dono: 'c1', avisarLeilao: avisarReal })
    expect(enviados).toHaveLength(1)
  })

  it('a read of the order that fails: logged with the internal id and a flag only, "erro" for the queue', async () => {
    const logs: string[] = []
    const quebrado: any = { ...sb, from: (t: string) => (t === 'pedidos_premium'
      ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'conexao caiu' } }) }) }) }
      : sb.from(t)) }
    const r = await leilaoParceiroComoReserva(quebrado, '0123456789abcdef', deps(httpCom(() => resp(200, REAL)), { cfg: cfgHist(), log: (m: string) => logs.push(m) }))
    expect(r).toBe('erro')
    expect(chamadas).toHaveLength(0)
    expect(logs).toEqual(['[parceiro-leilao] reserva do historico pedido=01234567: pulado (leitura falhou)'])
  })
})
