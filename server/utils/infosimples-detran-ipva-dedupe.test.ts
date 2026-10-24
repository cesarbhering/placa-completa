import { describe, it, expect, vi } from 'vitest'
import { parsearDetranSp, detranParaMultas, parsearDetranDf, normalizarIpvaItens } from './infosimples-detran'

// FGP0J33 (23/out/2026): trecho de IPVA do bruto real do DETRAN-SP
// (premium_custos, infosimples_detran_sp, code 200). Mesmo IPVA duas vezes, so
// a cota muda; a fonte diz 2610.04 e a pagina somava R$ 5.220,08.
const SP_FGP0J33 = {
  ipva: '2610.04',
  normalizado_ipva: 2610.04,
  ipva_mensagem: null,
  debitos_ipva: [
    { cota: '8', valor: 2610.04, exercicio: '2026', data_vencimento: '19/02/2026' },
    { cota: '2', valor: 2610.04, exercicio: '2026', data_vencimento: '19/02/2026' },
  ],
}

// ORB7328 (DF): trecho de debitos.ipva do bruto real do DETRAN-DF. 9 itens cuja
// soma e o total da fonte (R$ 11.868,75): NAO e duplicata, nao pode mudar.
const cotaDf = (cota: string, valor: number, ano = '2026') => ({ ano, cota, mora: 0, multa: 0, total: valor, valor, outros: 0, vencimento: null })
const DF_ORB7328 = {
  debitos: {
    ipva: [
      ...['01', '02', '03', '04', '05', '06'].map((c) => cotaDf(c, 493.04)),
      cotaDf('89', 2958.24),
      cotaDf('', 2937.72, '2024'),
      cotaDf('', 3014.55, '2025'),
    ],
  },
  veiculo: { ano_ultimo_licenciamento: '2021', desc_situacao: 'EM CIRCULACAO' },
}

describe('IPVA sem repeticao (FGP0J33 e ORB7328)', () => {
  it('SP: o mesmo IPVA com cota diferente aparece uma vez, com a cota so como informacao', () => {
    const bloco = detranParaMultas(parsearDetranSp(SP_FGP0J33, new Date('2026-10-23T12:00:00Z')))
    expect(bloco.ipva_itens).toEqual([{ ano: 2026, vencimento: '19/02/2026', valor_centavos: 261004, cota: '8' }])
    expect(bloco.ipva_total_centavos).toBe(261004)
  })

  it('SP: total vem da fonte; se a lista diverge, vale a fonte e loga', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const bloco = detranParaMultas(parsearDetranSp({ ...SP_FGP0J33, ipva: '3000.00', normalizado_ipva: 3000 }, new Date('2026-10-23T12:00:00Z')))
    expect(bloco.ipva_total_centavos).toBe(300000)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('difere da soma dos itens 261004'))
    warn.mockRestore()
  })

  it('ORB7328 (DF): nao mexe, 9 itens e o total de sempre', () => {
    const b = parsearDetranDf(DF_ORB7328, new Date('2026-10-23T12:00:00Z'))
    expect(b.ipva_itens).toHaveLength(9)
    expect(b.ipva_total_centavos).toBe(1186875)
  })

  it('so deduplica com a soma acima do total da fonte', () => {
    const dup = [
      { ano: 2026, vencimento: '19/02/2026', valor_centavos: 261004 },
      { ano: 2026, vencimento: '19/02/2026', valor_centavos: 261004 },
    ]
    expect(normalizarIpvaItens(dup, 261004)).toHaveLength(1)
    expect(normalizarIpvaItens(dup, 522008)).toHaveLength(2) // a fonte diz que sao dois
    expect(normalizarIpvaItens(dup, null)).toHaveLength(2) // sem total da fonte, nao mexe
  })

  it('itens sem vencimento nunca sao juntados', () => {
    const itens = [1, 2, 3].map((c) => ({ ano: 2026, vencimento: null, valor_centavos: 49304, cota: `0${c}` }))
    expect(normalizarIpvaItens(itens, 49304)).toHaveLength(3)
  })

  it('exercicios diferentes com o mesmo valor e vencimento continuam separados', () => {
    const itens = [
      { ano: 2025, vencimento: '19/02/2026', valor_centavos: 1000 },
      { ano: 2026, vencimento: '19/02/2026', valor_centavos: 1000 },
    ]
    expect(normalizarIpvaItens(itens, 1000)).toHaveLength(2)
  })
})
