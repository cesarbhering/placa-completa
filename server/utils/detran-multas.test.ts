import { describe, it, expect } from 'vitest'
import {
  temMultaSP,
  renavamDaResposta,
  ufDaResposta,
  parseMoedaBR,
  normalizarData,
  avaliarHodometro,
  normalizarRestricoes,
  temRestricaoAtiva,
  parseResultadoMultas,
  detalheDaLinha,
  respostaUtilMulta,
} from './detran-multas'

describe('gatilho: so multa em aberto e veiculo de SP', () => {
  const resp = (over: any) => ({ indicadorMultaRenainf: true, ufJurisdicao: 'SP', renavam: '00996754997', ...over })

  it('dispara com indicador no topo e UF SP', () => {
    expect(temMultaSP(resp({}))).toBe(true)
  })
  it('nao dispara sem multa', () => {
    expect(temMultaSP(resp({ indicadorMultaRenainf: false }))).toBe(false)
  })
  it('nao dispara fora de SP', () => {
    expect(temMultaSP(resp({ ufJurisdicao: 'MG' }))).toBe(false)
  })
  it('aceita indicador no caminho aninhado restricoes', () => {
    expect(temMultaSP({ restricoes: { indicadorMultaRenainf: true }, ufJurisdicao: 'SP' })).toBe(true)
  })
  it('aceita resposta achatada num array', () => {
    expect(temMultaSP([resp({})])).toBe(true)
  })
  it('le renavam e uf da resposta (inclusive achatada)', () => {
    expect(renavamDaResposta([resp({})])).toBe('00996754997')
    expect(ufDaResposta(resp({}))).toBe('SP')
    expect(renavamDaResposta({})).toBeNull()
  })
})

describe('parseMoedaBR', () => {
  it('valor com milhar e centavos', () => {
    expect(parseMoedaBR('R$ 1.234,56')).toBe(123456)
    expect(parseMoedaBR('R$ 141,61')).toBe(14161)
    expect(parseMoedaBR('174,08')).toBe(17408)
  })
  it('ausencia de debito vira zero', () => {
    expect(parseMoedaBR('Não há débito pendente')).toBe(0)
    expect(parseMoedaBR('Nada consta')).toBe(0)
    expect(parseMoedaBR('')).toBe(0)
  })
  it('numero cru ja em centavos', () => {
    expect(parseMoedaBR(14161)).toBe(14161)
  })
  it('texto sem numero reconhecivel vira null', () => {
    expect(parseMoedaBR('consulte no guiche')).toBeNull()
  })
})

describe('normalizarData', () => {
  it('aceita BR e ISO', () => {
    expect(normalizarData('29/06/2017')).toBe('2017-06-29')
    expect(normalizarData('2026-09-30')).toBe('2026-09-30')
    expect(normalizarData('sem data')).toBeNull()
  })
})

describe('hodometro', () => {
  it('serie crescente nao e suspeita e sai ordenada', () => {
    const { hodometro, hodometro_suspeito } = avaliarHodometro([
      { data: '16/09/2020', km: 125599 },
      { data: '29/06/2017', km: 76999 },
      { data: '14/12/2019', km: 114671 },
    ])
    expect(hodometro_suspeito).toBe(false)
    expect(hodometro.map((h) => h.km)).toEqual([76999, 114671, 125599])
  })

  it('km menor depois de uma leitura anterior e suspeito', () => {
    const { hodometro_suspeito } = avaliarHodometro([
      { data: '2017-06-29', km: 76999 },
      { data: '2020-09-16', km: 60000 },
    ])
    expect(hodometro_suspeito).toBe(true)
  })

  it('a suspeita respeita a ordem cronologica, nao a de entrada', () => {
    // 60000 chega antes na lista mas e uma data POSTERIOR: km caiu no tempo.
    const { hodometro_suspeito } = avaliarHodometro([
      { data: '2020-09-16', km: 60000 },
      { data: '2017-06-29', km: 76999 },
    ])
    expect(hodometro_suspeito).toBe(true)
  })

  it('descarta leituras sem data ou km valido', () => {
    const { hodometro } = avaliarHodometro([
      { data: '', km: 1000 },
      { data: '2020-01-01', km: NaN },
      { data: '2020-02-01', km: 5000 },
      null,
    ])
    expect(hodometro).toEqual([{ data: '2020-02-01', km: 5000 }])
  })
})

describe('restricoes', () => {
  const bruto = {
    guincho: 'Nada consta',
    judicial: 'Consta Bloqueio Judicial - Renajud',
    financeira: 'Nada consta',
    tributaria: 'Nada consta',
    administrativa: 'Nada consta',
    bloqueio_furto_roubo: 'Nada consta',
  }
  it('normaliza pras 6 chaves', () => {
    const r = normalizarRestricoes(bruto)
    expect(r?.judicial).toMatch(/Renajud/)
    expect(r?.guincho).toBe('Nada consta')
  })
  it('detecta restricao ativa alem de nada consta', () => {
    expect(temRestricaoAtiva(normalizarRestricoes(bruto))).toBe(true)
    expect(temRestricaoAtiva({ judicial: 'Nada consta', guincho: 'Nada consta' })).toBe(false)
    expect(temRestricaoAtiva(null)).toBe(false)
  })
  it('objeto vazio/sem chave conhecida vira null', () => {
    expect(normalizarRestricoes({})).toBeNull()
    expect(normalizarRestricoes(null)).toBeNull()
  })
})

describe('parseResultadoMultas (captura -> detalhe)', () => {
  it('caso FHB6G05: multa, licenciamento com vencimento, IPVA zerado, restricao judicial', () => {
    const d = parseResultadoMultas({
      uf: 'SP',
      multas_pix_centavos: 14161,
      ipva: 'Não há débito pendente',
      licenciamento_centavos: 17408,
      licenciamento_venc: '30/09/2026',
      hodometro: [
        { data: '29/06/2017', km: 76999 },
        { data: '16/09/2020', km: 125599 },
      ],
      restricoes: { judicial: 'Consta Bloqueio Judicial - Renajud' },
    })
    expect(d.status).toBe('ok')
    expect(d.multas_total_centavos).toBe(14161)
    expect(d.ipva_total_centavos).toBe(0)
    expect(d.licenciamento_centavos).toBe(17408)
    expect(d.licenciamento_venc).toBe('2026-09-30')
    expect(d.hodometro_suspeito).toBe(false)
    expect(d.restricoes?.judicial).toMatch(/Renajud/)
  })

  it('nada em aberto e sem restricao vira sem_debito', () => {
    const d = parseResultadoMultas({
      multas: 'Não há',
      ipva: 'Não há débito pendente',
      licenciamento: 'Nada consta',
      restricoes: { judicial: 'Nada consta' },
    })
    expect(d.status).toBe('sem_debito')
  })

  it('extrai valores em centavos a partir de texto R$', () => {
    const d = parseResultadoMultas({ multas: 'R$ 141,61', licenciamento: 'R$ 174,08' })
    expect(d.multas_total_centavos).toBe(14161)
    expect(d.licenciamento_centavos).toBe(17408)
  })
})

describe('detalheDaLinha (cache -> detalhe) e respostaUtil', () => {
  const row = {
    status: 'ok',
    uf: 'SP',
    multas_total_centavos: 14161,
    ipva_total_centavos: 0,
    licenciamento_centavos: 17408,
    licenciamento_venc: '2026-09-30',
    hodometro: [
      { data: '2017-06-29', km: 76999 },
      { data: '2020-09-16', km: 125599 },
    ],
    hodometro_suspeito: false,
    restricoes: { judicial: 'Consta Bloqueio Judicial - Renajud' },
  }
  it('reconstroi o detalhe a partir da linha', () => {
    const d = detalheDaLinha(row)
    expect(d?.multas_total_centavos).toBe(14161)
    expect(d?.restricoes?.judicial).toMatch(/Renajud/)
    expect(d?.hodometro.length).toBe(2)
  })
  it('respostaUtilMulta so aceita ok e sem_debito', () => {
    expect(respostaUtilMulta(detalheDaLinha(row))).toBe(true)
    expect(respostaUtilMulta(detalheDaLinha({ ...row, status: 'captcha' }))).toBe(false)
    expect(respostaUtilMulta(null)).toBe(false)
  })
})
