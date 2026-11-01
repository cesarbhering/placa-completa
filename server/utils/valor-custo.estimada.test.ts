import { describe, it, expect, vi, beforeEach } from 'vitest'

// getValorCusto com a fipe-api de mentira: duvida so de acabamento vira faixa +
// versao estimada (valor, historico e custo da versao do meio); familias
// diferentes seguem sem valor (Cesar, 01/nov/2026).
const historicoPedido: string[] = []
vi.mock('./fipe-api', () => ({
  fipePriceHistory: vi.fn(async (codigoModelo: string) => {
    historicoPedido.push(codigoModelo)
    return { consultadoEm: '2026-11-01T00:00:00Z', bruto: { data: { model: { id: 1 }, price_history: [{ year: 2020, prices: [{ year: 2025, month: 1, price: 80000 }, { year: 2026, month: 1, price: 76000 }] }] } } }
  }),
}))
vi.mock('./seguro-estimate', () => ({ getSeguroEstimado: vi.fn(async () => null) }))
vi.mock('./alerta-haiku', () => ({ alertarFalhaHaiku: vi.fn(async () => true) }))
vi.stubGlobal('useRuntimeConfig', () => ({ placaApiToken: 'x', fipeApiUrl: 'http://fipe', fipeApiToken: 't', anthropicApiKey: '' }))
vi.stubGlobal('consultarPlacaWdapi', async () => null)
vi.stubGlobal('aceitaCustoDeCarro', (s: string) => s === 'carro')

const { getValorCusto } = await import('./valor-custo')
const { fipeEIncerta } = await import('../../shared/fipe-incerta')
const { codigoFipeDoRelatorio } = await import('../../shared/codigo-fipe')

const BMW = ([
  ['803075-8', 'R 1250 GS Adventure Premium', 84027], ['803076-6', 'R 1250 GS Adventure Premium Exclusive', 85299],
  ['803074-0', 'R 1250 GS Premium Exclusive', 77517], ['803073-1', 'R 1250 GS Premium HP', 80099],
  ['803072-3', 'R 1250 GS Sport', 74053], ['803079-0', 'R 1250 RT Premium', 100821], ['803062-6', 'G 310 GS', 26872],
] as const).map(([codigo_fipe, modelo, valor]) => ({ codigo_fipe, modelo, valor, combustivel: 'Gasolina', mes_referencia: 'outubro de 2026' }))

function fipeApi(universo: any[], modelosDaMarca: { name: string; fipe_code: string }[] = []) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url)
    if (u.includes('/modelos')) return { ok: true, json: async () => ({ data: universo }) } as any
    if (u.endsWith('/brands')) return { ok: true, json: async () => ({ data: [{ id: 7, name: 'BMW', vehicle_type: 2 }, { id: 8, name: 'Honda', vehicle_type: 2 }] }) } as any
    if (u.includes('/brands/')) return { ok: true, json: async () => ({ data: modelosDaMarca }) } as any
    return { ok: false, json: async () => ({}) } as any
  }))
}

const moto = (descricaoMarcaModelo: string) => ({ ativo: true, segmento: 'moto' as const, senatran: { descricaoMarcaModelo, anoModelo: 2020, descricaoTipoVeiculo: 'MOTOCICLETA' } })

describe('getValorCusto: faixa + versao estimada', () => {
  beforeEach(() => { historicoPedido.length = 0 })

  it('BMW/R1250GS: mostra a versao do meio, com faixa, historico dela e a lista pra ajustar', async () => {
    fipeApi(BMW, [{ name: 'R 1250 GS Premium Exclusive', fipe_code: '9001' }])
    const vc: any = await getValorCusto('AAA0000', 'SP', null, moto('BMW/R1250GS'))
    expect(vc.fipeEstimada).toBe(true)
    expect(vc.fipeFaixa).toEqual({ min: 74053, max: 80099 })
    expect(vc.fipeCodigo).toBe('803074-0')
    expect(vc.fipeModelo).toBe('R 1250 GS Premium Exclusive')
    expect(vc.fipe).toContain('77.517')
    expect(vc.fipeNaoLocalizado).toBeUndefined()
    expect(historicoPedido).toEqual(['9001'])
    expect(vc.historico).toHaveLength(2)
    // A lista da duvida continua no snapshot (fluxo fipe-escolha).
    expect(vc.fipeCandidato.decididoPor).toBe('ambiguo')
    expect(vc.fipeCandidato.candidatos.map((c: any) => c.codigo_fipe).sort()).toEqual(['803072-3', '803073-1', '803074-0'])
    // A tela mostra o valor (nao e mais "incerta") e o codigo da versao estimada.
    expect(fipeEIncerta(vc)).toBe(false)
    expect(codigoFipeDoRelatorio(vc)).toBe('803074-0')
  })

  it('scooter x moto grande (familias diferentes): continua sem valor, so a lista', async () => {
    const universo = [
      { codigo_fipe: '811001-1', modelo: 'PCX 150 DLX', valor: 14000, combustivel: 'Gasolina', mes_referencia: 'x' },
      { codigo_fipe: '811002-0', modelo: 'PCX 150 Sport', valor: 58000, combustivel: 'Gasolina', mes_referencia: 'x' },
    ]
    fipeApi(universo)
    const vc: any = await getValorCusto('AAA0000', 'SP', null, moto('HONDA/PCX 150'))
    expect(vc.fipe).toBeNull()
    expect(vc.fipeNaoLocalizado).toBe(true)
    expect(vc.fipeEstimada).toBeUndefined()
    expect(fipeEIncerta(vc)).toBe(true)
    expect(historicoPedido).toEqual([])
  })
})
