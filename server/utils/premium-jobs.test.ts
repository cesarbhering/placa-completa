// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fontesAplicaveis, criarJobsDaEntrega, executarJob, verificarFechamento, rodarLote, _resetarLote } from './premium-jobs'
import { _resetarEmVoo, quantasEmVoo } from './tarefas-em-voo'

const RESP = [{ ufJurisdicao: 'AL', renavam: '1', indicadorRecall: true, descricaoMarcaModelo: 'FORD/FUSION', chassi: '3FA6P0H71FR000000' }]

function sbFalso(o: { snap?: any; snapDepois?: any; jobs?: any[]; aviso?: string | null; avisoLeilao?: string | null } = {}) {
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
          return { data: { id: 'p', placa: 'ORK8004', token_entrega: 'TOK', email: 'c@x.com', consulta_id: null, relatorio_snapshot: lidas > 1 && o.snapDepois ? o.snapDepois : o.snap, aviso_completo_em: estado.aviso, aviso_leilao_em: o.avisoLeilao ?? null } }
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

  it('Basica: so o recall vira job, DETRAN fica de fora (Cesar, 25/out)', async () => {
    const { cliente, ops } = sbFalso()
    const n = await criarJobsDaEntrega(cliente, 'p', RESP, Date.UTC(2026, 9, 14, 18), 'basica')
    expect(n).toBe(1)
    expect(ops[0].upsert).toEqual([{ pedido_id: 'p', fonte: 'recall', proxima_em: '2026-10-14T18:05:00.000Z' }])
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

  it('vehicle history partner: a slow source only when on, and only in the Completa plan', async () => {
    expect(fontesAplicaveis(RESP, { historicoVeicular: true }).map((f) => f.fonte)).toEqual(['detran', 'recall', 'historico_veicular'])
    expect(fontesAplicaveis(RESP, { historicoVeicular: true }).at(-1)).toEqual({ fonte: 'historico_veicular', rotulo: 'Donos, leilão e sinistro' })
    expect(fontesAplicaveis(RESP).map((f) => f.fonte)).not.toContain('historico_veicular')
    const a = sbFalso()
    expect(await criarJobsDaEntrega(a.cliente, 'p', RESP, Date.UTC(2026, 9, 14, 18), 'completa', { historicoVeicular: true })).toBe(3)
    expect(a.ops[0].upsert.map((j: any) => j.fonte)).toEqual(['detran', 'recall', 'historico_veicular'])
    const b = sbFalso()
    expect(await criarJobsDaEntrega(b.cliente, 'p', RESP, Date.UTC(2026, 9, 14, 18), 'basica', { historicoVeicular: true })).toBe(1)
    expect(b.ops[0].upsert.map((j: any) => j.fonte)).toEqual(['recall'])
  })

  it('vehicle history executor: block brought by the queue = ok 200; switch off = closes without calling', async () => {
    const snap = { consulta: { response: RESP } }
    const a = sbFalso({ snap, snapDepois: { ...snap, historicoVeicular: { status: 'ok', completa: true } } })
    const historico = vi.fn(async () => ({ ok: true, status: 'ok' as const, code: 200 }))
    expect(await executarJob(a.cliente, { id: 'j', pedido_id: 'p', fonte: 'historico_veicular' }, { historico })).toEqual({ status: 'ok', code: 200 })
    expect((historico.mock.calls[0] as any)[1]).toMatchObject({ id: 'p' })
    const b = sbFalso({ snap })
    expect(await executarJob(b.cliente, { id: 'j', pedido_id: 'p', fonte: 'historico_veicular' }, { historico: async () => ({ ok: false, status: 'falhou' as const, code: 503, erro: 'HTTP 503' }) }))
      .toEqual({ status: 'falha', code: 503, erro: 'HTTP 503' })
    const c = sbFalso({ snap })
    expect(await executarJob(c.cliente, { id: 'j', pedido_id: 'p', fonte: 'historico_veicular' }, { historico: async () => ({ ok: false, pulado: 'desligado' }) }))
      .toEqual({ status: 'sem_dado', code: null, erro: 'desligado' })
    // Another VIN than the vehicle's: closes without "new data" (no updated e-mail).
    const e = sbFalso({ snap })
    expect(await executarJob(e.cliente, { id: 'j', pedido_id: 'p', fonte: 'historico_veicular' }, { historico: async () => ({ ok: false, status: 'divergente' as const }) }))
      .toEqual({ status: 'sem_dado', code: null, erro: 'chassi da base parceira diferente' })
    const d = sbFalso({ snap: { ...snap, historicoVeicular: { status: 'ok', completa: true } } })
    const nunca = vi.fn()
    expect(await executarJob(d.cliente, { id: 'j', pedido_id: 'p', fonte: 'historico_veicular' }, { historico: nunca as any })).toEqual({ status: 'ok', code: 0 })
    expect(nunca).not.toHaveBeenCalled()
  })

  it('closing e-mail names the vehicle history among the sources that arrived late', async () => {
    const jobs = [{ fonte: 'historico_veicular', status: 'ok', ultimo_code: 200 }]
    const { cliente } = sbFalso({ jobs, snap: { consulta: { response: RESP }, historicoVeicular: { status: 'ok', completa: true } } })
    const enviarEmail = vi.fn(async () => true)
    expect(await verificarFechamento(cliente, 'p', { enviarEmail })).toBe(true)
    expect((enviarEmail.mock.calls[0] as any)[0]).toMatchObject({ fonte: 'histórico de donos, leilão e sinistro', itens: [] })
  })

  // Cesar, 17/11/2026: no good answer after the LAST queue attempt makes the
  // auction partner the fallback; earlier attempts do not (the queue may still bring it).
  it('vehicle history: only the last failed attempt calls the auction partner fallback, before the closing check', async () => {
    const snap = { consulta: { response: RESP } }
    const falha = async () => ({ ok: false, status: 'falhou' as const, code: 504, erro: 'HTTP 504' })
    const reservaLeilao = vi.fn(async () => 'ok')
    for (const tentativas of [0, 1, 2]) {
      const a = sbFalso({ snap })
      expect(await executarJob(a.cliente, { id: 'j', pedido_id: 'p', fonte: 'historico_veicular', tentativas, max_tentativas: 4 }, { historico: falha, reservaLeilao }))
        .toEqual({ status: 'falha', code: 504, erro: 'HTTP 504' })
    }
    expect(reservaLeilao).not.toHaveBeenCalled()
    const b = sbFalso({ snap })
    expect(await executarJob(b.cliente, { id: 'j', pedido_id: 'p', fonte: 'historico_veicular', tentativas: 3, max_tentativas: 4 }, { historico: falha, reservaLeilao }))
      .toEqual({ status: 'falha', code: 504, erro: 'HTTP 504' })
    expect(reservaLeilao).toHaveBeenCalledOnce()
    expect((reservaLeilao.mock.calls[0] as any)[1]).toBe('p')
    // Daily ceiling of the vehicle history on the last attempt: the same.
    const c = sbFalso({ snap })
    await executarJob(c.cliente, { id: 'j', pedido_id: 'p', fonte: 'historico_veicular', tentativas: 3, max_tentativas: 4 }, { historico: async () => ({ ok: false, status: 'teto' as const, code: null }), reservaLeilao })
    expect(reservaLeilao).toHaveBeenCalledTimes(2)
    // The last attempt brought it, or the switch is off: no fallback. Another
    // VIN: its fallback runs inside completarHistoricoVeicular, not here.
    const d = sbFalso({ snap, snapDepois: { ...snap, historicoVeicular: { status: 'ok', completa: true } } })
    expect((await executarJob(d.cliente, { id: 'j', pedido_id: 'p', fonte: 'historico_veicular', tentativas: 3, max_tentativas: 4 }, { historico: async () => ({ ok: true, status: 'ok' as const, code: 200 }), reservaLeilao })).status).toBe('ok')
    const e = sbFalso({ snap })
    await executarJob(e.cliente, { id: 'j', pedido_id: 'p', fonte: 'historico_veicular', tentativas: 3, max_tentativas: 4 }, { historico: async () => ({ ok: false, pulado: 'desligado' }), reservaLeilao })
    await executarJob(e.cliente, { id: 'j', pedido_id: 'p', fonte: 'historico_veicular', tentativas: 3, max_tentativas: 4 }, { historico: async () => ({ ok: false, status: 'divergente' as const }), reservaLeilao })
    expect(reservaLeilao).toHaveBeenCalledTimes(2)
  })

  // Review 1 of PR #758, item 1: the vehicle history is concluded with a final
  // answer that failed the order (partial, another VIN) but its fallback never
  // ran (the step after the delivery did not finish): the queue covers it.
  it('vehicle history concluded with a partial or other-VIN answer and no fallback yet: the queue runs it, once', async () => {
    const reservaLeilao = vi.fn(async () => 'ok')
    const parcial = { consulta: { response: RESP }, historicoVeicular: { status: 'ok', completa: false, faltas: ['sinistros'], donos: { total: 3 } }, historicoLeilao: { passagens: [] } }
    for (const tentativas of [0, 3]) {
      expect(await executarJob(sbFalso({ snap: parcial }).cliente, { id: 'j', pedido_id: 'p', fonte: 'historico_veicular', tentativas, max_tentativas: 4 }, { reservaLeilao }))
        .toEqual({ status: 'ok', code: 0 })
    }
    expect(reservaLeilao).toHaveBeenCalledTimes(2)
    expect((reservaLeilao.mock.calls[0] as any)[1]).toBe('p')
    // Another VIN: the same.
    const divergente = { consulta: { response: RESP }, historicoVeicular: { status: 'divergente', consultadoEm: null }, historicoLeilao: { passagens: [] } }
    await executarJob(sbFalso({ snap: divergente }).cliente, { id: 'j', pedido_id: 'p', fonte: 'historico_veicular' }, { reservaLeilao })
    expect(reservaLeilao).toHaveBeenCalledTimes(3)
    // Already has a partner state (the fallback ran): nothing. Complete answer: nothing.
    const jaRodou = { ...parcial, historicoLeilao: { passagens: [], parceiro: { status: 'falhou', reserva: true } } }
    expect(await executarJob(sbFalso({ snap: jaRodou }).cliente, { id: 'j', pedido_id: 'p', fonte: 'historico_veicular' }, { reservaLeilao })).toEqual({ status: 'ok', code: 0 })
    const completo = { ...parcial, historicoVeicular: { status: 'ok', completa: true, donos: { total: 3 } } }
    expect(await executarJob(sbFalso({ snap: completo }).cliente, { id: 'j', pedido_id: 'p', fonte: 'historico_veicular' }, { reservaLeilao })).toEqual({ status: 'ok', code: 0 })
    expect(reservaLeilao).toHaveBeenCalledTimes(3)
    // Other sources concluded: never the fallback.
    await executarJob(sbFalso({ snap: { ...parcial, multas: { status: 'ok', fonte: 'detran_al' } } }).cliente, { id: 'j', pedido_id: 'p', fonte: 'detran' }, { reservaLeilao })
    expect(reservaLeilao).toHaveBeenCalledTimes(3)
  })

  it('vehicle history concluded, fallback could not read the order: the job fails so the queue tries again', async () => {
    const parcial = { consulta: { response: RESP }, historicoVeicular: { status: 'ok', completa: false, donos: null }, historicoLeilao: { passagens: [] } }
    const r = await executarJob(sbFalso({ snap: parcial }).cliente, { id: 'j', pedido_id: 'p', fonte: 'historico_veicular' }, { reservaLeilao: async () => 'erro' })
    expect(r).toMatchObject({ status: 'falha', code: null })
  })

  it('closing e-mail: the vehicle history leaves it when its fallback already sent the late auction notice (one e-mail, not two)', async () => {
    const snapReserva = { consulta: { response: RESP }, historicoVeicular: { status: 'ok', completa: false }, historicoLeilao: { passagens: [{}], parceiro: { status: 'ok', reserva: true } } }
    const so = [{ fonte: 'historico_veicular', status: 'ok', ultimo_code: 200 }]
    const enviarEmail = vi.fn(async () => true)
    expect(await verificarFechamento(sbFalso({ jobs: so, snap: snapReserva, avisoLeilao: '2026-11-17T21:00:00Z' }).cliente, 'p', { enviarEmail })).toBe(false)
    expect(enviarEmail).not.toHaveBeenCalled()
    // Another source also came by the queue: its e-mail goes, without the vehicle history label.
    const comDetran = [...so, { fonte: 'detran', status: 'ok', ultimo_code: 200 }]
    expect(await verificarFechamento(sbFalso({ jobs: comDetran, snap: { ...snapReserva, multas: { status: 'ok' } }, avisoLeilao: '2026-11-17T21:00:00Z' }).cliente, 'p', { enviarEmail })).toBe(true)
    expect((enviarEmail.mock.calls[0] as any)[0]).toMatchObject({ fonte: 'DETRAN-AL' })
    // No late notice (the fallback found nothing): the vehicle history e-mail goes as before.
    enviarEmail.mockClear()
    expect(await verificarFechamento(sbFalso({ jobs: so, snap: snapReserva }).cliente, 'p', { enviarEmail })).toBe(true)
    expect((enviarEmail.mock.calls[0] as any)[0]).toMatchObject({ fonte: 'histórico de donos, leilão e sinistro' })
    // A late notice that did not come from the fallback does not hide the vehicle history.
    enviarEmail.mockClear()
    const semReserva = { ...snapReserva, historicoLeilao: { passagens: [{}], parceiro: { status: 'ok' } } }
    expect(await verificarFechamento(sbFalso({ jobs: so, snap: semReserva, avisoLeilao: '2026-11-17T21:00:00Z' }).cliente, 'p', { enviarEmail })).toBe(true)
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
