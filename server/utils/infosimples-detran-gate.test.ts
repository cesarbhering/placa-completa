import { describe, it, expect, vi, afterEach } from 'vitest'
import { completarDetran, temMultaRenainf, DETRAN_UFS } from './infosimples-detran'

// Gate por UF (decisao do Cesar, 30/set): SP sempre; SC e MG so com
// indicadorMultaRenainf=true no SENATRAN. Backfill por token ignora o gate.
function fakeSb() {
  const inserts: any[] = []
  return {
    inserts,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: {} } } }) }) }),
      insert: async (row: any) => { inserts.push(row); return { error: null } },
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }
}

describe('gate de chamada por UF', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  const setup = () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p' }))
    const fetchSpy = vi.fn(async () => ({ status: 200, json: async () => ({ code: 607, header: { price: '0.28' } }) }))
    vi.stubGlobal('fetch', fetchSpy)
    return fetchSpy
  }

  it('mapa: SP sempre, SC e MG so com RENAINF', () => {
    expect(DETRAN_UFS.SP.gate).toBe('sempre')
    expect(DETRAN_UFS.SC.gate).toBe('renainf')
    expect(DETRAN_UFS.MG.gate).toBe('renainf')
  })

  it('SP sem RENAINF: chama (sempre)', async () => {
    const f = setup()
    await completarDetran(fakeSb(), { id: 'p', placa: 'FYA8875' }, { response: [{ ufJurisdicao: 'SP', renavam: '1', indicadorMultaRenainf: false }] })
    expect(f).toHaveBeenCalledTimes(1)
  })

  for (const [uf, extra] of [['SC', {}], ['MG', { chassi: '9BWAG45UXJT036030' }]] as const) {
    it(`${uf} sem RENAINF: nao chama nem cobra`, async () => {
      const f = setup(); const sb = fakeSb()
      const r = await completarDetran(sb, { id: 'p', placa: 'X' }, { response: [{ ufJurisdicao: uf, renavam: '1', indicadorMultaRenainf: false, ...extra }] })
      expect(r).toMatchObject({ ok: false, pulado: `${uf} so com RENAINF` })
      expect(f).not.toHaveBeenCalled()
      expect(sb.inserts).toHaveLength(0)
    })
    it(`${uf} com RENAINF (em restricoes): chama`, async () => {
      const f = setup()
      await completarDetran(fakeSb(), { id: 'p', placa: 'X' }, { response: [{ ufJurisdicao: uf, renavam: '1', restricoes: { indicadorMultaRenainf: true }, ...extra }] })
      expect(f).toHaveBeenCalledTimes(1)
    })
    it(`${uf} sem RENAINF no backfill por token (ignorarGate): chama`, async () => {
      const f = setup()
      await completarDetran(fakeSb(), { id: 'p', placa: 'X' }, { response: [{ ufJurisdicao: uf, renavam: '1', ...extra }], ignorarGate: true })
      expect(f).toHaveBeenCalledTimes(1)
    })
  }

  it('temMultaRenainf le raiz e restricoes', () => {
    expect(temMultaRenainf([{ indicadorMultaRenainf: true }])).toBe(true)
    expect(temMultaRenainf({ restricoes: { indicadorMultaRenainf: true } })).toBe(true)
    expect(temMultaRenainf([{ indicadorMultaRenainf: false }])).toBe(false)
    expect(temMultaRenainf(null)).toBe(false)
  })
})
