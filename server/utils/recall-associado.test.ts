import { describe, it, expect, vi, beforeEach } from 'vitest'

const consultar = vi.fn()
vi.mock('./recall-toyota', () => ({ consultarRecallToyota: (...a: any[]) => consultar(...a) }))
const { buscarRecallBase, garantirRecallBase } = await import('./recall-associado')

const RESP = { descricaoMarcaModelo: 'TOYOTA/COROLLA XEI', chassi: '9BRBL3HE5G0123456', anoFabricacao: 2015, anoModelo: 2016 }
const MATCH = { recall_id: 1, code: '2HV', name: 'Airbag do motorista', model: 'COROLLA', model_year: '2015/2016', start_date: '2019-03-12', nivel: 'firme', situacao: 'consta_em_campanha', pdf_r2: null }

function fakeSb() {
  const updates: any[] = []
  return {
    updates,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: { response: RESP }, recall: null } } }) }) }),
      update: (u: any) => ({ eq: async () => { updates.push(u); return { error: null } } }),
    }),
  }
}

describe('recallBase no snapshot', () => {
  beforeEach(() => { consultar.mockReset() })

  it('hook positivo: consulta a base com chassi cheio e devolve as campanhas', async () => {
    consultar.mockResolvedValue({ matches: [MATCH] })
    const b = await buscarRecallBase({ placa: 'ABC1D23', recall_sinal: 'firme', recall_marca: 'TOYOTA' }, [RESP])
    expect(consultar.mock.calls[0][0]).toMatchObject({ placa: 'ABC1D23', chassi: '9BRBL3HE5G0123456', marca: 'TOYOTA', ano_mod: 2016 })
    expect(b).toEqual({ consultado: true, sinal: 'firme', fonte: 'base_recalls', campanhas: [{ codigo: '2HV', nome: 'Airbag do motorista', modelo: 'COROLLA', ano_modelo: '2015/2016', inicio: '2019-03-12', nivel: 'firme' }] })
  })

  it('sem hook positivo: nem consulta', async () => {
    expect(await buscarRecallBase({ placa: 'ABC1D23', recall_sinal: 'negativo' }, RESP)).toBeNull()
    expect(consultar).not.toHaveBeenCalled()
  })

  it('garantir: grava uma vez no snapshot (relendo antes) e depois serve do snapshot', async () => {
    consultar.mockResolvedValue({ matches: [MATCH] })
    const sb = fakeSb()
    const ped = { id: 'p1', placa: 'ABC1D23', recall_sinal: 'firme', recall_marca: 'TOYOTA' }
    const b = await garantirRecallBase(sb, ped, { consulta: { response: RESP } })
    expect(b?.campanhas).toHaveLength(1)
    expect(sb.updates[0].relatorio_snapshot.recallBase.campanhas[0].codigo).toBe('2HV')
    expect(sb.updates[0].relatorio_snapshot).toHaveProperty('recall') // nao apagou o que ja estava la
    consultar.mockClear()
    const de2 = await garantirRecallBase(sb, ped, { recallBase: b })
    expect(de2).toBe(b)
    expect(consultar).not.toHaveBeenCalled()
  })

  it('base fora do ar: nao grava nada (tenta de novo depois)', async () => {
    consultar.mockResolvedValue(null)
    const sb = fakeSb()
    expect(await garantirRecallBase(sb, { id: 'p1', placa: 'ABC1D23', recall_sinal: 'suave' }, { consulta: { response: RESP } })).toBeNull()
    expect(sb.updates).toHaveLength(0)
  })
})
