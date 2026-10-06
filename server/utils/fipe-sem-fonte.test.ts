// @vitest-environment node
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

// Caso FUG0A96 (Lamborghini Huracan Spyder 2018): a fonte veio com fipe.dados
// vazio e o relatorio ficou sem valor nenhum. Agora o fluxo pago resolve pela
// tabela FIPE (marca + modelo + ano do registro) e so aceita confianca alta.

const escolher = vi.fn()
vi.mock('./fipe-candidato', async (orig) => ({ ...(await orig<any>()), escolherMelhorFipe: (...a: any[]) => escolher(...a) }))
vi.mock('./seguro-estimate', () => ({ getSeguroEstimado: async () => null }))

const { getValorCusto, aceitaCandidatoFipe } = await import('./valor-custo')
const { marcaDoRegistro, marcaParaFipeApi } = await import('./fipe-candidato')

const SENATRAN = { descricaoMarcaModelo: 'I/LAMBORGHINI HURAC SPYD', anoModelo: 2018, cilindrada: 5204 }
const HURACAN = { codigo_fipe: '078011-1', modelo: 'HURACAN Spyder LP 610-4', valor: 3230798, texto_valor: 'R$ 3.230.798,00', combustivel: 'Gasolina', mes_referencia: 'outubro de 2026' }

beforeEach(() => {
  escolher.mockReset()
  vi.stubGlobal('useRuntimeConfig', () => ({ placaApiToken: 'x', fipeApiUrl: 'https://fipe.test', fipeApiToken: 't' }))
  vi.stubGlobal('consultarPlacaWdapi', async () => ({ MARCA: 'LAMBORGHINI', MODELO: 'HURAC SPYD', anoModelo: '2018', fipe: { dados: [] } }))
  vi.stubGlobal('$fetch', async () => { throw new Error('sem historico no teste') })
  vi.stubGlobal('aceitaCustoDeCarro', (s: string) => s === 'carro')
  vi.stubGlobal('getRegiaoSusep', () => null)
})
afterEach(() => vi.unstubAllGlobals())

describe('marca pro universo da fipe-api', () => {
  it('marca do registro SENATRAN', () => {
    expect(marcaDoRegistro('I/LAMBORGHINI HURAC SPYD')).toBe('LAMBORGHINI')
    expect(marcaDoRegistro('CHEVROLET/CELTA 1.0L LT')).toBe('CHEVROLET')
    expect(marcaDoRegistro('I/M.BENZ AMG CLA35 4M')).toBe('M.BENZ')
    expect(marcaDoRegistro('JEEP/COMMANDER LIM T')).toBe('JEEP')
    expect(marcaDoRegistro('R/RECLAL CS RC')).toBe('')
    expect(marcaDoRegistro('REB/VALE DO ACO MINAS BA')).toBe('')
    expect(marcaDoRegistro(null)).toBe('')
  })
  it('nome da fipe-api (CHEVROLET cru casa com caminhoes)', () => {
    expect(marcaParaFipeApi('CHEVROLET')).toBe('GM - Chevrolet')
    expect(marcaParaFipeApi('GM')).toBe('GM - Chevrolet')
    expect(marcaParaFipeApi('VW')).toBe('VW - VolksWagen')
    expect(marcaParaFipeApi('M.BENZ')).toBe('Mercedes-Benz')
    expect(marcaParaFipeApi('LAMBORGHINI')).toBe('LAMBORGHINI')
  })
})

describe('aceitaCandidatoFipe', () => {
  const r = (decididoPor: any, confianca?: any) => ({ decididoPor, confianca, escolhido: HURACAN as any })
  it('sem FIPE na fonte: so confianca alta', () => {
    expect(aceitaCandidatoFipe(r('regra', 'alta'), true)).toBe(true)
    expect(aceitaCandidatoFipe(r('haiku', 'alta'), true)).toBe(true)
    expect(aceitaCandidatoFipe(r('haiku', 'media'), true)).toBe(false)
    expect(aceitaCandidatoFipe(r('ambiguo', 'baixa'), true)).toBe(false)
    expect(aceitaCandidatoFipe(r('fallback'), true)).toBe(false)
  })
  it('com FIPE na fonte: regra de sempre (media passa)', () => {
    expect(aceitaCandidatoFipe(r('haiku', 'media'), false)).toBe(true)
    expect(aceitaCandidatoFipe(r('ambiguo', 'baixa'), false)).toBe(false)
  })
})

describe('getValorCusto com fipe.dados vazio', () => {
  const opts = { ativo: true, senatran: SENATRAN as any, segmento: 'carro' as any }
  it('alta confianca: valor da tabela FIPE', async () => {
    escolher.mockResolvedValue({ escolhido: HURACAN, decididoPor: 'haiku', confianca: 'alta', candidatos: [HURACAN] })
    const vc = await getValorCusto('FUG0A96', 'SP', 'SAO PAULO', opts)
    expect(vc?.fipe).toBe('R$ 3.230.798,00')
    expect(vc?.fipeCodigo).toBe('078011-1')
    expect(vc?.fipeNaoLocalizado).toBeFalsy()
  })
  it('media confianca: nao mostra valor, marca nao localizado', async () => {
    escolher.mockResolvedValue({ escolhido: HURACAN, decididoPor: 'haiku', confianca: 'media', candidatos: [HURACAN] })
    const vc = await getValorCusto('FUG0A96', 'SP', 'SAO PAULO', opts)
    expect(vc?.fipe).toBeNull()
    expect(vc?.fipeNaoLocalizado).toBe(true)
    expect(vc?.custo5anos).toBeNull()
  })
  it('ambiguo: sem valor, com a lista de candidatos (regra que ja existe)', async () => {
    escolher.mockResolvedValue({ escolhido: HURACAN, decididoPor: 'ambiguo', confianca: 'baixa', candidatos: [HURACAN, { ...HURACAN, codigo_fipe: '078010-3' }] })
    const vc = await getValorCusto('FUG0A96', 'SP', 'SAO PAULO', opts)
    expect(vc?.fipe).toBeNull()
    expect(vc?.fipeCandidato?.decididoPor).toBe('ambiguo')
    expect(vc?.fipeCandidato?.candidatos.length).toBe(2)
  })
  it('nada bateu: nao localizado', async () => {
    escolher.mockResolvedValue({ escolhido: null, decididoPor: 'fallback', candidatos: [] })
    const vc = await getValorCusto('FUG0A96', 'SP', 'SAO PAULO', opts)
    expect(vc?.fipeNaoLocalizado).toBe(true)
  })
  it('fora do fluxo pago: continua null, sem chamar o funil', async () => {
    const vc = await getValorCusto('FUG0A96', 'SP', 'SAO PAULO')
    expect(vc).toBeNull()
    expect(escolher).not.toHaveBeenCalled()
  })
})
