import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import RS from './__fixtures__/infosimples-detran-rs.json'
import VEI from './__fixtures__/infosimples-detran-rs-veiculo.json'
import { parsearVeiculoRs, juntarComplemento, completarDetran, DETRAN_UFS } from './infosimples-detran'

// Fixture = resposta REAL do /detran/rs/veiculo (IWC7G10, 09/out, code 200,
// R$0,28) com placa, renavam, chassi, nome e credor trocados por FALSOS.

describe('parsearVeiculoRs', () => {
  const hoje = new Date('2026-10-09T12:00:00Z')
  const c = parsearVeiculoRs(VEI, hoje)!
  it('IPVA pendente 2025 e 2026: total com multa e juros, original a parte', () => {
    expect(c.ipva_total_centavos).toBe(40546 + 42570)
    expect(c.ipva_original_centavos).toBe(32032 + 30302)
  })
  it('licenciamento valido ate 31/07/2025: atrasado, ultimo exercicio 2024, valor do licenciamento', () => {
    expect(c.licenciamento_atrasado_ano).toBe(2024)
    expect(c.licenciamento_centavos).toBe(11409)
  })
  it('em dia: validade futura e nada pendente', () => {
    const r = parsearVeiculoRs({ ...VEI, licenciamento_valido_ate: '31/07/2027', ipva: [{ exercicio: '2026', situacao: 'Liquidado', valor: 300, debitos: [] }] }, hoje)!
    expect(r).toMatchObject({ licenciamento_centavos: 0, licenciamento_atrasado_ano: null, ipva_total_centavos: 0 })
  })
  it('divida ativa liquidada nao conta', () => {
    expect(parsearVeiculoRs({ ipva: [{ exercicio: '2021', situacao: 'Em Divida Ativa Liquidada/Concluida', valor: 238.68, debitos: [] }] }, hoje)!.ipva_total_centavos).toBe(0)
  })
  it('nada de nome, credor, chassi nem renavam no complemento', () => {
    const out = JSON.stringify(juntarComplemento({}, c))
    for (const p of ['FULANO', 'FICTICIO', '9C2', '00000000000', 'proprietario']) expect(out).not.toContain(p)
  })
  it('mapa: complemento do RS no /veiculo', () => {
    expect((DETRAN_UFS.RS as any).complemento).toEqual({ path: 'detran/rs/veiculo', fonteCusto: 'infosimples_detran_rs_veiculo' })
  })
})

describe('completarDetran RS com complemento', () => {
  const RESP = [{ ufJurisdicao: 'RS', renavam: '1234567890', indicadorMultaRenainf: true }]
  beforeEach(() => vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'UEZY', infosimplesPkcs12Pass: 'p' })))
  afterEach(() => vi.unstubAllGlobals())
  it('infracoes + veiculo (placa e e-CNPJ nos dois), dois custos', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      urls.push(String(url))
      expect(init.body.get('placa')).toBe('IWC7G10')
      expect(init.body.has('pkcs12_cert')).toBe(true)
      const data = String(url).endsWith('/veiculo') ? VEI : RS
      return { status: 200, json: async () => ({ code: 200, header: { price: 0.28 }, data: [data] }) }
    }))
    const inserts: any[] = []; const updates: any[] = []
    const sb = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: {} } } }) }) }),
        insert: async (row: any) => { inserts.push(row); return { error: null } },
        update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
      }),
    }
    const r = await completarDetran(sb, { id: 'p1', placa: 'IWC7G10' }, { response: RESP })
    expect(r.ok).toBe(true)
    expect(urls.map((u) => u.split('/').slice(-1)[0])).toEqual(['infracoes', 'veiculo'])
    expect(inserts.map((i) => i.fonte)).toEqual(['infosimples_detran_rs', 'infosimples_detran_rs_veiculo'])
    expect(updates.at(-1).relatorio_snapshot.multas).toMatchObject({ fonte: 'detran_rs', complemento_ok: true, licenciamento_atrasado_ano: 2024 })
  })
})
