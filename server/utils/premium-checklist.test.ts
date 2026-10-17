import { describe, expect, it, beforeEach } from 'vitest'
import { pedidoDoChecklist, lerChecklist, gravarChecklist, dentroDoTetoChecklist, _limparTetoChecklist, TETO_ESCRITA_POR_TOKEN } from './premium-checklist'

function sbFake(pedido: any) {
  const linhas: any[] = []
  const sb = {
    from: (t: string) => {
      if (t === 'pedidos_premium') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: pedido }) }) }) }
      return {
        select: () => ({ eq: async (_c: string, id: string) => ({ data: linhas.filter((l) => l.pedido_id === id) }) }),
        upsert: async (row: any) => {
          const i = linhas.findIndex((l) => l.pedido_id === row.pedido_id && l.item_id === row.item_id)
          if (i >= 0) linhas[i] = row; else linhas.push(row)
          return { error: null }
        },
      }
    },
  }
  return { sb, linhas }
}

describe('checklist reativo: servidor', () => {
  beforeEach(() => _limparTetoChecklist())
  it('so pedido entregue e token no formato', async () => {
    expect(await pedidoDoChecklist(sbFake({ id: 'p1', status: 'entregue' }).sb, 'TokFicticio000000000001')).toEqual({ id: 'p1' })
    expect(await pedidoDoChecklist(sbFake({ id: 'p1', status: 'aguardando_pagamento' }).sb, 'TokFicticio000000000001')).toBeNull()
    expect(await pedidoDoChecklist(sbFake({ id: 'p1', status: 'entregue' }).sb, 'x y')).toBeNull()
  })
  it('upsert por (pedido, item); le so os marcados e so ids validos', async () => {
    const { sb, linhas } = sbFake({ id: 'p1', status: 'entregue' })
    await gravarChecklist(sb, 'p1', 'v-chassi', true)
    await gravarChecklist(sb, 'p1', 't-vistoria', true)
    await gravarChecklist(sb, 'p1', 't-vistoria', false)
    linhas.push({ pedido_id: 'p1', item_id: 'id-que-saiu', marcado: true })
    expect(linhas.filter((l) => l.item_id === 't-vistoria')).toHaveLength(1)
    expect(linhas.find((l) => l.item_id === 't-vistoria').marcado_em).toBeNull()
    expect(await lerChecklist(sb, 'p1')).toEqual({ 'v-chassi': true })
  })
  it('teto por token', () => {
    for (let i = 0; i < TETO_ESCRITA_POR_TOKEN; i++) expect(dentroDoTetoChecklist('e:tok', TETO_ESCRITA_POR_TOKEN, 1000)).toBe(true)
    expect(dentroDoTetoChecklist('e:tok', TETO_ESCRITA_POR_TOKEN, 1000)).toBe(false)
    expect(dentroDoTetoChecklist('e:outro', TETO_ESCRITA_POR_TOKEN, 1000)).toBe(true)
  })
  it('evento de funil checklist_marcado na allowlist, so com item_id e marcado', async () => {
    const { sanearEvento } = await import('../../shared/eventos-funil')
    const e = sanearEvento({ evento: 'checklist_marcado', extra: { item_id: 'v-chassi', marcado: true, token: 'nao-pode', email: 'x@y' } })!
    expect(e.evento).toBe('checklist_marcado')
    expect(e.extra).toEqual({ item_id: 'v-chassi', marcado: true })
  })
  it('template: checkbox de verdade com label, id estavel e contador', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const vue = readFileSync(join(process.cwd(), 'pages/premium/[token].vue'), 'utf8')
    expect(vue).toContain('type="checkbox"')
    expect(vue).toContain(':for="`chk-${it.id}`"')
    expect(vue).toContain(':key="it.id"')
    expect(vue).toContain('{{ checklistMarcados }} de {{ checklistTotal }} conferidos')
    expect(vue).toContain("document.addEventListener('visibilitychange', aoVoltarFocoChecklist)")
  })
})
