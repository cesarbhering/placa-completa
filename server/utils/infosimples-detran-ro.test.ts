// @vitest-environment node
import { describe, it, expect } from 'vitest'
import RO from './__fixtures__/infosimples-detran-ro.json'
import { parsearDetranRo, blocoDetranDaUf, DETRAN_UFS } from './infosimples-detran'

// Resposta REAL do DETRAN-RO (QTF0A93, 14/out) saneada: placa, chassi e recibo trocados.
describe('DETRAN-RO /veiculo', () => {
  it('caso real: em circulacao, sem multa, sem restricao', () => {
    const b: any = blocoDetranDaUf('RO', RO)
    expect(b).toMatchObject({ status: 'ok', fonte: 'detran_ro', multas_total_centavos: 0, multas_itens: [], restricoes_detran: [], alerta_roubo_furto: null })
    expect(JSON.stringify(b)).not.toMatch(/FIAT|VILHENA|storage\.invalid|chassi/i)
  })
  it('com multa (shape generico), paga fora, restricao e situacao', () => {
    const b: any = parsearDetranRo({
      debitos_veiculo: { multas: [
        { auto_infracao: 'R1', descricao: 'AVANCAR SINAL', data_infracao: '01/02/2026 10:30', valor: 'R$ 293,47', status: 'Em aberto' },
        { auto_infracao: 'R2', descricao: 'X', valor: 'R$ 88,38', status: 'Paga' },
      ], normalizado_total_multas: 293.47 },
      restricoes: ['ALIENACAO FIDUCIARIA', 'NADA CONSTA'],
      status: 'Roubado/Furtado',
    })
    expect(b.multas_itens.map((m: any) => m.auto)).toEqual(['R1'])
    expect(b.multas_total_centavos).toBe(29347)
    expect(b.restricoes_detran).toEqual([
      { tipo: 'financeira', texto: 'ALIENACAO FIDUCIARIA' },
      { tipo: 'situacao', texto: 'Roubado/Furtado' },
    ])
  })
  it('formato desconhecido -> null; mapa', () => {
    expect(parsearDetranRo({ outra: 1 })).toBeNull()
    expect(DETRAN_UFS.RO).toMatchObject({ path: 'detran/ro/veiculo', cert: 'nenhum', gate: 'sempre', fonteCusto: 'infosimples_detran_ro', timeoutS: 300 })
  })
})
