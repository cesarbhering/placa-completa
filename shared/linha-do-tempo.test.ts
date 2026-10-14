import { describe, it, expect } from 'vitest'
import { montarLinhaDoTempo, paraIso } from './linha-do-tempo'

describe('linha do tempo do veiculo', () => {
  it('junta tudo em ordem cronologica, sem data no fim', () => {
    const l = montarLinhaDoTempo({
      anoFabricacao: 2012, anoModelo: 2013,
      leiloes: [{ data: '2019-05-20', titulo: 'Copart', detalhe: 'Lote 12', confirmado: true }, { data: null, titulo: 'Detran SP', notificacao: true }],
      roubo: [{ etapa: 'ROUBO', data: '2016-03-01', tipo: 'ROUBO' }, { etapa: 'RECUPERACAO', data: '04/03/2016' }, { etapa: 'DEVOLUCAO', data: '2016-03-10' }],
      recallsAtendidos: [{ data: '2018-07-02', titulo: 'Pedal de embreagem', km: 41250 }],
      hodometro: [{ data: '2017-01-10', km: 30000 }, { data: '2021-01-12', km: 25000 }],
      licenciamento: { ano: 2025, emissao: '2025-04-20' },
      multas: [{ data: '12/02/2023', valorCentavos: 13016 }, { data: '2023-08-01', valorCentavos: 19353 }, { data: '2024-01-03', valorCentavos: 8838 }],
    })
    expect(l.map((x) => x.tipo)).toEqual(['fabricacao', 'roubo', 'recuperacao', 'devolucao', 'km', 'recall', 'leilao', 'km', 'multas', 'multas', 'licenciamento', 'notificacao'])
    expect(l[0].titulo).toBe('Fabricado em 2012 (ano-modelo 2013)')
    expect(l.find((x) => x.tipo === 'recall')!.detalhe).toBe('Pedal de embreagem · com 41.250 km')
    const caiu = l.filter((x) => x.tipo === 'km')[1]
    expect(caiu.tom).toBe('alerta')
    expect(caiu.detalhe).toContain('menor que a leitura anterior')
    expect(l.find((x) => x.titulo === '2 multas em 2023')!.detalhe).toBe('total R$ 323,69')
    expect(l.at(-1)!.quando).toBe('sem data')
    expect(JSON.stringify(l)).not.toContain('—')
  })
  it('so com fabricacao (carro limpo)', () => {
    expect(montarLinhaDoTempo({ anoFabricacao: 2020, anoModelo: 2020 }).map((x) => x.titulo)).toEqual(['Fabricado em 2020'])
  })
  it('paraIso', () => {
    expect(paraIso('2019-05-20T00:00:00Z')).toBe('2019-05-20')
    expect(paraIso('04/03/2016')).toBe('2016-03-04')
    expect(paraIso('2016')).toBe('2016')
    expect(paraIso('ontem')).toBeNull()
  })

  it('leitura de km da visita de recall nao duplica o evento do recall', () => {
    const t = montarLinhaDoTempo({
      recallsAtendidos: [{ data: '2021-05-10', titulo: 'Airbag', km: 30000 }],
      hodometro: [{ data: '2020-01-01', km: 10000 }, { data: '2021-05-10', km: 30000 }, { data: '2022-02-01', km: 41000 }],
    })
    expect(t.map((x) => x.tipo)).toEqual(['km', 'recall', 'km'])
    expect(t[2].detalhe).toBe('rodou 11.000 km desde a leitura anterior')
  })
})
