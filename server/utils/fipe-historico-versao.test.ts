// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { alvoDoSnapshot, historicoDaVersao } from './fipe-historico-versao'

const SNAP = {
  segmento: 'carro',
  consulta: { placa: 'DMV4C01', response: [{ descricaoMarcaModelo: 'TOYOTA/COROLLA XEI18VVT', anoModelo: 2004 }] },
  valorCusto: { fipeCandidato: { decididoPor: 'ambiguo', candidatos: [
    { codigo_fipe: '002061-3', modelo: 'Corolla XEi 1.8/1.8 Flex 16V Aut.', valor: 34812 },
    { codigo_fipe: '002028-1', modelo: 'Corolla XEi 1.8/1.8 Flex 16V Mec.', valor: 34067 },
  ] } },
}

describe('alvoDoSnapshot (nao vira proxy aberto da fipe-api)', () => {
  it('codigo da shortlist: modelo, marca e ano do relatorio', () => {
    expect(alvoDoSnapshot(SNAP, '002061-3')).toEqual({ modelo: 'Corolla XEi 1.8/1.8 Flex 16V Aut.', marca: 'TOYOTA', anoModelo: 2004 })
  })
  it('codigo fora da shortlist, mal formado ou sem snapshot: nada', () => {
    expect(alvoDoSnapshot(SNAP, '002060-5')).toBeNull()
    expect(alvoDoSnapshot(SNAP, '../brands')).toBeNull()
    expect(alvoDoSnapshot(null, '002061-3')).toBeNull()
    expect(alvoDoSnapshot({ ...SNAP, consulta: null }, '002061-3')).toBeNull()
  })
  it('caminhao usa a marca da tabela de caminhoes', () => {
    const snap = { ...SNAP, segmento: 'caminhao', consulta: { response: { descricaoMarcaModelo: 'VW/24.280 CRM 6X2', anoModelo: 2014 } },
      valorCusto: { fipeCandidato: { candidatos: [{ codigo_fipe: '515141-4', modelo: '24-280 E Constel. 6x2 2p (diesel)(E5)' }] } } }
    expect(alvoDoSnapshot(snap, '515141-4')?.marca).toBe('VOLKSWAGEN')
  })
})

describe('historicoDaVersao', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('resolve o codigo interno pelo nome e devolve a serie do ano-modelo', async () => {
    const chamadas: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      chamadas.push(url)
      const ok = (data: any) => ({ ok: true, json: async () => ({ data }) })
      if (url.endsWith('/brands')) return ok([{ id: 9, name: 'Toyota' }, { id: 1, name: 'Fiat' }])
      if (url.endsWith('/brands/9/models')) return ok([{ name: 'Corolla XEi 1.8/1.8 Flex 16V Aut.', fipe_code: '2229' }])
      if (url.endsWith('/models/fipe/2229/price-history')) return ok({ price_history: [
        { year: 2004, prices: [{ year: 2025, month: 1, price: 30000 }, { year: 2025, month: 2, price: 29500 }] },
        { year: 2005, prices: [{ year: 2025, month: 1, price: 99999 }, { year: 2025, month: 2, price: 99999 }] },
      ] })
      return { ok: false, json: async () => ({}) }
    }))
    const alvo = alvoDoSnapshot(SNAP, '002061-3')!
    const pts = await historicoDaVersao(alvo, '002061-3', 'http://fipe', 't')
    expect(pts).toEqual([{ label: 'Jan/25', price: 30000 }, { label: 'Fev/25', price: 29500 }])
    expect(chamadas).not.toContain('http://fipe/brands/1/models')
  })
})
