import { describe, it, expect, vi, beforeEach } from 'vitest'
import REAL from './__fixtures__/parceiro-leilao-real.json'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'
import {
  complementarLeilaoParceiro, rodarJobParceiro, cfgParceiro, inicioDoDiaBrasilia, ehSaldoOuLimite,
  _limparTokenParceiro, _limparAlertaTeto, FONTE_CUSTO_PARCEIRO, type Http,
} from './parceiro-leilao'

// Regras do Cesar (20/out/2026): so Completa, so com a nossa base vazia, teto
// diario, cache que nao cobra, placa e depois chassi, uma linha por tentativa.
const AGORA = Date.parse('2026-10-20T19:00:00Z')
const CHASSI = '9XXAA00000X000001'
const cfg = (x: any = {}) => cfgParceiro({ avaliserviceLigado: 'on', avaliserviceUser: 'u', avaliservicePass: 'p', avaliserviceTetoDia: '40', ...x })
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
    expect(await complementarLeilaoParceiro(pedido(), vazio(), {}, deps(http, { cfg: cfg({ avaliserviceLigado: '' }) })).then((h: any) => h.parceiro)).toBeUndefined()
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
    expect(sb.tab('fonte_cache')[0]).toMatchObject({ fonte: 'avaliservice', chave: 'placa:ABC1D23' })
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
