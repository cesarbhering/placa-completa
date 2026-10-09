import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import BA from './__fixtures__/infosimples-detran-ba.json'
import LIC from './__fixtures__/infosimples-detran-ba-licenciamento.json'
import { parsearLicenciamentoBa, juntarComplemento, completarDetran, destravarLoginBa, DETRAN_UFS } from './infosimples-detran'

// Fixture = resposta REAL do /detran/ba/licenciamento (JPQ6371, 09/out, code
// 200, R$0,30) sem proprietario, links e placa/renavam reais.

describe('parsearLicenciamentoBa', () => {
  const hoje = new Date('2026-10-09T12:00:00Z')
  const c = parsearLicenciamentoBa(LIC, hoje)!
  it('soma as taxas de licenciamento em aberto por exercicio (2021 a 2026)', () => {
    expect(c.licenciamento_exercicios.map((x) => x.ano)).toEqual([2021, 2022, 2023, 2024, 2025, 2026])
    expect(c.licenciamento_centavos).toBe(27900 + 27176 + 25727 + 24640 + 22828 + 20101)
  })
  it('ultimo exercicio licenciado = o ano antes do primeiro em aberto', () => {
    expect(c.licenciamento_atrasado_ano).toBe(2020)
  })
  it('IPVA atual zerado = em dia (0, nao null)', () => {
    expect(c.ipva_total_centavos).toBe(0)
  })
  it('nada de proprietario, links nem multas no complemento', () => {
    const out = JSON.stringify(c)
    for (const p of ['proprietario', 'html_url', 'site_receipt', 'RENAINF']) expect(out).not.toContain(p)
  })
  it('sem nada na resposta: null (nao inventa "em dia")', () => {
    expect(parsearLicenciamentoBa({}, hoje)).toBeNull()
  })
  it('em dia: nenhuma taxa em aberto', () => {
    const r = parsearLicenciamentoBa({ licenciamento: [{ descricao: 'Licenciamento atual', valor: 'R$0,00', normalizado_valor: 0 }, { descricao: 'IPVA atual', valor: 'R$0,00', normalizado_valor: 0 }], valores_atualizados: [] }, hoje)!
    expect(r).toMatchObject({ licenciamento_centavos: 0, licenciamento_atrasado_ano: null, ipva_total_centavos: 0 })
  })
  it('juntar mantem as multas do /multas', () => {
    const j = juntarComplemento({ fonte: 'detran_ba', multas_total_centavos: 19523, multas_itens: [{}] }, c)
    expect(j).toMatchObject({ fonte: 'detran_ba', multas_total_centavos: 19523, complemento_ok: true, licenciamento_atrasado_ano: 2020 })
  })
  it('mapa: complemento do BA no /licenciamento com custo proprio', () => {
    expect((DETRAN_UFS.BA as any).complemento).toEqual({ path: 'detran/ba/licenciamento', fonteCusto: 'infosimples_detran_ba_licenciamento' })
  })
})

describe('completarDetran BA com complemento', () => {
  const RESP = [{ ufJurisdicao: 'BA', renavam: '834913631', indicadorMultaRenainf: true }]
  function fakeSb(snap: any = { consulta: {} }) {
    const inserts: any[] = []; const updates: any[] = []
    let atual = snap
    return {
      inserts, updates,
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: atual } }) }) }),
        insert: async (row: any) => { inserts.push(row); return { error: null } },
        update: (row: any) => ({ eq: async () => { updates.push(row); atual = row.relatorio_snapshot; return { error: null } } }),
      }),
    }
  }
  beforeEach(() => {
    destravarLoginBa()
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32) }))
    process.env.NUXT_INFOSIMPLES_BA_CPF = '12345678900'
    process.env.NUXT_INFOSIMPLES_BA_SENHA = 'x'
  })
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.NUXT_INFOSIMPLES_BA_CPF; delete process.env.NUXT_INFOSIMPLES_BA_SENHA })

  const fetchPorPath = (lic: any = { code: 200, header: { price: 0.3 }, data: [LIC] }) => vi.fn(async (url: string, init: any) => {
    if (String(url).endsWith('/detran/ba/multas')) return { status: 200, json: async () => ({ code: 200, header: { price: 0.3 }, data: [BA] }) }
    expect(init.body.get('chassi')).toBe('') // o /licenciamento recusa renavam E chassi juntos (607)
    return { status: 200, json: async () => lic }
  })

  it('pedido novo: multas + licenciamento, dois custos, bloco com licenciamento e IPVA', async () => {
    vi.stubGlobal('fetch', fetchPorPath())
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p1', placa: 'JPQ6371' }, { response: RESP })
    expect(r.ok).toBe(true)
    expect(sb.inserts.map((i) => i.fonte)).toEqual(['infosimples_detran_ba', 'infosimples_detran_ba_licenciamento'])
    const m = sb.updates.at(-1).relatorio_snapshot.multas
    expect(m).toMatchObject({ fonte: 'detran_ba', complemento_ok: true, licenciamento_atrasado_ano: 2020, ipva_total_centavos: 0 })
    expect(m.licenciamento_centavos).toBeGreaterThan(0)
  })

  it('complemento falha: o bloco de multas grava igual (fail-open)', async () => {
    vi.stubGlobal('fetch', fetchPorPath({ code: 605, header: { price: 0.3 }, data: [] }))
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p1', placa: 'JPQ6371' }, { response: RESP })
    expect(r.ok).toBe(true)
    const m = sb.updates.at(-1).relatorio_snapshot.multas
    expect(m.fonte).toBe('detran_ba')
    expect(m.complemento_ok).toBeUndefined()
    expect(m.licenciamento_centavos).toBeNull()
  })

  it('pedido antigo com multas BA e sem complemento (backfill): chama SO o /licenciamento', async () => {
    const f = fetchPorPath()
    vi.stubGlobal('fetch', f)
    const sb = fakeSb({ consulta: {}, multas: { status: 'ok', fonte: 'detran_ba', multas_total_centavos: 100, multas_itens: [{ valor: 1 }] } })
    const r = await completarDetran(sb, { id: 'p1', placa: 'JPQ6371' }, { response: RESP, ignorarGate: true })
    expect(r.ok).toBe(true)
    expect(f.mock.calls.map((c: any) => String(c[0]))).toEqual([expect.stringMatching(/\/detran\/ba\/licenciamento$/)])
    expect(sb.updates.at(-1).relatorio_snapshot.multas).toMatchObject({ multas_total_centavos: 100, complemento_ok: true, licenciamento_atrasado_ano: 2020 })
  })

  it('ja com complemento: nao chama nada', async () => {
    const f = fetchPorPath()
    vi.stubGlobal('fetch', f)
    const sb = fakeSb({ consulta: {}, multas: { status: 'ok', fonte: 'detran_ba', complemento_ok: true } })
    const r = await completarDetran(sb, { id: 'p1', placa: 'JPQ6371' }, { response: RESP, ignorarGate: true })
    expect(r.ok).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })
})
