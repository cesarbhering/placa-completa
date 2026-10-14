import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { escolherMelhorFipe, parseVereditoHaiku, trechoSaneado, schemaVeredito } from './fipe-candidato'
import { alertarFalhaHaiku } from './alerta-haiku'

vi.mock('./alerta-haiku', () => ({ alertarFalhaHaiku: vi.fn(async () => true) }))

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
            content: [{ type: 'text', text: '{"codigo_fipe":"002124-5","confianca":"alta","justificativa":"bate com XLS hatch 1.5"}' }],
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

  // Payload real (senatran_consultas + placa_cache, staging) da placa
  // OLO2I01: Fiat 500 Cult, cilindrada 1400 (1.4), sem NENHUM sinal de
  // cambio na descricao SENATRAN ("I/FIAT 500 CULT"). Versao "CULT" isola
  // os 2 candidatos Cult (exclui Lounge/Sport), mas Dualogic vs Mec. so se
  // resolve por cambio - que a gente nao tem como saber aqui. Isso E
  // ambiguidade legitima: tem que sair shortlist, nao chute.
  const SENATRAN_OLO2I01 = {
    cilindrada: 1400,
    potencia: 88,
    descricaoMarcaModelo: 'I/FIAT 500 CULT',
    anoModelo: 2012,
  }

  const WDAPI_OLO2I01 = {
    marca: 'FIAT',
    MODELO: '500 CULT',
    SUBMODELO: '500',
    VERSAO: 'CULT',
    anoModelo: '2012',
    extra: { combustivel: 'Alcool / Gasolina' },
    fipe: {
      dados: [
        { score: 75, codigo_fipe: '001362-5', codigo_modelo: '5613', texto_modelo: '500 Cult 1.4 Flex 8V EVO Dualogic', texto_valor: 'R$ 42.423,00', texto_marca: 'Fiat', combustivel: 'Flex', mes_referencia: 'julho de 2026' },
        { score: 73, codigo_fipe: '001361-7', codigo_modelo: '5614', texto_modelo: '500 Cult 1.4 Flex 8V EVO Mec.', texto_valor: 'R$ 41.655,00', combustivel: 'Flex', mes_referencia: 'julho de 2026' },
        { score: 46, codigo_fipe: '001360-9', codigo_modelo: '5615', texto_modelo: '500 Lounge Air 1.4/ 1.4 Flex 16V Aut.', texto_valor: 'R$ 54.307,00', combustivel: 'Gasolina', mes_referencia: 'julho de 2026' },
        { score: 46, codigo_fipe: '001358-7', codigo_modelo: '5617', texto_modelo: '500 Sport Air 1.4 16V/1.4 Flex Mec.', texto_valor: 'R$ 48.188,00', combustivel: 'Gasolina', mes_referencia: 'julho de 2026' },
      ],
    },
  }

  it('OLO2I01 (Fiat 500 Cult): AMBIGUO entre Dualogic e Mec. quando nao ha sinal de cambio (shortlist, sem chutar)', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes('/modelos')) return { ok: true, json: async () => ({ data: [] }) } as any
      throw new Error(`unexpected fetch: ${url}`)
    }) as any

    const resultado = await escolherMelhorFipe({
      senatran: SENATRAN_OLO2I01,
      wdapi: WDAPI_OLO2I01,
      fipeApiUrl: 'https://fipe-api.placacompleta.com.br/api/v1',
      fipeApiToken: 'token-teste',
      // sem anthropicApiKey: sem cambio na descricao, nem o Haiku teria base -
      // o funil ja deve devolver ambiguo sozinho.
    })

    expect(resultado.decididoPor).toBe('ambiguo')
    expect(resultado.escolhido).toBeNull()
    const codigos = resultado.candidatos.map((c) => c.codigo_fipe).sort()
    expect(codigos).toEqual(['001361-7', '001362-5'])
  })
})

// ---------------------------------------------------------------------------
// Caso real FZK5F28 (P0): scooter PCX 150 virou CB 1000R de R$58 mil.
// A fonte livre ja trazia o candidato certo com score 92; o funil de CARRO
// eliminou ele por causa de VERSAO="ABS" (o nome FIPE do PCX nao tem "ABS"),
// sobraram tres motos grandes que TEM "ABS" no nome, e o juiz escolheu uma.
// ---------------------------------------------------------------------------
const SENATRAN_FZK5F28 = {
  cilindrada: 149,
  potencia: 13,
  descricaoMarcaModelo: 'HONDA/PCX 150 DLX ABS',
  anoModelo: 2020,
  descricaoTipoVeiculo: 'MOTOCICLETA',
  descricaoEspecie: 'PASSAGEIRO',
}

const WDAPI_FZK5F28 = {
  marca: 'HONDA',
  MODELO: 'PCX 150 DLX ABS',
  SUBMODELO: 'PCX',
  VERSAO: 'ABS',
  segmento: 'Moto',
  anoModelo: '2020',
  extra: { tipo_veiculo: 'Motoneta', combustivel: 'Gasolina' },
  fipe: {
    dados: [
      { score: 92, codigo_fipe: '811116-2', texto_modelo: 'PCX 150/DLX', texto_valor: 'R$ 15.328,00', combustivel: 'Gasolina', mes_referencia: 'agosto de 2026', codigo_modelo: '7139' },
      { score: 55, codigo_fipe: '811117-0', texto_modelo: 'PCX 150 SPORT', texto_valor: 'R$ 15.010,00', combustivel: 'Gasolina', mes_referencia: 'agosto de 2026' },
    ],
  },
}

// Universo Honda 2020 da fipe-api: motos grandes e carros, tudo junto.
const FIPE_API_HONDA_2020 = [
  { codigo_fipe: '811100-6', modelo: 'CB 1000R/ABS', valor: 58380, combustivel: 'Gasolina', mes_referencia: 'julho de 2026' },
  { codigo_fipe: '811101-4', modelo: 'NC 750X ABS', valor: 42100, combustivel: 'Gasolina', mes_referencia: 'julho de 2026' },
  { codigo_fipe: '811102-2', modelo: 'XRE 300 ABS', valor: 24500, combustivel: 'Gasolina', mes_referencia: 'julho de 2026' },
  { codigo_fipe: '811116-2', modelo: 'PCX 150/DLX', valor: 15328, combustivel: 'Gasolina', mes_referencia: 'julho de 2026' },
  { codigo_fipe: '014001-0', modelo: 'CIVIC Sedan EXL 2.0 Flex Aut.', valor: 118000, combustivel: 'Flex', mes_referencia: 'julho de 2026' },
]

function mockFetchHonda2020() {
  return vi.fn(async (url: string) => {
    if (String(url).includes('/modelos')) {
      return { ok: true, json: async () => ({ data: FIPE_API_HONDA_2020 }) } as any
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
}

describe('moto: PCX 150 (caso FZK5F28)', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('escolhe o PCX 150/DLX, nao a CB 1000R', async () => {
    vi.stubGlobal('fetch', mockFetchHonda2020())
    const r = await escolherMelhorFipe({
      senatran: SENATRAN_FZK5F28, wdapi: WDAPI_FZK5F28,
      fipeApiUrl: 'http://fipe', fipeApiToken: 't',
    })
    expect(r.escolhido?.codigo_fipe).toBe('811116-2')
    expect(r.escolhido?.modelo).toContain('PCX')
    expect(r.escolhido?.valor).toBe(15328)
  })

  it('nao devolve ambiguidade num caso que a fonte livre ja resolvia', async () => {
    vi.stubGlobal('fetch', mockFetchHonda2020())
    const r = await escolherMelhorFipe({
      senatran: SENATRAN_FZK5F28, wdapi: WDAPI_FZK5F28,
      fipeApiUrl: 'http://fipe', fipeApiToken: 't',
    })
    expect(r.decididoPor).not.toBe('ambiguo')
    expect(r.confianca).toBe('alta')
  })

  it('nenhum candidato de moto grande sobra na shortlist', async () => {
    vi.stubGlobal('fetch', mockFetchHonda2020())
    const r = await escolherMelhorFipe({
      senatran: SENATRAN_FZK5F28, wdapi: WDAPI_FZK5F28,
      fipeApiUrl: 'http://fipe', fipeApiToken: 't',
    })
    const nomes = r.candidatos.map((c) => c.modelo).join(' ')
    expect(nomes).not.toContain('CB 1000R')
    expect(nomes).not.toContain('NC 750X')
    expect(nomes).not.toContain('CIVIC')
  })

  it('sem o atalho de score alto, o funil de moto ainda nao deixa sobrar moto grande', async () => {
    vi.stubGlobal('fetch', mockFetchHonda2020())
    // mesma moto, mas a fonte livre veio com score baixo: cai no funil
    const wdapiFraco = { ...WDAPI_FZK5F28, fipe: { dados: WDAPI_FZK5F28.fipe.dados.map((d) => ({ ...d, score: 40 })) } }
    const r = await escolherMelhorFipe({
      senatran: SENATRAN_FZK5F28, wdapi: wdapiFraco,
      fipeApiUrl: 'http://fipe', fipeApiToken: 't',
    })
    const nomes = r.candidatos.map((c) => c.modelo).join(' ')
    expect(nomes).not.toContain('CB 1000R')
    expect(nomes).toContain('PCX')
  })
})

// ---------------------------------------------------------------------------
// Caso real GMF8I88: "VW/SAVEIRO CS RB MF" (cabine SIMPLES, Robust) tinha
// entre os candidatos a Saveiro Extreme CD (cabine dupla), R$25 mil mais cara.
// ---------------------------------------------------------------------------
const SENATRAN_GMF8I88 = {
  cilindrada: 1598,
  potencia: 110,
  descricaoMarcaModelo: 'VW/SAVEIRO CS RB MF',
  anoModelo: 2024,
  descricaoTipoVeiculo: 'CAMINHONETE',
}

const WDAPI_GMF8I88 = {
  marca: 'VW',
  MODELO: 'SAVEIRO CS RB MF',
  SUBMODELO: 'SAVEIRO',
  VERSAO: 'MF',
  anoModelo: '2024',
  extra: { combustivel: 'Alcool / Gasolina' },
  fipe: {
    dados: [
      { score: 61, codigo_fipe: '005546-8', texto_modelo: 'Saveiro Extreme 1.6 Flex 16V CD', texto_valor: 'R$ 99.871,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026', texto_marca: 'VW - VolksWagen' },
      { score: 61, codigo_fipe: '005538-7', texto_modelo: 'Saveiro Robust 1.6 Total Flex 16V ', texto_valor: 'R$ 74.795,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026', texto_marca: 'VW - VolksWagen' },
    ],
  },
}

const FIPE_API_VW_2024 = [
  { codigo_fipe: '005546-8', modelo: 'Saveiro Extreme 1.6 Flex 16V CD', valor: 99871, combustivel: 'Flex', mes_referencia: 'julho de 2026' },
  { codigo_fipe: '005538-7', modelo: 'Saveiro Robust 1.6 Total Flex 16V', valor: 74795, combustivel: 'Flex', mes_referencia: 'julho de 2026' },
  { codigo_fipe: '005547-6', modelo: 'Saveiro Trendline 1.6 Total Flex 16V CD', valor: 89000, combustivel: 'Flex', mes_referencia: 'julho de 2026' },
]

describe('picape: cabine simples nao pode virar cabine dupla (caso GMF8I88)', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('elimina os candidatos de cabine dupla', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/modelos')) return { ok: true, json: async () => ({ data: FIPE_API_VW_2024 }) } as any
      throw new Error('unexpected')
    }))
    const r = await escolherMelhorFipe({
      senatran: SENATRAN_GMF8I88, wdapi: WDAPI_GMF8I88,
      fipeApiUrl: 'http://fipe', fipeApiToken: 't',
    })
    const nomes = r.candidatos.map((c) => c.modelo).join(' | ')
    expect(nomes).not.toContain('CD')
    expect(nomes).toContain('Robust')
    expect(r.escolhido?.modelo || '').not.toContain('CD')
  })
})

// ── Camada 1: desempate por combustivel (so diesel/eletrico, conservador) ──
const SENATRAN_DIESEL = {
  cilindrada: 1998,
  potencia: 170,
  descricaoMarcaModelo: 'JEEP/COMPASS LIMITED',
  anoModelo: 2021,
  codigoCombustivel: '3', // Diesel
}
// Dois candidatos que sobrevivem a todos os outros passos (mesma litragem 2.0,
// sem sedan/sw, sem cambio na descricao, versao nao discriminante): so o
// combustivel os separa.
const WDAPI_COMPASS = {
  marca: 'JEEP',
  MODELO: 'COMPASS LIMITED',
  SUBMODELO: 'COMPASS',
  VERSAO: '',
  anoModelo: '2021',
  extra: { combustivel: 'Diesel' },
  fipe: {
    dados: [
      { score: 50, codigo_fipe: '017001-1', texto_modelo: 'COMPASS LIMITED 2.0 TD350 TB Diesel Aut.', texto_valor: 'R$ 185.000,00', combustivel: 'Diesel', mes_referencia: 'agosto de 2026' },
      { score: 52, codigo_fipe: '017002-0', texto_modelo: 'COMPASS LIMITED 2.0 Flex Aut.', texto_valor: 'R$ 150.000,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026' },
    ],
  },
}
function mockFetchModelosVazio() {
  return vi.fn(async (url: string) => {
    if (String(url).includes('/modelos')) return { ok: true, json: async () => ({ data: [] }) } as any
    throw new Error(`unexpected fetch: ${url}`)
  })
}

describe('escolherMelhorFipe - Camada 1 combustivel', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('veiculo DIESEL crava a versao diesel entre diesel e flex (por REGRA, sem Haiku)', async () => {
    global.fetch = mockFetchModelosVazio() as any
    const r = await escolherMelhorFipe({
      senatran: SENATRAN_DIESEL, wdapi: WDAPI_COMPASS,
      fipeApiUrl: 'https://fipe-api.placacompleta.com.br/api/v1', fipeApiToken: 't',
    })
    expect(r.decididoPor).toBe('regra')
    expect(r.escolhido?.codigo_fipe).toBe('017001-1')
    expect(r.escolhido?.modelo || '').toMatch(/Diesel/i)
  })

  it('veiculo a GASOLINA (codigo 2) NAO estreita por combustivel: segue ambiguo entre os 2', async () => {
    global.fetch = mockFetchModelosVazio() as any
    const r = await escolherMelhorFipe({
      senatran: { ...SENATRAN_DIESEL, codigoCombustivel: '2' }, wdapi: WDAPI_COMPASS,
      fipeApiUrl: 'https://fipe-api.placacompleta.com.br/api/v1', fipeApiToken: 't',
      // sem anthropicApiKey: 2 sobreviventes viram ambiguo
    })
    expect(r.decididoPor).toBe('ambiguo')
  })

  it('FAIL-SAFE: diesel sem nenhum candidato diesel NAO zera a lista (mantem todos)', async () => {
    global.fetch = mockFetchModelosVazio() as any
    const soFlex = {
      ...WDAPI_COMPASS,
      fipe: { dados: [
        { score: 50, codigo_fipe: '017002-0', texto_modelo: 'COMPASS LIMITED 2.0 Flex Aut.', texto_valor: 'R$ 150.000,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026' },
        { score: 52, codigo_fipe: '017003-8', texto_modelo: 'COMPASS SPORT 2.0 Flex Aut.', texto_valor: 'R$ 130.000,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026' },
      ] },
    }
    // Nome sem versao: com LIMITED no nome, a versao do nome ja decidiria
    // (shared/versao-fipe.ts) e o teste deixaria de medir o fail-safe do diesel.
    const r = await escolherMelhorFipe({
      senatran: { ...SENATRAN_DIESEL, descricaoMarcaModelo: 'JEEP/COMPASS' }, wdapi: soFlex,
      fipeApiUrl: 'https://fipe-api.placacompleta.com.br/api/v1', fipeApiToken: 't',
    })
    // combustivel nao achou diesel -> nao exclui ninguem -> 2 sobrevivem -> ambiguo
    expect(r.decididoPor).toBe('ambiguo')
    expect((r.candidatos || []).length).toBeGreaterThanOrEqual(2)
  })
})

// ── Camada 2: transmissaoHint (do recall) desempata o cambio ──
const SENATRAN_FIAT500 = {
  cilindrada: 1368,
  potencia: 100,
  descricaoMarcaModelo: 'FIAT/500 CULT', // SEM MT/AT: cambio so pelo hint
  anoModelo: 2013,
}
const WDAPI_FIAT500 = {
  marca: 'FIAT', MODELO: '500 CULT', SUBMODELO: '500', VERSAO: '', anoModelo: '2013',
  extra: { combustivel: 'Alcool / Gasolina' },
  fipe: {
    dados: [
      { score: 52, codigo_fipe: '001501-1', texto_modelo: '500 Cult 1.4 Flex 8V Mec.', texto_valor: 'R$ 40.000,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026' },
      { score: 54, codigo_fipe: '001502-0', texto_modelo: '500 Cult Dualogic 1.4 Flex 8V Aut.', texto_valor: 'R$ 44.000,00', combustivel: 'Flex', mes_referencia: 'agosto de 2026' },
    ],
  },
}
function mockModelosVazio2() {
  return vi.fn(async (url: string) => {
    if (String(url).includes('/modelos')) return { ok: true, json: async () => ({ data: [] }) } as any
    throw new Error(`unexpected fetch: ${url}`)
  })
}

describe('escolherMelhorFipe - Camada 2 transmissaoHint', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('SEM hint: Mec. vs Aut. sem cambio no registro fica ambiguo', async () => {
    global.fetch = mockModelosVazio2() as any
    const r = await escolherMelhorFipe({
      senatran: SENATRAN_FIAT500, wdapi: WDAPI_FIAT500,
      fipeApiUrl: 'https://fipe-api.placacompleta.com.br/api/v1', fipeApiToken: 't',
    })
    expect(r.decididoPor).toBe('ambiguo')
  })

  it('COM transmissaoHint=manual (do recall): crava a versao Mec. por regra', async () => {
    global.fetch = mockModelosVazio2() as any
    const r = await escolherMelhorFipe({
      senatran: { ...SENATRAN_FIAT500, transmissaoHint: 'manual' }, wdapi: WDAPI_FIAT500,
      fipeApiUrl: 'https://fipe-api.placacompleta.com.br/api/v1', fipeApiToken: 't',
    })
    expect(r.decididoPor).toBe('regra')
    expect(r.escolhido?.codigo_fipe).toBe('001501-1')
    expect(r.escolhido?.modelo || '').toMatch(/Mec/i)
  })

  it('o registro (MT/AT na descricao) tem prioridade sobre o hint', async () => {
    global.fetch = mockModelosVazio2() as any
    const r = await escolherMelhorFipe({
      // descricao diz AT, hint diz manual -> vale o registro (Aut.)
      senatran: { ...SENATRAN_FIAT500, descricaoMarcaModelo: 'FIAT/500 CULT AT', transmissaoHint: 'manual' },
      wdapi: WDAPI_FIAT500,
      fipeApiUrl: 'https://fipe-api.placacompleta.com.br/api/v1', fipeApiToken: 't',
    })
    expect(r.decididoPor).toBe('regra')
    expect(r.escolhido?.modelo || '').toMatch(/Aut/i)
  })
})

describe('versao do nome (caso DMV4C01, Corolla XEi)', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  it('SE-G nao entra na shortlist de um XEi; sobra so a duvida do cambio', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/modelos')) {
        return { ok: true, json: async () => ({ data: [
          { codigo_fipe: '002060-5', modelo: 'Corolla SE-G 1.8/1.8 Flex 16V Aut.', valor: 36960 },
          { codigo_fipe: '002061-3', modelo: 'Corolla XEi 1.8/1.8 Flex 16V Aut.', valor: 34812 },
          { codigo_fipe: '002028-1', modelo: 'Corolla XEi 1.8/1.8 Flex 16V Mec.', valor: 34067 },
          { codigo_fipe: '002080-0', modelo: 'Corolla XLi 1.6 16V 110cv Aut.', valor: 30000 },
        ] }) } as any
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))
    const r = await escolherMelhorFipe({
      senatran: { descricaoMarcaModelo: 'TOYOTA/COROLLA XEI18VVT', anoModelo: 2004, cilindrada: 1794 },
      wdapi: { marca: 'TOYOTA', MODELO: 'COROLLA XEI18VVT', anoModelo: '2004', fipe: { dados: [] } },
      fipeApiUrl: 'http://fipe', fipeApiToken: 't',
    })
    expect(r.decididoPor).toBe('ambiguo')
    expect(r.candidatos.map((c) => c.codigo_fipe).sort()).toEqual(['002028-1', '002061-3'])
  })
})

describe('modelo do nome no funil (caso TTR6F65, Tracker)', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  it('TRACKER nao termina com ONIX quando o universo tem Tracker', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/modelos')) {
        return { ok: true, json: async () => ({ data: [
          { codigo_fipe: '004519-5', modelo: 'ONIX HATCH 1.0 12V Flex 5p Mec.', valor: 60000 },
          { codigo_fipe: '004511-0', modelo: 'ONIX HATCH 1.0 12V TB Flex 5p Aut.', valor: 70000 },
          { codigo_fipe: '004540-3', modelo: 'TRACKER 1.0 Turbo 12V Flex Aut.', valor: 100000 },
        ] }) } as any
      }
      return { ok: false, json: async () => ({}) } as any
    }))
    const r = await escolherMelhorFipe({
      senatran: { descricaoMarcaModelo: 'CHEV/TRACKER T A', anoModelo: 2021, cilindrada: 999 },
      wdapi: { marca: 'CHEVROLET', MODELO: 'TRACKER T A', anoModelo: '2021', fipe: { dados: [] } },
      fipeApiUrl: 'http://fipe', fipeApiToken: 't',
    })
    expect(r.candidatos.map((c) => c.codigo_fipe)).toEqual(['004540-3'])
  })
})

describe('fallback respeita o nome (caso GMF8I88, Saveiro CS)', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  it('fipe-api fora: o melhor score da fonte nao pode ser a cabine dupla', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('timeout') }))
    const r = await escolherMelhorFipe({
      senatran: { descricaoMarcaModelo: 'VW/SAVEIRO CS RB MF', anoModelo: 2024, cilindrada: 1598, descricaoTipoVeiculo: 'CAMINHONETE' },
      wdapi: { marca: 'VW', anoModelo: '2024', fipe: { dados: [
        { score: 61, codigo_fipe: '005546-8', texto_marca: 'VW - VolksWagen', texto_modelo: 'Saveiro Extreme 1.6 Flex 16V CD', texto_valor: 'R$ 99.871,00' },
        { score: 61, codigo_fipe: '005538-7', texto_marca: 'VW - VolksWagen', texto_modelo: 'Saveiro Robust 1.6 Total Flex 16V ', texto_valor: 'R$ 74.795,00' },
        { score: 61, codigo_fipe: '005537-9', texto_marca: 'VW - VolksWagen', texto_modelo: 'Saveiro Robust 1.6 Total Flex 16V CD', texto_valor: 'R$ 85.210,00' },
      ] } },
      fipeApiUrl: 'http://fipe', fipeApiToken: 't',
    })
    expect(r.decididoPor).toBe('fallback')
    expect(r.escolhido?.codigo_fipe).toBe('005538-7')
  })
})

describe('timeout proprio da fipe-api', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
  it('fipe-api respondendo em 4 s (a frio) nao cai no fallback', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((url: string, opts: any) => new Promise((resolve, reject) => {
      opts?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      setTimeout(() => resolve({ ok: true, json: async () => ({ data: FIPE_API_ETIOS_2014 }) }), 4000)
    })))
    const p = escolherMelhorFipe({ senatran: SENATRAN_OXK7426, wdapi: WDAPI_OXK7426, fipeApiUrl: 'http://fipe', fipeApiToken: 't' })
    // /modelos em 4 s; depois /brands e /brands/:id/models (resolucao do codigo do modelo) tambem demoram 4 s cada.
    await vi.advanceTimersByTimeAsync(4100)
    await vi.advanceTimersByTimeAsync(4100)
    await vi.advanceTimersByTimeAsync(4100)
    const r = await p
    expect(r.decididoPor).toBe('regra')
    expect(r.escolhido?.codigo_fipe).toBe('002122-9')
  })
  it('acima de 8 s: fallback', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((url: string, opts: any) => new Promise((resolve, reject) => {
      opts?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      setTimeout(() => resolve({ ok: true, json: async () => ({ data: FIPE_API_ETIOS_2014 }) }), 9000)
    })))
    const p = escolherMelhorFipe({ senatran: SENATRAN_OXK7426, wdapi: WDAPI_OXK7426, fipeApiUrl: 'http://fipe', fipeApiToken: 't' })
    await vi.advanceTimersByTimeAsync(9100)
    expect((await p).decididoPor).toBe('fallback')
  })
})

describe('codigo do modelo: sem colisao carro x moto (caso FZK5F28)', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  it('atalho da fonte livre repassa o codigo_modelo da propria fonte', async () => {
    const chamadas: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      chamadas.push(String(url))
      if (String(url).includes('/modelos')) return { ok: true, json: async () => ({ data: [] }) } as any
      return { ok: false, json: async () => ({}) } as any
    }))
    const r = await escolherMelhorFipe({
      senatran: { descricaoMarcaModelo: 'HONDA/PCX 150 DLX ABS', descricaoTipoVeiculo: 'MOTONETA', anoModelo: 2020 },
      wdapi: { marca: 'HONDA', anoModelo: '2020', fipe: { dados: [{ score: 92, codigo_fipe: '811116-2', codigo_modelo: '7788', texto_marca: 'HONDA', texto_modelo: 'PCX 150/DLX', texto_valor: 'R$ 15.328,00' }] } },
      segmento: 'moto', fipeApiUrl: 'http://fipe-a', fipeApiToken: 't',
    })
    expect(r.decididoPor).toBe('wdapi')
    expect(r.escolhido?.codigoModelo).toBe('7788')
    expect(chamadas.some((u) => u.includes('/brands'))).toBe(false)
  })
  it('sem codigo da fonte: procura na marca de MOTOS, nao na de carros com o mesmo nome', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url)
      const ok = (data: any) => ({ ok: true, json: async () => ({ data }) }) as any
      if (u.includes('/modelos')) return ok([{ codigo_fipe: '811116-2', modelo: 'PCX 150/DLX', valor: 15328 }])
      if (u.endsWith('/brands')) return ok([{ id: 1, name: 'Honda', vehicle_type: 1 }, { id: 2, name: 'HONDA', vehicle_type: 2 }])
      if (u.endsWith('/brands/1/models')) return ok([{ name: 'Civic', fipe_code: '1' }])
      if (u.endsWith('/brands/2/models')) return ok([{ name: 'PCX 150/DLX', fipe_code: '7788' }])
      return { ok: false, json: async () => ({}) } as any
    }))
    const r = await escolherMelhorFipe({
      senatran: { descricaoMarcaModelo: 'HONDA/PCX 150 DLX ABS', descricaoTipoVeiculo: 'MOTONETA', anoModelo: 2020 },
      wdapi: { marca: 'HONDA', anoModelo: '2020', fipe: { dados: [] } },
      segmento: 'moto', fipeApiUrl: 'http://fipe-b', fipeApiToken: 't',
    })
    expect(r.escolhido?.codigo_fipe).toBe('811116-2')
    expect(r.escolhido?.codigoModelo).toBe('7788')
  })
})

describe('sem FIPE na fonte e Haiku sem resposta (caso HSX1F20, Celta Spirit)', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  const CELTA_2005 = [
    { codigo_fipe: '004227-7', modelo: 'Celta 1.0/ Super 1.0 MPFI VHC 8v 5p', valor: 15000 },
    { codigo_fipe: '004202-1', modelo: 'Celta 1.0/Super/N.Piq.1.0 MPFi VHC 8V 3p', valor: 14500 },
    { codigo_fipe: '004264-1', modelo: 'Celta Life 1.0 MPFI VHC 8V 3p', valor: 14800 },
    { codigo_fipe: '004266-8', modelo: 'Celta Life 1.0 MPFI VHC 8V 5p', valor: 15200 },
    { codigo_fipe: '004265-0', modelo: 'Celta Spirit 1.0 MPFI VHC 8V 3p', valor: 15500 },
    { codigo_fipe: '004267-6', modelo: 'Celta Spirit 1.0 MPFI VHC 8V 5p', valor: 15900 },
  ]
  const mock = (haiku: 'falha' | 'fora') => vi.fn(async (url: string) => {
    if (String(url).includes('/modelos')) return { ok: true, json: async () => ({ data: CELTA_2005 }) } as any
    if (String(url).includes('anthropic')) {
      if (haiku === 'falha') throw new Error('timeout')
      return { ok: true, json: async () => ({ content: [{ type: 'text', text: '{"codigo_fipe":"999999-9","confianca":"alta","justificativa":"x"}' }] }) } as any
    }
    return { ok: false, json: async () => ({}) } as any
  })
  const WD = { marca: 'GM', MODELO: 'CELTA 2P SPIRIT', anoModelo: '2005', fipe: { dados: [] } }

  it('"SPIRIT" no nome resolve por regra (versao do nome)', async () => {
    vi.stubGlobal('fetch', mock('falha'))
    const r = await escolherMelhorFipe({ senatran: { descricaoMarcaModelo: 'GM/CELTA 2P SPIRIT', anoModelo: 2005, cilindrada: 1000 }, wdapi: WD, fipeApiUrl: 'http://f', fipeApiToken: 't', anthropicApiKey: 'k' })
    expect(r.decididoPor).toBe('regra')
    expect(r.escolhido?.codigo_fipe).toBe('004265-0')
  })
  it('sem versao no nome e Haiku fora: duvida com a lista, nunca sem candidato', async () => {
    vi.stubGlobal('fetch', mock('falha'))
    const r = await escolherMelhorFipe({ senatran: { descricaoMarcaModelo: 'GM/CELTA', anoModelo: 2005, cilindrada: 1000 }, wdapi: WD, fipeApiUrl: 'http://f', fipeApiToken: 't', anthropicApiKey: 'k' })
    expect(r.decididoPor).toBe('ambiguo')
    expect(r.candidatos.length).toBeGreaterThan(1)
  })
  it('Haiku devolve codigo fora da lista: mesma coisa', async () => {
    vi.stubGlobal('fetch', mock('fora'))
    const r = await escolherMelhorFipe({ senatran: { descricaoMarcaModelo: 'GM/CELTA', anoModelo: 2005, cilindrada: 1000 }, wdapi: WD, fipeApiUrl: 'http://f', fipeApiToken: 't', anthropicApiKey: 'k' })
    expect(r.decididoPor).toBe('ambiguo')
    expect(r.candidatos.length).toBeGreaterThan(1)
  })
})

describe('juiz Haiku 5.5: formato da chamada e da resposta', () => {
  afterEach(() => { vi.restoreAllMocks() })
  const ETIOS = { senatran: { cilindrada: 1496, descricaoMarcaModelo: 'TOYOTA/ETIOS XLS', anoModelo: 2014 }, wdapi: { ...WDAPI_OXK7426, VERSAO: '' }, fipeApiUrl: 'https://fipe-api.placacompleta.com.br/api/v1', fipeApiToken: 'token-teste', anthropicApiKey: 'chave-teste' }
  const comAnthropic = (resp: () => any, chamadas: any[] = []) => vi.fn(async (url: string, init?: any) => {
    if (String(url).includes('/modelos')) return { ok: true, json: async () => ({ data: FIPE_API_ETIOS_2014 }) } as any
    if (String(url).includes('anthropic.com')) { chamadas.push(JSON.parse(init.body)); return resp() }
    throw new Error(`unexpected fetch: ${url}`)
  }) as any

  it('manda claude-haiku-5-5, thinking desligado e sem temperature; le o bloco text depois do thinking', async () => {
    const chamadas: any[] = []
    global.fetch = comAnthropic(() => ({ ok: true, status: 200, json: async () => ({
      stop_reason: 'end_turn',
      content: [
        { type: 'thinking', thinking: '', signature: 'x' },
        { type: 'text', text: '{"codigo_fipe":"002124-5","confianca":"alta","justificativa":"XLS hatch 1.5"}' },
      ],
    }) }), chamadas)
    const r = await escolherMelhorFipe(ETIOS)
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].model).toBe('claude-haiku-5-5')
    expect(chamadas[0].thinking).toEqual({ type: 'disabled' })
    expect(chamadas[0]).not.toHaveProperty('temperature')
    expect(r.decididoPor).toBe('haiku')
    expect(r.escolhido?.codigo_fipe).toBe('002124-5')
  })

  it('400 de parametro: loga o status e cai no comportamento sem juiz', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    global.fetch = comAnthropic(() => ({ ok: false, status: 400, json: async () => ({ type: 'error', error: { type: 'invalid_request_error', message: '`temperature` is deprecated for this model' } }) }))
    const r = await escolherMelhorFipe({ ...ETIOS, pedidoToken: 'tok-pedido' })
    expect(r.decididoPor).not.toBe('haiku')
    const log = warn.mock.calls.map((c) => String(c[0])).join('\n')
    expect(log).toContain('[fipe-haiku] HTTP 400')
    expect(log).toContain('invalid_request_error')
    expect(log).not.toContain('ETIOS')
    expect(alertarFalhaHaiku).toHaveBeenCalledWith(expect.objectContaining({
      motivo: 'HTTP 400 invalid_request_error', modelo: 'claude-haiku-5-5', token: 'tok-pedido',
    }))
    expect(JSON.stringify((alertarFalhaHaiku as any).mock.calls)).not.toMatch(/ETIOS|OXK7426/)
  })

  it('so thinking, sem bloco text: loga e nao decide', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    global.fetch = comAnthropic(() => ({ ok: true, status: 200, json: async () => ({ stop_reason: 'max_tokens', content: [{ type: 'thinking', thinking: '...' }] }) }))
    const r = await escolherMelhorFipe(ETIOS)
    expect(r.decididoPor).not.toBe('haiku')
    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toContain('sem bloco text stop_reason=max_tokens')
  })
})

describe('veredito do Haiku: formato tolerante e "nenhum" (FAG9103)', () => {
  // Texto real do 5.5 com max_tokens 300: cercado de ```json e cortado no meio.
  const CORTADO = '```json\n{"codigo_fipe": "068003-6", "confianca": "media", "justificativa": "Os dados oficiais indicam Towner Pick-Up (SENATRAN: \'TOWNER PICKUP US\'), 1.0 de 970 cc. A confianca e media porque a descricao \'US\' e'

  it('le JSON cercado de ```json, cortado no meio e com dois objetos', () => {
    expect(parseVereditoHaiku(CORTADO)).toMatchObject({ codigo_fipe: '068003-6', confianca: 'media' })
    expect(parseVereditoHaiku('```json\n{"codigo_fipe":"068003-6","confianca":"alta","justificativa":"x {y}"}\n```')).toMatchObject({ codigo_fipe: '068003-6', confianca: 'alta', justificativa: 'x {y}' })
    expect(parseVereditoHaiku('{"codigo_fipe":"A","confianca":"alta","justificativa":"1"} e {"codigo_fipe":"B","confianca":"baixa","justificativa":"2"}')).toMatchObject({ codigo_fipe: 'A' })
  })
  it('"nenhum", null ou vazio e resposta valida (codigo null, confianca baixa)', () => {
    for (const c of ['"nenhum"', 'null', '""', '"NENHUM"']) {
      expect(parseVereditoHaiku(`{"codigo_fipe":${c},"confianca":"alta","justificativa":"nao bate"}`)).toEqual({ codigo_fipe: null, confianca: 'baixa', justificativa: 'nao bate' })
    }
  })
  it('lixo de verdade continua invalido', () => {
    expect(parseVereditoHaiku('nao sei')).toBeNull()
    expect(parseVereditoHaiku('{"codigo_fipe":"A","confianca":"talvez"}')).toBeNull()
  })
  it('trecho do log sem placa nem chassi', () => {
    expect(trechoSaneado('placa FAG9103 e FAG-9I03 chassi LKHGF1AH6CAC12345 ok')).toBe('placa <placa> e <placa> chassi <chassi> ok')
  })
  it('schema: codigo so dentre os candidatos ou "nenhum"', () => {
    expect(schemaVeredito(['1', '2']).properties.codigo_fipe.enum).toEqual(['1', '2', 'nenhum'])
  })
})

describe('Haiku com structured outputs e resposta "nenhum"', () => {
  afterEach(() => { vi.restoreAllMocks() })
  const ETIOS = { senatran: { cilindrada: 1496, descricaoMarcaModelo: 'TOYOTA/ETIOS XLS', anoModelo: 2014 }, wdapi: { ...WDAPI_OXK7426, VERSAO: '' }, fipeApiUrl: 'https://fipe-api.placacompleta.com.br/api/v1', fipeApiToken: 'token-teste', anthropicApiKey: 'chave-teste' }
  const com = (texto: string, chamadas: any[] = []) => vi.fn(async (url: string, init?: any) => {
    if (String(url).includes('/modelos')) return { ok: true, json: async () => ({ data: FIPE_API_ETIOS_2014 }) } as any
    if (String(url).includes('anthropic.com')) { chamadas.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: texto }] }) } as any }
    throw new Error(`unexpected fetch: ${url}`)
  }) as any

  it('pede json_schema com os codigos da lista e max_tokens 600', async () => {
    const chamadas: any[] = []
    global.fetch = com('{"codigo_fipe":"002124-5","confianca":"alta","justificativa":"XLS"}', chamadas)
    const r = await escolherMelhorFipe(ETIOS)
    expect(r.decididoPor).toBe('haiku')
    expect(chamadas[0].max_tokens).toBe(600)
    const sch = chamadas[0].output_config.format
    expect(sch.type).toBe('json_schema')
    expect(sch.schema.properties.codigo_fipe.enum).toContain('002124-5')
    expect(sch.schema.properties.codigo_fipe.enum.at(-1)).toBe('nenhum')
  })

  it('"nenhum" vira duvida com a lista, sem alerta de falha', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;(alertarFalhaHaiku as any).mockClear()
    global.fetch = com('{"codigo_fipe":"nenhum","confianca":"baixa","justificativa":"nenhum bate"}')
    const r = await escolherMelhorFipe(ETIOS)
    expect(r.decididoPor).toBe('ambiguo')
    expect(r.escolhido).toBeNull()
    expect(r.candidatos.length).toBeGreaterThan(1)
    expect(alertarFalhaHaiku).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it('JSON invalido loga trecho saneado do texto cru', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    global.fetch = com('desculpe, a placa ETI0S14 nao consigo')
    await escolherMelhorFipe(ETIOS)
    const log = warn.mock.calls.map((c) => String(c[0])).join('\n')
    expect(log).toContain('[fipe-haiku] JSON invalido stop_reason=end_turn texto="desculpe, a placa <placa> nao consigo"')
  })
})

describe('sigla de versao no nome do cadastro (FPL1A52, VW Nivus HL)', () => {
  afterEach(() => { vi.restoreAllMocks() })
  const NIVUS_2021 = [
    { codigo_fipe: '005525-5', modelo: 'NIVUS Comfortline 200 TSI 1.0 Flex Aut.', valor: 98000 },
    { codigo_fipe: '005526-3', modelo: 'NIVUS Highline 200 TSI 1.0 Flex Aut.', valor: 108000 },
    { codigo_fipe: '005527-1', modelo: 'NIVUS Launching Ed. 200 TSI 1.0 Flex Aut.', valor: 110000 },
  ]
  const WD = { marca: 'VW', MODELO: 'NIVUS HL TSI AD', anoModelo: '2021', fipe: { dados: [] } }
  const montarFetch = (chamadas: any[], texto = '{"codigo_fipe":"005526-3","confianca":"alta","justificativa":"x"}') => vi.fn(async (url: string, init?: any) => {
    if (String(url).includes('/modelos')) return { ok: true, json: async () => ({ data: NIVUS_2021 }) } as any
    if (String(url).includes('anthropic')) { chamadas.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: texto }] }) } as any }
    return { ok: false, json: async () => ({}) } as any
  })
  const entrada = (desc: string) => ({ senatran: { descricaoMarcaModelo: desc, anoModelo: 2021, cilindrada: 999 }, wdapi: { ...WD, MODELO: desc.split('/')[1] }, fipeApiUrl: 'http://f', fipeApiToken: 't', anthropicApiKey: 'k' })

  it('"VW/NIVUS HL TSI AD" 2021: Highline 005526-3 por regra, sem Haiku', async () => {
    const chamadas: any[] = []
    vi.stubGlobal('fetch', montarFetch(chamadas))
    const r = await escolherMelhorFipe(entrada('VW/NIVUS HL TSI AD'))
    expect(r.decididoPor).toBe('regra')
    expect(r.confianca).toBe('alta')
    expect(r.escolhido?.codigo_fipe).toBe('005526-3')
    expect(chamadas).toHaveLength(0)
  })
  it('CL e LE/LAUNCH tambem: Comfortline e Launching Ed.', async () => {
    vi.stubGlobal('fetch', montarFetch([]))
    expect((await escolherMelhorFipe(entrada('VW/NIVUS CL TSI AD'))).escolhido?.codigo_fipe).toBe('005525-5')
    expect((await escolherMelhorFipe(entrada('VW/NIVUS LE TSI AD'))).escolhido?.codigo_fipe).toBe('005527-1')
  })
  it('sigla desconhecida segue pro Haiku, que recebe a tabela de siglas', async () => {
    const chamadas: any[] = []
    vi.stubGlobal('fetch', montarFetch(chamadas))
    const r = await escolherMelhorFipe(entrada('VW/NIVUS XZ TSI AD'))
    expect(chamadas).toHaveLength(1)
    expect(r.decididoPor).toBe('haiku')
    const prompt = chamadas[0].messages[0].content
    expect(prompt).toContain('HL = Highline')
    expect(prompt).toContain('A sigla de versao no nome do cadastro identifica a versao FIPE')
  })
  it('sigla de VW nao vale em outra marca', async () => {
    const { versaoDoNome } = await import('../../shared/versao-fipe')
    expect(versaoDoNome('VW/NIVUS HL TSI AD').versoes).toEqual(['HIGHLINE'])
    expect(versaoDoNome('VOLKSWAGEN/POLO TL MA').versoes).toEqual(['TRENDLINE'])
    expect(versaoDoNome('FIAT/UNO LE 1.0').versoes).toEqual([])
    expect(versaoDoNome('FIAT/PULSE IMPETUS T200').versoes).toEqual(['IMPETUS'])
  })
})
