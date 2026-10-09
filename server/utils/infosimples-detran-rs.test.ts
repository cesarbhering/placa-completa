import { describe, it, expect, vi, afterEach } from 'vitest'
import RS from './__fixtures__/infosimples-detran-rs.json'
import { parsearDetranRs, blocoDetranDaUf, completarDetran, DETRAN_UFS } from './infosimples-detran'

// Fixture = resposta REAL do /detran/rs/infracoes (IWC7G10, code 200) com os
// links temporarios trocados por URLs falsas.
describe('parsearDetranRs', () => {
  const b = parsearDetranRs(RS)
  it('nunca grava notificacao/guia/site_receipt', () => {
    const out = JSON.stringify(b)
    for (const p of ['storage.invalid', 'notificacao_autuacao_url', 'guia_pagamento_url', 'site_receipt']) expect(out).not.toContain(p)
  })
  it('bloco so com as chaves da whitelist', () => {
    expect(Object.keys(b).sort()).toEqual([
      'fonte', 'hodometro', 'hodometro_suspeito', 'ipva_total_centavos',
      'licenciamento_atrasado_ano', 'licenciamento_centavos', 'multas_itens', 'multas_total_centavos',
      'restricoes_detran', 'status',
    ])
  })
  it('em aberto = situacao diferente de Paga; pagas descartadas', () => {
    expect(b.fonte).toBe('detran_rs')
    // 'Vencida em 10/10/2025' entra; 'Paga' e a linha sem situacao/valor ficam so no historico.
    expect(b.multas_itens).toHaveLength(1)
    expect(b.multas_itens[0]).toMatchObject({ dataInfracao: '20/05/2025', horaInfracao: '01:53', dataVencimento: '10/10/2025', valor: 195.23 })
    expect(b.historico_infracoes).toBeUndefined()
    expect(b.multas_total_centavos).toBe(Math.round(b.multas_itens.reduce((a, i) => a + i.valor, 0) * 100))
  })
  it('situacao vazia COM valor conta como em aberto', () => {
    const x = parsearDetranRs({ infracoes: [{ valor_normalizado: 130.16, serie: 'X1' }] })
    expect(x.multas_itens).toHaveLength(1)
  })
  it('mapa: RS e-CNPJ, gate RENAINF, custo proprio', () => {
    expect(DETRAN_UFS.RS).toMatchObject({ path: 'detran/rs/infracoes', cert: 'ecnpj', gate: 'renainf', fonteCusto: 'infosimples_detran_rs' })
    expect(blocoDetranDaUf('RS', RS).fonte).toBe('detran_rs')
  })
})

describe('completarDetran RS', () => {
  afterEach(() => { vi.unstubAllGlobals() })
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
  it('chama /detran/rs/infracoes com placa+renavam+cert, grava custo RS', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p' }))
    const chamadas: { url: string; body: URLSearchParams }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => { chamadas.push({ url, body: init.body }); return { status: 200, json: async () => ({ code: 200, header: { price: 0.28 }, data: [RS] }) } }))
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p1', placa: 'IWC7G10' }, { response: [{ ufJurisdicao: 'RS', renavam: '1028182462', indicadorMultaRenainf: true }] })
    expect(r.ok).toBe(true)
    expect(chamadas[0].url).toMatch(/\/detran\/rs\/infracoes$/)
    expect(chamadas[0].body.get('placa')).toBe('IWC7G10')
    expect(chamadas[0].body.get('renavam')).toBe('01028182462')
    expect(chamadas[0].body.has('pkcs12_cert')).toBe(true)
    expect(sb.inserts[0]).toMatchObject({ fonte: 'infosimples_detran_rs', preco: 0.28, code: 200 })
    expect(JSON.stringify(sb.updates[0])).not.toContain('storage.invalid')
  })
  it('sem RENAINF nao chama', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p' }))
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    const r = await completarDetran(fakeSb(), { id: 'p1', placa: 'IWC7G10' }, { response: [{ ufJurisdicao: 'RS', renavam: '1' }] })
    expect(r).toMatchObject({ ok: false, pulado: 'RS so com RENAINF ou restricao' })
    expect(f).not.toHaveBeenCalled()
  })
})
