import { describe, it, expect, vi } from 'vitest'
import { sanearParaJsonb, gravarEntrega, presoComSnapshot, promoverSeSnapshotPronto, recuperarConsultandoPresos, FOLGA_SNAPSHOT_MS, PRESO_MS } from './entrega-pedido'
import { rastrearEmVoo, quantasEmVoo, _resetarEmVoo } from './tarefas-em-voo'
import { enfileirarNfse } from './nfse'

vi.mock('./nfse', () => ({ enfileirarNfse: vi.fn(async () => 'ignorado') }))

vi.spyOn(console, 'warn').mockImplementation(() => {})
const T = Date.UTC(2026, 10, 4, 15, 30, 0)

// Banco falso com filtros encadeados; `updates` registra cada tentativa.
function banco(o: { falhasUpdate?: number; falhaComTrace?: boolean; pedidos?: any[]; consents?: any[]; consultas?: any[] } = {}) {
  const updates: any[] = []
  let falhas = o.falhasUpdate ?? 0
  const pedidos = o.pedidos ?? []
  const q = (tabela: string) => {
    const f: { campo: string; op: string; v: any }[] = []
    let patch: any = null
    const api: any = {
      select: () => api, eq: (c: string, v: any) => (f.push({ campo: c, op: 'eq', v }), api),
      in: (c: string, v: any) => (f.push({ campo: c, op: 'in', v }), api), is: (c: string, v: any) => (f.push({ campo: c, op: 'is', v }), api),
      lt: () => api, gte: () => api, order: () => api, limit: () => api,
      update: (p: any) => { patch = p; return api },
      then: (res: any, rej: any) => Promise.resolve(exec()).then(res, rej),
    }
    const casa = (r: any) => f.every((x) => x.op === 'eq' ? r[x.campo] === x.v : x.op === 'in' ? x.v.includes(r[x.campo]) : (r[x.campo] ?? null) === x.v)
    function exec() {
      if (tabela === 'gcc_consentimentos') return { data: (o.consents ?? []).filter(casa) }
      if (tabela === 'senatran_consultas') return { data: (o.consultas ?? []).filter(casa) }
      if (patch) {
        updates.push(patch)
        if (falhas > 0) { falhas--; return { error: { message: 'falha simulada' } } }
        if (o.falhaComTrace && 'debug_trace' in patch) return { error: { message: 'unsupported Unicode escape sequence' } }
        const alvo = pedidos.filter(casa)
        alvo.forEach((r) => Object.assign(r, patch))
        return { data: alvo.map((r) => ({ id: r.id })), error: null }
      }
      return { data: pedidos.filter(casa), error: null }
    }
    return api
  }
  return { updates, pedidos, from: q }
}

describe('gravacao da entrega', () => {
  it('saneia \\u0000 e surrogate solto (o jsonb recusa os dois)', () => {
    const t = sanearParaJsonb([{ resumo: 'a\u0000b', corte: 'x\uD83D' }, { ok: 'carro 🚗' }])
    expect(t).toEqual([{ resumo: 'ab', corte: 'x�' }, { ok: 'carro 🚗' }])
  })
  it('confere o erro e tenta de novo', async () => {
    const db = banco({ falhasUpdate: 2, pedidos: [{ id: 'p1', status: 'consultando' }] })
    expect(await gravarEntrega(db, 'p1', { entregue_em: 'x', consulta_id: 'c1', debug_trace: [] }, { esperas: [0, 0, 0] })).toBeNull()
    expect(db.updates).toHaveLength(3)
    expect(db.pedidos[0]).toMatchObject({ status: 'entregue', consulta_id: 'c1' })
  })
  it('trace recusado: grava a entrega sem o debug_trace', async () => {
    const db = banco({ falhaComTrace: true, pedidos: [{ id: 'p1', status: 'consultando' }] })
    expect(await gravarEntrega(db, 'p1', { entregue_em: 'x', consulta_id: 'c1', debug_trace: [{ a: 1 }], placa_consultada: 'P' }, { esperas: [0, 0, 0] })).toBeNull()
    expect(db.pedidos[0]).toMatchObject({ status: 'entregue', consulta_id: 'c1', placa_consultada: 'P' })
    expect(db.pedidos[0].debug_trace).toBeUndefined()
  })
  it('tudo falhando: devolve o erro pra quem chamou alertar', async () => {
    const db = banco({ falhasUpdate: 99, pedidos: [{ id: 'p1', status: 'consultando' }] })
    expect(await gravarEntrega(db, 'p1', { entregue_em: 'x', consulta_id: 'c1' }, { esperas: [0, 0, 0] })).toBe('falha simulada')
    expect(db.pedidos[0].status).toBe('consultando')
  })
})

describe('pedido preso em consultando com snapshot pronto', () => {
  const snap = { consulta: { placa: 'P' }, camposRestantes: 0 }
  it('so quando o snapshot ja tem folga (a entrega normal grava o status antes)', () => {
    expect(presoComSnapshot({ status: 'consultando', relatorio_snapshot: snap, snapshot_em: new Date(T - FOLGA_SNAPSHOT_MS).toISOString() }, T)).toBe(true)
    expect(presoComSnapshot({ status: 'consultando', relatorio_snapshot: snap, snapshot_em: new Date(T - 1000).toISOString() }, T)).toBe(false)
    expect(presoComSnapshot({ status: 'entregue', relatorio_snapshot: snap }, T)).toBe(false)
    expect(presoComSnapshot({ status: 'consultando', relatorio_snapshot: null }, T)).toBe(false)
  })
  it('promove a entregue com o consulta_id recuperado da consulta paga', async () => {
    const em = new Date(T - 5 * 60 * 1000).toISOString()
    const p = { id: 'p1', status: 'consultando', relatorio_snapshot: snap, snapshot_em: em }
    const db = banco({ pedidos: [{ ...p }], consents: [{ id: 'g1', pedido_id: 'p1' }], consultas: [{ id: 'c1', consentimento_id: 'g1' }] })
    expect(await promoverSeSnapshotPronto(db, p, T)).toEqual({ consultaId: 'c1' })
    expect(db.pedidos[0]).toMatchObject({ status: 'entregue', entregue_em: em, consulta_id: 'c1' })
    // Segunda vez (outra aba): ja nao esta em consultando, nao promove de novo.
    expect(await promoverSeSnapshotPronto(db, p, T)).toBe(false)
  })
})

describe('boot: presos em consultando', () => {
  const velho = new Date(T - PRESO_MS - 60_000).toISOString()
  it('os tres caminhos: snapshot, consulta sem snapshot, nada', async () => {
    vi.mocked(enfileirarNfse).mockClear()
    const pedidos = [
      { id: 'a', status: 'consultando', ambiente: 'producao', pago_em: velho, relatorio_snapshot: { consulta: {} }, snapshot_em: velho },
      { id: 'b', status: 'consultando', ambiente: 'producao', pago_em: velho, relatorio_snapshot: null },
      { id: 'c', status: 'consultando', ambiente: 'producao', pago_em: velho, relatorio_snapshot: null },
    ]
    const db = banco({ pedidos, consents: [{ id: 'g', pedido_id: 'b' }], consultas: [{ id: 'cb', consentimento_id: 'g' }] })
    const processados: any[] = []
    const alertas: string[] = []
    const r = await recuperarConsultandoPresos(db, { agora: T, processar: async (_s, p) => { processados.push(p) }, alertar: (m) => { alertas.push(m) } })
    expect(r).toEqual([{ id: 'a', desfecho: 'promovido_snapshot' }, { id: 'b', desfecho: 'promovido_consulta' }, { id: 'c', desfecho: 'reprocessado' }])
    expect(pedidos[0]!.status).toBe('entregue')
    expect(pedidos[1]).toMatchObject({ status: 'entregue', consulta_id: 'cb' })
    expect(pedidos[2]!.status).toBe('pago')
    expect(processados.map((p) => p.id)).toEqual(['c'])
    expect(processados[0].status).toBe('pago')
    expect(alertas).toHaveLength(1)
    // Both promotions to entregue enqueue the NFS-e; the reprocessed one goes through processarPedidoPago.
    await new Promise((ok) => setTimeout(ok, 0))
    expect(vi.mocked(enfileirarNfse).mock.calls.map((c) => c[1]).sort()).toEqual(['a', 'b'])
  })
  it('nada preso: sem alerta', async () => {
    const alertas: string[] = []
    expect(await recuperarConsultandoPresos(banco(), { agora: T, processar: async () => {}, alertar: (m) => { alertas.push(m) } })).toEqual([])
    expect(alertas).toHaveLength(0)
  })
})

describe('consulta paga registrada como em voo', () => {
  it('rastrearEmVoo conta enquanto roda e propaga o erro', async () => {
    _resetarEmVoo()
    let soltar!: () => void
    const p = rastrearEmVoo('processar-pedido', () => new Promise<void>((r) => { soltar = r }))
    expect(quantasEmVoo()).toBe(1)
    soltar(); await p
    expect(quantasEmVoo()).toBe(0)
    await expect(rastrearEmVoo('x', async () => { throw new Error('boom') })).rejects.toThrow('boom')
    expect(quantasEmVoo()).toBe(0)
  })
})
