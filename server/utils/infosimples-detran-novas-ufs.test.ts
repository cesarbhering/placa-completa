import { describe, it, expect, vi, afterEach } from 'vitest'
import MA from './__fixtures__/infosimples-detran-ma.json'
import AC from './__fixtures__/infosimples-detran-ac.json'
import { blocoDetranDaUf, completarDetran, DETRAN_UFS, estruturaChaves } from './infosimples-detran'

// 06/out: MA e AC testados com veiculo real (sem multa); AL, PI e RR pela doc.
const multa = (extra: any = {}) => ({ descricao: 'AVANCAR SINAL', data_infracao: '01/02/2026', local: 'AV TESTE', orgao_autuador: 'DETRAN', valor: 'R$ 293,47', normalizado_valor: 293.47, ...extra })

describe('novas UFs: mapa', () => {
  it('MA/AL/PI/RR sem credencial; AC com o login gov.br; todas com gate renainf', () => {
    expect(DETRAN_UFS.MA).toMatchObject({ path: 'detran/ma/multas', cert: 'nenhum', gate: 'renainf' })
    expect(DETRAN_UFS.AC).toMatchObject({ path: 'detran/ac/veiculo', cert: 'govbr_ac', gate: 'renainf' })
    expect(DETRAN_UFS.AL.path).toBe('detran/al/infracoes')
    expect(DETRAN_UFS.PI.path).toBe('detran/pi/multas')
    expect(DETRAN_UFS.RR.path).toBe('detran/rr/debitos')
  })
})

describe('MA', () => {
  it('resposta real sem multa: zero, e nada do proprietario (SNG/impedimentos) entra', () => {
    const b: any = blocoDetranDaUf('MA', MA)
    expect(b).toMatchObject({ status: 'ok', fonte: 'detran_ma', multas_total_centavos: 0, multas_itens: [], autuacoes_em_andamento: 0 })
    expect(JSON.stringify(b)).not.toMatch(/FULANO|alienac|impediment|dados_veiculo/i)
  })
  it('penalidade em aberto vira multa; linha "Nenhuma..." nao', () => {
    const b: any = blocoDetranDaUf('MA', { ...MA, penalidades: { listagem: [multa()] }, infracoes_atuacao: { listagem: [multa(), multa()] } })
    expect(b.multas_itens).toHaveLength(1)
    expect(b.multas_total_centavos).toBe(29347)
    expect(b.autuacoes_em_andamento).toBe(2)
  })
})

describe('AC', () => {
  it('resposta real sem multa (infracoes null): zero, restricao do cadastro entra', () => {
    const b: any = blocoDetranDaUf('AC', AC)
    expect(b).toMatchObject({ status: 'ok', fonte: 'detran_ac', multas_total_centavos: 0, alerta_roubo_furto: null, ultimo_licenciamento_ano: 2026 })
    expect(b.restricoes_detran).toEqual([{ tipo: 'restricao', texto: 'ALIENACAO FIDUCIARIA' }])
  })
  it('vencidas + a vencer somam; sub_judice vai pra recurso; roubo/furto alerta', () => {
    const b: any = blocoDetranDaUf('AC', { ...AC, roubo_furto: 'CONSTA', infracoes: { vencidas: [multa()], a_vencer: [multa({ normalizado_valor: 100 })], sub_judice: [multa()], notificacao_autuacao: [multa()] } })
    expect(b.multas_total_centavos).toBe(39347)
    expect(b.multas_em_recurso).toHaveLength(1)
    expect(b.autuacoes_em_andamento).toBe(1)
    expect(b.alerta_roubo_furto).toMatch(/DETRAN-AC/)
  })
})

describe('AL, PI, RR (pela doc)', () => {
  it('AL: infracoes + normalizado_total', () => {
    const b: any = blocoDetranDaUf('AL', { infracoes: [multa({ datahora: '01/02/2026 10:30', autuador: 'DETRAN-AL', infracao_numero: 'A1' })], normalizado_total: 293.47 })
    expect(b.multas_total_centavos).toBe(29347)
    expect(b.multas_itens[0]).toMatchObject({ auto: 'A1', orgao: 'DETRAN' })
  })
  it('PI: multa paga nao entra', () => {
    const b: any = blocoDetranDaUf('PI', { multas: [multa({ status: 'Em aberto' }), multa({ status: 'Paga' })] })
    expect(b.multas_itens).toHaveLength(1)
  })
  it('RR: detalhes_infracoes + valor_normalizado', () => {
    const b: any = blocoDetranDaUf('RR', { infracoes: { detalhes_infracoes: [multa()], valor_normalizado: 293.47 }, roubo_furto: 'NADA CONSTA' })
    expect(b.multas_total_centavos).toBe(29347)
    expect(b.alerta_roubo_furto).toBeNull()
  })
  it('formato desconhecido devolve null (nada inventado)', () => {
    for (const uf of ['MA', 'AC', 'AL', 'PI', 'RR'] as const) expect(blocoDetranDaUf(uf, { outra_coisa: 1 })).toBeFalsy()
  })
})

describe('formato desconhecido no fluxo', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
  it('marca indisponivel e loga so as chaves', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't' }))
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, json: async () => ({ code: 200, header: { price: 0.24 }, data: [{ resultado: { nome: 'FULANO', valor: 10 } }] }) })))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const updates: any[] = []
    const sb = { from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: {} } } }) }) }),
      insert: async () => ({ error: null }),
      update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
    }) }
    const r = await completarDetran(sb, { id: 'abcdef12-0', placa: 'NHX1A11' }, { response: [{ ufJurisdicao: 'AL', renavam: '123', indicadorMultaRenainf: true }] })
    expect(r).toMatchObject({ ok: false, motivo: 'formato desconhecido' })
    expect(updates.at(-1).relatorio_snapshot.multas).toEqual({ status: 'indisponivel', uf: 'AL' })
    const linha = warn.mock.calls.map((c) => String(c[0])).find((l) => l.includes('formato-desconhecido'))!
    expect(linha).toContain('"resultado":{"nome":"string","valor":"number"}')
    expect(linha).not.toContain('FULANO')
  })
  it('estruturaChaves nao leva valores', () => {
    expect(estruturaChaves({ a: 'x', b: [{ c: 1 }], d: null })).toEqual({ a: 'string', b: [{ c: 'number' }], d: 'object' })
  })
})
