// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { compraDoApp, partesCitadasProntas, varrerAppCompletos, JANELA_AVISO_MS, JANELA_CANDIDATOS_MS } from './aviso-app-completo'
import { RETENCAO_CHAVE_IDEMPOTENCIA_MS } from './premium-email'
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
    let selecionadas: string | null = null
    const colunasOr: string[] = []
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
        // PostgREST 12.2.3 to 14.3 applies the or filter again over the
        // returned row: an or column missing from the select is 42703, and
        // nothing is written (review of PR #793).
        const pedidas = selecionadas?.split(',').map((c) => c.trim())
        const falta = pedidas ? colunasOr.find((c) => !pedidas.includes(c)) : undefined
        if (falta) return { data: null, error: { code: '42703', message: `column ${falta} does not exist` } }
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
        selecionadas = cols ?? null
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
        const partes = expr.split(',').map((p) => { const [c, op, ...v] = p.split('.'); return { c, op, v: v.join('.').replace(/^"(.*)"$/, '$1') } })
        const vale = (l: Linha, p: { c: string; op: string; v: string }) => {
          if (p.op === 'eq') return String(l[p.c] ?? '') === p.v
          if (p.op === 'is' && p.v === 'null') return (l[p.c] ?? null) === null
          if (p.op === 'lt') return l[p.c] != null && Date.parse(l[p.c]) < Date.parse(p.v)
          throw new Error(`fake: or(${expr}) sem suporte`)
        }
        filtros.push((l) => partes.some((p) => vale(l, p)))
        colunasOr.push(...partes.map((p) => p.c))
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
    aviso_completo_em: null, aviso_app_completo_em: null, entregue_em: ha(30), snapshot_em: ha(30),
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
    expect(db.pedidos_premium[0].aviso_app_completo_em).toBe(MARCA)
    expect(db.pedidos_premium[0].aviso_completo_em).toBeNull()
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
    expect(db.pedidos_premium[0].aviso_app_completo_em).toBe(MARCA)
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
    expect(db.pedidos_premium[0].aviso_app_completo_em).toBeNull()
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
    expect(db.pedidos_premium.map((p) => p.aviso_app_completo_em)).toEqual([null, null, null])
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
    expect(db.pedidos_premium[0].aviso_app_completo_em).toBeNull()
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
    expect(db.pedidos_premium[0].aviso_app_completo_em).toBeNull()
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
    expect(db.pedidos_premium[0].aviso_app_completo_em).toBe(MARCA)
  })

  it('send failure: the stamp is undone, the next timer pass sends it once, and a failure does not hold back the other orders', async () => {
    const { cliente, db } = bancoFalso({
      pedidos_premium: [pedidoApp(), pedidoApp({ id: 'pedido-app-2', token_entrega: 'TOKFICTICIO2', entregue_em: ha(25), snapshot_em: ha(25) })],
    })
    const falhasDe = new Set(['pedido-app-1'])
    const enviar = vi.fn(async (a: { pedidoId: string }) => !falhasDe.has(a.pedidoId))
    expect(await varrerAppCompletos(cliente, { enviar, agora: AGORA })).toMatchObject({ enviados: 1 })
    expect(db.pedidos_premium[0].aviso_app_completo_em).toBeNull()
    expect(db.pedidos_premium[1].aviso_app_completo_em).toBe(MARCA)
    falhasDe.clear()
    const proxima = AGORA + 60_000
    expect(await varrerAppCompletos(cliente, { enviar, agora: proxima })).toMatchObject({ enviados: 1 })
    expect(db.pedidos_premium[0].aviso_app_completo_em).toBe(new Date(proxima).toISOString())
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
      const tabela = (detran: unknown, h: unknown = historico, jobs: any[] = []) => partesCitadasProntas({ detran, historico: h, jobs, agora: AGORA })
      expect(tabela({ status: 'ok', multas_total_centavos: 25780 })).toBe(true)
      expect(tabela({ status: 'ok', ipva_total_centavos: 0 })).toBe(true)
      expect(tabela({ status: 'sem_debito' })).toBe(true)
      // Plan B of SP: the report says the DETRAN-SP did not answer.
      expect(tabela({ status: 'ok', fonte: 'detran_sp', origem: 'sefaz_der', ipva_total_centavos: 291263 })).toBe(false)
      expect(tabela({ status: 'protegido' })).toBe(false)
      expect(tabela({ status: 'indisponivel' })).toBe(false)
      expect(tabela(null)).toBe(false)
      expect(tabela({ status: 'ok' }, { status: 'ok', completa: false, faltas: ['sem donos'] })).toBe(false)
      expect(tabela({ status: 'ok' }, { status: 'divergente' })).toBe(false)
      expect(tabela({ status: 'ok' }, null)).toBe(false)
      // An exhausted job of a cited part counts even if a block came later; other sources do not.
      expect(tabela({ status: 'ok' }, historico, [{ fonte: 'detran', status: 'esgotado' }])).toBe(false)
      expect(tabela({ status: 'ok' }, historico, [{ fonte: 'recall', status: 'esgotado' }])).toBe(true)
    })

    // Review of PR #793: the report's own rule (resumoQuitar) decides whether
    // the fines and debts came, not the block status alone.
    it('DETRAN-RJ (debts not available, with or without the fines of the nada consta): the short sentence', async () => {
      const rj = { status: 'ok', fonte: 'detran_rj', uf: 'RJ', multas_total_centavos: null, ipva_total_centavos: null, multas_itens: [], debitos_indisponiveis: true, aviso_debitos: 'Aviso ficticio do RJ.' }
      const rjNadaConsta = { ...rj, multas_fonte: 'detran_rj_nada_consta', multas_total_centavos: 0, aviso_debitos: 'Aviso ficticio do IPVA do RJ.' }
      for (const multas of [rj, rjNadaConsta]) {
        const snapRj = snap({ consulta: { response: [{ ufJurisdicao: 'RJ' }] }, multas })
        expect(await partesDoEnvio(pedidoApp({ relatorio_snapshot: snapRj }), [job(), job({ id: 'job-2', fonte: 'historico_veicular' })])).toBe(false)
      }
    })

    it('plan B of SP (debts from SEFAZ-SP and DER-SP, the DETRAN-SP did not answer): the short sentence', async () => {
      const planoB = { status: 'ok', fonte: 'detran_sp', uf: 'SP', origem: 'sefaz_der', ipva_total_centavos: 291263, multas_total_centavos: 0 }
      expect(await partesDoEnvio(pedidoApp({ relatorio_snapshot: snap({ multas: planoB }) }), [job(), job({ id: 'job-2', fonte: 'historico_veicular' })])).toBe(false)
    })

    it('IPVA with no value from SEFAZ (unavailable, or the pending mark expired or still running): the short sentence', async () => {
      const base = { status: 'ok', fonte: 'detran_mg', uf: 'MG', ipva_total_centavos: 0, multas_total_centavos: 0 }
      const casos = [
        { ...base, ipva_sefaz_indisponivel: true },
        { ...base, ipva_pendente_sefaz: true, ipva_pendente_sefaz_em: ha(60) },
        { ...base, ipva_pendente_sefaz: true, ipva_pendente_sefaz_em: ha(1) },
      ]
      for (const multas of casos) {
        expect(await partesDoEnvio(pedidoApp({ relatorio_snapshot: snap({ multas }) }), [job(), job({ id: 'job-2', fonte: 'historico_veicular' })])).toBe(false)
      }
      // The IPVA value came: the full sentence.
      const comValor = { ...base, ipva_total_centavos: 291263, ipva_pendente_sefaz: false }
      expect(await partesDoEnvio(pedidoApp({ relatorio_snapshot: snap({ multas: comValor }) }), [job(), job({ id: 'job-2', fonte: 'historico_veicular' })])).toBe(true)
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

  it('either stamp blocks it: the "report updated" one (aviso_completo_em) or its own (aviso_app_completo_em)', async () => {
    const { cliente } = bancoFalso({
      pedidos_premium: [pedidoApp({ aviso_completo_em: ha(8) }), pedidoApp({ id: 'pedido-app-2', token_entrega: 'TOKFICTICIO2', aviso_app_completo_em: ha(8) })],
    })
    const enviar = enviou()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(enviar).not.toHaveBeenCalled()
  })

  // Review of PR #793: a queue job reset by hand after the "complete" e-mail
  // must still give the "report updated" e-mail when it brings new data.
  it('manual job reset after the short "complete" e-mail: the reopened job brings new data and the "report updated" e-mail goes', async () => {
    const { cliente, db } = bancoFalso({
      pedidos_premium: [pedidoApp({ relatorio_snapshot: { ...pedidoApp().relatorio_snapshot, multas: { status: 'indisponivel' } } })],
      premium_jobs: [job({ status: 'esgotado', ultimo_code: 609 }), job({ id: 'job-2', fonte: 'historico_veicular' })],
    })
    const enviar = enviou()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(enviar.mock.calls[0][0].partesProntas).toBe(false)
    // The job is reset by hand and runs again: nothing from the sweep meanwhile.
    Object.assign(db.premium_jobs[0], { status: 'pendente', concluido_em: null })
    await varrerAppCompletos(cliente, { enviar, agora: AGORA + 60_000 })
    Object.assign(db.premium_jobs[0], { status: 'ok', ultimo_code: 200, concluido_em: new Date(AGORA + 120_000).toISOString() })
    Object.assign(db.pedidos_premium[0].relatorio_snapshot, { multas: { status: 'ok', fonte: 'detran_sp' } })
    const atualizado = vi.fn(async () => true)
    expect(await verificarFechamento(cliente, 'pedido-app-1', { enviarEmail: atualizado })).toBe(true)
    expect(atualizado).toHaveBeenCalledTimes(1)
    await varrerAppCompletos(cliente, { enviar, agora: AGORA + 10 * 60_000 })
    expect(enviar).toHaveBeenCalledTimes(1)
  })

  /** Makes the next stamp update answer an error, after writing (aplicar) or not. */
  function updateAmbiguo(cliente: any, aplicar: boolean) {
    const original = cliente.from.getMockImplementation()
    let usado = false
    cliente.from.mockImplementation((tabela: string) => {
      const b = original(tabela)
      const update = b.update
      b.update = (v: Linha) => {
        update(v)
        if (usado || !v.aviso_app_completo_em) return b
        usado = true
        const then = b.then
        b.then = (res: any, rej: any) => (aplicar ? then((r: any) => r) : Promise.resolve())
          .then(() => ({ data: null, error: { message: 'gateway timeout (ficticio)' } })).then(res, rej)
        return b
      }
      return b
    })
  }

  it('ambiguous stamp answer (a gateway error with the write done): it reads the stamp back and sends once', async () => {
    const { cliente, db } = bancoFalso({ pedidos_premium: [pedidoApp()] })
    updateAmbiguo(cliente, true)
    const enviar = enviou()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(db.pedidos_premium[0].aviso_app_completo_em).toBe(MARCA)
  })

  it('ambiguous stamp answer with nothing written: no e-mail now, the next pass sends it', async () => {
    const { cliente, db } = bancoFalso({ pedidos_premium: [pedidoApp()] })
    updateAmbiguo(cliente, false)
    const enviar = enviou()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(enviar).not.toHaveBeenCalled()
    expect(db.pedidos_premium[0].aviso_app_completo_em).toBeNull()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA + 60_000 })
    expect(enviar).toHaveBeenCalledTimes(1)
  })

  it('the "report updated" e-mail claims between the read and the stamp: the stamp fails and nothing goes', async () => {
    const { cliente, db } = bancoFalso({ pedidos_premium: [pedidoApp()] })
    const original = cliente.from.getMockImplementation()!
    cliente.from.mockImplementation((tabela: string) => {
      const b = original(tabela)
      const update = b.update
      b.update = (v: Linha) => {
        if (v.aviso_app_completo_em) db.pedidos_premium[0].aviso_completo_em = ha(0)
        return update(v)
      }
      return b
    })
    const enviar = enviou()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(enviar).not.toHaveBeenCalled()
    expect(db.pedidos_premium[0].aviso_app_completo_em).toBeNull()
  })

  // Review 2 of PR #793: the queue's closing check can run late (a slow
  // database). A "complete" e-mail stamped after the job with new data closed
  // already carried that data: no "report updated" on top of it.
  it('slow closing check: the sweep sends the "complete" e-mail first, and the closing check then sends nothing', async () => {
    const { cliente, db } = bancoFalso({ pedidos_premium: [pedidoApp()], premium_jobs: [job({ ultimo_code: 200, concluido_em: ha(3) })] })
    const enviar = enviou()
    const atualizado = vi.fn(async () => true)
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(await verificarFechamento(cliente, 'pedido-app-1', { enviarEmail: atualizado })).toBe(false)
    expect([enviar.mock.calls.length, atualizado.mock.calls.length]).toEqual([1, 0])
    // Not stamped: a job reopened later can still send it.
    expect(db.pedidos_premium[0].aviso_completo_em).toBeNull()
  })

  it('a job reopened after the "complete" stamp that closes later with new data: the "report updated" e-mail goes', async () => {
    const { cliente, db } = bancoFalso({ pedidos_premium: [pedidoApp()], premium_jobs: [job({ ultimo_code: 200, concluido_em: ha(3) })] })
    const enviar = enviou()
    const atualizado = vi.fn(async () => true)
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    await verificarFechamento(cliente, 'pedido-app-1', { enviarEmail: atualizado })
    Object.assign(db.premium_jobs[0], { status: 'ok', ultimo_code: 200, concluido_em: ha(-5) })
    expect(await verificarFechamento(cliente, 'pedido-app-1', { enviarEmail: atualizado })).toBe(true)
    expect([enviar.mock.calls.length, atualizado.mock.calls.length]).toEqual([1, 1])
  })

  it('the app stamp lands between the closing check reads and its stamp: no "report updated" (the condition is in the stamp itself)', async () => {
    const { cliente, db } = bancoFalso({ pedidos_premium: [pedidoApp()], premium_jobs: [job({ ultimo_code: 200, concluido_em: ha(3) })] })
    const original = cliente.from.getMockImplementation()!
    cliente.from.mockImplementation((tabela: string) => {
      const b = original(tabela)
      const update = b.update
      b.update = (v: Linha) => {
        if (v.aviso_completo_em) db.pedidos_premium[0].aviso_app_completo_em = ha(1)
        return update(v)
      }
      return b
    })
    const atualizado = vi.fn(async () => true)
    expect(await verificarFechamento(cliente, 'pedido-app-1', { enviarEmail: atualizado })).toBe(false)
    expect(atualizado).not.toHaveBeenCalled()
    expect(db.pedidos_premium[0].aviso_completo_em).toBeNull()
  })

  it('closing stamp error: a warning with the error code and the order prefix, with no e-mail nor plate', async () => {
    const { cliente } = bancoFalso({ pedidos_premium: [pedidoApp()], premium_jobs: [job({ ultimo_code: 200, concluido_em: ha(1) })] })
    const original = cliente.from.getMockImplementation()!
    cliente.from.mockImplementation((tabela: string) => {
      const b = original(tabela)
      const update = b.update
      b.update = (v: Linha) => {
        update(v)
        if (v.aviso_completo_em) b.then = (res: any, rej: any) => Promise.resolve({ data: null, error: { code: 'PGRST000', message: 'timeout ficticio' } }).then(res, rej)
        return b
      }
      return b
    })
    const atualizado = vi.fn(async () => true)
    expect(await verificarFechamento(cliente, 'pedido-app-1', { enviarEmail: atualizado })).toBe(false)
    expect(atualizado).not.toHaveBeenCalled()
    const aviso = (console.warn as any).mock.calls.map((c: any[]) => c.join(' ')).find((t: string) => t.includes('PGRST000'))
    expect(aviso).toContain('pedido-a')
    expect(aviso).not.toContain('pedido-app-1')
    expect(aviso).not.toContain('cliente@exemplo.com')
    expect(aviso).not.toContain('ABC1D23')
  })

  // Review 2 of PR #793: stamp written, an error answer, and the read-back fails
  // too. The stamp of this pass is undone, so the e-mail is not lost.
  it('stamp written, error answer and a failed read-back: the stamp is undone and the next pass sends once', async () => {
    const { cliente, db } = bancoFalso({ pedidos_premium: [pedidoApp()] })
    updateAmbiguo(cliente, true)
    const comAmbiguo = cliente.from.getMockImplementation()!
    let leituraFalhou = false
    cliente.from.mockImplementation((tabela: string) => {
      const b = comAmbiguo(tabela)
      const select = b.select
      b.select = (cols?: string) => {
        if (cols === 'aviso_app_completo_em' && !leituraFalhou) { leituraFalhou = true; throw new Error('leitura ficticia falhou') }
        return select(cols)
      }
      return b
    })
    const enviar = enviou()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(leituraFalhou).toBe(true)
    expect(enviar).not.toHaveBeenCalled()
    expect(db.pedidos_premium[0].aviso_app_completo_em).toBeNull()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA + 60_000 })
    expect(enviar).toHaveBeenCalledTimes(1)
  })

  it('a failed send undoes only its own stamp, never one set by hand in the meantime', async () => {
    const { cliente, db } = bancoFalso({ pedidos_premium: [pedidoApp()] })
    const aMao = ha(-1)
    const enviar = vi.fn(async () => { db.pedidos_premium[0].aviso_app_completo_em = aMao; return false })
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(db.pedidos_premium[0].aviso_app_completo_em).toBe(aMao)
  })

  it('no order older than the provider keeps the idempotency key: every retry stays inside the key window', async () => {
    expect(JANELA_CANDIDATOS_MS).toBeLessThanOrEqual(RETENCAO_CHAVE_IDEMPOTENCIA_MS)
    expect(JANELA_AVISO_MS).toBeLessThan(RETENCAO_CHAVE_IDEMPOTENCIA_MS)
    // Delivered just over the window ago, its queue closing only now: no e-mail.
    const entregue = new Date(AGORA - JANELA_CANDIDATOS_MS - 60_000).toISOString()
    const { cliente } = bancoFalso({ pedidos_premium: [pedidoApp({ entregue_em: entregue, snapshot_em: entregue })], premium_jobs: [job({ concluido_em: ha(5) })] })
    const enviar = enviou()
    await varrerAppCompletos(cliente, { enviar, agora: AGORA })
    expect(enviar).not.toHaveBeenCalled()
  })

  it('SIGTERM in the middle of a pass: no new order is stamped, so the new container sends the rest', async () => {
    const { cliente, db } = bancoFalso({
      pedidos_premium: [pedidoApp(), pedidoApp({ id: 'pedido-app-2', token_entrega: 'TOKFICTICIO2', entregue_em: ha(25), snapshot_em: ha(25) })],
    })
    const enviar = vi.fn(async () => { marcarEncerrando(); return true })
    expect(await varrerAppCompletos(cliente, { enviar, agora: AGORA })).toMatchObject({ enviados: 1 })
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(db.pedidos_premium.filter((p) => p.aviso_app_completo_em === null)).toHaveLength(1)
  })

  it('a send that throws counts as a failure (stamp undone) and never escapes the sweep', async () => {
    const { cliente, db } = bancoFalso({ pedidos_premium: [pedidoApp()] })
    const enviar = vi.fn(async () => { throw new Error('falha ficticia') })
    await expect(varrerAppCompletos(cliente, { enviar, agora: AGORA })).resolves.toMatchObject({ enviados: 0 })
    expect(db.pedidos_premium[0].aviso_app_completo_em).toBeNull()
    // A sender that throws before returning a promise: the same.
    const sincrono = vi.fn((): Promise<boolean> => { throw new Error('falha ficticia sincrona') })
    await expect(varrerAppCompletos(cliente, { enviar: sincrono, agora: AGORA })).resolves.toMatchObject({ enviados: 0 })
    expect(sincrono).toHaveBeenCalledTimes(1)
    expect(db.pedidos_premium[0].aviso_app_completo_em).toBeNull()
  })

  it('a database error ends the pass quietly', async () => {
    const quebrado = { from: () => { throw new Error('banco fora (ficticio)') }, rpc: vi.fn() }
    await expect(varrerAppCompletos(quebrado, { enviar: enviou(), agora: AGORA })).resolves.toMatchObject({ enviados: 0 })
    const comErro = { from: () => { const b: any = { then: (r: any) => Promise.resolve({ data: null, error: { message: 'timeout ficticio' } }).then(r) }; for (const m of ['select', 'eq', 'is', 'not', 'or', 'in', 'gte', 'lte', 'order', 'limit']) b[m] = () => b; return b }, rpc: vi.fn() }
    await expect(varrerAppCompletos(comErro, { enviar: enviou(), agora: AGORA })).resolves.toMatchObject({ enviados: 0 })
  })
})
