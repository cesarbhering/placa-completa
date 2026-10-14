import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { completarDetran, temMultaRenainf, passaNoGateDetran, DETRAN_UFS } from './infosimples-detran'

// Gate por UF: desde 13/out (decisao do Cesar) TODAS as UFs consultam sempre,
// como SP, com ou sem multa RENAINF (caso KXK6G54, MG sem RENAINF). O gate
// 'renainf' segue suportado em passaNoGateDetran. Backfill por token ignora o gate.
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

  it('mapa: todas as UFs (20) com gate sempre; sem RENAINF todas passam no gate', () => {
    const ufs = Object.keys(DETRAN_UFS)
    expect(ufs).toHaveLength(20)
    for (const uf of ufs) {
      expect((DETRAN_UFS as any)[uf].gate).toBe('sempre')
      expect(passaNoGateDetran((DETRAN_UFS as any)[uf].gate, [{ ufJurisdicao: uf, renavam: '1', indicadorMultaRenainf: false }])).toBe(true)
    }
    // 'renainf' continua suportado (UF futura)
    expect(passaNoGateDetran('renainf', [{ indicadorMultaRenainf: false }])).toBe(false)
  })

  it('a tela do relatorio espera o bloco nas mesmas UFs do servidor', () => {
    const vue = readFileSync(join(process.cwd(), 'pages/premium/[token].vue'), 'utf8')
    const m = vue.match(/const UFS_COM_DETRAN = \[([^\]]+)\]/)
    expect(m).not.toBeNull()
    const ufsTela = m![1].split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean).sort()
    expect(ufsTela).toEqual(Object.keys(DETRAN_UFS).sort())
  })

  it('SP sem RENAINF: chama (sempre)', async () => {
    const f = setup()
    await completarDetran(fakeSb(), { id: 'p', placa: 'FYA8875' }, { response: [{ ufJurisdicao: 'SP', renavam: '1', indicadorMultaRenainf: false }] })
    expect(f).toHaveBeenCalledTimes(1)
  })

  for (const [uf, extra] of [['SC', {}], ['MG', { chassi: '9BWAG45UXJT036030' }]] as const) {
    it(`${uf} sem RENAINF: chama e grava o custo (gate sempre)`, async () => {
      const f = setup(); const sb = fakeSb()
      await completarDetran(sb, { id: 'p', placa: 'X' }, { response: [{ ufJurisdicao: uf, renavam: '1', indicadorMultaRenainf: false, ...extra }], semRetry: true })
      expect(f).toHaveBeenCalledTimes(1)
      expect(sb.inserts.length).toBeGreaterThanOrEqual(1)
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
