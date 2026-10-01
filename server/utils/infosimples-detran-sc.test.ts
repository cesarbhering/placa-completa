import { describe, it, expect, vi, afterEach } from 'vitest'
import SC from './__fixtures__/infosimples-detran-sc.json'
import { decrypt } from 'aes-bridge'
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
      'fonte', 'historico_infracoes', 'hodometro', 'hodometro_suspeito', 'ipva_itens', 'ipva_total_centavos',
      'licenciamento_atrasado_ano', 'licenciamento_centavos', 'licenciamento_venc', 'multas_itens',
      'multas_total_centavos', 'restricoes_detran', 'status', 'ultimo_licenciamento_ano',
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
    expect(b.ipva_itens).toEqual([{ ano: 2026, vencimento: '31/08/2026', valor_centavos: 66932 }])
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
  it('SP e SC suportadas; UF sem DETRAN nao', () => {
    expect(ufDetranSuportada('sc')).toBe('SC')
    expect(ufDetranSuportada('SP')).toBe('SP')
    expect(ufDetranSuportada('RJ')).toBeNull()
    expect(ufDetranSuportada(null)).toBeNull()
  })
  it('blocoDetranDaUf usa o parser da UF', () => {
    expect(blocoDetranDaUf('SC', SC).fonte).toBe('detran_sc')
  })
})

describe('completarDetran SC', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.NUXT_INFOSIMPLES_ECPF_PKCS12_B64
    delete process.env.NUXT_INFOSIMPLES_ECPF_PKCS12_PASS
  })
  const KEY = 'k'.repeat(32)
  const cfgEcnpj = () => vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't', infosimplesEncKey: KEY, infosimplesPkcs12B64: 'ECNPJ-PFX', infosimplesPkcs12Pass: 'ecnpj-pass' }))
  function fakeSb() {
    const inserts: any[] = []; const updates: any[] = []
    return {
      inserts, updates,
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: {} } } }) }) }),
        insert: async (row: any) => { inserts.push(row); return { error: null } },
        update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
      }),
    }
  }
  const RESP_SC = [{ ufJurisdicao: 'SC', renavam: '390314714', indicadorMultaRenainf: true }]

  it('usa o e-CNPJ no /detran/sc/veiculo (mesmo com e-CPF no ambiente), grava custo SC e o snapshot sem PII', async () => {
    cfgEcnpj()
    process.env.NUXT_INFOSIMPLES_ECPF_PKCS12_B64 = 'ECPF-PFX'
    process.env.NUXT_INFOSIMPLES_ECPF_PKCS12_PASS = 'ecpf-pass'
    const chamadas: { url: string; body: URLSearchParams }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      chamadas.push({ url, body: init.body })
      return { status: 200, json: async () => ({ code: 200, header: { price: '0.28' }, data: [SC] }) }
    }))
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p1', placa: 'MJL2938' }, { response: RESP_SC })
    expect(r.ok).toBe(true)
    expect(chamadas[0].url).toMatch(/\/detran\/sc\/veiculo$/)
    // O cert mandado e o e-CNPJ (decripta o que foi pro Infosimples).
    const volta = async (v: string) => new TextDecoder().decode(await decrypt(v.replace(/-/g, '+').replace(/_/g, '/'), KEY))
    expect(await volta(chamadas[0].body.get('pkcs12_cert')!)).toBe('ECNPJ-PFX')
    expect(await volta(chamadas[0].body.get('pkcs12_pass')!)).toBe('ecnpj-pass')
    expect(chamadas[0].body.get('renavam')).toBe('00390314714')
    expect(sb.inserts[0]).toMatchObject({ pedido_id: 'p1', fonte: 'infosimples_detran_sc', preco: 0.28, code: 200 })
    const gravado = JSON.stringify(sb.updates[0])
    expect(sb.updates[0].relatorio_snapshot.multas.fonte).toBe('detran_sc')
    expect(gravado).not.toContain('FULANO')
    expect(gravado).not.toContain('CICRANO')
  })

  it('SP continua com o e-CNPJ', async () => {
    cfgEcnpj()
    process.env.NUXT_INFOSIMPLES_ECPF_PKCS12_B64 = 'ECPF-PFX'
    process.env.NUXT_INFOSIMPLES_ECPF_PKCS12_PASS = 'ecpf-pass'
    const chamadas: { url: string; body: URLSearchParams }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      chamadas.push({ url, body: init.body })
      return { status: 200, json: async () => ({ code: 607, header: { price: '0.28' } }) }
    }))
    await completarDetran(fakeSb(), { id: 'p1', placa: 'FYA8875' }, { response: [{ ufJurisdicao: 'SP', renavam: '01136947237' }] })
    expect(chamadas[0].url).toMatch(/\/detran\/sp\/debitos$/)
    const volta = async (v: string) => new TextDecoder().decode(await decrypt(v.replace(/-/g, '+').replace(/_/g, '/'), KEY))
    expect(await volta(chamadas[0].body.get('pkcs12_cert')!)).toBe('ECNPJ-PFX')
  })
})
