import { describe, it, expect, beforeEach } from 'vitest'
import { listaLeilaoModelos, _zerarCacheGancho, TTL_GANCHO_MS } from './gancho-modelo'

function sb(linhas: any[] | null, erro = false) {
  const chamadas = { n: 0 }
  const q: any = {
    select: () => q, gt: () => q, order: () => q,
    range: async (de: number, ate: number) => {
      chamadas.n++
      return erro ? { data: null, error: { message: 'x' } } : { data: (linhas || []).slice(de, ate + 1), error: null }
    },
  }
  return { chamadas, from: () => q }
}

describe('cache da leilao_modelos', () => {
  beforeEach(() => _zerarCacheGancho())
  it('carrega e guarda 24 h', async () => {
    const s = sb([{ marca: 'VW', modelo: 'GOL', qtd: 3 }])
    expect(await listaLeilaoModelos(s, 0)).toEqual([{ marca: 'VW', modelo: 'GOL', qtd: 3 }])
    await listaLeilaoModelos(s, TTL_GANCHO_MS - 1)
    expect(s.chamadas.n).toBe(1)
    await listaLeilaoModelos(s, TTL_GANCHO_MS + 1)
    expect(s.chamadas.n).toBe(2)
  })
  it('pagina de 1000 em 1000', async () => {
    const linhas = Array.from({ length: 2500 }, (_, i) => ({ marca: 'M', modelo: `X${i}`, qtd: 1 }))
    const s = sb(linhas)
    expect((await listaLeilaoModelos(s, 0)).length).toBe(2500)
    expect(s.chamadas.n).toBe(3)
  })
  it('tabela vazia = lista vazia; erro = vazia e tenta de novo em 5 min', async () => {
    expect(await listaLeilaoModelos(sb([]), 0)).toEqual([])
    _zerarCacheGancho()
    const e = sb(null, true)
    expect(await listaLeilaoModelos(e, 0)).toEqual([])
    await listaLeilaoModelos(e, 4 * 60 * 1000)
    expect(e.chamadas.n).toBe(1)
    await listaLeilaoModelos(e, 6 * 60 * 1000)
    expect(e.chamadas.n).toBe(2)
  })
  it('tabela vazia tambem relê em 5 min (acesso antes da 1a carga nao congela 24 h)', async () => {
    const vazia = sb([])
    expect(await listaLeilaoModelos(vazia, 0)).toEqual([])
    await listaLeilaoModelos(vazia, 4 * 60 * 1000)
    expect(vazia.chamadas.n).toBe(1)
    await listaLeilaoModelos(vazia, 6 * 60 * 1000)
    expect(vazia.chamadas.n).toBe(2)
  })
})
