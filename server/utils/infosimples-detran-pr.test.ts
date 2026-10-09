import { describe, it, expect, vi, afterEach } from 'vitest'
import { decrypt } from 'aes-bridge'
import PR from './__fixtures__/infosimples-detran-pr.json'
import { parsearDetranPr, blocoDetranDaUf, completarDetran, DETRAN_UFS } from './infosimples-detran'

// Fixture = resposta REAL do /detran/pr/multas-descritivos (renavam do ARX3D99,
// 30/set, code 200, 10 multas pagas) com links, documento de recolhimento e
// site_receipt trocados por valores FALSOS. Aqui data e uma LISTA.

describe('parsearDetranPr', () => {
  const b = parsearDetranPr(PR)
  it('nunca grava html_url, guia, codigo de barras, documento nem site_receipt', () => {
    const out = JSON.stringify(b)
    for (const proibido of ['storage.invalid', 'html_url', 'guia_pagamento', 'codigo_barras', 'numero_documento', 'site_receipt']) expect(out).not.toContain(proibido)
  })
  it('multa-paga e descartada: nao soma, nao aparece, nao conta', () => {
    expect(b.fonte).toBe('detran_pr')
    expect(b.multas_itens).toHaveLength(0)
    expect(b.multas_total_centavos).toBe(0)
    expect(b.historico_infracoes).toBeUndefined()
  })
  it('demais tipos sao em aberto: somam, hora 12h08 -> 12:08, sem codigo na descricao', () => {
    const aberta = { ...PR[0], tipo: 'multa-em-aberto', vencimento: '10/11/2026', data_pagamento: null }
    const x = parsearDetranPr([aberta, ...PR])
    expect(x.multas_itens).toHaveLength(1)
    expect(x.multas_itens[0]).toMatchObject({
      dataInfracao: '06/04/2022', horaInfracao: '12:08', dataVencimento: '10/11/2026',
      valor: 195.23, local: 'PADRE GERMANO MAYER X RUA DO HERVAL', orgao: 'PREFEITURA MUNICIPAL DE CURITIBA',
    })
    expect(x.multas_itens[0].descricao).toMatch(/^Executar operação de conversão/)
    expect(x.multas_total_centavos).toBe(19523)
    expect(x.historico_infracoes).toBeUndefined()
  })
  it('lista vazia (612) = nada consta', () => {
    expect(parsearDetranPr([])).toMatchObject({ multas_total_centavos: 0, multas_itens: [] })
  })
  it('mapa: PR com e-CPF, sem placa, lista e gate RENAINF', () => {
    expect(DETRAN_UFS.PR).toMatchObject({ path: 'detran/pr/multas-descritivos', cert: 'ecpf', gate: 'renainf', fonte: 'detran_pr', fonteCusto: 'infosimples_detran_pr', semPlaca: true, dataLista: true })
    expect(blocoDetranDaUf('PR', PR).fonte).toBe('detran_pr')
  })
})

describe('completarDetran PR (e-CPF)', () => {
  const KEY = 'k'.repeat(32)
  const RESP = [{ ufJurisdicao: 'PR', renavam: '465532470', indicadorMultaRenainf: true }]
  function fakeSb(multas?: any) {
    const inserts: any[] = []; const updates: any[] = []
    return {
      inserts, updates,
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: {}, ...(multas ? { multas } : {}) } } }) }) }),
        insert: async (row: any) => { inserts.push(row); return { error: null } },
        update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
      }),
    }
  }
  const cfg = () => vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't', infosimplesEncKey: KEY, infosimplesPkcs12B64: 'ECNPJ-PFX', infosimplesPkcs12Pass: 'ecnpj-pass' }))
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.NUXT_INFOSIMPLES_ECPF_PKCS12_B64
    delete process.env.NUXT_INFOSIMPLES_ECPF_PKCS12_PASS
  })

  it('manda o e-CPF (nao o e-CNPJ) criptografado, so renavam, sem placa; grava custo e o bloco', async () => {
    cfg()
    process.env.NUXT_INFOSIMPLES_ECPF_PKCS12_B64 = 'ECPF-PFX'
    process.env.NUXT_INFOSIMPLES_ECPF_PKCS12_PASS = 'ecpf-pass'
    const chamadas: { url: string; body: URLSearchParams }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      chamadas.push({ url, body: init.body })
      return { status: 200, json: async () => ({ code: 200, header: { price: '0.24' }, data: PR }) }
    }))
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p1', placa: 'ARX3D99' }, { response: RESP })
    expect(r.ok).toBe(true)
    expect(chamadas[0].url).toMatch(/\/detran\/pr\/multas-descritivos$/)
    const volta = async (v: string) => new TextDecoder().decode(await decrypt(v.replace(/-/g, '+').replace(/_/g, '/'), KEY))
    expect(await volta(chamadas[0].body.get('pkcs12_cert')!)).toBe('ECPF-PFX')
    expect(await volta(chamadas[0].body.get('pkcs12_pass')!)).toBe('ecpf-pass')
    expect(chamadas[0].body.get('renavam')).toBe('00465532470')
    expect(chamadas[0].body.has('placa')).toBe(false)
    expect(sb.inserts[0]).toMatchObject({ pedido_id: 'p1', fonte: 'infosimples_detran_pr', preco: 0.24, code: 200 })
    const multas = sb.updates[0].relatorio_snapshot.multas
    expect(multas).toMatchObject({ fonte: 'detran_pr', multas_total_centavos: 0})
    expect(JSON.stringify(multas)).not.toContain('storage.invalid')
  })

  it('612 (sem dados) = nada consta, com custo', async () => {
    cfg()
    process.env.NUXT_INFOSIMPLES_ECPF_PKCS12_B64 = 'ECPF-PFX'
    process.env.NUXT_INFOSIMPLES_ECPF_PKCS12_PASS = 'ecpf-pass'
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, json: async () => ({ code: 612, header: { price: '0.24' } }) })))
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p1', placa: 'ARX3D99' }, { response: RESP })
    expect(r).toMatchObject({ ok: true, multasCentavos: 0, temAlgo: false })
    expect(sb.inserts[0]).toMatchObject({ fonte: 'infosimples_detran_pr', code: 200 })
  })

  it('sem o e-CPF no ambiente: NAO chama, sem custo, marca o bloco como indisponivel', async () => {
    cfg()
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p1', placa: 'ARX3D99' }, { response: RESP })
    expect(r).toMatchObject({ ok: false, pulado: 'infosimples nao configurado (ecpf)' })
    expect(f).not.toHaveBeenCalled()
    expect(sb.inserts).toHaveLength(0)
    expect(sb.updates[0].relatorio_snapshot.multas).toEqual({ status: 'indisponivel', uf: 'PR' })
  })

  it('indisponivel nunca pisa num bloco pronto', async () => {
    cfg()
    vi.stubGlobal('fetch', vi.fn())
    const sb = fakeSb({ status: 'ok', fonte: 'detran_pr' })
    await completarDetran(sb, { id: 'p1', placa: 'ARX3D99' }, { response: RESP })
    expect(sb.updates).toHaveLength(0)
  })

  it('sem RENAINF: nao chama (gate)', async () => {
    cfg()
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    const r = await completarDetran(fakeSb(), { id: 'p1', placa: 'ARX3D99' }, { response: [{ ufJurisdicao: 'PR', renavam: '1' }] })
    expect(r).toMatchObject({ ok: false, pulado: 'PR so com RENAINF ou restricao' })
    expect(f).not.toHaveBeenCalled()
  })
})
