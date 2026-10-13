import { describe, it, expect, vi, afterEach } from 'vitest'
import CE from './__fixtures__/infosimples-detran-ce.json'
import PA from './__fixtures__/infosimples-detran-pa-veiculo.json'
import AM from './__fixtures__/infosimples-detran-am.json'
import { parsearDetranCe, parsearDetranPa, parsearDetranAm, multaGenerica, blocoDetranDaUf, completarDetran, DETRAN_UFS } from './infosimples-detran'

// Fixtures = respostas REAIS de CE (PMI5902, 30/set), PA /veiculo (OTX9I55,
// 13/out) e AM (JUT9G09, 30/set) com Pix, boleto, site_receipt, renavam, chassi,
// placa e nome trocados por FALSOS.

const PROIBIDO = ['storage.invalid', 'PIX-FALSO', 'codigo_pix', 'boleto', 'site_receipt', 'FULANO', 'renavam', 'proprietario']

describe('parsearDetranCe', () => {
  const b = parsearDetranCe(CE)
  it('nunca grava Pix, boleto nem site_receipt', () => {
    const out = JSON.stringify(b)
    for (const p of PROIBIDO) expect(out).not.toContain(p)
  })
  it('4 multas, total = soma de normalizado_valor (com juros)', () => {
    expect(b.fonte).toBe('detran_ce')
    expect(b.multas_itens).toHaveLength(4)
    expect(b.multas_itens[0]).toMatchObject({
      descricao: 'ESTACIONAR EM LOCAL/HORARIO PROIBIDO ESPECIFICAMEN',
      dataInfracao: '07/05/2021', dataVencimento: '03/01/2022', valor: 204.51,
    })
    expect(b.multas_total_centavos).toBe(20451 + 235612 + 22895 + 23447)
    expect(b.multas_em_recurso).toEqual([])
  })
})

describe('parsearDetranPa (/detran/pa/veiculo)', () => {
  const b: any = parsearDetranPa(PA)
  it('caso real OTX9I55: 11 multas a pagar, total = soma (R$ 10.834,96)', () => {
    expect(b.fonte).toBe('detran_pa')
    expect(b.multas_itens).toHaveLength(11)
    expect(b.multas_total_centavos).toBe(1083496)
    expect(b.multas_itens[0]).toEqual({
      auto: 'T601547659', orgao: 'DPRF', municipio: 'ITAITUBA',
      descricao: 'USAR QQ VEIC.PARA, DELIB.INTERROMPER CIRC. VIA SEM AUT.ORGAO',
      local: 'BR-230 KM-1097 UF-PA', dataInfracao: '01/11/2022', horaInfracao: '02:40',
      dataVencimento: null, valor: 8142.61,
    })
  })
  it('IPVA, licenciamento atrasado, situacao (estelionato) e restricao administrativa', () => {
    expect(b.ipva_total_centavos).toBe(581910)
    expect(b.ipva_itens).toEqual([{ ano: null, vencimento: null, valor_centavos: 581910 }])
    expect(b.ultimo_licenciamento_ano).toBe(2022)
    expect(b.licenciamento_atrasado_ano).toBe(2022)
    expect(b.restricoes_detran).toEqual([
      { tipo: 'situacao', texto: 'REGISTRO DE ESTELIONATO NA BASE DETRAN / ADMINISTRATIVA' },
      { tipo: 'administrativa', texto: 'REST. ADMINISTRATIVA' },
    ])
    expect(b.hodometro).toEqual([])
    expect(b.alerta_roubo_furto).toBeNull()
  })
  it('nunca grava nome, renavam, chassi, motor, site_receipt nem pontos/gravidade', () => {
    const out = JSON.stringify(b)
    for (const p of [...PROIBIDO, 'FULANO', '9BGCHASSIFALSO', 'ABC1234', 'GRAVISSIMA', 'pontos']) expect(out).not.toContain(p)
  })
  it('em dia, sem situacao, sem multa: nada consta; pagas nao contam', () => {
    const x: any = parsearDetranPa({
      situacao: 'NORMAL', situacao_licenciamento: 'EM DIA', ano_licenciamento: '2026', restricoes: ['NADA CONSTA'], valor_ipva: 'R$ 0,00', seguro: '** PAGO **',
      infracoes: [{ auto_infracao: 'P1', data_hora: '01/01/2026 10:00', normalizado_valor: 100, status: 'PAGO' }],
    })
    expect(x).toMatchObject({ multas_total_centavos: 0, multas_itens: [], ipva_total_centavos: 0, ipva_itens: [], ultimo_licenciamento_ano: 2026, licenciamento_atrasado_ano: null, restricoes_detran: [] })
  })
  it('furto/roubo na situacao vira alerta; seguro em aberto vira outro debito', () => {
    const x: any = parsearDetranPa({ situacao: 'ROUBO/FURTO', restricoes: ['ALIENACAO FIDUCIARIA', 'BLOQUEIO JUDICIAL'], seguro: 'R$ 101,63', infracoes: [] })
    expect(x.alerta_roubo_furto).toBe('Restrição informada pelo DETRAN-PA: roubo/furto')
    expect(x.restricoes_detran).toEqual([
      { tipo: 'situacao', texto: 'ROUBO/FURTO' },
      { tipo: 'financeira', texto: 'ALIENACAO FIDUCIARIA' },
      { tipo: 'judiciaria', texto: 'BLOQUEIO JUDICIAL' },
      { tipo: 'outros_debitos', texto: 'Seguro obrigatório em aberto: R$ 101,63' },
    ])
  })
  it('formato desconhecido (ex.: resposta do /infracoes antigo) -> null', () => {
    expect(parsearDetranPa({ infracoes_vencidas: [] })).toBeNull()
  })
})

describe('parsearDetranAm', () => {
  it('sem debito: nada consta, sem dados do veiculo nem boleto', () => {
    const b = parsearDetranAm(AM)
    expect(b).toMatchObject({ fonte: 'detran_am', multas_total_centavos: 0, ipva_total_centavos: 0, multas_itens: [], restricoes_detran: [] })
    const out = JSON.stringify(b)
    for (const p of [...PROIBIDO, 'TROLLER', 'AMARELA']) expect(out).not.toContain(p)
  })
  it('total de multas pelos debitos (DETRAN-AM + outras UFs + locais), IPVA, seguro e taxas', () => {
    const d = JSON.parse(JSON.stringify(AM))
    Object.assign(d.debitos, { normalizado_multas_detran_am: 195.23, normalizado_multas_outras_ufs: 130.16, normalizado_multas_locais: 0, normalizado_ipva: 1500, normalizado_seguro_obrigatorio: 20, normalizado_taxas_detran_am: 150.5 })
    d.multas = [{ ait: 'AM1', descricao: 'X', valor: 'R$ 195,23' }]
    const b = parsearDetranAm(d)
    expect(b.multas_total_centavos).toBe(32539)
    expect(b.multas_itens).toHaveLength(1)
    expect(b.ipva_total_centavos).toBe(150000)
    expect(b.restricoes_detran).toEqual([
      { tipo: 'outros_debitos', texto: 'Seguro obrigatório em aberto: R$ 20,00' },
      { tipo: 'outros_debitos', texto: 'Taxas do DETRAN-AM em aberto: R$ 150,50' },
    ])
  })
})

describe('multaGenerica', () => {
  it('"--" e vazio viram null; nunca copia campo fora da whitelist', () => {
    const m = multaGenerica({ ait: 'A', ait_originaria: '--', local: '--', codigo_pix: 'PIX', boleto_pdf_url: 'u' })
    expect(m.local).toBeNull()
    expect(JSON.stringify(m)).not.toContain('PIX')
  })
})

describe('mapa e chamada CE/PA/AM (sem credencial)', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('mapa', () => {
    expect(DETRAN_UFS.CE).toMatchObject({ path: 'detran/ce/multas', cert: 'nenhum', gate: 'renainf', fonteCusto: 'infosimples_detran_ce' })
    expect(DETRAN_UFS.PA).toMatchObject({ path: 'detran/pa/veiculo', cert: 'nenhum', gate: 'renainf', fonteCusto: 'infosimples_detran_pa', timeoutS: 600 })
    expect(DETRAN_UFS.AM).toMatchObject({ path: 'detran/am/multas', cert: 'nenhum', gate: 'renainf', fonteCusto: 'infosimples_detran_am' })
    expect(blocoDetranDaUf('CE', CE).fonte).toBe('detran_ce')
    expect(blocoDetranDaUf('PA', PA).fonte).toBe('detran_pa')
    expect(blocoDetranDaUf('AM', AM).fonte).toBe('detran_am')
  })
  it('manda so token + placa + renavam (sem certificado, sem login) e grava custo', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't' }))
    const chamadas: { url: string; body: URLSearchParams }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      chamadas.push({ url, body: init.body })
      return { status: 200, json: async () => ({ code: 200, header: { price: '0.20' }, data: [CE] }) }
    }))
    const inserts: any[] = []; const updates: any[] = []
    const sb = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: {} } } }) }) }),
        insert: async (row: any) => { inserts.push(row); return { error: null } },
        update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
      }),
    }
    const r = await completarDetran(sb, { id: 'p1', placa: 'PMI5902' }, { response: [{ ufJurisdicao: 'CE', renavam: '1113496034', indicadorMultaRenainf: true }] })
    expect(r.ok).toBe(true)
    const body = chamadas[0].body
    expect(chamadas[0].url).toMatch(/\/detran\/ce\/multas$/)
    expect(body.get('placa')).toBe('PMI5902')
    expect(body.get('renavam')).toBe('01113496034')
    for (const k of ['pkcs12_cert', 'pkcs12_pass', 'login_cpf', 'login_senha']) expect(body.has(k)).toBe(false)
    expect(inserts[0]).toMatchObject({ fonte: 'infosimples_detran_ce', preco: 0.2, code: 200 })
    expect(updates[0].relatorio_snapshot.multas.fonte).toBe('detran_ce')
  })
  it('PA: /detran/pa/veiculo, timeout 600, so placa + renavam; grava multas, IPVA e restricoes', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't' }))
    const chamadas: { url: string; body: URLSearchParams }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      chamadas.push({ url, body: init.body })
      return { status: 200, json: async () => ({ code: 200, header: { price: '0.24' }, data: [PA] }) }
    }))
    const inserts: any[] = []; const updates: any[] = []
    const sb = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: {} } } }) }) }),
        insert: async (row: any) => { inserts.push(row); return { error: null } },
        update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
      }),
    }
    const r = await completarDetran(sb, { id: 'p1', placa: 'ABC1D23' }, { response: [{ ufJurisdicao: 'PA', renavam: '1014354940', indicadorMultaRenainf: true }] })
    expect(r.ok).toBe(true)
    expect(chamadas[0].url).toMatch(/\/detran\/pa\/veiculo$/)
    const body = chamadas[0].body
    expect(body.get('timeout')).toBe('600')
    expect(body.get('ignore_site_receipt')).toBe('0')
    expect(body.get('renavam')).toBe('01014354940')
    for (const k of ['pkcs12_cert', 'pkcs12_pass', 'login_cpf', 'login_senha', 'chassi']) expect(body.has(k)).toBe(false)
    expect(inserts[0]).toMatchObject({ fonte: 'infosimples_detran_pa', preco: 0.24, code: 200 })
    const m = updates[0].relatorio_snapshot.multas
    expect(m).toMatchObject({ fonte: 'detran_pa', multas_total_centavos: 1083496, ipva_total_centavos: 581910, licenciamento_atrasado_ano: 2022 })
    expect(m.restricoes_detran).toHaveLength(2)
    expect(JSON.stringify(m)).not.toContain('FULANO')
  })
})
