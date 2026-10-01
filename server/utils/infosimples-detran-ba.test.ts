import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import BA from './__fixtures__/infosimples-detran-ba.json'
import { parsearDetranBa, blocoDetranDaUf, completarDetran, loginBaTravado, destravarLoginBa, DETRAN_UFS } from './infosimples-detran'

// Fixture = resposta REAL do /detran/ba/multas (SIP4I06, code 200) com o nome do
// proprietario e os links temporarios trocados por valores FALSOS.

describe('parsearDetranBa', () => {
  const b = parsearDetranBa(BA)
  it('nunca grava proprietario, PDFs nem site_receipt', () => {
    const out = JSON.stringify(b)
    for (const proibido of ['FULANO DONO', 'storage.invalid', 'proprietario', 'pdf_url', 'site_receipt']) expect(out).not.toContain(proibido)
  })
  it('bloco so com as chaves da whitelist', () => {
    expect(Object.keys(b).sort()).toEqual([
      'autuacoes_em_andamento', 'fonte', 'hodometro', 'hodometro_suspeito', 'ipva_total_centavos',
      'licenciamento_atrasado_ano', 'licenciamento_centavos', 'multas_itens', 'multas_total_centavos',
      'restricoes_detran', 'status',
    ])
  })
  it('casa infracao com o detalhe pelo numero de controle (AIT, vencimento, municipio)', () => {
    expect(b.fonte).toBe('detran_ba')
    expect(b.multas_itens).toHaveLength(1)
    expect(b.multas_itens[0]).toMatchObject({
      auto: 'N005097437', dataInfracao: '02/05/2026', dataVencimento: '26/06/2026', valor: 195.23,
      municipio: 'FEIRA DE SANTANA', orgao: 'DEPTO. POLICIA RODOVIARIA FEDERAL', local: 'BA - BR 324 - KM 514.00 - D',
    })
    expect(b.multas_total_centavos).toBe(19523)
    expect(b.autuacoes_em_andamento).toBe(0)
  })
  it('mapa: BA com login gov.br e gate RENAINF', () => {
    expect(DETRAN_UFS.BA).toMatchObject({ path: 'detran/ba/multas', cert: 'govbr_ba', gate: 'renainf', fonteCusto: 'infosimples_detran_ba' })
    expect(blocoDetranDaUf('BA', BA).fonte).toBe('detran_ba')
  })
})

describe('completarDetran BA (login gov.br)', () => {
  const RESP = [{ ufJurisdicao: 'BA', renavam: '1357806202', indicadorMultaRenainf: true }]
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

  it('manda CPF + senha em TEXTO PURO, renavam, chassi vazio, sem placa e sem certificado', async () => {
    const chamadas: { url: string; body: URLSearchParams }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      chamadas.push({ url, body: init.body })
      return { status: 200, json: async () => ({ code: 200, header: { price: 0.3 }, data: [BA] }) }
    }))
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p1', placa: 'SIP4I06' }, { response: RESP })
    expect(r.ok).toBe(true)
    const body = chamadas[0].body
    expect(chamadas[0].url).toMatch(/\/detran\/ba\/multas$/)
    expect(body.get('login_cpf')).toBe('12345678900')
    expect(body.get('login_senha')).toBe('Senha#Teste1')
    expect(body.get('renavam')).toBe('01357806202')
    expect(body.get('chassi')).toBe('')
    expect(body.has('placa')).toBe(false)
    expect(body.has('pkcs12_cert')).toBe(false)
    expect(sb.inserts[0]).toMatchObject({ fonte: 'infosimples_detran_ba', preco: 0.3, code: 200 })
    expect(JSON.stringify(sb.updates[0])).not.toContain('FULANO DONO')
  })

  it('608 (senha recusada) trava o BA: a proxima venda NAO tenta de novo', async () => {
    const f = vi.fn(async () => ({ status: 200, json: async () => ({ code: 608, code_message: 'Usuário e/ou senha inválidos (ERL0002000)', header: { price: 0 } }) }))
    vi.stubGlobal('fetch', f)
    const r1 = await completarDetran(fakeSb(), { id: 'p1', placa: 'SIP4I06' }, { response: RESP })
    expect(r1).toMatchObject({ ok: false, code: 608 })
    expect(loginBaTravado()).toBeTruthy()
    const sb2 = fakeSb()
    const r2 = await completarDetran(sb2, { id: 'p2', placa: 'RPJ6D25' }, { response: RESP })
    expect(r2).toMatchObject({ ok: false, pulado: 'login gov.br travado (608)' })
    expect(f).toHaveBeenCalledTimes(1)
    expect(sb2.inserts).toHaveLength(0)
  })

  it('sem CPF/senha no ambiente: nao chama', async () => {
    delete process.env.NUXT_INFOSIMPLES_BA_SENHA
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    const r = await completarDetran(fakeSb(), { id: 'p1', placa: 'SIP4I06' }, { response: RESP })
    expect(r).toMatchObject({ ok: false, pulado: 'infosimples nao configurado (govbr_ba)' })
    expect(f).not.toHaveBeenCalled()
  })

  it('sem RENAINF: nao chama (gate)', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    const r = await completarDetran(fakeSb(), { id: 'p1', placa: 'SIP4I06' }, { response: [{ ufJurisdicao: 'BA', renavam: '1' }] })
    expect(r).toMatchObject({ ok: false, pulado: 'BA so com RENAINF' })
    expect(f).not.toHaveBeenCalled()
  })
})
