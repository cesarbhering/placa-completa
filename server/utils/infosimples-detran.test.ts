import { describe, it, expect } from 'vitest'
import { parsearDetranSp, ehVeiculoSp, detranParaMultas } from './infosimples-detran'

// Fixture baseada na resposta REAL do Infosimples (FYA8875, code 200).
const REAL = {
  debitos_multas: [
    { auto_infracao: 'A01146781A', data_infracao: '04/07/2022', hora_infracao: '21:04:00', data_vencimento: '22/11/2022', valor: 432.1, descricao: 'CONDUZIR O VEICULO QUE NAO ESTEJA REGISTRADO', local: 'AV ORDEM E PROGRESSO 1085', municipio: 'SAO PAULO', orgao_autuador: { codigo: '126100', nome: 'DETRAN' } },
  ],
  multas_total: 2970.56,
  multas_mensagem: 'Constam multas',
  ipva: 0.0,
  ipva_mensagem: 'Sem debitos de IPVA',
  debitos_ipva: [],
  licenciamento_valor: 0,
  licenciamento_mensagem: 'Sem debito',
  debitos_licenciamento: [],
  status_licenciamento: 'IRREGULAR',
  ultimo_licenciamento: 'exercicio 2020',
  vistorias: [
    { data: '27/12/2021', km: '79050 km' },
    { data: '30/08/2019', km: '36029 km' },
    { data: '30/08/2019', km: '36029 km' }, // duplicata
  ],
  restricao_financeira: 'Consta Intenção de Gravame',
  restricao_judiciaria: 'NADA CONSTA, Consta Bloqueio Judicial - Renajud',
  restricao_administrativa: 'Nada consta',
  restricao_tributaria: '',
  bloqueio_furto: 'Nada consta',
}

describe('ehVeiculoSp', () => {
  it('SP (qualquer caixa) sim; outras UFs nao', () => {
    expect(ehVeiculoSp('SP')).toBe(true)
    expect(ehVeiculoSp('sp')).toBe(true)
    expect(ehVeiculoSp(' Sp ')).toBe(true)
    expect(ehVeiculoSp('RJ')).toBe(false)
    expect(ehVeiculoSp(null)).toBe(false)
    expect(ehVeiculoSp('')).toBe(false)
  })
})

describe('parsearDetranSp', () => {
  it('multas: item + total', () => {
    const r = parsearDetranSp(REAL, 2026)
    expect(r.multas.itens).toHaveLength(1)
    expect(r.multas.itens[0].descricao).toMatch(/NAO ESTEJA REGISTRADO/)
    expect(r.multas.itens[0].valor).toBe(432.1)
    expect(r.multas.itens[0].orgao).toBe('DETRAN')
    expect(r.multas.total).toBe(2970.56)
  })

  it('hodometro: dedupe + ordem crescente por data', () => {
    const r = parsearDetranSp(REAL, 2026)
    expect(r.hodometro.leituras).toEqual([
      { data: '30/08/2019', km: 36029 },
      { data: '27/12/2021', km: 79050 },
    ])
    expect(r.hodometro.suspeitaAdulteracao).toBe(false)
  })

  it('hodometro: leitura mais nova com km MENOR => suspeita de adulteracao', () => {
    const r = parsearDetranSp({
      vistorias: [
        { data: '01/01/2020', km: '80000 km' },
        { data: '01/06/2022', km: '55000 km' }, // andou pra tras
      ],
    }, 2026)
    expect(r.hodometro.suspeitaAdulteracao).toBe(true)
  })

  it('licenciamento: ultimo exercicio 2020 < ano atual => atrasado mesmo sem debito', () => {
    const r = parsearDetranSp(REAL, 2026)
    expect(r.licenciamento.ultimoExercicio).toBe(2020)
    expect(r.licenciamento.atrasado).toBe(true)
    expect(r.licenciamento.valor).toBe(0)
  })

  it('licenciamento: exercicio no ano atual => nao atrasado', () => {
    const r = parsearDetranSp({ ultimo_licenciamento: 'exercicio 2026' }, 2026)
    expect(r.licenciamento.atrasado).toBe(false)
  })

  it('ipva: valor 0 sem itens => sem debito', () => {
    const r = parsearDetranSp(REAL, 2026)
    expect(r.ipva.valor).toBe(0)
    expect(r.ipva.temDebito).toBe(false)
  })

  it('restricoes: mostra o que consta, esconde "Nada consta"/vazio', () => {
    const r = parsearDetranSp(REAL, 2026)
    expect(r.restricoes.financeira).toBe('Consta Intenção de Gravame')
    expect(r.restricoes.judiciaria).toMatch(/Renajud/)
    expect(r.restricoes.administrativa).toBeNull()
    expect(r.restricoes.tributaria).toBeNull()
    expect(r.restricoes.furto).toBeNull()
  })

  it('temAlgo true quando ha multa/hodometro/restricao', () => {
    expect(parsearDetranSp(REAL, 2026).temAlgo).toBe(true)
    expect(parsearDetranSp({}, 2026).temAlgo).toBe(false)
  })
})

describe('detranParaMultas (mapeia pro shape da UI existente)', () => {
  it('centavos, hodometro em ISO, e os extras', () => {
    const m = detranParaMultas(parsearDetranSp(REAL, 2026))
    expect(m.status).toBe('ok')
    expect(m.fonte).toBe('detran_sp')
    expect(m.multas_total_centavos).toBe(297056)
    expect(m.ipva_total_centavos).toBe(0)
    // hodometro convertido pra ISO (a UI formata a partir de ISO), ordenado.
    expect(m.hodometro).toEqual([
      { data: '2019-08-30', km: 36029 },
      { data: '2021-12-27', km: 79050 },
    ])
    expect(m.hodometro_suspeito).toBe(false)
    expect(m.multas_itens).toHaveLength(1)
    expect(m.licenciamento_atrasado_ano).toBe(2020)
    // so restricoes que constam (financeira + judiciaria), sem "Nada consta".
    expect(m.restricoes_detran.map((r) => r.tipo).sort()).toEqual(['financeira', 'judiciaria'])
  })
})
