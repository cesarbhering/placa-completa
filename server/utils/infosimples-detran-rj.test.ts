import { describe, it, expect, vi, afterEach } from 'vitest'
import RJ from './__fixtures__/infosimples-detran-rj-restricoes.json'
import { parsearDetranRj, blocoDetranDaUf, completarDetran, DETRAN_UFS, AVISO_DEBITOS_RJ } from './infosimples-detran'
import { resumoQuitar } from '../../shared/detran-quitar'

// Fixture = resposta REAL da "DETRAN / Restricoes (Unificada)" com uf=RJ
// (LMI1G50, 21/out/2026, R$0,24, ~260 s), placa/chassi/recibo trocados.
afterEach(() => { vi.unstubAllGlobals() })

describe('DETRAN-RJ (so restricoes)', () => {
  const b: any = blocoDetranDaUf('RJ', RJ.data[0])

  it('config: consulta unificada com uf=RJ, sem credencial, exige chassi, timeout longo', () => {
    expect(DETRAN_UFS.RJ).toMatchObject({ path: 'detran/restricoes', cert: 'nenhum', exigeChassi: true, timeoutS: 300, paramsExtra: { uf: 'RJ' }, fonteCusto: 'infosimples_detran_rj_restricoes' })
  })

  it('restricao vira restricoes_detran; multas, IPVA e licenciamento indisponiveis (null, nao zero)', () => {
    expect(b).toMatchObject({ status: 'ok', fonte: 'detran_rj', multas_itens: [], multas_total_centavos: null, ipva_total_centavos: null, licenciamento_centavos: null, debitos_indisponiveis: true, aviso_debitos: AVISO_DEBITOS_RJ })
    expect(b.restricoes_detran).toEqual([{ tipo: 'restricao', texto: 'EXISTE INTENCAO/COMUNICACAO DE VENDA' }])
    expect(AVISO_DEBITOS_RJ).toBe('Multas e IPVA do RJ não estão disponíveis: o estado exige o documento do proprietário para essa consulta.')
    expect(AVISO_DEBITOS_RJ).not.toMatch(/—|senatran/i)
  })

  it('whitelist: nada de recibo, chassi, placa nem renavam no bloco', () => {
    const s = JSON.stringify(b)
    expect(s).not.toMatch(/storage\.invalid|site_receipt|9XXAA00000X000001|ABC1D23/)
  })

  it('sem restricao: lista vazia; roubo vira alerta; formato estranho = null', () => {
    expect(parsearDetranRj({ existe_restricao: false, restricoes: [] })?.restricoes_detran).toEqual([])
    expect(parsearDetranRj({ restricoes: ['NADA CONSTA'] })?.restricoes_detran).toEqual([])
    expect(parsearDetranRj({ restricoes: ['ROUBO/FURTO'] })?.alerta_roubo_furto).toBe('Restrição informada pelo DETRAN-RJ: roubo/furto')
    expect(parsearDetranRj({ outra: 1 })).toBeNull()
  })

  it('resumo: nunca "nada a quitar" no RJ; mostra o aviso', () => {
    const r = resumoQuitar({ bloco: { ...b, uf: 'RJ' } })
    expect(r.nadaAQuitar).toBeNull()
    expect(r.avisoDebitos).toBe(AVISO_DEBITOS_RJ)
    expect(resumoQuitar({ bloco: { fonte: 'detran_ce', multas_total_centavos: 0 } }).avisoDebitos).toBeNull()
  })

  it('completarDetran RJ: manda uf, placa, renavam e chassi para detran/restricoes, grava custo e bloco', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't' }))
    const chamadas: { url: string; body: URLSearchParams }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => { chamadas.push({ url, body: init.body }); return { status: 200, json: async () => RJ } }))
    const inserts: any[] = []; const updates: any[] = []
    const sb: any = { from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }), maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: {} } } }) }) }),
      insert: async (r: any) => { inserts.push(r); return { error: null } },
      upsert: async () => ({ error: null }),
      update: (r: any) => ({ eq: async () => { updates.push(r); return { error: null } } }),
    }) }
    const r = await completarDetran(sb, { id: 'p1', placa: 'ABC1D23' }, { response: [{ ufJurisdicao: 'RJ', renavam: '1078095172', chassi: '9XXAA00000X000001' }] })
    expect(r.ok).toBe(true)
    expect(chamadas[0].url).toMatch(/\/detran\/restricoes$/)
    expect(chamadas[0].body.get('uf')).toBe('RJ')
    expect(chamadas[0].body.get('chassi')).toBe('9XXAA00000X000001')
    expect(chamadas[0].body.get('placa')).toBe('ABC1D23')
    expect(chamadas[0].body.get('pkcs12_cert')).toBeNull()
    expect(inserts.find((i) => i.fonte === 'infosimples_detran_rj_restricoes')).toMatchObject({ preco: 0.24, code: 200 })
    expect(updates[0].relatorio_snapshot.multas).toMatchObject({ status: 'ok', fonte: 'detran_rj', debitos_indisponiveis: true })
  })
})
