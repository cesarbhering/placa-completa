// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { escolherMelhorFipe, tabelaFipe, codigoDaTabela, marcaParaFipeApi } from './fipe-candidato'
import { tabelaDoSegmento } from '../../shared/tabela-fipe'

// Caso real PUF7J27: caminhao VW 24.280 CRM 6X2 2014. A fonte livre mandou
// candidatos da tabela de CARROS (Touareg, Amarok) e o funil buscou o universo
// em "VW - VolksWagen" (carros). O certo e a tabela de caminhoes:
// 24-280 E Constel. 6x2 (515141-4).

const SENATRAN_PUF7J27 = {
  descricaoMarcaModelo: 'VW/24.280 CRM 6X2',
  descricaoTipoVeiculo: 'CAMINHAO',
  descricaoEspecie: 'CARGA',
  anoModelo: 2014,
  cilindrada: 8900,
  codigoCombustivel: 3,
}

const WDAPI_PUF7J27 = {
  marca: 'VW',
  MODELO: '24.280 CRM 6X2',
  anoModelo: '2014',
  fipe: {
    dados: [
      { score: 40, codigo_fipe: '005266-3', texto_marca: 'VW - VolksWagen', texto_modelo: 'TOUAREG 3.6 24V V6 280cv Tiptronic 5p', texto_valor: 'R$ 75.509,00' },
      { score: 38, codigo_fipe: '005330-9', texto_marca: 'VW - VolksWagen', texto_modelo: 'AMAROK CD2.0 16V/S CD2.0 16V TDI 4x4 Die', texto_valor: 'R$ 73.537,00' },
    ],
  },
}

const CARROS_VW_2014 = [
  { codigo_fipe: '005266-3', modelo: 'TOUAREG 3.6 24V V6 280cv Tiptronic 5p', valor: 75509, combustivel: 'Gasolina' },
  { codigo_fipe: '005330-9', modelo: 'AMAROK CD2.0 16V/S CD2.0 16V TDI 4x4 Die', valor: 73537, combustivel: 'Diesel' },
]

const CAMINHOES_VW_2014 = [
  { codigo_fipe: '515141-4', modelo: '24-280 E Constel. 6x2 2p (diesel)(E5)', valor: 255574, combustivel: 'Diesel' },
  { codigo_fipe: '515152-0', modelo: '24-280 E Constel. 8x2 2p (diesel)(E5)', valor: 274087, combustivel: 'Diesel' },
  { codigo_fipe: '515140-6', modelo: '24-330 E Constel. 6x2 2p (diesel)(E5)', valor: 255715, combustivel: 'Diesel' },
  { codigo_fipe: '515100-7', modelo: '17-280 Constellation 4x2 2p (diesel)(E5)', valor: 210000, combustivel: 'Diesel' },
]

function mockFipeApi(porMarca: Record<string, any[]>) {
  const chamadas: string[] = []
  const fn = vi.fn(async (url: string) => {
    const u = new URL(String(url))
    if (u.pathname.endsWith('/modelos')) {
      const marca = u.searchParams.get('marca') || ''
      chamadas.push(marca)
      // A fipe-api casa marca sem caixa e mistura tabelas de mesmo nome.
      const chave = Object.keys(porMarca).find((k) => k.toLowerCase() === marca.toLowerCase())
      return { ok: true, json: async () => ({ data: chave ? porMarca[chave] : [] }) } as any
    }
    // /brands e /brands/:id/models (resolucao do codigo_modelo): sem dado.
    return { ok: false, json: async () => ({}) } as any
  })
  return { fn, chamadas }
}

describe('tabelaFipe', () => {
  it('caminhao, cavalo e onibus vao pra tabela de caminhoes', () => {
    expect(tabelaFipe({ descricaoTipoVeiculo: 'CAMINHAO' })).toBe('caminhoes')
    expect(tabelaFipe({ descricaoTipoVeiculo: 'CAMINHAO TRATOR' })).toBe('caminhoes')
    expect(tabelaFipe({ descricaoTipoVeiculo: 'ONIBUS' })).toBe('caminhoes')
    expect(tabelaFipe({ descricaoTipoVeiculo: 'MICROONIBUS' })).toBe('caminhoes')
  })
  it('motocicleta, motoneta e ciclomotor vao pra tabela de motos', () => {
    expect(tabelaFipe({ descricaoTipoVeiculo: 'MOTOCICLETA' })).toBe('motos')
    expect(tabelaFipe({ descricaoTipoVeiculo: 'MOTONETA' })).toBe('motos')
    expect(tabelaFipe({ descricaoTipoVeiculo: 'CICLOMOTOR' })).toBe('motos')
  })
  it('o resto e carro, inclusive caminhonete', () => {
    expect(tabelaFipe({ descricaoTipoVeiculo: 'AUTOMOVEL' })).toBe('carros')
    expect(tabelaFipe({ descricaoTipoVeiculo: 'CAMINHONETE' })).toBe('carros')
    expect(tabelaFipe({ descricaoTipoVeiculo: 'UTILITARIO' })).toBe('carros')
    expect(tabelaFipe(null)).toBe('carros')
  })
  it('sem tipo no registro, vale o segmento', () => {
    expect(tabelaFipe(null, {}, 'caminhao')).toBe('caminhoes')
    expect(tabelaFipe(null, {}, 'moto')).toBe('motos')
    expect(tabelaFipe(null, {}, 'carro')).toBe('carros')
  })
  it('codigo FIPE diz a tabela', () => {
    expect(codigoDaTabela('515141-4', 'caminhoes')).toBe(true)
    expect(codigoDaTabela('005266-3', 'caminhoes')).toBe(false)
    expect(codigoDaTabela('811116-2', 'motos')).toBe(true)
    expect(codigoDaTabela('014001-0', 'motos')).toBe(false)
    expect(codigoDaTabela('005266-3', 'carros')).toBe(true)
    expect(codigoDaTabela('811116-2', 'carros')).toBe(false)
    expect(tabelaDoSegmento('caminhao')).toBe('caminhoes')
    expect(tabelaDoSegmento('outro')).toBe('carros')
  })
  it('marca na tabela de caminhoes', () => {
    expect(marcaParaFipeApi('VW', 'caminhoes')).toBe('VOLKSWAGEN')
    expect(marcaParaFipeApi('M.BENZ', 'caminhoes')).toBe('MERCEDES-BENZ')
    expect(marcaParaFipeApi('SCANIA', 'caminhoes')).toBe('SCANIA')
    expect(marcaParaFipeApi('VW')).toBe('VW - VolksWagen')
  })
})

describe('caminhao (caso PUF7J27)', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('busca na tabela de caminhoes e acha o 24-280 6x2 por regra', async () => {
    const { fn, chamadas } = mockFipeApi({ VOLKSWAGEN: CAMINHOES_VW_2014, 'VW - VolksWagen': CARROS_VW_2014 })
    vi.stubGlobal('fetch', fn)
    const r = await escolherMelhorFipe({
      senatran: SENATRAN_PUF7J27, wdapi: WDAPI_PUF7J27, segmento: 'caminhao',
      fipeApiUrl: 'http://fipe', fipeApiToken: 't',
    })
    expect(chamadas).toEqual(['VOLKSWAGEN'])
    expect(r.escolhido?.codigo_fipe).toBe('515141-4')
    expect(r.decididoPor).toBe('regra')
    expect(r.confianca).toBe('alta')
  })

  it('nenhum candidato de carro sobra, nem no fallback', async () => {
    const { fn } = mockFipeApi({ VOLKSWAGEN: [], 'VW - VolksWagen': CARROS_VW_2014 })
    vi.stubGlobal('fetch', fn)
    const r = await escolherMelhorFipe({
      senatran: SENATRAN_PUF7J27, wdapi: WDAPI_PUF7J27, segmento: 'caminhao',
      fipeApiUrl: 'http://fipe', fipeApiToken: 't',
    })
    expect(r.decididoPor).toBe('fallback')
    expect(r.escolhido).toBeNull()
  })

  it('so com o tipo do registro (sem segmento) ja vai pra tabela certa', async () => {
    const { fn, chamadas } = mockFipeApi({ VOLKSWAGEN: CAMINHOES_VW_2014 })
    vi.stubGlobal('fetch', fn)
    const r = await escolherMelhorFipe({
      senatran: SENATRAN_PUF7J27, wdapi: WDAPI_PUF7J27,
      fipeApiUrl: 'http://fipe', fipeApiToken: 't',
    })
    expect(chamadas).toEqual(['VOLKSWAGEN'])
    expect(r.escolhido?.codigo_fipe).toBe('515141-4')
  })
})

describe('van registrada como caminhao (Renault Master)', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('sem o modelo na tabela de caminhoes, aceita a versao de carro com o mesmo nome', async () => {
    const { fn, chamadas } = mockFipeApi({
      RENAULT: [],
      Renault: [],
    })
    // A fipe-api de verdade casa sem caixa: as duas buscas caem no mesmo lugar.
    const CARROS_RENAULT = [
      { codigo_fipe: '025230-9', modelo: 'Master 2.5 dCi Executivo 115cv 16L', valor: 73544, combustivel: 'Diesel' },
      { codigo_fipe: '025104-3', modelo: 'Sandero Expression 1.6 8V Flex', valor: 30000, combustivel: 'Flex' },
    ]
    fn.mockImplementation(async (url: string) => {
      const u = new URL(String(url))
      if (u.pathname.endsWith('/modelos')) {
        chamadas.push(u.searchParams.get('marca') || '')
        return { ok: true, json: async () => ({ data: CARROS_RENAULT }) } as any
      }
      return { ok: false, json: async () => ({}) } as any
    })
    vi.stubGlobal('fetch', fn)
    const r = await escolherMelhorFipe({
      senatran: { descricaoMarcaModelo: 'RENAULT/MASTER 2.5 DCI', descricaoTipoVeiculo: 'CAMINHAO', anoModelo: 2012, codigoCombustivel: 3 },
      wdapi: { marca: 'RENAULT', MODELO: 'MASTER', anoModelo: '2012', fipe: { dados: [] } },
      segmento: 'caminhao', fipeApiUrl: 'http://fipe', fipeApiToken: 't',
    })
    expect(r.escolhido?.codigo_fipe).toBe('025230-9')
    expect(r.candidatos.map((c) => c.codigo_fipe)).not.toContain('025104-3')
  })
})

describe('moto: candidato de carro da fonte livre nao entra', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  const HONDA = [
    { codigo_fipe: '811116-2', modelo: 'PCX 150/DLX', valor: 15328, combustivel: 'Gasolina' },
    { codigo_fipe: '811100-6', modelo: 'CB 1000R/ABS', valor: 58380, combustivel: 'Gasolina' },
    { codigo_fipe: '014001-0', modelo: 'PCX Sedan 2.0 Flex Aut.', valor: 118000, combustivel: 'Flex' },
  ]

  it('MOTOCICLETA com candidato de carro de score alto: escolhe a moto', async () => {
    const { fn } = mockFipeApi({ HONDA })
    vi.stubGlobal('fetch', fn)
    const r = await escolherMelhorFipe({
      senatran: { descricaoMarcaModelo: 'HONDA/PCX 150 DLX', descricaoTipoVeiculo: 'MOTOCICLETA', anoModelo: 2020 },
      wdapi: {
        marca: 'HONDA', MODELO: 'PCX 150 DLX', anoModelo: '2020',
        fipe: { dados: [{ score: 95, codigo_fipe: '014001-0', texto_marca: 'Honda', texto_modelo: 'PCX Sedan 2.0 Flex Aut.', texto_valor: 'R$ 118.000,00' }] },
      },
      fipeApiUrl: 'http://fipe', fipeApiToken: 't',
    })
    expect(r.escolhido?.codigo_fipe).toBe('811116-2')
    expect(r.candidatos.every((c) => c.codigo_fipe.startsWith('8'))).toBe(true)
  })
})

describe('getValorCusto: ambiguo nao vira valor', () => {
  const escolher = vi.fn()
  let getValorCusto: any

  beforeEach(async () => {
    vi.resetModules()
    vi.doMock('./fipe-candidato', async (orig) => ({ ...(await orig<any>()), escolherMelhorFipe: (...a: any[]) => escolher(...a) }))
    vi.doMock('./seguro-estimate', () => ({ getSeguroEstimado: async () => ({ premioAnual: 4281 }) }))
    getValorCusto = (await import('./valor-custo')).getValorCusto
    escolher.mockReset()
    vi.stubGlobal('useRuntimeConfig', () => ({ placaApiToken: 'x', fipeApiUrl: 'https://fipe.test', fipeApiToken: 't' }))
    vi.stubGlobal('consultarPlacaWdapi', async () => ({
      ...WDAPI_PUF7J27,
      fipe: { dados: [{ score: 40, codigo_fipe: '005266-3', codigo_modelo: '123', texto_modelo: 'TOUAREG 3.6 24V V6 280cv Tiptronic 5p', texto_valor: 'R$ 75.509,00' }] },
    }))
    vi.stubGlobal('$fetch', async () => ({ model: { id: 1 }, price_history: [{ year: 2014, prices: [{ year: 2025, month: 1, price: 1 }, { year: 2025, month: 2, price: 2 }] }] }))
    vi.stubGlobal('aceitaCustoDeCarro', (s: string) => s === 'carro')
    vi.stubGlobal('getRegiaoSusep', () => null)
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock('./fipe-candidato'); vi.doUnmock('./seguro-estimate') })

  it('caminhao: candidato de carro da fonte nao vira valor mesmo no fallback', async () => {
    escolher.mockResolvedValue({ escolhido: null, decididoPor: 'fallback', candidatos: [] })
    const vc = await getValorCusto('PUF7J27', 'SP', null, { ativo: true, segmento: 'caminhao', senatran: SENATRAN_PUF7J27 })
    expect(vc?.fipe).toBeNull()
    expect(vc?.fipeModelo).toBeNull()
    expect(vc?.historico).toBeNull()
    expect(vc?.seguroAnual).toBeNull()
  })

  it('carro ambiguo/baixa: sem valor, modelo, historico e seguro; guarda a shortlist', async () => {
    const amarok = { codigo_fipe: '005330-9', modelo: 'AMAROK', valor: 73537 }
    escolher.mockResolvedValue({ escolhido: amarok, decididoPor: 'ambiguo', confianca: 'baixa', candidatos: [amarok, { ...amarok, codigo_fipe: '005337-6' }] })
    const vc = await getValorCusto('ABC1234', 'SP', null, { ativo: true, segmento: 'carro', senatran: { descricaoTipoVeiculo: 'AUTOMOVEL' } })
    expect(vc?.fipe).toBeNull()
    expect(vc?.fipeModelo).toBeNull()
    expect(vc?.fipeCodigo).toBeNull()
    expect(vc?.historico).toBeNull()
    expect(vc?.seguroAnual).toBeNull()
    expect(vc?.custo5anos).toBeNull()
    expect(vc?.fipeCandidato?.decididoPor).toBe('ambiguo')
    expect(vc?.fipeCandidato?.candidatos).toHaveLength(2)
  })

  it('carro com decisao confiante segue mostrando o valor', async () => {
    const touareg = { codigo_fipe: '005266-3', codigoModelo: '123', modelo: 'TOUAREG 3.6', valor: 75509, texto_valor: 'R$ 75.509,00' }
    escolher.mockResolvedValue({ escolhido: touareg, decididoPor: 'regra', confianca: 'alta', candidatos: [touareg] })
    const vc = await getValorCusto('ABC1234', 'SP', null, { ativo: true, segmento: 'carro', senatran: { descricaoTipoVeiculo: 'AUTOMOVEL' } })
    expect(vc?.fipe).toBe('R$ 75.509,00')
    expect(vc?.fipeCodigo).toBe('005266-3')
  })
})
