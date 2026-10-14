import { describe, it, expect, vi, afterEach } from 'vitest'
import MG from './__fixtures__/infosimples-detran-mg.json'
import { parsearDetranMg, blocoDetranDaUf, ufDetranSuportada, chassiDaResposta, completarDetran } from './infosimples-detran'

// Fixture = resposta REAL do /detran/mg/multas-descritivos (QNA3903, code 200),
// com os links temporarios do Infosimples trocados por URLs falsas.
const HOJE = new Date('2026-09-29T12:00:00-03:00')

describe('parsearDetranMg', () => {
  const b = parsearDetranMg(MG, HOJE)

  it('nunca grava html_url, impedimentos_e_restricoes_url nem site_receipt', () => {
    const out = JSON.stringify(b)
    expect(out).not.toContain('storage.invalid')
    expect(out).not.toContain('html_url')
    expect(out).not.toContain('site_receipt')
  })

  it('bloco so com as chaves da whitelist', () => {
    expect(Object.keys(b).sort()).toEqual([
      'alerta_roubo_furto', 'autuacoes_em_andamento', 'fonte', 'hodometro', 'hodometro_suspeito',
      'ipva_pago_ano', 'ipva_total_centavos', 'licenciamento_atrasado_ano', 'licenciamento_centavos', 'licenciamento_em',
      'multas_itens', 'multas_total_centavos', 'restricoes_detran', 'status', 'ultimo_licenciamento_ano',
    ])
  })

  it('multas: 2 exigiveis, total, AIT, orgao sem espacos duplos', () => {
    expect(b.fonte).toBe('detran_mg')
    expect(b.multas_itens).toHaveLength(2)
    expect(b.multas_itens[0]).toMatchObject({ dataInfracao: '09/04/2024', horaInfracao: '11:07', valor: 130.16, orgao: 'DER SP', municipio: null })
    expect(b.multas_total_centavos).toBe(Math.round(b.multas_itens.reduce((a, i) => a + i.valor, 0) * 100))
  })

  it('ROUBO/FURTO nos impedimentos vira alerta com texto da fonte, fora da lista de restricoes', () => {
    expect(b.alerta_roubo_furto).toBe('Restrição informada pelo DETRAN-MG: roubo/furto')
    expect(b.restricoes_detran.find((r) => /roubo|furto/i.test(r.texto))).toBeUndefined()
  })

  it('licenciamento 2024 em 2026 => atrasado; IPVA so com o ano pago; sem valores', () => {
    expect(b.ultimo_licenciamento_ano).toBe(2024)
    expect(b.licenciamento_atrasado_ano).toBe(2024)
    expect(b.ipva_pago_ano).toBe(2024)
    expect(b.ipva_total_centavos).toBeNull()
    expect(b.licenciamento_centavos).toBeNull()
  })

  it('licenciamento do ano anterior nao e atrasado', () => {
    expect(parsearDetranMg({ ...MG, situacao_licenciamento: 'VEICULO LICENCIADO PARA O ANO 2025' }, HOJE).licenciamento_atrasado_ano).toBeNull()
  })

  it('sem impedimento: sem alerta', () => {
    expect(parsearDetranMg({ ...MG, impedimentos_e_restricoes: '' }, HOJE).alerta_roubo_furto).toBeNull()
  })

  it('gate MG e parser da UF', () => {
    expect(ufDetranSuportada('mg')).toBe('MG')
    expect(blocoDetranDaUf('MG', MG).fonte).toBe('detran_mg')
    expect(chassiDaResposta([{ chassi: '9bwag45uxjt036030' }])).toBe('9BWAG45UXJT036030')
    expect(chassiDaResposta([{ chassi: '' }])).toBeNull()
  })
})

describe('completarDetran MG', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  const cfg = () => vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p' }))
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

  it('sem chassi no SENATRAN: nao chama nem cobra', async () => {
    cfg()
    const fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy)
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p1', placa: 'QNA3903' }, { response: [{ ufJurisdicao: 'MG', renavam: '01129294215', indicadorMultaRenainf: true }] })
    expect(r).toMatchObject({ ok: false, pulado: 'sem chassi' })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(sb.inserts).toHaveLength(0)
  })

  it('manda o chassi no endpoint MG, grava custo MG e o snapshot sem links temporarios', async () => {
    cfg()
    const chamadas: { url: string; body: URLSearchParams }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      chamadas.push({ url, body: init.body })
      return { status: 200, json: async () => ({ code: 200, header: { price: '0.28' }, data: [MG] }) }
    }))
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p1', placa: 'QNA3903' }, { response: [{ ufJurisdicao: 'MG', renavam: '01129294215', chassi: '9BWAG45UXJT036030', indicadorMultaRenainf: true }] })
    expect(r.ok).toBe(true)
    expect(chamadas[0].url).toMatch(/\/detran\/mg\/multas-descritivos$/)
    expect(chamadas[0].body.get('chassi')).toBe('9BWAG45UXJT036030')
    expect(sb.inserts[0]).toMatchObject({ pedido_id: 'p1', fonte: 'infosimples_detran_mg', preco: 0.28, code: 200 })
    expect(JSON.stringify(sb.updates[0])).not.toContain('storage.invalid')
    expect(sb.updates[0].relatorio_snapshot.multas.alerta_roubo_furto).toBeTruthy()
  })
})
