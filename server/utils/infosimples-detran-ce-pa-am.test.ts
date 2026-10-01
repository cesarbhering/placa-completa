import { describe, it, expect, vi, afterEach } from 'vitest'
import CE from './__fixtures__/infosimples-detran-ce.json'
import PA from './__fixtures__/infosimples-detran-pa.json'
import AM from './__fixtures__/infosimples-detran-am.json'
import { parsearDetranCe, parsearDetranPa, parsearDetranAm, multaGenerica, blocoDetranDaUf, completarDetran, DETRAN_UFS } from './infosimples-detran'

// Fixtures = respostas REAIS (30/set) de CE (PMI5902), PA (QET3C05) e AM
// (JUT9G09) com Pix, boleto, site_receipt e renavam trocados por FALSOS.

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
      auto: 'SG00069363', descricao: 'ESTACIONAR EM LOCAL/HORARIO PROIBIDO ESPECIFICAMEN',
      dataInfracao: '07/05/2021', dataVencimento: '03/01/2022', valor: 204.51,
    })
    expect(b.multas_total_centavos).toBe(20451 + 235612 + 22895 + 23447)
    expect(b.multas_em_recurso).toEqual([])
  })
})

describe('parsearDetranPa', () => {
  it('vazio = nada consta', () => {
    const b = parsearDetranPa(PA)
    expect(b).toMatchObject({ fonte: 'detran_pa', multas_total_centavos: 0, multas_itens: [], multas_em_recurso: [] })
  })
  it('defensivo: vencidas + a vencer somam, efeito suspensivo vai pra recurso', () => {
    const b = parsearDetranPa({
      infracoes_vencidas: [{ auto_infracao: 'PA1', descricao: 'AVANCAR SINAL', data_infracao: '01/02/2026 10:30', valor: 'R$ 293,47', orgao_autuador: 'DETRAN-PA' }],
      infracoes_a_vencer: [{ numero_auto: 'PA2', infracao: 'VELOCIDADE', data: '05/09/2026', vencimento: '10/11/2026', normalizado_valor: 130.16 }],
      infracoes_efeito_suspensivo: [{ ait: 'PA3', valor: 'R$ 88,38' }],
    })
    expect(b.multas_itens.map((x) => x.auto)).toEqual(['PA1', 'PA2'])
    expect(b.multas_itens[0]).toMatchObject({ dataInfracao: '01/02/2026', horaInfracao: '10:30', valor: 293.47, orgao: 'DETRAN-PA' })
    expect(b.multas_itens[1]).toMatchObject({ descricao: 'VELOCIDADE', dataVencimento: '10/11/2026', valor: 130.16 })
    expect(b.multas_total_centavos).toBe(29347 + 13016)
    expect(b.multas_em_recurso).toHaveLength(1)
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
    expect(DETRAN_UFS.PA).toMatchObject({ path: 'detran/pa/infracoes', cert: 'nenhum', gate: 'renainf', fonteCusto: 'infosimples_detran_pa' })
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
})
