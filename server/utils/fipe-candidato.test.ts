import { describe, it, expect, vi, beforeEach } from 'vitest'
import { escolherMelhorFipe } from './fipe-candidato'

// Payload real (senatran_consultas + placa_cache, staging) da placa OXK7426:
// Etios HB X, cilindrada 1329 (1.3), a wdapi so devolveu 3 candidatos e
// todos errados (Sedan 1.5). O universo da fipe-api tem os 11 Etios 2014,
// incluindo o correto 002122-9 (X 1.3 hatch).
const SENATRAN_OXK7426 = {
  cilindrada: 1329,
  potencia: 90,
  descricaoMarcaModelo: 'TOYOTA/ETIOS HB X',
  anoModelo: 2014,
}

const WDAPI_OXK7426 = {
  marca: 'TOYOTA',
  MODELO: 'ETIOS HB X',
  SUBMODELO: 'ETIOS',
  VERSAO: 'X',
  anoModelo: '2014',
  extra: { combustivel: 'Alcool / Gasolina' },
  fipe: {
    dados: [
      { score: 52, codigo_fipe: '002125-3', texto_modelo: 'ETIOS X Sedan 1.5 Flex 16V 4p Mec.', texto_valor: 'R$ 41.540,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026' },
      { score: 51, codigo_fipe: '002127-0', texto_modelo: 'ETIOS XLS Sedan 1.5 Flex 16V 4p Mec.', texto_valor: 'R$ 43.745,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026' },
      { score: 51, codigo_fipe: '002126-1', texto_modelo: 'ETIOS XS Sedan1.5 Flex 16V 4p Mec.', texto_valor: 'R$ 41.407,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026' },
    ],
  },
}

// Universo real devolvido pelo endpoint novo da fipe-api (GET /modelos?marca=Toyota&ano=2014)
const FIPE_API_ETIOS_2014 = [
  { codigo_fipe: '002121-0', modelo: 'ETIOS 1.3 Flex 16V 5p Mec.', valor: 43833, combustivel: 'Flex', mes_referencia: 'julho de 2026' },
  { codigo_fipe: '002133-4', modelo: 'ETIOS CROSS 1.5 Flex 16V 5p Mec.', valor: 48347, combustivel: 'Flex', mes_referencia: 'julho de 2026' },
  { codigo_fipe: '002134-2', modelo: 'ETIOS PLATINUM 1.5 Flex 16V 5p Mec.', valor: 41505, combustivel: 'Flex', mes_referencia: 'julho de 2026' },
  { codigo_fipe: '002135-0', modelo: 'ETIOS PLATINUM Sed. 1.5 Flex 16V 4p Mec.', valor: 41580, combustivel: 'Flex', mes_referencia: 'julho de 2026' },
  { codigo_fipe: '002122-9', modelo: 'ETIOS X 1.3 Flex 16V 5p Mec.', valor: 42602, combustivel: 'Flex', mes_referencia: 'julho de 2026' },
  { codigo_fipe: '002125-3', modelo: 'ETIOS X Sedan 1.5 Flex 16V 4p Mec.', valor: 41120, combustivel: 'Flex', mes_referencia: 'julho de 2026' },
  { codigo_fipe: '002124-5', modelo: 'ETIOS XLS 1.5 Flex 16V 5p Mec.', valor: 43854, combustivel: 'Flex', mes_referencia: 'julho de 2026' },
  { codigo_fipe: '002127-0', modelo: 'ETIOS XLS Sedan 1.5 Flex 16V 4p Mec.', valor: 43965, combustivel: 'Flex', mes_referencia: 'julho de 2026' },
  { codigo_fipe: '002123-7', modelo: 'ETIOS XS  1.3 Flex 16V 5p Mec.', valor: 43785, combustivel: 'Flex', mes_referencia: 'julho de 2026' },
  { codigo_fipe: '002132-6', modelo: 'ETIOS XS 1.5 Flex 16V 5p Mec.', valor: 42847, combustivel: 'Flex', mes_referencia: 'julho de 2026' },
  { codigo_fipe: '002126-1', modelo: 'ETIOS XS Sedan1.5 Flex 16V 4p Mec.', valor: 41770, combustivel: 'Flex', mes_referencia: 'julho de 2026' },
]

function mockFetchFipeApiOk() {
  return vi.fn(async (url: string) => {
    if (String(url).includes('/modelos')) {
      return { ok: true, json: async () => ({ data: FIPE_API_ETIOS_2014 }) } as any
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
}

describe('escolherMelhorFipe', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('OXK7426 (Etios HB X 1.3): resolve por REGRA pro 002122-9, mesmo a wdapi so tendo Sedan 1.5', async () => {
    global.fetch = mockFetchFipeApiOk() as any

    const resultado = await escolherMelhorFipe({
      senatran: SENATRAN_OXK7426,
      wdapi: WDAPI_OXK7426,
      fipeApiUrl: 'https://fipe-api.placacompleta.com.br/api/v1',
      fipeApiToken: 'token-teste',
      // sem anthropicApiKey: nem precisa, o funil resolve sozinho
    })

    expect(resultado.decididoPor).toBe('regra')
    expect(resultado.escolhido?.codigo_fipe).toBe('002122-9')
    expect(resultado.confianca).toBe('alta')
  })

  it('fipe-api fora do ar: fail-open pro melhor score da wdapi (comportamento antigo)', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as any

    const resultado = await escolherMelhorFipe({
      senatran: SENATRAN_OXK7426,
      wdapi: WDAPI_OXK7426,
      fipeApiUrl: 'https://fipe-api.placacompleta.com.br/api/v1',
      fipeApiToken: 'token-teste',
    })

    expect(resultado.decididoPor).toBe('fallback')
    // comportamento de hoje: maior score da wdapi (002125-3, score 52)
    expect(resultado.escolhido?.codigo_fipe).toBe('002125-3')
  })

  it('sem marca/ano suficiente: fail-open sem nem tentar a fipe-api', async () => {
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as any

    const resultado = await escolherMelhorFipe({
      senatran: null,
      wdapi: { fipe: { dados: [{ score: 10, codigo_fipe: 'X', texto_modelo: 'Y', texto_valor: 'R$ 1,00' }] } },
      fipeApiUrl: 'https://fipe-api.placacompleta.com.br/api/v1',
      fipeApiToken: 'token-teste',
    })

    expect(resultado.decididoPor).toBe('fallback')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('mais de um sobrevivente e sem chave Anthropic: ambiguidade honesta (shortlist, sem escolher sozinho)', async () => {
    global.fetch = mockFetchFipeApiOk() as any

    // Descricao sem "HB"/"SED" pra nao filtrar carroceria, cilindrada generica
    // o bastante pra deixar >1 candidato de 1.5 no funil.
    const resultado = await escolherMelhorFipe({
      senatran: { cilindrada: 1496, descricaoMarcaModelo: 'TOYOTA/ETIOS XLS', anoModelo: 2014 },
      wdapi: { ...WDAPI_OXK7426, VERSAO: '' },
      fipeApiUrl: 'https://fipe-api.placacompleta.com.br/api/v1',
      fipeApiToken: 'token-teste',
    })

    expect(resultado.decididoPor).toBe('ambiguo')
    expect(resultado.escolhido).toBeNull()
    expect(resultado.candidatos.length).toBeGreaterThan(1)
  })

  it('Haiku decide com confianca alta quando ha mais de um sobrevivente', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes('/modelos')) {
        return { ok: true, json: async () => ({ data: FIPE_API_ETIOS_2014 }) } as any
      }
      if (String(url).includes('anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: '{"codigo_fipe":"002124-5","confianca":"alta","justificativa":"bate com XLS hatch 1.5"}' }],
          }),
        } as any
      }
      throw new Error(`unexpected fetch: ${url}`)
    }) as any

    const resultado = await escolherMelhorFipe({
      senatran: { cilindrada: 1496, descricaoMarcaModelo: 'TOYOTA/ETIOS XLS', anoModelo: 2014 },
      wdapi: { ...WDAPI_OXK7426, VERSAO: '' },
      fipeApiUrl: 'https://fipe-api.placacompleta.com.br/api/v1',
      fipeApiToken: 'token-teste',
      anthropicApiKey: 'chave-teste',
    })

    expect(resultado.decididoPor).toBe('haiku')
    expect(resultado.escolhido?.codigo_fipe).toBe('002124-5')
    expect(resultado.confianca).toBe('alta')
  })
})
