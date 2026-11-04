import { describe, it, expect, vi } from 'vitest'

vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
const { rebuildLeilao, MAX_ANTERIORES } = await import('./rebuild-leilao')

const T = Date.UTC(2026, 10, 4, 16, 0, 0)
const refs = (n: number) => Array.from({ length: n }, (_, i) => ({ ref: `lote/f${i}.jpg` }))
const passagemVelha = { fonte: 'Copart', lote: 'L1', nivel: 'confirmado', foto_refs: refs(1) }
const snapBase = () => ({
  consulta: { placa: 'P', response: [{}] }, valorCusto: { fipe: 1 }, recall: { x: 1 }, multas: { status: 'ok' },
  historicoLeilao: { resumo: { tem_indicio: true }, passagens: [passagemVelha] },
})

function banco(pedidos: any[]) {
  const updates: any[] = []
  return {
    updates,
    from: () => {
      let patch: any = null
      let ids: string[] = []
      const api: any = {
        select: () => api,
        in: async (_c: string, v: string[]) => ({ data: pedidos.filter((p) => v.includes(p.token_entrega)), error: null }),
        update: (p: any) => { patch = p; return api },
        eq: async (_c: string, id: string) => { ids = [id]; updates.push({ id, patch }); pedidos.filter((p) => ids.includes(p.id)).forEach((p) => Object.assign(p, patch)); return { error: null } },
      }
      return api
    },
  }
}

describe('rebuildLeilao (admin backfill)', () => {
  it('token inexistente e pedido nao entregue: pula, sem escrever nada', async () => {
    const db = banco([{ id: 'p2', token_entrega: 'tokPend', status: 'consultando', plano: 'completa', relatorio_snapshot: snapBase() }])
    const montar = vi.fn()
    const r = await rebuildLeilao(db, ['naoExiste', 'tokPend'], { montar: montar as any, agora: T })
    expect(r).toEqual([
      { token: 'naoExiste', pulado: 'token inexistente' },
      { token: 'tokPend', pulado: 'pedido nao entregue (status consultando)' },
    ])
    expect(montar).not.toHaveBeenCalled()
    expect(db.updates).toHaveLength(0)
  })

  it('sucesso com fotos novas: troca so o historicoLeilao, guarda o anterior e renova o cache', async () => {
    const ped = { id: 'p1', token_entrega: 'tokOk', status: 'entregue', plano: 'completa', placa: 'P', consulta_id: 'c1', preview: null, relatorio_snapshot: snapBase() }
    const db = banco([ped])
    const novo = { resumo: { tem_indicio: true }, passagens: [{ ...passagemVelha, foto_refs: refs(8) }] }
    const montar = vi.fn(async () => ({ historicoLeilao: novo }))
    const r = await rebuildLeilao(db, ['tokOk'], { montar: montar as any, agora: T })
    expect(r).toEqual([{ token: 'tokOk', ok: true, passagens: 1, fotosPorPassagem: [{ fonte: 'Copart', lote: 'L1', fotos: 8 }] }])
    // Mesmo caminho da entrega: so o campo de leilao, com o id (base parceira reaproveita a cobranca) e cache renovado.
    expect(montar).toHaveBeenCalledWith(db, expect.objectContaining({ id: 'p1', placa: 'P', plano: 'completa', consulta_id: 'c1' }), ['historicoLeilao'], { renovarLeilao: true })
    const snap = ped.relatorio_snapshot as any
    expect(snap.historicoLeilao).toBe(novo)
    expect(snap.valorCusto).toEqual({ fipe: 1 })
    expect(snap.recall).toEqual({ x: 1 })
    expect(snap.multas).toEqual({ status: 'ok' })
    expect(snap.auditoria.historicoLeilaoAnteriores).toEqual([
      { substituidoEm: new Date(T).toISOString(), motivo: 'rebuildLeilao', bloco: { resumo: { tem_indicio: true }, passagens: [passagemVelha] } },
    ])
  })

  it('base de leiloes fora do ar: nao apaga o bloco que o cliente ja tem', async () => {
    const ped = { id: 'p1', token_entrega: 'tokOk', status: 'entregue', plano: 'completa', relatorio_snapshot: snapBase() }
    const db = banco([ped])
    const r = await rebuildLeilao(db, ['tokOk'], { montar: (async () => ({ historicoLeilao: null })) as any })
    expect(r[0]).toMatchObject({ ok: false })
    expect(db.updates).toHaveLength(0)
  })

  it('auditoria guarda so os ultimos blocos', async () => {
    const snap: any = snapBase()
    snap.auditoria = { historicoLeilaoAnteriores: Array.from({ length: MAX_ANTERIORES }, (_, i) => ({ substituidoEm: `x${i}`, bloco: null })) }
    const ped = { id: 'p1', token_entrega: 't', status: 'entregue', plano: 'completa', relatorio_snapshot: snap }
    await rebuildLeilao(banco([ped]), ['t'], { montar: (async () => ({ historicoLeilao: { passagens: [] } })) as any, agora: T })
    const a = (ped.relatorio_snapshot as any).auditoria.historicoLeilaoAnteriores
    expect(a).toHaveLength(MAX_ANTERIORES)
    expect(a[0].substituidoEm).toBe(new Date(T).toISOString())
  })

  it('basica nao tem bloco de leilao', async () => {
    const r = await rebuildLeilao(banco([{ id: 'p', token_entrega: 'b', status: 'entregue', plano: 'basica', relatorio_snapshot: snapBase() }]), ['b'], { montar: vi.fn() as any })
    expect(r).toEqual([{ token: 'b', pulado: 'plano sem bloco de leilao' }])
  })
})
