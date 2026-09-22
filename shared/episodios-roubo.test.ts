import { describe, it, expect } from 'vitest'
import { agruparEpisodios, tudoEncerrado, plural } from './episodios-roubo'

const roubo = (data: string, tipo = 'ROUBO') => ({
  dataOcorrencia: data, categoriaOcorrencia: 'DECLARACAO', tipoOcorrenciaDeclaracao: tipo,
  nomeMarcaModeloNoRegistroOcorrencia: 'RENAULT/LOGAN', nomeCorNoRegistroOcorrencia: 'PRATA',
  ufJurisdicaoNoRegistroOcorrencia: 'MG',
})
const recuperacao = (data: string) => ({ dataOcorrencia: data, categoriaOcorrencia: 'RECUPERACAO', ufJurisdicaoNoRegistroOcorrencia: 'MG' })
const devolucao = (data: string) => ({ dataOcorrencia: data, categoriaOcorrencia: 'DEVOLUCAO', ufJurisdicaoNoRegistroOcorrencia: 'MG' })

describe('episodios de roubo e furto', () => {
  it('junta roubo, recuperacao e devolucao num episodio encerrado', () => {
    const eps = agruparEpisodios([roubo('2020-02-11'), recuperacao('2020-02-12'), devolucao('2020-02-17')])
    expect(eps).toHaveLength(1)
    expect(eps[0]!.encerrado).toBe(true)
    expect(eps[0]!.tipoInicial).toBe('ROUBO')
    expect(eps[0]!.registros.map(r => r.etapa)).toEqual(['ROUBO', 'RECUPERACAO', 'DEVOLUCAO'])
    expect(eps[0]!.duracaoDias).toBe(6)
    expect(tudoEncerrado(eps)).toBe(true)
  })

  it('roubo sozinho fica em aberto', () => {
    const eps = agruparEpisodios([roubo('2020-02-11', 'FURTO')])
    expect(eps).toHaveLength(1)
    expect(eps[0]!.encerrado).toBe(false)
    expect(eps[0]!.tipoInicial).toBe('FURTO')
    expect(tudoEncerrado(eps)).toBe(false)
  })

  it('segundo roubo abre episodio novo em vez de entrar no primeiro', () => {
    const eps = agruparEpisodios([
      roubo('2018-03-01'), devolucao('2018-03-10'),
      roubo('2021-07-02'), recuperacao('2021-07-04'),
    ])
    expect(eps).toHaveLength(2)
    expect(eps[0]!.encerrado).toBe(true)
    expect(eps[1]!.encerrado).toBe(false)
    expect(eps[1]!.registros.map(r => r.etapa)).toEqual(['ROUBO', 'RECUPERACAO'])
    expect(tudoEncerrado(eps)).toBe(false)
  })

  it('recuperacao sem roubo antes vira episodio proprio, rotulado pelo que e', () => {
    const eps = agruparEpisodios([recuperacao('2019-05-02'), roubo('2020-02-11')])
    expect(eps).toHaveLength(2)
    expect(eps[0]!.etapaInicial).toBe('RECUPERACAO')
    expect(eps[0]!.tipoInicial).toBeNull()
    expect(eps[1]!.etapaInicial).toBe('ROUBO')
  })

  it('ordem embaralhada na origem nao muda a historia', () => {
    const eps = agruparEpisodios([devolucao('2020-02-17'), roubo('2020-02-11'), recuperacao('2020-02-12')])
    expect(eps).toHaveLength(1)
    expect(eps[0]!.registros.map(r => r.data)).toEqual(['2020-02-11', '2020-02-12', '2020-02-17'])
    expect(eps[0]!.duracaoDias).toBe(6)
  })

  it('lista vazia ou ausente nao inventa episodio', () => {
    expect(agruparEpisodios([])).toEqual([])
    expect(agruparEpisodios(null)).toEqual([])
    expect(tudoEncerrado([])).toBe(false)
  })

  it('registro sem data continua no relatorio, no fim da fila', () => {
    const eps = agruparEpisodios([roubo('2020-02-11'), { dataOcorrencia: '', categoriaOcorrencia: 'DEVOLUCAO' }])
    expect(eps).toHaveLength(1)
    expect(eps[0]!.registros).toHaveLength(2)
    expect(eps[0]!.encerrado).toBe(true)
    expect(eps[0]!.duracaoDias).toBeNull()
  })

  it('dia no singular', () => {
    expect(plural(1)).toBe('1 dia')
    expect(plural(6)).toBe('6 dias')
  })
})
