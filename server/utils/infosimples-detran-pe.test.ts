import { describe, it, expect, vi, afterEach } from 'vitest'
import PE from './__fixtures__/infosimples-detran-pe.json'
import { parsearDetranPe, semUrls, blocoDetranDaUf, completarDetran, DETRAN_UFS } from './infosimples-detran'

// Fixture = resposta REAL do /detran/pe/extrato-geral (RZJ5F09, 30/set, 38s,
// sem debitos) com o site_receipt trocado por um FALSO.

describe('parsearDetranPe', () => {
  it('tudo NADA CONSTA: zero, restricoes_gerais SIM vira restricao, sem log', () => {
    const log = vi.fn()
    const b = parsearDetranPe(PE, log)
    expect(b).toMatchObject({ fonte: 'detran_pe', multas_total_centavos: 0, ipva_total_centavos: 0, licenciamento_centavos: 0, multas_itens: [], autuacoes_em_andamento: 0 })
    expect(b.restricoes_detran).toEqual([{ tipo: 'administrativa', texto: 'Consta restrição no DETRAN-PE' }])
    expect(JSON.stringify(b)).not.toContain('storage.invalid')
    expect(log).not.toHaveBeenCalled()
  })
  it('restricoes_gerais NAO: sem restricao', () => {
    expect(parsearDetranPe({ ...PE, restricoes_gerais: 'NAO' }, () => {}).restricoes_detran).toEqual([])
  })
  it('defensivo: texto com valor, lista de multas, texto sem valor; loga sem URL', () => {
    const log = vi.fn()
    const b = parsearDetranPe({
      ...PE,
      baixa_gravame: 'ALIENACAO FIDUCIARIA',
      debitos: {
        ipva: 'R$ 1.234,56', licenciamento: 'CONSTA DEBITO', dpvat: 'NADA CONSTA', autuacoes_tramitacao: [{ ait: 'X' }],
        multas: [{ ait: 'PE1', descricao: 'AVANCAR SINAL', data_infracao: '01/02/2026', valor: 'R$ 293,47', boleto_pdf_url: 'https://storage.invalid/b' }],
      },
    }, log)
    expect(b.ipva_total_centavos).toBe(123456)
    expect(b.multas_itens).toHaveLength(1)
    expect(b.multas_total_centavos).toBe(29347)
    expect(b.autuacoes_em_andamento).toBe(1)
    expect(b.restricoes_detran).toEqual(expect.arrayContaining([
      { tipo: 'outros_debitos', texto: 'Licenciamento: CONSTA DEBITO' },
      { tipo: 'financeira', texto: 'Gravame: ALIENACAO FIDUCIARIA' },
    ]))
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).not.toContain('storage.invalid')
    expect(JSON.stringify(b)).not.toContain('storage.invalid')
  })
  it('multas como texto com valor', () => {
    expect(parsearDetranPe({ debitos: { multas: 'R$ 500,00' } }, () => {}).multas_total_centavos).toBe(50000)
  })
  it('semUrls tira url, receipt, boleto e nome', () => {
    expect(semUrls({ a: 'https://x', site_receipt: 'r', nome_proprietario: 'F', b: { boleto_pdf_url: 'u', c: 1 } })).toEqual({ a: '[url]', b: { c: 1 } })
  })
})

describe('completarDetran PE (e-CNPJ, chassi)', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('mapa', () => {
    expect(DETRAN_UFS.PE).toMatchObject({ path: 'detran/pe/extrato-geral', cert: 'ecnpj', gate: 'renainf', fonteCusto: 'infosimples_detran_pe', exigeChassi: true })
    expect(blocoDetranDaUf('PE', PE).fonte).toBe('detran_pe')
  })
  it('manda placa + renavam + chassi + e-CNPJ e grava custo', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p' }))
    const chamadas: { url: string; body: URLSearchParams }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      chamadas.push({ url, body: init.body })
      return { status: 200, json: async () => ({ code: 200, header: { price: '0.28' }, data: [PE] }) }
    }))
    const inserts: any[] = []; const updates: any[] = []
    const sb = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: {} } } }) }) }),
        insert: async (row: any) => { inserts.push(row); return { error: null } },
        update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
      }),
    }
    const r = await completarDetran(sb, { id: 'p1', placa: 'RZJ5F09' }, { response: [{ ufJurisdicao: 'PE', renavam: '123', chassi: '9BWZZZ377VT004251', indicadorMultaRenainf: true }] })
    expect(r.ok).toBe(true)
    const body = chamadas[0].body
    expect(chamadas[0].url).toMatch(/\/detran\/pe\/extrato-geral$/)
    expect(body.get('placa')).toBe('RZJ5F09')
    expect(body.get('renavam')).toBe('00000000123')
    expect(body.get('chassi')).toBe('9BWZZZ377VT004251')
    expect(body.has('pkcs12_cert')).toBe(true)
    expect(inserts[0]).toMatchObject({ fonte: 'infosimples_detran_pe', preco: 0.28, code: 200 })
    expect(updates[0].relatorio_snapshot.multas.fonte).toBe('detran_pe')
  })
  it('sem chassi: nao chama e marca indisponivel', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p' }))
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    const updates: any[] = []
    const sb = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: {} } } }) }) }), update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }) }) }
    const r = await completarDetran(sb, { id: 'p1', placa: 'RZJ5F09' }, { response: [{ ufJurisdicao: 'PE', renavam: '123', indicadorMultaRenainf: true }] })
    expect(r).toMatchObject({ ok: false, pulado: 'sem chassi' })
    expect(f).not.toHaveBeenCalled()
    expect(updates[0].relatorio_snapshot.multas).toEqual({ status: 'indisponivel', uf: 'PE' })
  })
})
