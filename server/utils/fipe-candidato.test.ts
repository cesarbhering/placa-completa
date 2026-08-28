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

// Payload real (senatran_consultas + placa_cache, staging) da placa QNL9E19:
// Onix 1.4MT LT (cambio MANUAL na descricao SENATRAN). A wdapi ja tem o
// candidato certo entre os 8, mas so cilindrada+carroceria+versao deixam 2
// sobreviventes (LT 1.4 Mec. e LT 1.4 Aut.) - o desempate e o cambio (MT).
const SENATRAN_QNL9E19 = {
  cilindrada: 1400,
  potencia: 106,
  descricaoMarcaModelo: 'CHEVROLET/ONIX 1.4MT LT',
  anoModelo: 2018,
}

const WDAPI_QNL9E19 = {
  marca: 'CHEVROLET', // taxonomia da apiplacas/SENATRAN
  MODELO: 'ONIX 1.4MT LT',
  SUBMODELO: 'ONIX',
  VERSAO: 'LT',
  anoModelo: '2018',
  extra: { combustivel: 'Alcool / Gasolina' },
  fipe: {
    dados: [
      { score: 47, codigo_fipe: '004488-1', codigo_modelo: '8239', texto_modelo: 'ONIX HATCH ADVANTAGE 1.4 8V Flex 5p Aut.', texto_valor: 'R$ 63.774,00', texto_marca: 'GM - Chevrolet', combustivel: 'Flex', mes_referencia: 'agosto de 2026' },
      { score: 54, codigo_fipe: '004460-1', codigo_modelo: '7120', texto_modelo: 'ONIX HATCH EFFECT 1.4 8V F.Power 5p Mec.', texto_valor: 'R$ 60.953,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026' },
      { score: 53, codigo_fipe: '004473-3', codigo_modelo: '7691', texto_modelo: 'ONIX HATCH Joy 1.0 8V Flex 5p Mec.', texto_valor: 'R$ 46.737,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026' },
      { score: 55, codigo_fipe: '004424-5', codigo_modelo: '6232', texto_modelo: 'ONIX HATCH LT 1.0 8V FlexPower 5p Mec.', texto_valor: 'R$ 52.792,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026' },
      { score: 54, codigo_fipe: '004425-3', codigo_modelo: '6233', texto_modelo: 'ONIX HATCH LT 1.4 8V FlexPower 5p Mec.', texto_valor: 'R$ 58.089,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026' },
      { score: 54, codigo_fipe: '004439-3', codigo_modelo: '6531', texto_modelo: 'ONIX HATCH LTZ 1.4 8V FlexPower 5p Aut.', texto_valor: 'R$ 64.924,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026' },
      { score: 53, codigo_fipe: '004426-1', codigo_modelo: '6234', texto_modelo: 'ONIX HATCH LTZ 1.4 8V FlexPower 5p Mec.', texto_valor: 'R$ 60.787,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026' },
      { score: 55, codigo_fipe: '004438-5', codigo_modelo: '6530', texto_modelo: 'ONIX HATCH LT 1.4 8V FlexPower 5p Aut.', texto_valor: 'R$ 62.023,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026' },
    ],
  },
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

  // Bug reportado apos re-emissao real em prod: o snapshot do Etios acertou
  // o codigo_fipe (002122-9), mas historico/seguroAnual/quedaAno vieram NULL
  // porque o candidato veio do universo da fipe-api (sem codigo_modelo) e
  // ninguem buscava esse id. fipe-candidato.ts resolve isso chamando
  // /brands + /brands/{id}/models e casando pelo nome do modelo.
  it('resolve codigoModelo do escolhido via /brands quando ele nao veio da wdapi (fix historico nulo)', async () => {
    global.fetch = vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('/modelos')) return { ok: true, json: async () => ({ data: FIPE_API_ETIOS_2014 }) } as any
      if (u.endsWith('/brands')) {
        return { ok: true, json: async () => ({ data: [{ id: 98, name: 'Toyota' }] }) } as any
      }
      if (u.includes('/brands/98/models')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 6321, name: 'ETIOS X 1.3 Flex 16V 5p Mec.', fipe_code: '6246' }] }),
        } as any
      }
      throw new Error(`unexpected fetch: ${u}`)
    }) as any

    const resultado = await escolherMelhorFipe({
      senatran: SENATRAN_OXK7426,
      wdapi: WDAPI_OXK7426,
      fipeApiUrl: 'https://fipe-api.placacompleta.com.br/api/v1',
      fipeApiToken: 'token-teste',
    })

    expect(resultado.decididoPor).toBe('regra')
    expect(resultado.escolhido?.codigo_fipe).toBe('002122-9')
    expect(resultado.escolhido?.codigoModelo).toBe('6246')
  })

  it('QNL9E19 (Onix 1.4MT LT): resolve por REGRA pro 004425-3 (LT 1.4 Mec.), MT desempata Mec vs Aut, LT nao casa com LTZ, e usa texto_marca "GM - Chevrolet" (nao wdapi.marca "CHEVROLET")', async () => {
    const urlsChamadas: string[] = []
    global.fetch = vi.fn(async (url: string) => {
      urlsChamadas.push(String(url))
      if (String(url).includes('/modelos')) {
        // universo vazio da fipe-api: a wdapi ja tem os 8 candidatos reais,
        // o teste foca em confirmar a marca certa na query e o funil.
        return { ok: true, json: async () => ({ data: [] }) } as any
      }
      throw new Error(`unexpected fetch: ${url}`)
    }) as any

    const resultado = await escolherMelhorFipe({
      senatran: SENATRAN_QNL9E19,
      wdapi: WDAPI_QNL9E19,
      fipeApiUrl: 'https://fipe-api.placacompleta.com.br/api/v1',
      fipeApiToken: 'token-teste',
    })

    // a query pra fipe-api usa o nome CANONICO da FIPE (texto_marca), nao o
    // nome da apiplacas/SENATRAN - achado real: "CHEVROLET" sozinho falha
    // na fipe-api (existe uma marca "CHEVROLET" so de caminhoes, separada
    // de "GM - Chevrolet" dos carros).
    expect(urlsChamadas.some((u) => u.includes(encodeURIComponent('GM - Chevrolet')))).toBe(true)
    expect(urlsChamadas.some((u) => u.includes('marca=CHEVROLET') && !u.includes('GM'))).toBe(false)

    expect(resultado.decididoPor).toBe('regra')
    expect(resultado.escolhido?.codigo_fipe).toBe('004425-3')
    expect(resultado.escolhido?.codigoModelo).toBe('6233')
  })
})
