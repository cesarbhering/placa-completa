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

  it('licenciamento: ultimo exercicio 2020 (<= ano atual - 2) => atrasado mesmo sem debito', () => {
    const r = parsearDetranSp(REAL, 2026)
    expect(r.licenciamento.ultimoExercicio).toBe(2020)
    expect(r.licenciamento.atrasado).toBe(true)
    expect(r.licenciamento.valor).toBe(0)
  })

  it('licenciamento: exercicio = ano atual - 1 sem debito vencido NAO e atrasado (calendario por placa)', () => {
    const r = parsearDetranSp({ ultimo_licenciamento: 'exercicio 2026' }, new Date('2027-03-10T12:00:00-03:00'))
    expect(r.licenciamento.atrasado).toBe(false)
    expect(detranParaMultas(r).licenciamento_atrasado_ano).toBeNull()
    expect(detranParaMultas(r).ultimo_licenciamento_ano).toBe(2026)
  })

  it('licenciamento: ano atual - 1 COM debito de licenciamento vencido => atrasado', () => {
    const r = parsearDetranSp({
      ultimo_licenciamento: 'exercicio 2026',
      debitos_licenciamento: [{ data_vencimento: '31/07/2027', valor: 160.2 }],
    }, new Date('2027-09-01T12:00:00-03:00'))
    expect(r.licenciamento.atrasado).toBe(true)
  })

  it('licenciamento: debito de licenciamento ainda no prazo nao e atraso', () => {
    const r = parsearDetranSp({
      ultimo_licenciamento: 'exercicio 2026',
      debitos_licenciamento: [{ data_vencimento: '31/12/2027', valor: 160.2 }],
    }, new Date('2027-09-01T12:00:00-03:00'))
    expect(r.licenciamento.atrasado).toBe(false)
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

// ---------- completarDetran (orquestracao usada no pos-entrega e no backfill) ----------
import { vi, afterEach } from 'vitest'
import { completarDetran } from './infosimples-detran'

function fakeSupabase(snapshot: any) {
  const inserts: any[] = []
  const updates: any[] = []
  const from = (tabela: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: snapshot } }) }) }),
    insert: async (row: any) => { inserts.push({ tabela, row }); return { error: null } },
    update: (row: any) => ({ eq: async () => { updates.push({ tabela, row }); return { error: null } } }),
  })
  return { from, inserts, updates }
}

const RESP_SP = [{ ufJurisdicao: 'SP', renavam: '01136947237' }]

describe('completarDetran', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  const cfgOk = () => vi.stubGlobal('useRuntimeConfig', () => ({
    infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'cGZ4', infosimplesPkcs12Pass: 'p',
  }))

  it('nao chama o Infosimples pra veiculo fora de SP', async () => {
    cfgOk()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const sb = fakeSupabase({ consulta: {} })
    const r = await completarDetran(sb, { id: 'p1', placa: 'ABC1D23' }, { response: [{ ufJurisdicao: 'MG', renavam: '1' }] })
    expect(r.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(sb.inserts).toHaveLength(0)
  })

  it('cache: snapshot que ja tem o bloco do Infosimples nao gera nova chamada', async () => {
    cfgOk()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const sb = fakeSupabase({ multas: { fonte: 'detran_sp' } })
    const r = await completarDetran(sb, { id: 'p1', placa: 'FYA8875' }, { response: RESP_SP })
    expect(r).toMatchObject({ ok: false, pulado: 'ja tem detran_sp' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('SP: grava o custo e sobrescreve o bloco antigo (gov.br) com o do Infosimples', async () => {
    cfgOk()
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, json: async () => ({ code: 200, header: { price: '0.28' }, data: [REAL] }) })))
    const sb = fakeSupabase({ consulta: {}, multas: { status: 'ok' } })
    const r = await completarDetran(sb, { id: 'p1', placa: 'FYA8875' }, { response: RESP_SP })
    expect(r.ok).toBe(true)
    expect(sb.inserts[0].row).toMatchObject({ pedido_id: 'p1', fonte: 'infosimples_detran_sp', preco: 0.28, code: 200 })
    expect(sb.updates[0].row.relatorio_snapshot.multas.fonte).toBe('detran_sp')
  })

  it('erro do Infosimples: grava o custo mesmo assim e nao mexe no snapshot', async () => {
    cfgOk()
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, json: async () => ({ code: 607, code_message: 'renavam invalido', header: { price: '0.28' } }) })))
    const sb = fakeSupabase({ consulta: {} })
    const r = await completarDetran(sb, { id: 'p1', placa: 'FYA8875' }, { response: RESP_SP })
    expect(r).toMatchObject({ ok: false, code: 607 })
    expect(sb.inserts).toHaveLength(1)
    expect(sb.updates).toHaveLength(0)
  })
})

import { moeda } from './infosimples-detran'
describe('moeda', () => {
  it('le os formatos que o Infosimples manda', () => {
    expect(moeda(2970.56)).toBe(2970.56)
    expect(moeda('2970.56')).toBe(2970.56) // multas_total real do FYA8875
    expect(moeda('R$ 2.970,56')).toBe(2970.56)
    expect(moeda('432,10')).toBe(432.1)
    expect(moeda('2.970')).toBe(2970)
    expect(moeda('1.234.567')).toBe(1234567)
    expect(moeda('0.0')).toBe(0)
    expect(moeda('')).toBe(0)
    expect(moeda(null)).toBe(0)
  })
  it('multas_total em string decimal nao explode o total do bloco', () => {
    const p = parsearDetranSp({ ...REAL, multas_total: '2970.56' }, 2026)
    expect(detranParaMultas(p).multas_total_centavos).toBe(297056)
  })
})

import { restricaoConsta } from './infosimples-detran'
describe('restricaoConsta', () => {
  it('ignora negativas (nada/nao consta) e mantem so o que consta', () => {
    expect(restricaoConsta('Nada consta')).toBeNull()
    expect(restricaoConsta('Não Consta Bloqueio Judicial - Renajud')).toBeNull() // FSP4A20 real
    expect(restricaoConsta('NAO CONSTA')).toBeNull()
    expect(restricaoConsta('')).toBeNull()
    expect(restricaoConsta(null)).toBeNull()
    expect(restricaoConsta('NADA CONSTA, Consta Bloqueio Judicial - Renajud')).toBe('Consta Bloqueio Judicial - Renajud') // FYA8875 real
    expect(restricaoConsta('Consta Gravame')).toBe('Consta Gravame')
  })
})
