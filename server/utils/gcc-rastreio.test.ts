import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { ambienteDaConsultaPaga, podeReporReserva, reporReservaGcc } from './gcc-reserva'
import { dadosDoGasto } from './senatran-consulta'

// 05/out: hash GCC (~R$7) gasto sem placa/pedido; claim por created_at; e o
// homolog podia comprar hash real (dropdown 'producao' + reposicao da reserva).

describe('ambienteDaConsultaPaga', () => {
  const prod = { public: { homolog: false } }
  const homolog = { public: { homolog: true } }
  const homologLiberado = { public: { homolog: true }, homologGccProducao: 'on' }
  it('fora do homolog e sempre producao, ignore o que vier', () => {
    expect(ambienteDaConsultaPaga('homolog', prod)).toBe('producao')
    expect(ambienteDaConsultaPaga(undefined, prod)).toBe('producao')
    expect(ambienteDaConsultaPaga('producao', prod)).toBe('producao')
  })
  it('homolog sem a env: producao vira homolog (sem hash real)', () => {
    expect(ambienteDaConsultaPaga('producao', homolog)).toBe('homolog')
    expect(ambienteDaConsultaPaga('producao', { public: { homolog: true }, homologGccProducao: 'off' })).toBe('homolog')
    expect(ambienteDaConsultaPaga('producao', { public: { homolog: true }, homologGccProducao: '' })).toBe('homolog')
  })
  it('homolog com NUXT_HOMOLOG_GCC_PRODUCAO=on: so producao quando pedido', () => {
    expect(ambienteDaConsultaPaga('producao', homologLiberado)).toBe('producao')
    expect(ambienteDaConsultaPaga('homolog', homologLiberado)).toBe('homolog')
    expect(ambienteDaConsultaPaga(undefined, homologLiberado)).toBe('homolog')
  })
})

describe('reposicao da reserva no homolog', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('podeReporReserva: nunca producao no homolog', () => {
    expect(podeReporReserva('producao', { public: { homolog: true } })).toBe(false)
    expect(podeReporReserva('homolog', { public: { homolog: true } })).toBe(true)
    expect(podeReporReserva('producao', { public: { homolog: false } })).toBe(true)
  })
  it('reporReservaGcc de producao no homolog nao chama o GCC', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { homolog: true }, homologGccProducao: 'on' }))
    vi.stubGlobal('fetch', fetchSpy)
    const supabase = { from: vi.fn(), rpc: vi.fn() }
    const r = await reporReservaGcc(supabase, 'producao')
    expect(r.criados).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('dadosDoGasto', () => {
  it('grava placa, ambiente e pedido no spent', () => {
    const agora = new Date('2026-10-05T17:23:05Z')
    expect(dadosDoGasto({ ok: true, placa: 'RVX0H18', ambiente: 'producao', pedidoId: 'p-1', agora })).toEqual({
      status: 'spent', spent_at: '2026-10-05T17:23:05.000Z', placa: 'RVX0H18', ambiente: 'producao', pedido_id: 'p-1',
    })
  })
  it('erro do SERPRO marca error e mantem o rastreio; sem pedido vira null', () => {
    const d = dadosDoGasto({ ok: false, placa: 'ABC1D23', ambiente: 'homolog' })
    expect(d.status).toBe('error')
    expect(d.placa).toBe('ABC1D23')
    expect(d.pedido_id).toBeNull()
  })
})

describe('migration do claim', () => {
  it('reivindicar_hash_reserva ordena pelo que vence primeiro, com margem de 1h', () => {
    const sql = readFileSync('supabase/migrations/20261005210000_gcc_reserva_rastreio.sql', 'utf8')
    expect(sql).toMatch(/order by c\.expira_em asc/)
    expect(sql).toMatch(/expira_em > now\(\) \+ interval '1 hour'/)
    expect(sql).toMatch(/revoke execute on function public\.reivindicar_hash_reserva/)
  })
})

describe('margem de consumo de 10 min', () => {
  it('SQL do claim e contagem do repositor usam o mesmo criterio', async () => {
    const { MARGEM_CONSUMO_MS, limiteUtilizavel } = await import('./gcc-reserva')
    expect(MARGEM_CONSUMO_MS).toBe(10 * 60 * 1000)
    expect(limiteUtilizavel(new Date('2026-10-05T12:00:00Z'))).toBe('2026-10-05T12:10:00.000Z')
    const sql = readFileSync('supabase/migrations/20261005230000_gcc_claim_margem_10min.sql', 'utf8')
    expect(sql).toMatch(/expira_em > now\(\) \+ interval '10 minutes'/)
    expect(sql).toMatch(/order by c\.expira_em asc/)
    expect(sql).toMatch(/revoke execute on function public\.reivindicar_hash_reserva/)
  })
})
