import { describe, it, expect, vi, beforeEach } from 'vitest'

// Plate lookup order: cache -> PlacaFipe -> wdapi. All HTTP is mocked; the
// plates, VIN and engine numbers below are invented.
let cacheRow: any = null
let upserts: any[] = []
let chamadasLog: any[] = []
let placafipeResposta: () => Promise<any>
let wdapiResposta: () => Promise<any>
let urls: string[] = []
let config: any = {}

vi.stubGlobal('useRuntimeConfig', () => config)
vi.stubGlobal('useSupabaseServer', () => ({
  from: (tabela: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: cacheRow }) }) }),
    upsert: (row: any) => { upserts.push(row); return { then: (fn: any) => fn({ error: null }) } },
    insert: (row: any) => { if (tabela === 'api_chamadas') chamadasLog.push(row); return { then: (fn: any) => fn({ error: null }) } },
  }),
}))
vi.stubGlobal('$fetch', async (url: string) => {
  urls.push(url)
  if (url.includes('placafipe')) return placafipeResposta()
  return wdapiResposta()
})

const { consultarPlacaWdapiDetalhado, motorDoPayload, semMotor } = await import('./placa-lookup')
const { mapearPlacaFipe, _resetDisjuntorPlacaFipe, proximaMeiaNoiteBrasilia, valorParaTexto } = await import('./placafipe')

const PLACA = 'TST1A23'
const CHASSI = '9ZZTESTE000000001'
const MOTOR = 'ZZT123456'

function respostaOk(extra: any = {}) {
  return {
    codigo: 1,
    msg: 'total de 2 modelo(s) encontrado(s)',
    placa: PLACA,
    fipe: [
      { similaridade: '56.00', correspondencia: '50.00', marca: 'VW - VOLKSWAGEN', modelo: 'GOL TRENDLINE 1.0 T.FLEX 12V 5P', ano_modelo: 2018, codigo_fipe: '005455-0', codigo_marca: '59', codigo_modelo: '7522', mes_referencia: 'Novembro de 2026', combustivel: 'FLEX', valor: '41870.00', unidade_valor: 'R$' },
      { similaridade: '40.00', correspondencia: '40.00', marca: 'VW - VOLKSWAGEN', modelo: 'GOL 1.6 MSI', ano_modelo: 2018, codigo_fipe: '005999-1', codigo_marca: '59', codigo_modelo: '9999', mes_referencia: 'Novembro de 2026', combustivel: 'FLEX', valor: '45000.00', unidade_valor: 'R$' },
    ],
    informacoes_veiculo: {
      marca: 'VOLKSWAGEN', modelo: 'GOL TREND MCV NOVO', modelo_lista: ['GOL', 'TREND', 'MCV', 'NOVO'],
      ano: '2017', ano_modelo: '2018', cor: 'Prata', chassi: CHASSI, motor: MOTOR,
      municipio: 'BELO HORIZONTE', uf: 'MG', segmento: 'Automóvel', sub_segmento: null,
      placa: PLACA, placa_alternativa: 'TST1023', cilindradas: '999', potencia: '82', combustivel: 'Álcool/Gasolina',
      ...extra,
    },
    tempo: 10, unidade_tempo: 'ms',
  }
}

const WDAPI = { MARCA: 'VW', MODELO: 'GOL', anoModelo: '2018', fipe: { dados: [] } }

beforeEach(() => {
  cacheRow = null
  upserts = []
  chamadasLog = []
  urls = []
  config = { placafipeToken: 'pf-test-token', placaApiToken: 'wd-test-token' }
  placafipeResposta = async () => respostaOk()
  wdapiResposta = async () => WDAPI
  _resetDisjuntorPlacaFipe()
})

const chamouPlacaFipe = () => urls.filter((u) => u.includes('placafipe')).length
const chamouWdapi = () => urls.filter((u) => u.includes('wdapi2')).length

describe('PlacaFipe adapter', () => {
  it('maps the provider answer to the internal plate shape', () => {
    const p = mapearPlacaFipe(respostaOk(), PLACA)
    expect(p.MARCA).toBe('VOLKSWAGEN')
    expect(p.MODELO).toBe('GOL TREND MCV NOVO')
    expect(p.ano).toBe('2017')
    expect(p.anoModelo).toBe('2018')
    expect(p.cor).toBe('Prata')
    expect(p.municipio).toBe('BELO HORIZONTE')
    expect(p.uf).toBe('MG')
    expect(p.placa_alternativa).toBe('TST1023')
    expect(p.listamodelo).toEqual(['GOL', 'TREND', 'MCV', 'NOVO'])
    expect(p.extra.chassi).toBe(CHASSI)
    expect(p.extra.motor).toBe(MOTOR)
    expect(p.extra.combustivel).toBe('Álcool/Gasolina')
    expect(p.extra.ano_modelo).toBe('2018')
    expect(p.extra.ano_fabricacao).toBe('2017')
    expect(p.extra.cilindradas).toBe('999')
    // root chassi is only for a provider-masked value; the full one stays in extra
    expect(p.chassi).toBeUndefined()
  })

  it('maps the FIPE list to fipe.dados with score and a BRL value text', () => {
    const p = mapearPlacaFipe(respostaOk(), PLACA)
    expect(p.fipe.dados).toHaveLength(2)
    expect(p.fipe.dados[0]).toMatchObject({
      codigo_fipe: '005455-0', codigo_modelo: '7522', texto_modelo: 'GOL TRENDLINE 1.0 T.FLEX 12V 5P',
      texto_marca: 'VW - VOLKSWAGEN', combustivel: 'FLEX', mes_referencia: 'Novembro de 2026', score: 56,
    })
    expect(p.fipe.dados[0].texto_valor).toMatch(/^R\$\s41\.870,00$/)
    // the code downstream picks the highest score
    const melhor = p.fipe.dados.reduce((b: any, i: any) => (i.score > b.score ? i : b))
    expect(melhor.codigo_fipe).toBe('005455-0')
  })

  it('drops masked VIN and engine number instead of storing asterisks', () => {
    const p = mapearPlacaFipe(respostaOk({ chassi: '******0001', motor: '******' }), PLACA)
    expect(p.extra.chassi).toBeUndefined()
    expect(p.extra.motor).toBeUndefined()
    expect(p.chassi).toBe('******0001')
  })

  it('formats values like the old provider', () => {
    expect(valorParaTexto('22159.00')).toMatch(/^R\$\s22\.159,00$/)
    expect(valorParaTexto('0')).toBeNull()
    expect(valorParaTexto('abc')).toBeNull()
  })
})

describe('lookup order: cache -> PlacaFipe -> wdapi', () => {
  it('cache hit makes no provider call', async () => {
    cacheRow = { payload: { MARCA: 'VW' }, encontrado: true, fetched_at: new Date().toISOString() }
    const r = await consultarPlacaWdapiDetalhado(PLACA)
    expect(r).toMatchObject({ cacheHit: true, fonte: 'cache' })
    expect(urls).toHaveLength(0)
  })

  it('PlacaFipe success answers, caches and never calls wdapi', async () => {
    const r = await consultarPlacaWdapiDetalhado(PLACA)
    expect(r.fonte).toBe('placafipe')
    expect(r.cacheHit).toBe(false)
    expect(r.payload.MARCA).toBe('VOLKSWAGEN')
    expect(chamouWdapi()).toBe(0)
    expect(upserts).toHaveLength(1)
    expect(upserts[0]).toMatchObject({ placa: PLACA, encontrado: true })
    expect(chamadasLog.map((c) => c.fonte)).toEqual(['placafipe'])
  })

  it('sends the plate and token in a POST body, never in the URL', async () => {
    const spy = vi.fn(async () => respostaOk())
    vi.stubGlobal('$fetch', async (url: string, opts: any) => { urls.push(url); return spy(url, opts) })
    await consultarPlacaWdapiDetalhado(PLACA)
    const [url, opts] = spy.mock.calls[0] as any
    expect(url).toBe('https://api.placafipe.com.br/getplacafipe')
    expect(opts.method).toBe('POST')
    expect(opts.body).toEqual({ placa: PLACA, token: 'pf-test-token' })
    expect(opts.timeout).toBeLessThanOrEqual(5000)
    vi.stubGlobal('$fetch', async (u: string) => { urls.push(u); return u.includes('placafipe') ? placafipeResposta() : wdapiResposta() })
  })

  it('not found on PlacaFipe falls back to wdapi', async () => {
    placafipeResposta = async () => ({ codigo: 759, msg: 'Não foi possível reconhecer a placa solicitada' })
    const r = await consultarPlacaWdapiDetalhado(PLACA)
    expect(r.fonte).toBe('wdapi')
    expect(r.payload).toEqual(WDAPI)
    expect(chamouPlacaFipe()).toBe(1)
    expect(chamouWdapi()).toBe(1)
  })

  it('timeout on PlacaFipe falls back to wdapi', async () => {
    placafipeResposta = async () => { const e: any = new Error('[POST] "https://api.placafipe.com.br/getplacafipe": <no response> The operation was aborted due to timeout'); e.name = 'FetchError'; throw e }
    const r = await consultarPlacaWdapiDetalhado(PLACA)
    expect(r.fonte).toBe('wdapi')
    expect(chamouWdapi()).toBe(1)
    // a transient failure must not be cached as "not found"
    expect(upserts.every((u) => u.encontrado === true)).toBe(true)
  })

  it('HTTP 500 on PlacaFipe falls back to wdapi', async () => {
    placafipeResposta = async () => { const e: any = new Error('500'); e.status = 500; throw e }
    const r = await consultarPlacaWdapiDetalhado(PLACA)
    expect(r.fonte).toBe('wdapi')
  })

  it('quota exceeded falls back and skips PlacaFipe until the next day', async () => {
    placafipeResposta = async () => ({ codigo: 4862, msg: 'Total de consultas atingiu o limite ou token não permitido' })
    const r1 = await consultarPlacaWdapiDetalhado(PLACA)
    expect(r1.fonte).toBe('wdapi')
    placafipeResposta = async () => respostaOk()
    const r2 = await consultarPlacaWdapiDetalhado('TST9Z99')
    expect(r2.fonte).toBe('wdapi')
    expect(chamouPlacaFipe()).toBe(1)
  })

  it('quota pause ends at the next midnight in Brasilia', () => {
    // 2026-11-09 23:30 BRT = 2026-11-10 02:30 UTC -> next midnight BRT = 2026-11-10 03:00 UTC
    expect(new Date(proximaMeiaNoiteBrasilia(Date.UTC(2026, 10, 10, 2, 30))).toISOString()).toBe('2026-11-10T03:00:00.000Z')
    // 2026-11-09 10:00 BRT -> 2026-11-10 03:00 UTC
    expect(new Date(proximaMeiaNoiteBrasilia(Date.UTC(2026, 10, 9, 13, 0))).toISOString()).toBe('2026-11-10T03:00:00.000Z')
  })

  it('breaker opens after 3 consecutive failures and stops calling PlacaFipe', async () => {
    placafipeResposta = async () => { const e: any = new Error('503'); e.status = 503; throw e }
    for (let i = 0; i < 3; i++) await consultarPlacaWdapiDetalhado(`TST1A2${i}`)
    expect(chamouPlacaFipe()).toBe(3)
    placafipeResposta = async () => respostaOk()
    const r = await consultarPlacaWdapiDetalhado('TST1A29')
    expect(r.fonte).toBe('wdapi')
    expect(chamouPlacaFipe()).toBe(3)
    expect(chamouWdapi()).toBe(4)
  })

  it('breaker closes again after the pause', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      placafipeResposta = async () => { const e: any = new Error('503'); e.status = 503; throw e }
      for (let i = 0; i < 3; i++) await consultarPlacaWdapiDetalhado(`TST1A2${i}`)
      vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1)
      placafipeResposta = async () => respostaOk()
      const r = await consultarPlacaWdapiDetalhado('TST1A29')
      expect(r.fonte).toBe('placafipe')
    } finally {
      vi.useRealTimers()
    }
  })

  it('not found is not a failure for the breaker', async () => {
    placafipeResposta = async () => ({ codigo: 759, msg: 'nao reconhecida' })
    for (let i = 0; i < 4; i++) await consultarPlacaWdapiDetalhado(`TST1A2${i}`)
    expect(chamouPlacaFipe()).toBe(4)
  })

  it('both providers without a vehicle caches a short-lived not-found', async () => {
    placafipeResposta = async () => ({ codigo: 759, msg: 'nao reconhecida' })
    wdapiResposta = async () => { const e: any = new Error('404'); e.status = 404; throw e }
    const r = await consultarPlacaWdapiDetalhado(PLACA)
    expect(r).toEqual({ payload: null, cacheHit: false, fonte: null })
    expect(upserts).toEqual([expect.objectContaining({ placa: PLACA, encontrado: false })])
  })

  it('without a PlacaFipe token goes straight to wdapi', async () => {
    config = { placaApiToken: 'wd-test-token' }
    const r = await consultarPlacaWdapiDetalhado(PLACA)
    expect(r.fonte).toBe('wdapi')
    expect(chamouPlacaFipe()).toBe(0)
  })

  it('without the wdapi token PlacaFipe still answers', async () => {
    config = { placafipeToken: 'pf-test-token' }
    const r = await consultarPlacaWdapiDetalhado(PLACA)
    expect(r.fonte).toBe('placafipe')
  })

  it('logs provider calls without plate or token in the endpoint', async () => {
    placafipeResposta = async () => ({ codigo: 759 })
    await consultarPlacaWdapiDetalhado(PLACA)
    const textos = JSON.stringify(chamadasLog)
    expect(textos).not.toContain(PLACA)
    expect(textos).not.toContain('test-token')
  })
})

describe('engine number stays out of the free result', () => {
  it('motorDoPayload reads the full engine number only', () => {
    expect(motorDoPayload(mapearPlacaFipe(respostaOk(), PLACA))).toBe(MOTOR)
    expect(motorDoPayload({ extra: { motor: '******' } })).toBeNull()
    expect(motorDoPayload({ extra: { motor: '' } })).toBeNull()
    expect(motorDoPayload(null)).toBeNull()
  })

  it('semMotor removes the engine number and keeps everything else', () => {
    const completo = mapearPlacaFipe(respostaOk(), PLACA)
    const livre = semMotor(completo)
    expect(JSON.stringify(livre)).not.toContain(MOTOR)
    expect(livre.extra.chassi).toBe(CHASSI)
    expect(livre.fipe.dados).toHaveLength(2)
    // does not mutate the cached object
    expect(completo.extra.motor).toBe(MOTOR)
    expect(semMotor(null)).toBeNull()
    expect(semMotor(WDAPI)).toBe(WDAPI)
  })
})
