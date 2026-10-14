// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import VEIC from './__fixtures__/infosimples-detran-al-veiculo.json'
import SEFAZ from './__fixtures__/infosimples-sefaz-al-ipva.json'
import { parsearVeiculoAl, parsearIpvaSefazAl, completarDetran, DETRAN_UFS } from './infosimples-detran'
import { _resetarEmVoo, quantasEmVoo } from './tarefas-em-voo'

// Respostas REAIS do ORK8004 (AL, 14/out) saneadas: nome, placa, renavam e recibo trocados.
const HOJE = new Date('2026-10-14T12:00:00-03:00')

describe('AL /veiculo (complemento)', () => {
  const c: any = parsearVeiculoAl(VEIC, HOJE)
  it('licenciamento por ano 2021-2026 (R$ 1.549,94); ultimo licenciado 2020; atrasado', () => {
    expect(c.licenciamento_centavos).toBe(154994)
    expect(c.licenciamento_exercicios.map((x: any) => x.ano)).toEqual([2021, 2022, 2023, 2024, 2025, 2026])
    expect(c.ultimo_licenciamento_ano).toBe(2020)
    expect(c.licenciamento_atrasado_ano).toBe(2020)
  })
  it('total de infracoes (reserva), IPVA apontado sem valor, sem restricao, sem roubo', () => {
    expect(c.multas_reserva_centavos).toBe(25780)
    expect(c.ipva_pendente).toBe(true)
    expect(c.ipva_total_centavos).toBeNull()
    expect(c.restricoes_detran).toEqual([])
    expect(c.alerta_roubo_furto).toBeNull()
    expect(JSON.stringify(c)).not.toContain('FULANO')
  })
  it('restricao de venda, comunicacao de venda e roubo viram restricao/alerta', () => {
    const x: any = parsearVeiculoAl({ debitos: { debitos_anuais: [], debitos_eventuais: {} }, informacoes_gerais: { restricao_venda: 'COM RESERVA DE DOMINIO', comunicacao_de_venda: 'SIM', roubo_furto: 'SIM' } }, HOJE)
    expect(x.restricoes_detran).toEqual([{ tipo: 'financeira', texto: 'COM RESERVA DE DOMINIO' }, { tipo: 'cadastro', texto: 'Comunicação de venda registrada no DETRAN-AL' }])
    expect(x.alerta_roubo_furto).toBe('Restrição informada pelo DETRAN-AL: roubo/furto')
    expect(x.licenciamento_atrasado_ano).toBeNull()
  })
})

describe('SEFAZ-AL /ipva', () => {
  it('parcela unica 2026 com multa e juros: R$ 2.912,63', () => {
    expect(parsearIpvaSefazAl(SEFAZ)).toEqual([{ ano: 2026, vencimento: '14/10/2026', valor_centavos: 291263 }])
  })
  it('so pagamento (nada em parcelamento): sem IPVA em aberto', () => {
    expect(parsearIpvaSefazAl([{ exercicio: '2026', parcelamento: [], pagamento: [{ valor_recolhido: '1.000,00' }] }])).toEqual([])
  })
})

describe('AL: fluxo completo', () => {
  afterEach(() => { vi.unstubAllGlobals(); _resetarEmVoo() })
  function sbFalso() {
    let snap: any = { consulta: {} }
    const custos: any[] = []
    const sb = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: snap } }) }) }),
        insert: async (row: any) => { custos.push(row); return { error: null } },
        update: (row: any) => ({ eq: async () => { snap = row.relatorio_snapshot; return { error: null } } }),
      }),
    }
    return { sb, custos, snap: () => snap }
  }
  const resp = [{ ufJurisdicao: 'AL', renavam: '1054663081' }]
  const respostas = (infracoes: any) => vi.fn(async (url: string) => {
    if (url.endsWith('/detran/al/infracoes')) return { status: 200, json: async () => infracoes }
    if (url.endsWith('/detran/al/veiculo')) return { status: 200, json: async () => ({ code: 200, header: { price: '0.24' }, data: [VEIC] }) }
    if (url.endsWith('/sefaz/al/ipva')) return { status: 200, json: async () => ({ code: 200, header: { price: '0.26' }, data: SEFAZ }) }
    throw new Error('url inesperada ' + url)
  })

  it('/infracoes ok: multas com detalhe + /veiculo; SEFAZ entra depois, solta', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't' }))
    const f = respostas({ code: 200, header: { price: '0.24' }, data: [{ infracoes: [{ auto: 'S007653952', descricao: 'TRANSITAR EM VELOC', valor: 'R$ 257,80', data: '20/03/2018' }], normalizado_total: 257.8 }] })
    vi.stubGlobal('fetch', f)
    const { sb, custos, snap } = sbFalso()
    const r = await completarDetran(sb, { id: 'p', placa: 'ORK8004' }, { response: resp })
    expect(r.ok).toBe(true)
    // gravado ANTES da SEFAZ: IPVA pendente
    await vi.waitFor(() => expect(quantasEmVoo()).toBe(0))
    const m = snap().multas
    expect(m).toMatchObject({ fonte: 'detran_al', multas_total_centavos: 25780, licenciamento_centavos: 154994, ultimo_licenciamento_ano: 2020, ipva_total_centavos: 291263, ipva_fonte: 'sefaz_al' })
    expect(m.ipva_pendente_sefaz).toBeUndefined()
    expect(m.multas_itens).toHaveLength(1)
    expect(custos.map((c) => [c.fonte, c.preco])).toEqual([['infosimples_detran_al', 0.24], ['infosimples_detran_al_veiculo', 0.24], ['infosimples_sefaz_al_ipva', 0.26]])
    const sefazCall = (f.mock.calls as any[]).find((c) => String(c[0]).endsWith('/sefaz/al/ipva'))
    expect(sefazCall[1].body.get('timeout')).toBe('300')
  })

  it('/infracoes com 609: reserva pelo /veiculo (total sem detalhe), nao fica indisponivel', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't' }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', respostas({ code: 609, code_message: 'Tentativas excedidas', header: { price: '0.0' } }))
    const { sb, snap } = sbFalso()
    const r = await completarDetran(sb, { id: 'p', placa: 'ORK8004' }, { response: resp, semRetry: true })
    expect(r.ok).toBe(true)
    await vi.waitFor(() => expect(quantasEmVoo()).toBe(0))
    expect(snap().multas).toMatchObject({ status: 'ok', fonte: 'detran_al', multas_sem_detalhe: true, multas_total_centavos: 25780, multas_itens: [], licenciamento_atrasado_ano: 2020, ipva_total_centavos: 291263 })
  })

  it('mapa do AL', () => {
    expect(DETRAN_UFS.AL).toMatchObject({ path: 'detran/al/infracoes', complemento: { path: 'detran/al/veiculo' }, reservaPeloComplemento: true, ipvaSefaz: { path: 'sefaz/al/ipva', timeoutS: 300 } })
  })
})
