import { describe, it, expect, vi, afterEach } from 'vitest'
import GO from './__fixtures__/infosimples-detran-go.json'
import { completarDetran, INFOSIMPLES_TIMEOUT_S, ABORT_MS, CODIGOS_RETRY, logIndisponivel } from './infosimples-detran'

// Incidente 01-03/out: toda UF fora de SP saia 'indisponivel'. O fetch abortava
// em 120 s enquanto a Infosimples tinha 600 s; e erro de origem (609) nao tinha
// retry nem log.
const cfg = () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p' })
function fakeSb(snap: any = { consulta: {} }) {
  const inserts: any[] = []; const updates: any[] = []
  return {
    inserts, updates,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: snap } }) }) }),
      insert: async (row: any) => { inserts.push(row); return { error: null } },
      update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
    }),
  }
}
const resp = [{ ufJurisdicao: 'GO', renavam: '341284556', indicadorMultaRenainf: true }]

describe('DETRAN fora de SP: tempos, retry e log', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks() })

  it('a Infosimples recebe timeout MENOR que o nosso abort', () => {
    expect(INFOSIMPLES_TIMEOUT_S * 1000).toBeLessThan(ABORT_MS)
    expect(ABORT_MS).toBeGreaterThanOrEqual(300_000)
    expect([...CODIGOS_RETRY].sort()).toEqual([0, 605, 609])
  })

  it('609 e depois 200: tenta de novo, grava o bloco e os dois custos', async () => {
    vi.stubGlobal('useRuntimeConfig', cfg)
    const corpos: URLSearchParams[] = []
    const respostas = [{ code: 609, header: { price: 0 } }, { code: 200, header: { price: '0.28' }, data: [GO] }]
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: any) => { corpos.push(init.body); return { status: 200, json: async () => respostas.shift() } }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'abcdef12-0000', placa: 'NLR8389' }, { response: resp, esperaRetryMs: 0 })
    expect(r.ok).toBe(true)
    expect(corpos).toHaveLength(2)
    expect(corpos[0].get('timeout')).toBe(String(INFOSIMPLES_TIMEOUT_S))
    expect(sb.inserts.map((i) => i.code)).toEqual([609, 200])
    expect(sb.updates.at(-1).relatorio_snapshot.multas.fonte).toBe('detran_go')
    expect(warn.mock.calls.some((c) => String(c[0]).includes('[detran] retry uf=GO code=609'))).toBe(true)
  })

  it('falha nas duas: marca indisponivel e loga sem PII', async () => {
    vi.stubGlobal('useRuntimeConfig', cfg)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('The operation was aborted due to timeout') }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'abcdef12-0000', placa: 'NLR8389' }, { response: resp, esperaRetryMs: 0 })
    expect(r).toMatchObject({ ok: false, code: 0 })
    expect(sb.updates.at(-1).relatorio_snapshot.multas).toEqual({ status: 'indisponivel', uf: 'GO' })
    const linha = warn.mock.calls.map((c) => String(c[0])).find((l) => l.startsWith('[detran] indisponivel'))!
    expect(linha).toMatch(/uf=GO code=0 ms=\d+ motivo=.* pedido=abcdef12$/)
    expect(linha).not.toContain('NLR8389')
  })

  it('log mascara placa e numeros longos no motivo', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logIndisponivel('12345678-x', 'SC', 609, 'placa ABC1D23 renavam 00341284556 falhou', 99000)
    expect(String(warn.mock.calls[0][0])).toBe('[detran] indisponivel uf=SC code=609 ms=99000 motivo=placa <placa> renavam <num> falhou pedido=12345678')
  })

  it('bloco manual com mais multas que o oficial fica', async () => {
    vi.stubGlobal('useRuntimeConfig', cfg)
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, json: async () => ({ code: 200, header: { price: 0.28 }, data: [GO] }) })))
    const manual = { fonte: 'detran_go', preenchido_manual_em: '2026-10-03T15:00:00Z', multas_itens: Array.from({ length: 23 }, () => ({ valor: 1 })) }
    const sb = fakeSb({ consulta: {}, multas: manual })
    const r = await completarDetran(sb, { id: 'p1', placa: 'NLR8389' }, { response: resp })
    expect(r).toMatchObject({ ok: false, motivo: 'manual mais completo, mantido' })
    expect(sb.updates).toHaveLength(0)
  })
})
