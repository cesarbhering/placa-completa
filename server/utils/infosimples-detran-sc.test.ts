import { describe, it, expect, vi, afterEach } from 'vitest'
import SC from './__fixtures__/infosimples-detran-sc.json'
import { parsearDetranSc, limparTextoSng, ufDetranSuportada, blocoDetranDaUf, completarDetran } from './infosimples-detran'

// Fixture = resposta REAL do /detran/sc/veiculo (MJL2938, code 200), com os
// campos de pessoa trocados por nomes FALSOS (nenhum dado real no repo).
const HOJE = new Date('2026-09-29T12:00:00-03:00')

describe('parsearDetranSc: LGPD', () => {
  it('nunca deixa passar nome de proprietario, condutor, interessado, SNG ou recibo', () => {
    const out = JSON.stringify(parsearDetranSc(SC, HOJE))
    for (const proibido of [
      'FULANO PROPRIETARIO ATUAL', 'BELTRANO PROPRIETARIO ANTERIOR', 'CICRANO CONDUTOR PRINCIPAL',
      'FULANO INTERESSADO', 'B**** D*******', 'F****** P*********', 'receipt-com-dados-pessoais',
      'nome_proprietario', 'nome_principal_condutor', 'interessado', 'site_receipt', 'ultimo_processo',
    ]) expect(out).not.toContain(proibido)
  })

  it('o bloco gravado tem so as chaves da whitelist', () => {
    expect(Object.keys(parsearDetranSc(SC, HOJE)).sort()).toEqual([
      'fonte', 'historico_infracoes', 'hodometro', 'hodometro_suspeito', 'ipva_total_centavos',
      'licenciamento_atrasado_ano', 'licenciamento_centavos', 'licenciamento_venc', 'multas_itens',
      'multas_total_centavos', 'restricoes_detran', 'status',
    ])
  })

  it('limparTextoSng tira quem informou e pra quem', () => {
    expect(limparTextoSng('Registro de Alienação Fiduciária informado por B**** D******* S* em 29/09/2026 às 16h08min para I**** F*****'))
      .toBe('Registro de Alienação Fiduciária informado em 29/09/2026')
    expect(limparTextoSng('')).toBeNull()
  })
})

describe('parsearDetranSc: mapeamento (MJL2938 real)', () => {
  const b = parsearDetranSc(SC, HOJE)
  it('classifica os debitos pela classe: multa, IPVA, licenciamento', () => {
    expect(b.fonte).toBe('detran_sc')
    expect(b.multas_total_centavos).toBe(30961) // JOINVIL-...-JV00226652 (valor do debito)
    expect(b.ipva_total_centavos).toBe(66932)   // IPVA (Cota Unica) 2026
    expect(b.licenciamento_centavos).toBe(14937) // Licenciamento Anual 2026
    expect(b.licenciamento_venc).toBe('2026-10-31')
  })
  it('multas em aberto com data/hora, local e vencimento do debito do mesmo auto', () => {
    expect(b.multas_itens).toHaveLength(1)
    expect(b.multas_itens[0]).toMatchObject({
      auto: 'JV00226652', dataInfracao: '13/11/2025', horaInfracao: '11:31',
      dataVencimento: '13/04/2026', valor: 293.47, local: 'MONSENHOR GERCINO, 2105 - JOINVILLE/SC',
    })
  })
  it('licenciamento 2025 com o de 2026 ainda nao vencido NAO e atrasado', () => {
    expect(b.licenciamento_atrasado_ano).toBeNull()
  })
  it('licenciamento vencido vira atrasado com o ano do ultimo licenciado', () => {
    expect(parsearDetranSc(SC, new Date('2026-11-05T12:00:00-03:00')).licenciamento_atrasado_ano).toBe(2025)
  })
  it('restricoes: SNG limpo; "Sem gravame" e "Em circulação" nao entram', () => {
    expect(b.restricoes_detran).toEqual([{ tipo: 'sng', texto: 'Registro de Alienação Fiduciária informado em 29/09/2026' }])
  })
  it('historico de infracoes: contagem, pagas e recursos; sem km', () => {
    expect(b.historico_infracoes).toEqual({ total: 14, pagas: 14, recursos: 1 })
    expect(b.hodometro).toEqual([])
  })
})

describe('gate por UF', () => {
  it('SP e SC suportadas, resto nao', () => {
    expect(ufDetranSuportada('sc')).toBe('SC')
    expect(ufDetranSuportada('SP')).toBe('SP')
    expect(ufDetranSuportada('MG')).toBeNull()
    expect(ufDetranSuportada(null)).toBeNull()
  })
  it('blocoDetranDaUf usa o parser da UF', () => {
    expect(blocoDetranDaUf('SC', SC).fonte).toBe('detran_sc')
  })
})

describe('completarDetran SC', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  it('chama o endpoint /detran/sc/veiculo, grava custo com fonte SC e o snapshot sem PII', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'cGZ4', infosimplesPkcs12Pass: 'p' }))
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => { urls.push(url); return { status: 200, json: async () => ({ code: 200, header: { price: '0.28' }, data: [SC] }) } }))
    const inserts: any[] = []; const updates: any[] = []
    const sb = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: {} } } }) }) }),
        insert: async (row: any) => { inserts.push(row); return { error: null } },
        update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
      }),
    }
    const r = await completarDetran(sb, { id: 'p1', placa: 'MJL2938' }, { response: [{ ufJurisdicao: 'SC', renavam: '390314714' }] })
    expect(r.ok).toBe(true)
    expect(urls[0]).toMatch(/\/detran\/sc\/veiculo$/)
    expect(inserts[0]).toMatchObject({ pedido_id: 'p1', fonte: 'infosimples_detran_sc', preco: 0.28, code: 200 })
    const gravado = JSON.stringify(updates[0])
    expect(updates[0].relatorio_snapshot.multas.fonte).toBe('detran_sc')
    expect(gravado).not.toContain('FULANO')
    expect(gravado).not.toContain('CICRANO')
  })
})
