import { describe, it, expect, vi, afterEach } from 'vitest'
import ES from './__fixtures__/infosimples-detran-es.json'
import { parsearDetranEs, blocoDetranDaUf, completarDetran, DETRAN_UFS } from './infosimples-detran'

// Fixture = resposta REAL do /detran/es/veiculo (RVN0B00, 30/set, 46s, sem
// debitos) com proprietario, proprietario_anterior, data_aquisicao, renavam e
// site_receipt trocados por FALSOS.

const HOJE = new Date(2026, 8, 30)
const PROIBIDO = ['FULANO', 'CICRANO', '01/01/1999', 'storage.invalid', 'proprietario', 'aquisicao', 'site_receipt', 'renavam', '36254580']

describe('parsearDetranEs', () => {
  it('sem debitos: nada consta, sem restricao, sem log e sem PII', () => {
    const log = vi.fn()
    const b = parsearDetranEs(ES, HOJE, log)
    expect(b).toMatchObject({
      fonte: 'detran_es', multas_total_centavos: 0, ipva_total_centavos: 0, licenciamento_centavos: 0,
      multas_itens: [], multas_em_recurso: [], restricoes_detran: [], ultimo_licenciamento_ano: 2026, licenciamento_atrasado_ano: null,
    })
    expect(log).not.toHaveBeenCalled()
    const out = JSON.stringify(b)
    for (const p of PROIBIDO) expect(out).not.toContain(p)
  })
  it('defensivo: multas, debitos por classe, recursos e restricoes; log sem PII', () => {
    const log = vi.fn()
    const b = parsearDetranEs({
      ...ES,
      multas: [{ auto_infracao: 'ES1', descricao: 'AVANCAR SINAL', data_infracao: '01/02/2026', valor: 'R$ 293,47' }],
      infracoes: [{ numero_auto: 'ES2' }],
      debitos: [
        { descricao: 'IPVA 2026', vencimento: '10/04/2026', valor: 'R$ 1.500,00' },
        { descricao: 'LICENCIAMENTO 2026', vencimento: '10/04/2026', valor: 'R$ 180,79' },
        { descricao: 'TAXA DE SERVICO', valor: 'R$ 20,00' },
      ],
      recursos: [{ ait: 'ES3', valor: 'R$ 130,16' }],
      gravame: 'ALIENACAO FIDUCIARIA',
      impedimentos: 'RENAJUD - RESTRICAO DE TRANSFERENCIA',
      averbacao_judicial: 'Sim',
      indicativo_clonagem: 'Sim',
      ano_ultimo_licenciamento: '2025',
    }, HOJE, log)
    expect(b.multas_itens.map((x) => x.auto)).toEqual(['ES1'])
    expect(b.multas_total_centavos).toBe(29347)
    expect(b.ipva_total_centavos).toBe(150000)
    expect(b.ipva_itens).toEqual([{ ano: 2026, vencimento: '10/04/2026', valor_centavos: 150000 }])
    expect(b.licenciamento_centavos).toBe(18079)
    expect(b.licenciamento_atrasado_ano).toBe(2025)
    expect(b.multas_em_recurso).toHaveLength(1)
    expect(b.autuacoes_em_andamento).toBe(1)
    expect(b.restricoes_detran.map((r) => r.tipo)).toEqual(['outros_debitos', 'financeira', 'administrativa', 'judiciaria', 'clonagem'])
    expect(log).toHaveBeenCalledTimes(1)
    for (const p of PROIBIDO) expect(log.mock.calls[0][0]).not.toContain(p)
    for (const p of PROIBIDO) expect(JSON.stringify(b)).not.toContain(p)
  })
  it('so infracoes[] (sem multas[]): viram itens, sem contar em dobro', () => {
    const b = parsearDetranEs({ ...ES, infracoes: [{ ait: 'X', valor: 'R$ 100,00' }] }, HOJE, () => {})
    expect(b.multas_total_centavos).toBe(10000)
    expect(b.autuacoes_em_andamento).toBe(0)
  })
})

describe('completarDetran ES (e-CNPJ)', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('mapa', () => {
    expect(DETRAN_UFS.ES).toMatchObject({ path: 'detran/es/veiculo', cert: 'ecnpj', gate: 'renainf', fonte: 'detran_es', fonteCusto: 'infosimples_detran_es' })
    expect(blocoDetranDaUf('ES', ES).fonte).toBe('detran_es')
  })
  it('placa + renavam + e-CNPJ, grava custo e snapshot sem PII', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p' }))
    const chamadas: { url: string; body: URLSearchParams }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      chamadas.push({ url, body: init.body })
      return { status: 200, json: async () => ({ code: 200, header: { price: '0.28' }, data: [ES] }) }
    }))
    const inserts: any[] = []; const updates: any[] = []
    const sb = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: {} } } }) }) }),
        insert: async (row: any) => { inserts.push(row); return { error: null } },
        update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
      }),
    }
    const r = await completarDetran(sb, { id: 'p1', placa: 'RVN0B00' }, { response: [{ ufJurisdicao: 'ES', renavam: '1326889696', indicadorMultaRenainf: true }] })
    expect(r.ok).toBe(true)
    expect(chamadas[0].url).toMatch(/\/detran\/es\/veiculo$/)
    expect(chamadas[0].body.get('placa')).toBe('RVN0B00')
    expect(chamadas[0].body.get('renavam')).toBe('01326889696')
    expect(chamadas[0].body.has('pkcs12_cert')).toBe(true)
    expect(chamadas[0].body.has('chassi')).toBe(false)
    expect(inserts[0]).toMatchObject({ fonte: 'infosimples_detran_es', preco: 0.28, code: 200 })
    const gravado = JSON.stringify(updates[0])
    for (const p of ['FULANO', 'CICRANO', '01/01/1999', 'storage.invalid']) expect(gravado).not.toContain(p)
  })
})
