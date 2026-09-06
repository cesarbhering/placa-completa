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
