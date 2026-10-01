import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import DF from './__fixtures__/infosimples-detran-df.json'
import { parsearDetranDf, blocoDetranDaUf, completarDetran, loginBaTravado, destravarLoginBa, DETRAN_UFS } from './infosimples-detran'

// Fixture = resposta REAL do /detran/df/debitos (PBX2E59, 30/set, code 200)
// com chassi, renavam e site_receipt trocados por valores FALSOS.

describe('parsearDetranDf', () => {
  const HOJE = new Date(2026, 8, 30)
  const b = parsearDetranDf(DF, HOJE)
  it('nunca grava responsavel, codigo RENAINF, chassi, renavam nem site_receipt', () => {
    const out = JSON.stringify(b)
    for (const proibido of ['storage.invalid', 'site_receipt', 'CONDUTOR', 'responsavel', '11460504119', '9XXXXXXXXXXXXXXXX', 'renavam', 'chassi']) expect(out).not.toContain(proibido)
  })
  it('infracao em aberto com valor corrigido, hora, pontos e grupo', () => {
    expect(b.fonte).toBe('detran_df')
    expect(b.multas_itens).toHaveLength(1)
    expect(b.multas_itens[0]).toMatchObject({
      auto: 'KK02569188', orgao: 'DETRAN - DF', dataInfracao: '12/06/2026', horaInfracao: '16:01', dataVencimento: '21/09/2026',
      valor: 131.46, descricao: 'TRANSITAR VELOCIDADE SUPERIOR MAX PERMIT ATE 20%', pontos: 4, grupo: 'MEDIA',
    })
    expect(b.multas_total_centavos).toBe(13146)
    expect(b.licenciamento_centavos).toBe(0)
    expect(b.ipva_total_centavos).toBe(0)
    expect(b.ultimo_licenciamento_ano).toBe(2026)
    expect(b.licenciamento_atrasado_ano).toBeNull()
    expect(b.restricoes_detran).toEqual([])
  })
  it('valor_corrigido manda no total; DPVAT/parcelamento viram outros debitos; IPVA por exercicio', () => {
    const d = JSON.parse(JSON.stringify(DF))
    d.debitos.infracoes_veiculo[0].valor_corrigido = 150.1
    d.debitos.total_dpvat = 20.5
    d.debitos.total_devido_parcelamento = 300
    d.debitos.total_licenciamento = 180.79
    d.debitos.ipva = [{ exercicio: '2025', data_vencimento: '10/03/2025', valor: 'R$ 1.234,56' }]
    d.veiculo.ano_ultimo_licenciamento = '2023'
    d.veiculo.desc_situacao = 'BAIXADO'
    const x = parsearDetranDf(d, HOJE)
    expect(x.multas_total_centavos).toBe(15010)
    expect(x.licenciamento_centavos).toBe(18079)
    expect(x.ipva_itens).toEqual([{ ano: 2025, vencimento: '10/03/2025', valor_centavos: 123456 }])
    expect(x.ipva_total_centavos).toBe(123456)
    expect(x.licenciamento_atrasado_ano).toBe(2023)
    expect(x.restricoes_detran).toEqual([
      { tipo: 'outros_debitos', texto: 'DPVAT em aberto: R$ 20,50' },
      { tipo: 'outros_debitos', texto: 'Parcelamento em aberto no DETRAN-DF: R$ 300,00' },
      { tipo: 'situacao', texto: 'BAIXADO' },
    ])
  })
  it('mapa: DF com login gov.br e gate RENAINF', () => {
    expect(DETRAN_UFS.DF).toMatchObject({ path: 'detran/df/debitos', cert: 'govbr_df', gate: 'renainf', fonte: 'detran_df', fonteCusto: 'infosimples_detran_df' })
    expect(blocoDetranDaUf('DF', DF).fonte).toBe('detran_df')
  })
})

describe('completarDetran DF (login gov.br do BA)', () => {
  const RESP = [{ ufJurisdicao: 'DF', renavam: '1212669042', indicadorMultaRenainf: true }]
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
  beforeEach(() => {
    destravarLoginBa()
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p' }))
    process.env.NUXT_INFOSIMPLES_BA_CPF = '123.456.789-00'
    process.env.NUXT_INFOSIMPLES_BA_SENHA = 'Senha#Teste1'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.NUXT_INFOSIMPLES_BA_CPF
    delete process.env.NUXT_INFOSIMPLES_BA_SENHA
    destravarLoginBa()
  })

  it('manda placa + renavam + CPF + senha em TEXTO PURO, sem certificado; grava custo DF', async () => {
    const chamadas: { url: string; body: URLSearchParams }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      chamadas.push({ url, body: init.body })
      return { status: 200, json: async () => ({ code: 200, header: { price: '0.28' }, data: [DF] }) }
    }))
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p1', placa: 'PBX2E59' }, { response: RESP })
    expect(r).toMatchObject({ ok: true, multasCentavos: 13146, temAlgo: true })
    const body = chamadas[0].body
    expect(chamadas[0].url).toMatch(/\/detran\/df\/debitos$/)
    expect(body.get('placa')).toBe('PBX2E59')
    expect(body.get('renavam')).toBe('01212669042')
    expect(body.get('login_cpf')).toBe('12345678900')
    expect(body.get('login_senha')).toBe('Senha#Teste1')
    expect(body.has('pkcs12_cert')).toBe(false)
    expect(body.has('chassi')).toBe(false)
    expect(sb.inserts[0]).toMatchObject({ fonte: 'infosimples_detran_df', preco: 0.28, code: 200 })
    expect(JSON.stringify(sb.updates[0])).not.toContain('storage.invalid')
  })

  it('608 trava DF e BA (mesma conta gov.br), sem retry', async () => {
    const f = vi.fn(async () => ({ status: 200, json: async () => ({ code: 608, code_message: 'Usuário e/ou senha inválidos', header: { price: 0 } }) }))
    vi.stubGlobal('fetch', f)
    const r1 = await completarDetran(fakeSb(), { id: 'p1', placa: 'PBX2E59' }, { response: RESP })
    expect(r1).toMatchObject({ ok: false, code: 608 })
    expect(loginBaTravado()).toBeTruthy()
    const r2 = await completarDetran(fakeSb(), { id: 'p2', placa: 'PBX2E59' }, { response: RESP })
    expect(r2).toMatchObject({ ok: false, pulado: 'login gov.br travado (608)' })
    const r3 = await completarDetran(fakeSb(), { id: 'p3', placa: 'SIP4I06' }, { response: [{ ufJurisdicao: 'BA', renavam: '1357806202', indicadorMultaRenainf: true }] })
    expect(r3).toMatchObject({ ok: false, pulado: 'login gov.br travado (608)' })
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('sem RENAINF: nao chama (gate)', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    const r = await completarDetran(fakeSb(), { id: 'p1', placa: 'PBX2E59' }, { response: [{ ufJurisdicao: 'DF', renavam: '1' }] })
    expect(r).toMatchObject({ ok: false, pulado: 'DF so com RENAINF' })
    expect(f).not.toHaveBeenCalled()
  })
})
