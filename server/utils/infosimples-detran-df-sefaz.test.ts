// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import DF from './__fixtures__/infosimples-detran-df.json'
import { parsearIpvaSefazDf, completarDetran, DETRAN_UFS } from './infosimples-detran'
import { _resetarEmVoo, quantasEmVoo } from './tarefas-em-voo'

// DF: o IPVA e da SEFAZ-DF, nao do DETRAN (PQH4374, 14/out: /detran/df/debitos
// com debitos_ipva vazio; /sefaz/df/ipva real voltou 612 "NENHUM REGISTRO ENCONTRADO").
describe('SEFAZ-DF /ipva', () => {
  it('debitos[] por ano/cota (formato da doc), sem razao_social nem boleto', () => {
    const itens = parsearIpvaSefazDf([{ razao_social: 'FULANO', debitos: [
      { ano: '2025', cota: 'UNICA', valor_principal: '1.000,00', valor_total: '1.180,50', boleto_pdf_url: 'https://x' },
      { ano: '2026', cota: '1', valor_total: 'R$ 350,00' },
    ] }])
    expect(itens).toEqual([{ ano: 2026, vencimento: null, valor_centavos: 35000, cota: '1' }, { ano: 2025, vencimento: null, valor_centavos: 118050, cota: 'UNICA' }])
    expect(JSON.stringify(itens)).not.toMatch(/FULANO|https/)
  })
  it('vazio = nada em aberto', () => {
    expect(parsearIpvaSefazDf([])).toEqual([])
    expect(parsearIpvaSefazDf([{ debitos: [] }])).toEqual([])
  })
})

describe('DF: SEFAZ solta depois do bloco, so com renavam', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); _resetarEmVoo() })
  function rodar(sefaz: any) {
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't' }))
    vi.stubEnv('NUXT_INFOSIMPLES_BA_CPF', '123.456.789-00')
    vi.stubEnv('NUXT_INFOSIMPLES_BA_SENHA', 's')
    const chamadas: any[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      chamadas.push({ url, body: init.body })
      if (url.endsWith('/detran/df/debitos')) return { status: 200, json: async () => ({ code: 200, header: { price: '0.28' }, data: [DF] }) }
      return { status: 200, json: async () => sefaz }
    }))
    let snap: any = { consulta: {} }; const custos: any[] = []
    const sb = { from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: snap } }) }) }),
      insert: async (r: any) => { custos.push(r); return { error: null } },
      update: (r: any) => ({ eq: async () => { snap = r.relatorio_snapshot; return { error: null } } }) }) }
    return { sb, chamadas, custos, snap: () => snap }
  }
  const resp = [{ ufJurisdicao: 'DF', renavam: '1234567890' }]

  it('612 (nenhum registro): IPVA 0 pela SEFAZ-DF; chamada sem placa e sem login', async () => {
    const { sb, chamadas, custos, snap } = rodar({ code: 612, code_message: 'nao retornou dados', errors: ['NENHUM REGISTRO ENCONTRADO.'], header: { price: '0.24' } })
    expect((await completarDetran(sb, { id: 'p', placa: 'PQH4374' }, { response: resp })).ok).toBe(true)
    await vi.waitFor(() => expect(quantasEmVoo()).toBe(0))
    const sef = chamadas.find((c) => c.url.endsWith('/sefaz/df/ipva'))
    expect(sef.body.get('renavam')).toBe('01234567890')
    for (const k of ['placa', 'login_cpf', 'login_senha', 'pkcs12_cert']) expect(sef.body.has(k)).toBe(false)
    expect(snap().multas).toMatchObject({ fonte: 'detran_df', ipva_total_centavos: 0, ipva_itens: [], ipva_fonte: 'sefaz_df' })
    expect(snap().multas.ipva_pendente_sefaz).toBeUndefined()
    expect(custos.map((c) => c.fonte)).toEqual(['infosimples_detran_df', 'infosimples_sefaz_df_ipva'])
  })

  it('200 com debitos: IPVA por ano no bloco', async () => {
    const { sb, snap } = rodar({ code: 200, header: { price: '0.24' }, data: [{ debitos: [{ ano: '2026', cota: 'UNICA', valor_total: '2.100,00' }] }] })
    await completarDetran(sb, { id: 'p', placa: 'PQH4374' }, { response: resp })
    await vi.waitFor(() => expect(quantasEmVoo()).toBe(0))
    expect(snap().multas).toMatchObject({ ipva_total_centavos: 210000, ipva_itens: [{ ano: 2026, valor_centavos: 210000 }] })
  })

  it('mapa', () => {
    expect((DETRAN_UFS.DF as any).ipvaSefaz).toMatchObject({ path: 'sefaz/df/ipva', semCredencial: true, soRenavam: true, sempre: true })
  })
})
