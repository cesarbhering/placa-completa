// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fontesAplicaveis, criarJobsDaEntrega, executarJob, verificarFechamento, rodarLote, _resetarLote } from './premium-jobs'
import { _resetarEmVoo, quantasEmVoo } from './tarefas-em-voo'

const RESP = [{ ufJurisdicao: 'AL', renavam: '1', indicadorRecall: true, descricaoMarcaModelo: 'FORD/FUSION', chassi: '3FA6P0H71FR000000' }]

function sbFalso(o: { snap?: any; snapDepois?: any; jobs?: any[]; aviso?: string | null } = {}) {
  let lidas = 0
  const ops: any[] = []
  const estado = { aviso: o.aviso ?? null as string | null }
  const builder = (tabela: string) => {
    const f: any = { tabela, upd: null, filtros: [] as any[] }
    const b: any = {
      select: () => b, eq: (c: string, v: any) => { f.filtros.push([c, v]); return b }, is: () => b,
      upsert: async (rows: any, opts: any) => { ops.push({ upsert: rows, opts }); return { error: null } },
      update: (row: any) => { f.upd = row; return b },
      maybeSingle: async () => {
        if (tabela === 'pedidos_premium' && f.filtros.length === 1 && !f.sel) {
          lidas++
          return { data: { id: 'p', placa: 'ORK8004', token_entrega: 'TOK', email: 'c@x.com', consulta_id: null, relatorio_snapshot: lidas > 1 && o.snapDepois ? o.snapDepois : o.snap, aviso_completo_em: estado.aviso } }
        }
        return { data: null }
      },
      then: (res: any, rej: any) => {
        let out: any = { data: null, error: null }
        if (tabela === 'premium_jobs') out = { data: o.jobs ?? [], error: null }
        if (tabela === 'pedidos_premium' && f.upd) {
          ops.push({ update: f.upd })
          if (f.upd.aviso_completo_em && !estado.aviso) { estado.aviso = f.upd.aviso_completo_em; out = { data: [{ id: 'p' }], error: null } }
          else if (f.upd.aviso_completo_em === null) { estado.aviso = null }
          else out = { data: [], error: null }
        }
        return Promise.resolve(out).then(res, rej)
      },
    }
    return b
  }
  return { cliente: { from: builder, rpc: vi.fn() }, ops, estado }
}

describe('fila premium_jobs', () => {
  beforeEach(() => { _resetarEmVoo(); _resetarLote() })

  it('fontes aplicaveis pela resposta do SENATRAN', () => {
    expect(fontesAplicaveis(RESP).map((f) => f.fonte)).toEqual(['detran', 'recall'])
    expect(fontesAplicaveis([{ ufJurisdicao: 'TO' }])).toEqual([])
  })

  it('na entrega: um job por fonte, a partir de entrega + 5 min, sem duplicar', async () => {
    const { cliente, ops } = sbFalso()
    const n = await criarJobsDaEntrega(cliente, 'p', RESP, Date.UTC(2026, 9, 14, 18))
    expect(n).toBe(2)
    expect(ops[0].upsert).toEqual([
      { pedido_id: 'p', fonte: 'detran', proxima_em: '2026-10-14T18:05:00.000Z' },
      { pedido_id: 'p', fonte: 'recall', proxima_em: '2026-10-14T18:05:00.000Z' },
    ])
    expect(ops[0].opts).toEqual({ onConflict: 'pedido_id,fonte', ignoreDuplicates: true })
  })

  it('executor idempotente: fonte ja chegou = ok code 0, sem chamar', async () => {
    const { cliente } = sbFalso({ snap: { consulta: { response: RESP }, multas: { status: 'ok', fonte: 'detran_al' } } })
    const detran = vi.fn()
    expect(await executarJob(cliente, { id: 'j', pedido_id: 'p', fonte: 'detran' }, { detran })).toEqual({ status: 'ok', code: 0 })
    expect(detran).not.toHaveBeenCalled()
  })

  it('executor: a fila trouxe o bloco = ok code 200; nao trouxe = falha; protegido = sem_dado', async () => {
    const snap = { consulta: { response: RESP }, multas: { status: 'indisponivel' } }
    const a = sbFalso({ snap, snapDepois: { ...snap, multas: { status: 'ok', fonte: 'detran_al' } } })
    const detran = vi.fn(async () => ({ ok: true, code: 200 }))
    expect(await executarJob(a.cliente, { id: 'j', pedido_id: 'p', fonte: 'detran' }, { detran: detran as any })).toEqual({ status: 'ok', code: 200 })
    expect((detran.mock.calls[0] as any)[2]).toMatchObject({ semRetry: true })
    const b = sbFalso({ snap })
    expect(await executarJob(b.cliente, { id: 'j', pedido_id: 'p', fonte: 'detran' }, { detran: (async () => ({ ok: false, code: 609, motivo: 'Tentativas excedidas' })) as any }))
      .toEqual({ status: 'falha', code: 609, erro: 'Tentativas excedidas' })
    const c = sbFalso({ snap })
    expect((await executarJob(c.cliente, { id: 'j', pedido_id: 'p', fonte: 'detran' }, { detran: (async () => ({ ok: false, code: 620, motivo: 'protegido pelo proprietario' })) as any })).status).toBe('sem_dado')
    expect((await executarJob(c.cliente, { id: 'j', pedido_id: 'p', fonte: 'leilao' })).erro).toBe('fonte sem executor')
  })

  it('fechamento: so com dado novo pela fila; UM e-mail, marca antes de enviar', async () => {
    const jobs = [{ fonte: 'detran', status: 'ok', ultimo_code: 200 }, { fonte: 'recall', status: 'esgotado', ultimo_code: null }]
    const bloco = { status: 'ok', fonte: 'detran_al', multas_total_centavos: 25780, ipva_total_centavos: 291263, licenciamento_atrasado_ano: 2020 }
    const { cliente } = sbFalso({ jobs, snap: { consulta: { response: RESP }, multas: bloco } })
    const enviarEmail = vi.fn(async () => true)
    expect(await verificarFechamento(cliente, 'p', { enviarEmail })).toBe(true)
    expect((enviarEmail.mock.calls[0] as any)[0]).toMatchObject({ email: 'c@x.com', token: 'TOK', placa: 'ORK8004', fonte: 'DETRAN-AL', itens: ['Multas em aberto: R$ 257,80', 'IPVA em aberto: R$ 2.912,63', 'Licenciamento atrasado desde 2020'] })
    // segunda vez: ja avisado
    expect(await verificarFechamento(cliente, 'p', { enviarEmail })).toBe(false)
    expect(enviarEmail).toHaveBeenCalledTimes(1)
  })

  it('fechamento: job aberto ou nada novo = sem e-mail', async () => {
    const enviarEmail = vi.fn(async () => true)
    expect(await verificarFechamento(sbFalso({ jobs: [{ fonte: 'detran', status: 'pendente' }] }).cliente, 'p', { enviarEmail })).toBe(false)
    expect(await verificarFechamento(sbFalso({ jobs: [{ fonte: 'detran', status: 'ok', ultimo_code: 0 }] }).cliente, 'p', { enviarEmail })).toBe(false)
    expect(enviarEmail).not.toHaveBeenCalled()
  })

  it('lote: reivindica pela RPC, executa em voo e grava o resultado; um lote por vez', async () => {
    const { cliente } = sbFalso({ snap: { consulta: { response: RESP }, multas: { status: 'ok', fonte: 'detran_al' } }, jobs: [{ fonte: 'detran', status: 'ok', ultimo_code: 0 }] })
    cliente.rpc.mockImplementation(async (nome: string) => nome === 'premium_jobs_reivindicar' ? { data: [{ id: 'j1', pedido_id: 'p', fonte: 'detran' }], error: null } : { data: null, error: null })
    const ids = await rodarLote(cliente, 5)
    expect(ids).toEqual(['j1'])
    expect(await rodarLote(cliente, 5)).toEqual([]) // lote em andamento
    await vi.waitFor(() => expect(quantasEmVoo()).toBe(0))
    expect(cliente.rpc).toHaveBeenCalledWith('premium_jobs_reivindicar', { p_limite: 5 })
    expect(cliente.rpc).toHaveBeenCalledWith('premium_jobs_resultado', { p_id: 'j1', p_status: 'ok', p_code: 0, p_erro: null })
  })
})
