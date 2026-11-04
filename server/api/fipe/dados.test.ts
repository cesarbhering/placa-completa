import { describe, it, expect, vi, beforeEach } from 'vitest'
import fipePrices from '../../../data/fipe-prices.json'
import seguroModelos from '../../../data/seguro-modelos.json'
import { fipeBrands } from '../../../data/fipe-brands'
import { modelSeoData } from '../../../data/fipe-model-intros'

let handler: any
let reqHeaders: Record<string, string>
let resHeaders: Record<string, string>
let status: number | null
vi.stubGlobal('defineEventHandler', (fn: any) => { handler = fn; return fn })
vi.stubGlobal('getHeader', (_e: any, nome: string) => reqHeaders[nome.toLowerCase()])
vi.stubGlobal('setResponseHeader', (_e: any, nome: string, valor: string) => { resHeaders[nome.toLowerCase()] = valor })
vi.stubGlobal('setResponseStatus', (_e: any, s: number) => { status = s })
await import('./dados.get')

// slugs que o catalogo reconhece: marca-modelo (paginas de modelo) e marca (pagina da marca)
const slugsDeModelo = new Set(Object.values(fipeBrands).flatMap((b) => b.models.map((m) => `${b.slug}-${m.slug}`)))
const slugsDeMarca = new Set(Object.keys(fipeBrands))

describe('GET /api/fipe/dados: dados das paginas /tabela-fipe para o app', () => {
  beforeEach(() => { reqHeaders = {}; resHeaders = {}; status = null })

  it('devolve versao 1 e as cinco chaves do contrato', async () => {
    const corpo = await handler({})
    expect(corpo.versao).toBe(1)
    expect(Object.keys(corpo).sort()).toEqual(['intros', 'marcas', 'precos', 'referencia', 'seguro', 'versao'])
  })

  it('entrega os dados inteiros, sem cortar nem resumir', async () => {
    const corpo = await handler({})
    expect(corpo.marcas).toEqual(fipeBrands)
    expect(corpo.precos).toEqual(fipePrices)
    expect(corpo.intros).toEqual(modelSeoData)
    expect(corpo.seguro).toEqual(seguroModelos)
  })

  it('referencia e o mes mais recente entre as entradas de precos', async () => {
    const meses = Object.values(fipePrices as Record<string, any>).map((e) => e.priceTable[0])
    const maior = meses.reduce((a, b) => (b.referenceYear * 100 + b.referenceMonth > a.referenceYear * 100 + a.referenceMonth ? b : a))
    const { referencia } = await handler({})
    expect(referencia).toEqual({ mes: maior.referenceMonth, ano: maior.referenceYear })
    expect(referencia.mes).toBeGreaterThanOrEqual(1)
    expect(referencia.mes).toBeLessThanOrEqual(12)
  })

  it('toda chave de precos e seguro e um slug marca-modelo do catalogo', async () => {
    const { precos, seguro } = await handler({})
    expect(Object.keys(precos).filter((k) => !slugsDeModelo.has(k))).toEqual([])
    expect(Object.keys(seguro).filter((k) => !slugsDeModelo.has(k))).toEqual([])
  })

  it('toda chave de intros e slug de marca ou marca-modelo do catalogo', async () => {
    const { intros } = await handler({})
    expect(Object.keys(intros).filter((k) => !slugsDeMarca.has(k) && !slugsDeModelo.has(k))).toEqual([])
  })

  it('manda Cache-Control de um dia e ETag forte', async () => {
    await handler({})
    expect(resHeaders['cache-control']).toBe('public, max-age=86400')
    expect(resHeaders['etag']).toMatch(/^"[0-9a-f]{40,64}"$/)
    expect(status).toBeNull()
  })

  it('o ETag e o mesmo entre chamadas (corpo fixo por build)', async () => {
    await handler({})
    const primeiro = resHeaders['etag']
    resHeaders = {}
    await handler({})
    expect(resHeaders['etag']).toBe(primeiro)
  })

  it('If-None-Match igual ao ETag: 304 sem corpo', async () => {
    await handler({})
    reqHeaders = { 'if-none-match': resHeaders['etag'] }
    resHeaders = {}
    expect(await handler({})).toBeNull()
    expect(status).toBe(304)
    expect(resHeaders['etag']).toBeDefined()
  })

  it('If-None-Match diferente: 200 com corpo', async () => {
    reqHeaders = { 'if-none-match': '"outro"' }
    const corpo = await handler({})
    expect(corpo.versao).toBe(1)
    expect(status).toBeNull()
  })
})
