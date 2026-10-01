import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import FX from './__fixtures__/recall-nissan.json'
import { parsearRecallNissan, consultarRecallNissan, completarRecallNissan, ehNissan, _limparCacheNissan } from './recall-nissan'

// Fixture = respostas REAIS da consulta oficial Nissan (01/out): uma Frontier
// com 3 campanhas realizadas (4 linhas: RT030 tem 2 itens) e um carro com RT030
// pendente. Chassi trocado por FALSO e texto longo cortado.

describe('parsearRecallNissan', () => {
  it('agrupa por campanha: 3 realizadas com data e concessionaria, sem chassi nem texto longo', () => {
    const b = parsearRecallNissan(FX.realizadas)!
    expect(b.pendentes).toBe(0)
    expect(b.campanhas.map((c) => c.numero)).toEqual(['RT038', 'R1202', 'RT030'])
    expect(b.campanhas[0]).toEqual({
      numero: 'RT038', titulo: 'Substituição do Gerador de Gases Do Airbag Do Motorista', status: 'realizado',
      data: '2021-01-15', concessionaria: 'NICENTER AV. BRASILIA NBA',
    })
    expect(b.campanhas[2]).toMatchObject({ numero: 'RT030', data: '2019-01-04', concessionaria: 'NICENTER APUCARANA NBA' })
    const out = JSON.stringify(b)
    for (const p of ['9XXXXXXXXXXXXXXXX', 'chassis', 'texto_da_campanha', 'RIO DE JANEIRO', '98510EB79C', 'itens_do_reparo']) expect(out).not.toContain(p)
  })
  it('pendente: sem data e sem concessionaria', () => {
    const b = parsearRecallNissan(FX.pendente)!
    expect(b.pendentes).toBe(1)
    expect(b.campanhas[0]).toMatchObject({ numero: 'RT030', status: 'pendente', data: null, concessionaria: null })
  })
  it('qualquer item nao reparado deixa a campanha pendente; pendentes vem primeiro', () => {
    const misto = [...FX.realizadas, { ...FX.realizadas[1], efetuou_o_reparo: false, data_do_reparo: null }]
    const b = parsearRecallNissan(misto)!
    expect(b.campanhas[0]).toMatchObject({ numero: 'RT030', status: 'pendente' })
    expect(b.pendentes).toBe(1)
  })
  it('excluido do recall', () => {
    const b = parsearRecallNissan([{ ...FX.pendente[0], excluido_do_recall: true }])!
    expect(b.campanhas[0].status).toBe('excluido')
    expect(b.pendentes).toBe(0)
  })
  it('lista vazia = consultado sem campanha; nao-lista = null', () => {
    expect(parsearRecallNissan([])).toEqual({ fonte: 'nissan', consultado: true, pendentes: 0, campanhas: [] })
    expect(parsearRecallNissan({ erro: 'x' })).toBeNull()
  })
  it('ehNissan', () => {
    expect(ehNissan('NISSAN/KICKS SL CVT')).toBe(true)
    expect(ehNissan('I/NISSAN FRONTIER')).toBe(true)
    expect(ehNissan('RENAULT/KWID')).toBe(false)
  })
})

describe('consultarRecallNissan / completarRecallNissan', () => {
  beforeEach(() => _limparCacheNissan())
  afterEach(() => vi.unstubAllGlobals())
  const VIN = '3N1AB7AD1KY000000'
  function fakeSb(snap: any = { consulta: {}, recall: { status: 'ok' } }) {
    const updates: any[] = []
    return {
      updates,
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: snap } }) }) }),
        update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
      }),
    }
  }

  it('1 GET por chassi, com cache', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => FX.pendente }))
    vi.stubGlobal('fetch', f)
    const a = await consultarRecallNissan(VIN)
    const b = await consultarRecallNissan(VIN.toLowerCase())
    expect(a?.pendentes).toBe(1)
    expect(b).toEqual(a)
    expect(f).toHaveBeenCalledTimes(1)
    expect(String((f.mock.calls[0] as any)[0])).toMatch(/nissanRecall\/recall\/3N1AB7AD1KY000000$/)
  })
  it('fail-open: erro HTTP, rede e timeout -> null, sem cache', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    expect(await consultarRecallNissan(VIN)).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('timeout') }))
    expect(await consultarRecallNissan(VIN)).toBeNull()
  })
  it('chassi incompleto: nao chama', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    expect(await consultarRecallNissan('3N1AB7AD1')).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })
  it('todo Nissan com chassi cheio, MESMO sem flag de recall: grava recallNissan sem pisar no resto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => FX.realizadas })))
    const sb = fakeSb()
    const r = await completarRecallNissan(sb, { id: 'p1' }, [{ descricaoMarcaModelo: 'NISSAN/FRONTIER', chassi: VIN, indicadorRecall: false }])
    expect(r).toEqual({ ok: true, pendentes: 0 })
    expect(sb.updates[0].relatorio_snapshot.recall).toEqual({ status: 'ok' })
    expect(sb.updates[0].relatorio_snapshot.recallNissan.campanhas).toHaveLength(3)
  })
  it('nao Nissan ou sem chassi: nao chama', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    expect(await completarRecallNissan(fakeSb(), { id: 'p1' }, [{ descricaoMarcaModelo: 'RENAULT/KWID', chassi: VIN }])).toMatchObject({ pulado: 'nao e Nissan' })
    expect(await completarRecallNissan(fakeSb(), { id: 'p1' }, [{ descricaoMarcaModelo: 'NISSAN/KICKS', chassi: '' }])).toMatchObject({ pulado: 'sem chassi cheio' })
    expect(f).not.toHaveBeenCalled()
  })
})
