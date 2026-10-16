import { describe, expect, it, vi } from 'vitest'
import { revisarRestricoesDetran, promptRevisor } from './revisor-restricao-detran'
import { classificarRestricaoDetran } from '../../shared/restricao-detran-classe'

function sbMemoria() {
  const linhas = new Map<string, any>()
  const sb = {
    from: () => ({
      select: () => ({ eq: (_c: string, f: string) => ({ eq: (_c2: string, ch: string) => ({ maybeSingle: async () => ({ data: linhas.get(`${f}|${ch}`) || null }) }) }) }),
      upsert: async (row: any) => { linhas.set(`${row.fonte}|${row.chave}`, row); return { error: null } },
    }),
  }
  return { sb, linhas }
}
const resposta = (classe: string) => ({ ok: true, json: async () => ({ content: [{ type: 'text', text: JSON.stringify({ classe, motivo: 'teste' }) }] }) }) as any

describe('revisor final (Haiku) das restricoes do DETRAN', () => {
  const duvida = classificarRestricaoDetran({ tipo: 'administrativa', texto: 'Administrativa' })
  it('chama uma vez por texto e guarda no cache persistente', async () => {
    const { sb, linhas } = sbMemoria()
    const fetcher = vi.fn(async () => resposta('restricao'))
    const v1 = await revisarRestricoesDetran([duvida, duvida], { sb, chaveApi: 'k', fetcher })
    expect(v1[duvida.chave]).toMatchObject({ classe: 'restricao' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect([...linhas.keys()][0]).toMatch(/^revisor_restricao_detran\|/)
    const corpo = JSON.parse((fetcher.mock.calls[0] as any)[1].body)
    expect(corpo).toMatchObject({ model: 'claude-haiku-5-5', thinking: { type: 'disabled' } })
    expect(corpo.temperature).toBeUndefined()
  })
  it('falha ou "duvida" do Haiku: sem veredito (tela mostra informacao neutra)', async () => {
    const outra = classificarRestricaoDetran({ tipo: 'judiciaria', texto: 'CONSTA' })
    expect(await revisarRestricoesDetran([outra], { chaveApi: 'k', fetcher: vi.fn(async () => ({ ok: false, status: 500 }) as any) })).toEqual({})
    const terceira = classificarRestricaoDetran({ tipo: 'financeira', texto: 'NAO CONSTA BAIXA' })
    expect(await revisarRestricoesDetran([terceira], { chaveApi: 'k', fetcher: vi.fn(async () => resposta('duvida')) })).toEqual({})
  })
  it('sem chave e sem cache: nao chama nada', async () => {
    const fetcher = vi.fn()
    const p = classificarRestricaoDetran({ tipo: 'x', texto: 'CONSTA ALGO' })
    expect(await revisarRestricoesDetran([p], { fetcher: fetcher as any })).toEqual({})
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('prompt sem travessao', () => {
    expect(promptRevisor('administrativa', 'x')).not.toContain('—')
  })
})
