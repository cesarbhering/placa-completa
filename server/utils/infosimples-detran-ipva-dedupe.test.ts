import { describe, it, expect, vi } from 'vitest'
import { parsearDetranSp, detranParaMultas, parsearDetranDf, parsearIpvaSefazDf, normalizarIpvaItens } from './infosimples-detran'

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

// ORB7328 (DF): trecho de debitos.ipva do bruto real do DETRAN-DF. Cotas 01 a 06
// de 493,04 + cota 89 (cota unica) de 2.958,24 = soma delas.
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

  it('DF: cota unica + parcelas do mesmo ano vira so a cota unica; total sem dobrar', () => {
    const b = parsearDetranDf(DF_ORB7328, new Date('2026-10-23T12:00:00Z'))
    expect(b.ipva_itens.map((x) => [x.ano, x.valor_centavos])).toEqual([[2026, 295824], [2025, 301455], [2024, 293772]])
    expect(b.ipva_total_centavos).toBe(295824 + 301455 + 293772)
  })

  it('SEFAZ-DF: cota 89 tira as outras cotas do ano mesmo com juros diferentes por cota', () => {
    const itens = parsearIpvaSefazDf({ debitos: [
      { ano: '2026', cota: '01', valor_total: '590,50' }, { ano: '2026', cota: '02', valor_total: '583,94' },
      { ano: '2026', cota: '89', valor_total: '3.450,37' }, { ano: '2025', cota: '', valor_total: '4.468,67' },
    ] })
    expect(itens!.map((x) => x.valor_centavos)).toEqual([345037, 446867])
  })

  it('parcelas sem vencimento e sem cota unica continuam todas (nao junta)', () => {
    const itens = [1, 2, 3].map((c) => ({ ano: 2026, vencimento: null, valor_centavos: 49304, cota: `0${c}` }))
    expect(normalizarIpvaItens(itens)).toHaveLength(3)
  })

  it('exercicios diferentes com o mesmo valor e vencimento continuam separados', () => {
    const itens = [
      { ano: 2025, vencimento: '19/02/2026', valor_centavos: 1000 },
      { ano: 2026, vencimento: '19/02/2026', valor_centavos: 1000 },
    ]
    expect(normalizarIpvaItens(itens)).toHaveLength(2)
  })
})
