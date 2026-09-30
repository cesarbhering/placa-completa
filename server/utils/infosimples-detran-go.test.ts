import { describe, it, expect, vi, afterEach } from 'vitest'
import GO from './__fixtures__/infosimples-detran-go.json'
import { parsearDetranGo, blocoDetranDaUf, completarDetran, DETRAN_UFS } from './infosimples-detran'

// Fixture = resposta REAL do /detran/go/debitos (NLR8389, code 200, 30/set) com
// os links temporarios e o codigo de barras trocados.
describe('parsearDetranGo', () => {
  const b = parsearDetranGo(GO, new Date(2026, 8, 30))
  it('nunca grava boleto, ait_pdf, codigo de barras, responsavel nem site_receipt', () => {
    const out = JSON.stringify(b)
    for (const p of ['storage.invalid', 'boleto', 'ait_pdf_url', 'codigo_barras', '0000000000', 'responsavel', 'CONDUTOR', 'site_receipt']) expect(out).not.toContain(p)
  })
  it('bloco so com as chaves da whitelist', () => {
    expect(Object.keys(b).sort()).toEqual([
      'fonte', 'hodometro', 'hodometro_suspeito', 'ipva_itens', 'ipva_sefaz', 'ipva_total_centavos',
      'licenciamento_atrasado_ano', 'licenciamento_centavos', 'licenciamento_venc', 'multas_em_recurso',
      'multas_itens', 'multas_total_centavos', 'restricoes_detran', 'status', 'ultimo_licenciamento_ano',
    ])
    expect(Object.keys(b.multas_itens[0]).sort()).toEqual([
      'auto', 'dataInfracao', 'dataVencimento', 'descricao', 'grupo', 'horaInfracao', 'local', 'municipio', 'orgao', 'pontos', 'situacao', 'valor',
    ])
  })
  it('multa vencida vira item em aberto com pontos, grupo e situacao', () => {
    expect(b.fonte).toBe('detran_go')
    expect(b.multas_itens).toHaveLength(1)
    expect(b.multas_itens[0]).toMatchObject({
      auto: 'RD00869386', dataInfracao: '27/04/2026', horaInfracao: '04:59', dataVencimento: '08/09/2026',
      valor: 131.46, orgao: 'PREF. DE: GO - GOIANIA', pontos: 4, grupo: 'MEDIA', situacao: 'Multa com Auto em Penalidade',
    })
    expect(b.multas_total_centavos).toBe(13146)
    expect(b.multas_em_recurso).toEqual([])
  })
  it('IPVA "DEBITO NA SEFAZ" por exercicio, com o valor original', () => {
    expect(b.ipva_sefaz).toEqual([
      { ano: 2025, vencimento: '31/10/2025', valor_centavos: 58323 },
      { ano: 2024, vencimento: '15/10/2024', valor_centavos: 54237 },
      { ano: 2022, vencimento: '13/12/2022', valor_centavos: 53457 },
      { ano: 2021, vencimento: '04/11/2021', valor_centavos: 42474 },
    ])
    expect(b.ipva_itens).toEqual([])
    expect(b.ipva_total_centavos).toBe(58323 + 54237 + 53457 + 42474)
  })
  it('licenciamento PAGO em todos: sem debito, ultimo = 2026, sem atraso', () => {
    expect(b.licenciamento_centavos).toBe(0)
    expect(b.ultimo_licenciamento_ano).toBe(2026)
    expect(b.licenciamento_atrasado_ano).toBeNull()
    expect(b.restricoes_detran).toEqual([])
  })
  it('sob_juice = em recurso (nao soma); sne fica fora; parcelada/notificada somam', () => {
    const x = parsearDetranGo({
      infracoes: {
        vencidas: [], nao_vencida: [{ ait: 'A1', valor: 100 }], notificada: [{ ait: 'A2', valor: '50.5' }],
        nao_notificada: [], parcelada: [{ ait: 'A3', valor: 10 }], sob_juice: [{ ait: 'R1', valor: 200 }], sne: [{ ait: 'S1', valor: 999 }],
      },
      debitos_veiculo: [{ ipva_valor: 'R$ 1.200,00', licenciamento: 'R$ 150,00', data_vencimento: '10/01/2026' }],
      divida_ativa: [{}], outros_debitos: [{}, {}], licenciamento_notificado: [{}],
    }, new Date(2026, 8, 30))
    expect(x.multas_itens.map((i) => i.auto)).toEqual(['A1', 'A2', 'A3'])
    expect(x.multas_total_centavos).toBe(16050)
    expect(x.multas_em_recurso.map((i) => i.auto)).toEqual(['R1'])
    expect(x.ipva_total_centavos).toBe(120000)
    expect(x.ipva_itens).toEqual([{ ano: 2026, vencimento: '10/01/2026', valor_centavos: 120000 }])
    expect(x.ipva_sefaz).toEqual([])
    expect(x.licenciamento_centavos).toBe(15000)
    expect(x.licenciamento_venc).toBe('2026-01-10')
    expect(x.restricoes_detran.map((r) => r.tipo)).toEqual(['divida_ativa', 'outros_debitos', 'licenciamento_notificado'])
  })
  it('mapa: GO e-CNPJ, gate RENAINF, custo proprio', () => {
    expect(DETRAN_UFS.GO).toMatchObject({ path: 'detran/go/debitos', cert: 'ecnpj', gate: 'renainf', fonte: 'detran_go', fonteCusto: 'infosimples_detran_go' })
    expect(blocoDetranDaUf('GO', GO).fonte).toBe('detran_go')
  })
})

describe('completarDetran GO', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  const cfg = () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p' })
  function fakeSb(snap: any = { consulta: {} }) {
    const inserts: any[] = []; const updates: any[] = []
    return {
      inserts, updates,
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: snap } }) }) }),
        insert: async (row: any) => { inserts.push(row); return { error: null } },
        update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
      }),
    }
  }
  const resp = [{ ufJurisdicao: 'GO', renavam: '341284556', indicadorMultaRenainf: true }]
  it('chama /detran/go/debitos com placa+renavam+cert, grava custo GO', async () => {
    vi.stubGlobal('useRuntimeConfig', cfg)
    const chamadas: { url: string; body: URLSearchParams }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => { chamadas.push({ url, body: init.body }); return { status: 200, json: async () => ({ code: 200, header: { price: '0.28' }, data: [GO] }) } }))
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p1', placa: 'NLR8389' }, { response: resp })
    expect(r.ok).toBe(true)
    expect(chamadas[0].url).toMatch(/\/detran\/go\/debitos$/)
    expect(chamadas[0].body.get('placa')).toBe('NLR8389')
    expect(chamadas[0].body.get('renavam')).toBe('00341284556')
    expect(chamadas[0].body.has('pkcs12_cert')).toBe(true)
    expect(sb.inserts[0]).toMatchObject({ fonte: 'infosimples_detran_go', preco: 0.28, code: 200 })
    expect(JSON.stringify(sb.updates[0])).not.toContain('storage.invalid')
  })
  it('sem RENAINF nao chama', async () => {
    vi.stubGlobal('useRuntimeConfig', cfg)
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    const r = await completarDetran(fakeSb(), { id: 'p1', placa: 'NLR8389' }, { response: [{ ufJurisdicao: 'GO', renavam: '1' }] })
    expect(r).toMatchObject({ ok: false, pulado: 'GO so com RENAINF' })
    expect(f).not.toHaveBeenCalled()
  })
  it('bloco oficial ja gravado: nao chama de novo', async () => {
    vi.stubGlobal('useRuntimeConfig', cfg)
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    const r = await completarDetran(fakeSb({ multas: { fonte: 'detran_go' } }), { id: 'p1', placa: 'NLR8389' }, { response: resp })
    expect(r).toMatchObject({ ok: false, pulado: 'ja tem detran_go' })
    expect(f).not.toHaveBeenCalled()
  })
  it('bloco preenchido a mao e trocado pelo dado oficial', async () => {
    vi.stubGlobal('useRuntimeConfig', cfg)
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, json: async () => ({ code: 200, header: { price: 0.28 }, data: [GO] }) })))
    const sb = fakeSb({ consulta: {}, multas: { fonte: 'detran_go', preenchido_manual_em: '2026-09-30T15:00:00Z' } })
    const r = await completarDetran(sb, { id: 'p1', placa: 'NLR8389' }, { response: resp })
    expect(r.ok).toBe(true)
    expect(sb.updates[0].relatorio_snapshot.multas.preenchido_manual_em).toBeUndefined()
    expect(sb.updates[0].relatorio_snapshot.multas.ipva_sefaz).toHaveLength(4)
  })
})
