// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { compraDoApp, partesCitadasProntas, varrerAppCompletos, JANELA_AVISO_MS } from './aviso-app-completo'
import { verificarFechamento } from './premium-jobs'
import { _resetarEmVoo, marcarEncerrando } from './tarefas-em-voo'

// App purchases get one "report complete" e-mail once no queue job is pending
// or running (Cesar, 24/11/2026). All data here is fictitious.

type Linha = Record<string, any>

const AGORA = Date.parse('2026-11-24T18:00:00.000Z')
const ha = (min: number) => new Date(AGORA - min * 60_000).toISOString()
const MARCA = new Date(AGORA).toISOString()

/**
 * In-memory Supabase with the calls these flows make. Each call resolves on a
 * later macrotask and a conditional update checks and writes in one step, so
 * two flows started together interleave like two containers on one database.
 */
function bancoFalso(tabelas: { pedidos_premium?: Linha[]; premium_jobs?: Linha[] } = {}) {
  const db: Record<string, Linha[]> = {
    pedidos_premium: (tabelas.pedidos_premium ?? []).map((l) => ({ ...l })),
    premium_jobs: (tabelas.premium_jobs ?? []).map((l) => ({ ...l })),
  }
  const from = vi.fn((tabela: string) => {
    const filtros: ((l: Linha) => boolean)[] = []
    let valores: Linha | null = null
    let ordem: { col: string; asc: boolean } | null = null
    let limite: number | null = null
    // Aliased JSON paths (alias:col->a->>b), as PostgREST answers them.
    let campos: { alias: string; caminho: string[]; texto: boolean }[] | null = null
    const projetar = (l: Linha) => {
      if (!campos) return { ...l }
      const out: Linha = {}
      for (const c of campos) {
        let v: any = l
        for (const k of c.caminho) v = v == null ? null : v[k]
        out[c.alias] = v == null ? null : c.texto ? String(v) : v
      }
      return out
    }
    const executar = () => {
      const linhas = db[tabela] ?? (db[tabela] = [])
      let alvo = linhas.filter((l) => filtros.every((f) => f(l)))
      if (valores) {
        for (const l of alvo) Object.assign(l, valores)
        return { data: alvo.map((l) => ({ ...l })), error: null }
      }
      if (ordem) {
        const { col, asc } = ordem
        alvo = [...alvo].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1))
      }
      if (limite != null) alvo = alvo.slice(0, limite)
      return { data: alvo.map(projetar), error: null }
    }
    const depois = () => new Promise((r) => setTimeout(r, 0))
    const b: any = {
      select: (cols?: string) => {
        if (cols && cols.includes(':')) {
          campos = cols.split(',').map((c) => c.trim()).filter(Boolean).map((c) => {
            const [alias, expr] = c.includes(':') ? c.split(':') : [c, c]
            return { alias, caminho: expr.split(/->>?/), texto: expr.includes('->>') }
          })
        }
        return b
      },
      eq: (c: string, v: any) => { filtros.push((l) => (l[c] ?? null) === v); return b },
      is: (c: string, v: any) => { filtros.push((l) => (l[c] ?? null) === v); return b },
      not: (c: string, op: string, v: any) => {
        if (op !== 'is' || v !== null) throw new Error(`fake: not(${c}, ${op}) sem suporte`)
        filtros.push((l) => (l[c] ?? null) !== null)
        return b
      },
      in: (c: string, vs: any[]) => { filtros.push((l) => vs.includes(l[c])); return b },
      gte: (c: string, v: string) => { filtros.push((l) => l[c] != null && l[c] >= v); return b },
      lte: (c: string, v: string) => { filtros.push((l) => l[c] != null && l[c] <= v); return b },
      or: (expr: string) => {
        const partes = expr.split(',').map((p) => { const [c, op, ...v] = p.split('.'); return { c, op, v: v.join('.') } })
        if (partes.some((p) => p.op !== 'eq')) throw new Error(`fake: or(${expr}) sem suporte`)
        filtros.push((l) => partes.some((p) => String(l[p.c] ?? '') === p.v))
        return b
      },
      order: (col: string, o?: { ascending?: boolean }) => { ordem = { col, asc: o?.ascending !== false }; return b },
      limit: (n: number) => { limite = n; return b },
      update: (v: Linha) => { valores = v; return b },
      maybeSingle: () => depois().then(() => ({ data: executar().data[0] ?? null, error: null })),
      then: (res: any, rej: any) => depois().then(executar).then(res, rej),
    }
    return b
  })
  return { cliente: { from, rpc: vi.fn() }, db }
}

function pedidoApp(over: Linha = {}): Linha {
  return {
    id: 'pedido-app-1', placa: 'ABC1D23', plano: 'completa', status: 'entregue',
    email: 'cliente@exemplo.com', token_entrega: 'TOKFICTICIO1',
    canal: 'app', forma_pagamento: 'google_play', pix_provider: 'google_play',
    aviso_completo_em: null, entregue_em: ha(30), snapshot_em: ha(30),
    relatorio_snapshot: {
      consulta: { response: [{ ufJurisdicao: 'SP' }] },
      multas: { status: 'ok', fonte: 'detran_sp' },
      historicoVeicular: { status: 'ok', completa: true, donos: { total: 2 } },
    },
    ...over,
  }
}

function job(over: Linha = {}): Linha {
  return { id: 'job-1', pedido_id: 'pedido-app-1', fonte: 'detran', status: 'ok', ultimo_code: 0, concluido_em: ha(10), ...over }
}

const enviou = () => vi.fn(async (_a: { email: string; token: string; placa: string; pedidoId: string; partesProntas: boolean }) => true)

describe('app purchase: report complete e-mail', () => {
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { vi.restoreAllMocks(); _resetarEmVoo() })

  it('tells an app purchase from a site purchase', () => {
    expect(compraDoApp({ canal: 'app', forma_pagamento: 'pix' })).toBe(true)
    // Born from the store notification: no user agent, so no canal.
    expect(compraDoApp({ canal: null, forma_pagamento: 'google_play' })).toBe(true)
    expect(compraDoApp({ canal: null, forma_pagamento: null, pix_provider: 'google_play' })).toBe(true)
    expect(compraDoApp({ canal: 'web', forma_pagamento: 'pix' })).toBe(false)
    expect(compraDoApp({ canal: null, forma_pagamento: 'cartao' })).toBe(false)
  })

  it('complete at delivery (no queue job): one e-mail with the report link, once the delivery wait is over', async () => {
    const { cliente, db } = bancoFalso({ pedidos_premium: [pedidoApp({ entregue_em: ha(2), snapshot_em: ha(2) })] })
    const enviar = enviou()
    // Two minutes after the delivery the queue jobs may not exist yet: wait.
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(enviar).not.toHaveBeenCalled()
    Object.assign(db.pedidos_premium[0], { entregue_em: ha(6), snapshot_em: ha(6) })
    expect(await varrerAppCompletos(cliente, { enviar, agora: AGORA })).toMatchObject({ enviados: 1 })
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(enviar.mock.calls[0][0]).toEqual({ email: 'cliente@exemplo.com', token: 'TOKFICTICIO1', placa: 'ABC1D23', pedidoId: 'pedido-app-1', partesProntas: true })
    expect(db.pedidos_premium[0].aviso_completo_em).toBe(MARCA)
    // Next passes: already told.
    await varrerAppCompletos(cliente, { enviar, agora: AGORA + 60_000 })
    expect(enviar).toHaveBeenCalledTimes(1)
  })

  it('complete through the queue with no new data (the sources came by the normal path): one e-mail', async () => {
    const { cliente, db } = bancoFalso({
      pedidos_premium: [pedidoApp()],
      premium_jobs: [job({ concluido_em: ha(6) }), job({ id: 'job-2', fonte: 'historico_veicular', concluido_em: ha(4) })],
    })
    const enviar = enviou()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(db.pedidos_premium[0].aviso_completo_em).toBe(MARCA)
  })

  it('a job still pending or running: no e-mail; it goes on the first pass after the last job closes', async () => {
    const { cliente, db } = bancoFalso({
      pedidos_premium: [pedidoApp()],
      premium_jobs: [job(), job({ id: 'job-2', fonte: 'historico_veicular', status: 'rodando', ultimo_code: null, concluido_em: null })],
    })
    const enviar = enviou()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    db.premium_jobs[1].status = 'pendente'
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(enviar).not.toHaveBeenCalled()
    expect(db.pedidos_premium[0].aviso_completo_em).toBeNull()
    // Exhausted counts as closed: the queue will not try again.
    Object.assign(db.premium_jobs[1], { status: 'esgotado', concluido_em: ha(3) })
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(enviar).toHaveBeenCalledTimes(1)
  })

  it('complete through the queue with new data: the queue\'s own "report updated" e-mail goes, and no second e-mail', async () => {
    const { cliente, db } = bancoFalso({
      pedidos_premium: [pedidoApp()],
      premium_jobs: [job({ ultimo_code: 200, concluido_em: new Date(AGORA - 20_000).toISOString() })],
    })
    const enviar = enviou()
    const atualizado = vi.fn(async () => true)
    // The last job just closed: the closing check of the queue and a sweep run together.
    await Promise.all([
      verificarFechamento(cliente, 'pedido-app-1', { enviarEmail: atualizado }),
      varrerAppCompletos(cliente, { enviar, agora: AGORA }),
    ])
    expect(atualizado).toHaveBeenCalledTimes(1)
    expect(enviar).not.toHaveBeenCalled()
    expect(db.pedidos_premium[0].aviso_completo_em).not.toBeNull()
    // Later passes: the "updated" e-mail already counts as the one e-mail.
    await varrerAppCompletos(cliente, { enviar, agora: AGORA + 10 * 60_000 })
    expect(enviar).not.toHaveBeenCalled()
  })

  it('the "report updated" e-mail already went out (aviso_completo_em set): no e-mail', async () => {
    const { cliente } = bancoFalso({ pedidos_premium: [pedidoApp({ aviso_completo_em: ha(8) })], premium_jobs: [job()] })
    const enviar = enviou()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(enviar).not.toHaveBeenCalled()
  })

  it('app order without an e-mail: no e-mail, nothing stamped, nothing thrown', async () => {
    const { cliente, db } = bancoFalso({
      pedidos_premium: [
        pedidoApp({ email: null }),
        pedidoApp({ id: 'pedido-app-2', token_entrega: 'TOKFICTICIO2', email: '' }),
        pedidoApp({ id: 'pedido-app-3', token_entrega: 'TOKFICTICIO3', email: 'sem-arroba' }),
      ],
    })
    const enviar = enviou()
    await expect(varrerAppCompletos(cliente, { enviar, agora: AGORA })).resolves.toMatchObject({ enviados: 0 })
    expect(enviar).not.toHaveBeenCalled()
    expect(db.pedidos_premium.map((p) => p.aviso_completo_em)).toEqual([null, null, null])
  })

  it('site order (canal web): the sweep leaves it alone, and the queue closing e-mail works as before', async () => {
    const web = { canal: 'web', forma_pagamento: 'pix', pix_provider: 'pix_ficticio' }
    const { cliente, db } = bancoFalso({
      pedidos_premium: [pedidoApp({ id: 'pedido-web-1', ...web }), pedidoApp({ id: 'pedido-web-2', token_entrega: 'TOKFICTICIO2', ...web })],
      premium_jobs: [job({ pedido_id: 'pedido-web-1' }), job({ id: 'job-2', pedido_id: 'pedido-web-2', ultimo_code: 200 })],
    })
    const enviar = enviou()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(enviar).not.toHaveBeenCalled()
    // No new data by the queue: no e-mail at all, as before.
    const atualizado = vi.fn(async () => true)
    expect(await verificarFechamento(cliente, 'pedido-web-1', { enviarEmail: atualizado })).toBe(false)
    // New data by the queue: the "updated" e-mail, as before.
    expect(await verificarFechamento(cliente, 'pedido-web-2', { enviarEmail: atualizado })).toBe(true)
    expect(atualizado).toHaveBeenCalledTimes(1)
    await varrerAppCompletos(cliente, { enviar, agora: AGORA + 10 * 60_000 })
    expect(enviar).not.toHaveBeenCalled()
    expect(db.pedidos_premium[0].aviso_completo_em).toBeNull()
  })

  it('Google Play order born from the store notification (no canal) and a Pix purchase inside the app: both get it', async () => {
    const { cliente } = bancoFalso({
      pedidos_premium: [
        pedidoApp({ canal: null }),
        pedidoApp({ id: 'pedido-app-2', token_entrega: 'TOKFICTICIO2', forma_pagamento: 'pix', pix_provider: 'pix_ficticio' }),
      ],
    })
    const enviar = enviou()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(enviar.mock.calls.map((c) => c[0].pedidoId).sort()).toEqual(['pedido-app-1', 'pedido-app-2'])
  })

  it('Basica bought in the app: no e-mail (the approved text names DETRAN and the vehicle history, which the Basica does not have)', async () => {
    const { cliente, db } = bancoFalso({ pedidos_premium: [pedidoApp({ plano: 'basica', forma_pagamento: 'pix', pix_provider: 'pix_ficticio' })] })
    const enviar = enviou()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(enviar).not.toHaveBeenCalled()
    expect(db.pedidos_premium[0].aviso_completo_em).toBeNull()
  })

  it('not delivered (refunded, failed) or no report yet: no e-mail', async () => {
    const { cliente } = bancoFalso({
      pedidos_premium: [
        pedidoApp({ status: 'reembolsado' }),
        pedidoApp({ id: 'pedido-app-2', token_entrega: 'TOKFICTICIO2', status: 'falha_google_play' }),
        pedidoApp({ id: 'pedido-app-3', token_entrega: 'TOKFICTICIO3', snapshot_em: null }),
      ],
    })
    const enviar = enviou()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(enviar).not.toHaveBeenCalled()
  })

  it('completed longer ago than the window: no e-mail (a deploy does not e-mail old orders, and retries stop)', async () => {
    const velho = AGORA - JANELA_AVISO_MS - 60_000
    const { cliente } = bancoFalso({
      pedidos_premium: [
        pedidoApp({ entregue_em: ha(300), snapshot_em: ha(300) }),
        pedidoApp({ id: 'pedido-app-2', token_entrega: 'TOKFICTICIO2', entregue_em: ha(300), snapshot_em: ha(300) }),
      ],
      premium_jobs: [job({ pedido_id: 'pedido-app-2', concluido_em: new Date(velho).toISOString() })],
    })
    const enviar = enviou()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(enviar).not.toHaveBeenCalled()
  })

  it('race: two passes at the same time, in two containers or in one, send one e-mail', async () => {
    const { cliente, db } = bancoFalso({ pedidos_premium: [pedidoApp()], premium_jobs: [job()] })
    const enviar = enviou()
    const outroContainer = await (async () => { vi.resetModules(); return import('./aviso-app-completo') })()
    expect(outroContainer.varrerAppCompletos).not.toBe(varrerAppCompletos)
    await Promise.all([
      varrerAppCompletos(cliente, { enviar, agora: AGORA }),
      outroContainer.varrerAppCompletos(cliente, { enviar, agora: AGORA }),
      varrerAppCompletos(cliente, { enviar, agora: AGORA }),
    ])
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(db.pedidos_premium[0].aviso_completo_em).toBe(MARCA)
  })

  it('send failure: the stamp is undone, the next timer pass sends it once, and a failure does not hold back the other orders', async () => {
    const { cliente, db } = bancoFalso({
      pedidos_premium: [pedidoApp(), pedidoApp({ id: 'pedido-app-2', token_entrega: 'TOKFICTICIO2', entregue_em: ha(25), snapshot_em: ha(25) })],
    })
    const falhasDe = new Set(['pedido-app-1'])
    const enviar = vi.fn(async (a: { pedidoId: string }) => !falhasDe.has(a.pedidoId))
    expect(await varrerAppCompletos(cliente, { enviar, agora: AGORA })).toMatchObject({ enviados: 1 })
    expect(db.pedidos_premium[0].aviso_completo_em).toBeNull()
    expect(db.pedidos_premium[1].aviso_completo_em).toBe(MARCA)
    falhasDe.clear()
    const proxima = AGORA + 60_000
    expect(await varrerAppCompletos(cliente, { enviar, agora: proxima })).toMatchObject({ enviados: 1 })
    expect(db.pedidos_premium[0].aviso_completo_em).toBe(new Date(proxima).toISOString())
    const tentativas = (id: string) => enviar.mock.calls.filter((c) => c[0].pedidoId === id).length
    expect([tentativas('pedido-app-1'), tentativas('pedido-app-2')]).toEqual([2, 1])
    await varrerAppCompletos(cliente, { enviar, agora: proxima + 60_000 })
    expect(enviar).toHaveBeenCalledTimes(3)
  })

  describe('first paragraph: the full sentence only when the DETRAN and the vehicle history are in the report', () => {
    const snap = (over: Linha) => ({ ...pedidoApp().relatorio_snapshot, ...over })
    async function partesDoEnvio(pedido: Linha, jobs: Linha[] = []) {
      const { cliente } = bancoFalso({ pedidos_premium: [pedido], premium_jobs: jobs })
      const enviar = enviou()
      await varrerAppCompletos(cliente, { enviar, agora: AGORA })
      expect(enviar).toHaveBeenCalledTimes(1)
      return enviar.mock.calls[0][0].partesProntas
    }

    it('normal case: both in the report, the full sentence', async () => {
      expect(await partesDoEnvio(pedidoApp(), [job(), job({ id: 'job-2', fonte: 'historico_veicular' })])).toBe(true)
    })

    it('state with no DETRAN coverage: the short sentence', async () => {
      const semDetran = snap({ consulta: { response: [{ ufJurisdicao: 'TO' }] }, multas: undefined })
      expect(await partesDoEnvio(pedidoApp({ relatorio_snapshot: semDetran }), [job({ fonte: 'historico_veicular' })])).toBe(false)
    })

    it('DETRAN job exhausted: the short sentence', async () => {
      const jobs = [job({ status: 'esgotado', ultimo_code: 609 }), job({ id: 'job-2', fonte: 'historico_veicular' })]
      expect(await partesDoEnvio(pedidoApp({ relatorio_snapshot: snap({ multas: { status: 'indisponivel' } }) }), jobs)).toBe(false)
    })

    it('vehicle history job exhausted: the short sentence', async () => {
      const jobs = [job(), job({ id: 'job-2', fonte: 'historico_veicular', status: 'esgotado', ultimo_code: 503 })]
      expect(await partesDoEnvio(pedidoApp({ relatorio_snapshot: snap({ historicoVeicular: { status: 'falhou' } }) }), jobs)).toBe(false)
    })

    it('decision table: DETRAN answered with no debts counts; protected data, a partial history or no history do not', () => {
      const historico = { status: 'ok', completa: true, donos: { total: 1 } }
      expect(partesCitadasProntas({ detranStatus: 'ok', historico, jobs: [] })).toBe(true)
      expect(partesCitadasProntas({ detranStatus: 'sem_debito', historico, jobs: [] })).toBe(true)
      expect(partesCitadasProntas({ detranStatus: 'protegido', historico, jobs: [] })).toBe(false)
      expect(partesCitadasProntas({ detranStatus: 'indisponivel', historico, jobs: [] })).toBe(false)
      expect(partesCitadasProntas({ detranStatus: null, historico, jobs: [] })).toBe(false)
      expect(partesCitadasProntas({ detranStatus: 'ok', historico: { status: 'ok', completa: false, faltas: ['sem donos'] }, jobs: [] })).toBe(false)
      expect(partesCitadasProntas({ detranStatus: 'ok', historico: { status: 'divergente' }, jobs: [] })).toBe(false)
      expect(partesCitadasProntas({ detranStatus: 'ok', historico: null, jobs: [] })).toBe(false)
      // An exhausted job of a cited part counts even if a block came later; other sources do not.
      expect(partesCitadasProntas({ detranStatus: 'ok', historico, jobs: [{ fonte: 'detran', status: 'esgotado' }] })).toBe(false)
      expect(partesCitadasProntas({ detranStatus: 'ok', historico, jobs: [{ fonte: 'recall', status: 'esgotado' }] })).toBe(true)
    })

    it('the report fields cannot be read: the short sentence, which is always true, and the e-mail still goes', async () => {
      const { cliente } = bancoFalso({ pedidos_premium: [pedidoApp()] })
      const original = cliente.from.getMockImplementation()!
      cliente.from.mockImplementation((tabela: string) => {
        const b = original(tabela)
        const select = b.select
        b.select = (cols?: string) => {
          if (cols?.includes('relatorio_snapshot->')) throw new Error('leitura ficticia falhou')
          return select(cols)
        }
        return b
      })
      const enviar = enviou()
      await varrerAppCompletos(cliente, { enviar, agora: AGORA })
      expect(enviar).toHaveBeenCalledTimes(1)
      expect(enviar.mock.calls[0][0].partesProntas).toBe(false)
    })
  })

  it('SIGTERM in the middle of a pass: no new order is stamped, so the new container sends the rest', async () => {
    const { cliente, db } = bancoFalso({
      pedidos_premium: [pedidoApp(), pedidoApp({ id: 'pedido-app-2', token_entrega: 'TOKFICTICIO2', entregue_em: ha(25), snapshot_em: ha(25) })],
    })
    const enviar = vi.fn(async () => { marcarEncerrando(); return true })
    expect(await varrerAppCompletos(cliente, { enviar, agora: AGORA })).toMatchObject({ enviados: 1 })
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(db.pedidos_premium.filter((p) => p.aviso_completo_em === null)).toHaveLength(1)
  })

  it('a send that throws counts as a failure (stamp undone) and never escapes the sweep', async () => {
    const { cliente, db } = bancoFalso({ pedidos_premium: [pedidoApp()] })
    const enviar = vi.fn(async () => { throw new Error('falha ficticia') })
    await expect(varrerAppCompletos(cliente, { enviar, agora: AGORA })).resolves.toMatchObject({ enviados: 0 })
    expect(db.pedidos_premium[0].aviso_completo_em).toBeNull()
    // A sender that throws before returning a promise: the same.
    const sincrono = vi.fn((): Promise<boolean> => { throw new Error('falha ficticia sincrona') })
    await expect(varrerAppCompletos(cliente, { enviar: sincrono, agora: AGORA })).resolves.toMatchObject({ enviados: 0 })
    expect(sincrono).toHaveBeenCalledTimes(1)
    expect(db.pedidos_premium[0].aviso_completo_em).toBeNull()
  })

  it('a database error ends the pass quietly', async () => {
    const quebrado = { from: () => { throw new Error('banco fora (ficticio)') }, rpc: vi.fn() }
    await expect(varrerAppCompletos(quebrado, { enviar: enviou(), agora: AGORA })).resolves.toMatchObject({ enviados: 0 })
    const comErro = { from: () => { const b: any = { then: (r: any) => Promise.resolve({ data: null, error: { message: 'timeout ficticio' } }).then(r) }; for (const m of ['select', 'eq', 'is', 'not', 'or', 'in', 'gte', 'lte', 'order', 'limit']) b[m] = () => b; return b }, rpc: vi.fn() }
    await expect(varrerAppCompletos(comErro, { enviar: enviou(), agora: AGORA })).resolves.toMatchObject({ enviados: 0 })
  })
})
