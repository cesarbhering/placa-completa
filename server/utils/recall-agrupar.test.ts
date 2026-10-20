import { describe, it, expect, vi } from 'vitest'
import { agruparCampanhasRecall, hashCampanhas, promptAgrupar, FONTE_CUSTO, FONTE_AGRUPAMENTO } from './recall-agrupar'
import type { CampanhaBase } from '../../shared/recall-associado'

const C = (nome: string, ano: string): CampanhaBase => ({ codigo: null, nome, modelo: 'Voyage', ano_modelo: ano, inicio: null, nivel: 'firme' })
const CAMPS = [C('Gerador de gás do airbag do motorista', '2011 a 2014'), C('Gerador de gás do airbag do motorista e/ou do passageiro', '2009 a 2016'), C('Bomba de combustível', '2012')]
const OK = { grupos: [
  { titulo: 'Airbag do motorista e/ou passageiro', resumo: 'O airbag pode romper ao abrir.', indices: [0, 1], anos: '2009 a 2016', modelo: 'Voyage' },
  { titulo: 'Bomba de combustível', resumo: 'O motor pode parar.', indices: [2], anos: '2012', modelo: 'Voyage' },
] }

function sbMem() {
  const cache = new Map<string, any>()
  const custos: any[] = []
  const sb = {
    from: (t: string) => {
      if (t === 'premium_custos') return { insert: async (l: any) => { custos.push(l); return { error: null } } }
      const f: any = {}
      const q: any = {
        select: () => q, eq: (k: string, v: any) => { f[k] = v; return q },
        maybeSingle: async () => ({ data: cache.get(`${f.fonte}|${f.chave}`) ?? null }),
        upsert: async (l: any) => { cache.set(`${l.fonte}|${l.chave}`, { ...l }); return { error: null } },
      }
      return q
    },
  }
  return { sb, cache, custos }
}
const resposta = (json: any, usage = { input_tokens: 500, output_tokens: 120 }) => async () =>
  new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(json) }], usage }), { status: 200 })

describe('agruparCampanhasRecall', () => {
  it('agrupa, grava no cache e registra o custo (anthropic_recall)', async () => {
    const m = sbMem()
    const fetcher = vi.fn(resposta(OK))
    const r = await agruparCampanhasRecall(CAMPS, { sb: m.sb, chaveApi: 'k', fetcher: fetcher as any, pedidoId: 'p1', log: () => {} })
    expect(r!.grupos.map((g) => g.indices)).toEqual([[0, 1], [2]])
    expect(r!.total).toBe(3)
    expect(r!.hash).toBe(hashCampanhas(CAMPS))
    expect(m.custos).toHaveLength(1)
    expect(m.custos[0]).toMatchObject({ pedido_id: 'p1', fonte: FONTE_CUSTO, code: 200 })
    expect(m.custos[0].preco).toBeGreaterThan(0)
    expect(m.cache.has(`${FONTE_AGRUPAMENTO}|${r!.hash}`)).toBe(true)
    // mesmo conjunto de novo: cache, sem chamar a API
    const r2 = await agruparCampanhasRecall(CAMPS, { sb: m.sb, chaveApi: 'k', fetcher: fetcher as any, log: () => {} })
    expect(r2!.grupos).toEqual(r!.grupos)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('o pedido a API sai sem temperature, com thinking desligado e schema', async () => {
    let corpo: any
    const fetcher = vi.fn(async (_u: any, init: any) => { corpo = JSON.parse(init.body); return resposta(OK)() })
    await agruparCampanhasRecall(CAMPS, { chaveApi: 'k', fetcher: fetcher as any, log: () => {} })
    expect(corpo.model).toBe('claude-haiku-5-5')
    expect(corpo).not.toHaveProperty('temperature')
    expect(corpo.thinking).toEqual({ type: 'disabled' })
    expect(corpo.output_config.format.type).toBe('json_schema')
  })

  it('agente perde ou repete indice: null (lista original), custo registrado com o erro, nada no cache', async () => {
    for (const ruim of [
      { grupos: [{ ...OK.grupos[0], indices: [0] }, OK.grupos[1]] },
      { grupos: [{ ...OK.grupos[0], indices: [0, 1, 2] }, OK.grupos[1]] },
    ]) {
      const m = sbMem()
      const r = await agruparCampanhasRecall(CAMPS, { sb: m.sb, chaveApi: 'k', fetcher: resposta(ruim) as any, pedidoId: 'p1', log: () => {} })
      expect(r).toBe(null)
      expect(m.custos[0]).toMatchObject({ code: 422 })
      expect(m.custos[0].detalhe).toMatch(/indices invalidos/)
      expect(m.cache.size).toBe(0)
    }
  })

  it('HTTP 400, JSON torto, erro de rede e timeout: null, nunca lanca', async () => {
    const casos: any[] = [
      async () => new Response('{}', { status: 400 }),
      async () => new Response(JSON.stringify({ content: [{ type: 'text', text: 'nao e json' }] }), { status: 200 }),
      async () => { throw new Error('rede') },
      async () => { const e: any = new Error('abort'); e.name = 'AbortError'; throw e },
    ]
    for (const f of casos) expect(await agruparCampanhasRecall(CAMPS, { chaveApi: 'k', fetcher: f, log: () => {} })).toBe(null)
  })

  it('uma campanha so, ou sem chave: nem chama', async () => {
    const fetcher = vi.fn(resposta(OK))
    expect(await agruparCampanhasRecall([CAMPS[0]], { chaveApi: 'k', fetcher: fetcher as any })).toBe(null)
    expect(await agruparCampanhasRecall(CAMPS, { chaveApi: null, fetcher: fetcher as any })).toBe(null)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('prompt sem travessao e com a regra dos indices', () => {
    const p = promptAgrupar(CAMPS)
    expect(p).not.toMatch(/—/)
    expect(p).toContain('exatamente um grupo')
    expect(p.toLowerCase()).not.toContain('senatran')
  })
})
