import { describe, it, expect, vi } from 'vitest'
import { reconciliarNfse } from './nfse'
import { ErroNfseIndisponivel, ErroNfseRejeitado } from './nfse-provedor'

const config = { nfse: 'on', nfseDesde: '2026-11-13T00:00:00Z' }
const AGORA = new Date('2026-11-14T12:00:00Z')

function row(id: string, over: any = {}) {
  return {
    id, token_entrega: 'tok-fake', placa: 'ABC1D23', plano: 'completa', valor_centavos: 1990,
    pago_em: '2026-11-14T01:30:00Z', entregue_em: '2026-11-14T01:31:00Z', email: 'a@exemplo.test',
    pix_provider: 'abacatepay', canal: 'site', abacatepay_id: 'abc', stripe_session_id: null, status: 'entregue',
    nfse_id: null, nfse_status: null, nfse_erro: null, nfse_numero: null, nfse_email_em: null, nfse_atualizado_em: null, ...over,
  }
}

// In-memory table: supports the eq/is/not/lt/or filters the code under test uses.
function fakeSb(rows: any[]) {
  const updates: Array<{ id: string; patch: any }> = []
  const match = (r: any, fs: Array<(r: any) => boolean>) => fs.every((f) => f(r))
  return {
    updates,
    from: () => {
      const fs: Array<(r: any) => boolean> = []
      let max = 1000
      let ordem: [string, boolean] | null = null
      const ordenar = (xs: any[]) => !ordem ? xs : [...xs].sort((a, b) => {
        const [c, asc] = ordem!
        const x = a[c] ?? '', y = b[c] ?? ''
        return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1)
      })
      const filtros: any = {
        eq: (c: string, v: any) => { fs.push((r) => r[c] === v); return filtros },
        neq: (c: string, v: any) => { fs.push((r) => r[c] !== v); return filtros },
        is: (c: string, v: any) => { fs.push((r) => r[c] === v); return filtros },
        not: (c: string, op: string, v: any) => {
          if (op === 'is') fs.push((r) => r[c] !== v)
          else if (op === 'in') fs.push((r) => !String(v).slice(1, -1).split(',').includes(r[c]))
          return filtros
        },
        lt: (c: string, v: any) => { fs.push((r) => r[c] != null && r[c] < v); return filtros },
        gte: (c: string, v: any) => { fs.push((r) => r[c] != null && r[c] >= v); return filtros },
        or: (f: string) => {
          // Split on top-level commas only (not.in.(a,b) keeps its inner commas).
          const parts = f.split(/,(?![^(]*\))/).map((x) => x.split('.'))
          const test = (r: any, [c, op, v, w]: string[]) =>
            op === 'is' ? r[c] == null
              : op === 'not' && v === 'in' ? !w.slice(1, -1).split(',').includes(r[c])
              : r[c] === v
          fs.push((r) => parts.some((p) => test(r, p)))
          return filtros
        },
        order: (c: string, o: any = {}) => { ordem = [c, o.ascending !== false]; return filtros },
        limit: (n: number) => { max = n; return filtros },
      }
      return {
        select: (_cols?: string) => {
          const s: any = Object.fromEntries(Object.entries(filtros).map(([k, f]: any) => [k, (...a: any[]) => { f(...a); return s }]))
          s.single = async () => ({ data: rows.filter((r) => match(r, fs))[0] ?? null, error: null })
          s.then = (res: any) => Promise.resolve({ data: ordenar(rows.filter((r) => match(r, fs))).slice(0, max), error: null }).then(res)
          return s
        },
        update: (patch: any) => {
          const q: any = Object.fromEntries(Object.entries(filtros).map(([k, f]: any) => [k, (...a: any[]) => { f(...a); return q }]))
          Object.assign(q, {
            select: () => q,
            then: (res: any) => {
              const hit = rows.filter((r) => match(r, fs))
              for (const r of hit) { Object.assign(r, patch); updates.push({ id: r.id, patch }) }
              return Promise.resolve({ data: hit.map((r) => ({ id: r.id })), error: null }).then(res)
            },
          })
          return q
        },
      }
    },
  }
}

function deps(over: any = {}) {
  return {
    provedor: {
      emitir: vi.fn(async () => ({ id: 'nota-novo', estado: 'processando' })),
      consultar: vi.fn(async (id: string) => ({ id, estado: 'emitida', numero: '42' })),
      pdf: vi.fn(async () => Buffer.from('pdf')),
      cancelar: vi.fn(async () => {}),
    } as any,
    lerTomador: vi.fn(async () => ({ documento: '12345678909', nome: 'Fulano de Tal', tipo: 'CPF' as const })),
    enviarEmail: vi.fn(async () => true),
    avisar: vi.fn(async () => {}),
    agora: () => AGORA, config, ...over,
  }
}

describe('reconciliarNfse', () => {
  it('enqueues orders stuck in a_enfileirar', async () => {
    const rows = [row('p1', { nfse_status: 'a_enfileirar' })]
    const d = deps()
    const r = await reconciliarNfse(fakeSb(rows), d)
    expect(d.provedor.emitir).toHaveBeenCalledTimes(1)
    expect(rows[0].nfse_status).toBe('enfileirada')
    expect(r.enfileiradas).toBe(1)
  })

  it('consults a stale enfileirada and applies the state; fresh ones are left alone', async () => {
    const rows = [
      row('p1', { nfse_status: 'enfileirada', nfse_id: 'n1', nfse_atualizado_em: '2026-11-14T11:00:00.000Z' }),
      row('p2', { nfse_status: 'enfileirada', nfse_id: 'n2', nfse_atualizado_em: '2026-11-14T11:55:00.000Z' }),
    ]
    const d = deps()
    const r = await reconciliarNfse(fakeSb(rows), d)
    expect(d.provedor.consultar).toHaveBeenCalledTimes(1)
    expect(d.provedor.consultar).toHaveBeenCalledWith('n1')
    expect(rows[0].nfse_status).toBe('emitida')
    expect(rows[1].nfse_status).toBe('enfileirada')
    expect(r.atualizadas).toBe(1)
  })

  it('emitter down: stops early with the counts so far, no throw', async () => {
    const rows = [
      row('p1', { nfse_status: 'enfileirada', nfse_id: 'n1', nfse_atualizado_em: '2026-11-14T10:00:00.000Z' }),
      row('p2', { nfse_status: 'enfileirada', nfse_id: 'n2', nfse_atualizado_em: '2026-11-14T10:01:00.000Z' }),
      row('p3', { status: 'reembolsado', nfse_erro: 'cancelar_pendente', nfse_id: 'n3', nfse_status: 'emitida' }),
    ]
    const d = deps()
    d.provedor.consultar = vi.fn(async () => { throw new ErroNfseIndisponivel() })
    const r = await reconciliarNfse(fakeSb(rows), d)
    expect(d.provedor.consultar).toHaveBeenCalledTimes(1)
    expect(d.provedor.cancelar).not.toHaveBeenCalled()
    expect(r).toEqual({ enfileiradas: 0, atualizadas: 0, emails: 0, cancelamentos: 0 })
  })

  it('emitida without e-mail sent: sends once, second run does nothing', async () => {
    const rows = [row('p1', { nfse_status: 'emitida', nfse_id: 'n1', nfse_numero: '42' })]
    const d = deps()
    const sb = fakeSb(rows)
    const r1 = await reconciliarNfse(sb, d)
    const r2 = await reconciliarNfse(sb, d)
    expect(d.enviarEmail).toHaveBeenCalledTimes(1)
    expect(r1.emails).toBe(1)
    expect(r2.emails).toBe(0)
    expect(rows[0].nfse_email_em).toBeTruthy()
  })

  it('retries cancelar_pendente', async () => {
    const rows = [row('p1', { status: 'reembolsado', nfse_status: 'emitida', nfse_id: 'n1', nfse_erro: 'cancelar_pendente' })]
    const d = deps()
    const r = await reconciliarNfse(fakeSb(rows), d)
    // (d) retries it; (e) skips the row (d) already handled in this run.
    expect(d.provedor.cancelar).toHaveBeenCalledTimes(1)
    expect(d.provedor.cancelar).toHaveBeenCalledWith('n1', 'Estorno do pagamento ao cliente')
    expect(rows[0].nfse_erro).toBeNull()
    expect(d.enviarEmail).not.toHaveBeenCalled()
    expect(r.cancelamentos).toBe(1)
  })

  it('emitter down in (a): stops at the first order and counts nothing', async () => {
    const rows = [row('p1', { nfse_status: 'a_enfileirar' }), row('p2', { nfse_status: 'a_enfileirar' })]
    const d = deps()
    d.provedor.emitir = vi.fn(async () => { throw new ErroNfseIndisponivel() })
    const r = await reconciliarNfse(fakeSb(rows), d)
    expect(d.provedor.emitir).toHaveBeenCalledTimes(1)
    expect(r).toEqual({ enfileiradas: 0, atualizadas: 0, emails: 0, cancelamentos: 0 })
    expect(rows.map((x) => x.nfse_status)).toEqual(['a_enfileirar', 'a_enfileirar'])
  })

  it('(a) counts only orders actually enqueued', async () => {
    const rows = [row('p1', { nfse_status: 'a_enfileirar', pix_provider: 'google_play' }), row('p2', { nfse_status: 'a_enfileirar' })]
    const r = await reconciliarNfse(fakeSb(rows), deps())
    expect(rows.map((x) => x.nfse_status)).toEqual(['fora_escopo', 'enfileirada'])
    expect(r.enfileiradas).toBe(1)
  })

  it('(b) counts only notes whose state changed', async () => {
    const rows = [row('p1', { nfse_status: 'enfileirada', nfse_id: 'n1', nfse_atualizado_em: '2026-11-14T11:00:00.000Z' })]
    const d = deps()
    d.provedor.consultar = vi.fn(async (id: string) => ({ id, estado: 'pendente' }))
    const r = await reconciliarNfse(fakeSb(rows), d)
    expect(d.provedor.consultar).toHaveBeenCalledTimes(1)
    expect(r.atualizadas).toBe(0)
  })

  it('(c) never e-mails a refunded order nor one with a pending error', async () => {
    const rows = [
      row('p1', { status: 'reembolsado', nfse_status: 'emitida', nfse_id: 'n1', nfse_erro: 'cancelar_rejeitado:422' }),
      row('p2', { nfse_status: 'emitida', nfse_id: 'n2', nfse_erro: 'cancelar_pendente' }),
    ]
    const d = deps()
    d.provedor.cancelar = vi.fn(async () => { throw new ErroNfseIndisponivel() })
    const r = await reconciliarNfse(fakeSb(rows), d)
    expect(d.enviarEmail).not.toHaveBeenCalled()
    expect(r.emails).toBe(0)
  })

  it('(d) does not count a cancel the emitter did not accept', async () => {
    const rows = [row('p1', { status: 'reembolsado', nfse_status: 'emitida', nfse_id: 'n1', nfse_erro: 'cancelar_pendente' })]
    const d = deps()
    d.provedor.cancelar = vi.fn(async () => { throw new ErroNfseIndisponivel() })
    const r = await reconciliarNfse(fakeSb(rows), d)
    expect(d.provedor.cancelar).toHaveBeenCalledTimes(1)
    expect(r.cancelamentos).toBe(0)
  })

  it('(e) cancels the note of a refunded order left issued', async () => {
    const rows = [
      row('p1', { status: 'reembolsado', nfse_status: 'enfileirada', nfse_id: 'n1', nfse_atualizado_em: '2026-11-14T11:59:00.000Z' }),
      row('p2', { status: 'reembolsado', nfse_status: 'cancelada', nfse_id: 'n2' }),
      row('p3', { status: 'reembolsado', nfse_status: 'emitida', nfse_id: 'n3', nfse_erro: 'cancelar_rejeitado:422' }),
    ]
    const d = deps()
    const r = await reconciliarNfse(fakeSb(rows), d)
    expect(d.provedor.cancelar).toHaveBeenCalledTimes(1)
    expect(d.provedor.cancelar).toHaveBeenCalledWith('n1', 'Estorno do pagamento ao cliente')
    expect(d.enviarEmail).not.toHaveBeenCalled()
    expect(r.cancelamentos).toBe(1)
  })

  it('(e) is NULL-safe: a refunded order with a note id and NULL nfse_status is still picked up', async () => {
    const rows = [row('p1', { status: 'reembolsado', nfse_status: null, nfse_id: 'n1' })]
    const d = deps()
    const r = await reconciliarNfse(fakeSb(rows), d)
    expect(d.provedor.cancelar).toHaveBeenCalledWith('n1', 'Estorno do pagamento ao cliente')
    expect(r.cancelamentos).toBe(1)
  })

  it('(e) on 409 pulls the final state from the emitter', async () => {
    const rows = [row('p1', { status: 'reembolsado', nfse_status: 'emitida', nfse_id: 'n1', nfse_email_em: '2026-11-14T02:00:00Z' })]
    const d = deps()
    d.provedor.cancelar = vi.fn(async () => { throw new ErroNfseRejeitado(409, {}) })
    d.provedor.consultar = vi.fn(async (id: string) => ({ id, estado: 'cancelada', cancelada_em: '2026-11-14T11:00:00Z' }))
    const r = await reconciliarNfse(fakeSb(rows), d)
    expect(d.provedor.consultar).toHaveBeenCalledWith('n1')
    expect(rows[0].nfse_status).toBe('cancelada')
    expect(r).toMatchObject({ cancelamentos: 0, atualizadas: 1 })
  })

  it('(c) sends at most 10 e-mails per run', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(`p${i}`, { nfse_status: 'emitida', nfse_id: `n${i}`, nfse_numero: String(i) }))
    const d = deps()
    const r = await reconciliarNfse(fakeSb(rows), d)
    expect(d.enviarEmail).toHaveBeenCalledTimes(10)
    expect(r.emails).toBe(10)
  })

  it('(e) leaves refunded orders whose note was rejected or failed alone', async () => {
    const rows = [
      row('p1', { status: 'reembolsado', nfse_status: 'rejeitada', nfse_id: 'n1' }),
      row('p2', { status: 'reembolsado', nfse_status: 'falhou', nfse_id: 'n2' }),
    ]
    const d = deps()
    const r = await reconciliarNfse(fakeSb(rows), d)
    expect(d.provedor.cancelar).not.toHaveBeenCalled()
    expect(r.cancelamentos).toBe(0)
  })

  it('(e) works the oldest nfse_atualizado_em first', async () => {
    const rows = [
      row('novo', { status: 'reembolsado', nfse_status: 'emitida', nfse_id: 'n-novo', nfse_atualizado_em: '2026-11-14T11:00:00.000Z' }),
      row('velho', { status: 'reembolsado', nfse_status: 'emitida', nfse_id: 'n-velho', nfse_atualizado_em: '2026-11-14T03:00:00.000Z' }),
    ]
    const d = deps()
    d.provedor.cancelar = vi.fn(async () => { throw new ErroNfseIndisponivel() })
    await reconciliarNfse(fakeSb(rows), d)
    expect(d.provedor.cancelar).toHaveBeenCalledTimes(1)
    expect(d.provedor.cancelar).toHaveBeenCalledWith('n-velho', 'Estorno do pagamento ao cliente')
  })

  it('(f) enqueues delivered orders with NULL nfse_status, only in scope and older than 5 min', async () => {
    const rows = [
      row('ok', { entregue_em: '2026-11-14T10:00:00.000Z' }),
      row('fresco', { entregue_em: '2026-11-14T11:57:00.000Z' }),
      row('antes', { entregue_em: '2026-11-12T10:00:00.000Z' }),
      row('pago', { status: 'pago', entregue_em: null }),
      row('reembolsado', { status: 'reembolsado', entregue_em: '2026-11-14T10:00:00.000Z' }),
      row('ja', { nfse_status: 'fora_escopo', entregue_em: '2026-11-14T10:00:00.000Z' }),
    ]
    const d = deps()
    const r = await reconciliarNfse(fakeSb(rows), d)
    expect(d.provedor.emitir).toHaveBeenCalledTimes(1)
    expect(d.provedor.emitir).toHaveBeenCalledWith(expect.objectContaining({ referencia: 'ok' }))
    expect(rows.find((x) => x.id === 'ok')!.nfse_status).toBe('enfileirada')
    expect(rows.filter((x) => x.id !== 'ok').map((x) => x.nfse_status)).toEqual([null, null, null, null, 'fora_escopo'])
    expect(r.enfileiradas).toBe(1)
  })

  it('(f) is idempotent: a second run does not issue again', async () => {
    const rows = [row('p1', { entregue_em: '2026-11-14T10:00:00.000Z' })]
    const d = deps()
    const sb = fakeSb(rows)
    await reconciliarNfse(sb, d)
    const r2 = await reconciliarNfse(sb, d)
    expect(d.provedor.emitir).toHaveBeenCalledTimes(1)
    expect(r2.enfileiradas).toBe(0)
  })

  it('(f) oldest first and stops when the emitter is down', async () => {
    const rows = [
      row('novo', { entregue_em: '2026-11-14T10:00:00.000Z' }),
      row('velho', { entregue_em: '2026-11-14T01:00:00.000Z' }),
    ]
    const d = deps()
    d.provedor.emitir = vi.fn(async () => { throw new ErroNfseIndisponivel() })
    const r = await reconciliarNfse(fakeSb(rows), d)
    expect(d.provedor.emitir).toHaveBeenCalledTimes(1)
    expect(d.provedor.emitir).toHaveBeenCalledWith(expect.objectContaining({ referencia: 'velho' }))
    expect(r.enfileiradas).toBe(0)
    expect(rows.map((x) => x.nfse_status)).toEqual([null, 'a_enfileirar'])
  })

  it('(f) skipped without a valid nfseDesde', async () => {
    const rows = [row('p1', { entregue_em: '2026-11-14T10:00:00.000Z' })]
    const d = deps({ config: { nfse: 'on', nfseDesde: '' } })
    await reconciliarNfse(fakeSb(rows), d)
    expect(d.provedor.emitir).not.toHaveBeenCalled()
    expect(rows[0].nfse_status).toBeNull()
  })

  it('feature off: does nothing', async () => {
    const d = deps({ config: { nfse: '' } })
    const r = await reconciliarNfse(fakeSb([row('p1', { nfse_status: 'a_enfileirar' })]), d)
    expect(r.enfileiradas).toBe(0)
    expect(d.provedor.emitir).not.toHaveBeenCalled()
  })
})
