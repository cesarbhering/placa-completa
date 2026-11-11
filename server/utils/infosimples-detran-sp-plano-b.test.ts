import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  completarDetran, dispararPlanoBSp, parsearSefazSp, parsearDerSp, montarBlocoPlanoBSp, PLANO_B_SP,
} from './infosimples-detran'
import { executarJob } from './premium-jobs'
import { procedenciaDebitos, resumoQuitar, NOTA_PLANO_B_SP } from '../../shared/detran-quitar'
import { ufRenainfForaDoDetran } from '../../shared/renainf-detran'

// Plano B do DETRAN-SP (SEFAZ-SP + DER-SP). Fixtures SINTETICAS, no formato
// das respostas reais do Infosimples (placa, renavam e valores inventados).

const cfg = () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'UEZY', infosimplesPkcs12Pass: 'p' })
const RESP_SP = [{ ufJurisdicao: 'SP', renavam: '12345678901', indicadorMultaRenainf: true }]
const PLACA = 'TST1A23'

const DETRAN_608 = { code: 608, code_message: 'Os parâmetros foram recusados pelo site ou aplicativo de origem que processou esta consulta.', errors: ['O serviço não está disponível para este veículo.'], header: { price: '0.28' }, data: [] }
const SEFAZ_618 = { code: 618, code_message: 'O site ou aplicativo de origem está sobrecarregado. Tente novamente em alguns instantes.', errors: [], header: { price: '0.0' }, data: [] }
const DER_612 = { code: 612, code_message: 'A consulta não retornou dados no site ou aplicativo de origem no qual a automação foi executada.', errors: ['Não existem autuações e penalidades cadastradas até esta data para o renavam 12345678901'], header: { price: '0.28' }, data: [] }

const SEFAZ_DATA = {
  ano_fabricacao: 2019,
  comunicacao_venda: { comprador: 'NOME FICTICIO' },
  ipva: { competencia: 2026, saldo_devido: 1500.5, normalizado_saldo_devido: 1500.5, valor: 1500.5 },
  ipva_divida_ativa: true,
  ipva_inscritos: [{ exercicio: '2023', valor: '1.200,00', normalizado_valor: 1200, numero_inscricao: '999' }],
  ipva_nao_inscritos: [{ exercicio: '2025', valor: '1.400,00', normalizado_valor: 1400 }],
  licenciamentos: [{ exercicio: '2025', valor: '160,00', normalizado_valor: 160 }, { exercicio: '2024', valor: '0,00', normalizado_valor: 0 }],
  multas: { valor: '391,08', normalizado_valor: 391.08, lista: [
    { auto_infracao: 'A1B2C3', descricao: 'TRANSITAR EM VELOCIDADE SUPERIOR', data_infracao: '10/03/2026', valor: '130,16', normalizado_valor: 130.16, orgao: 'DER' },
    { auto_infracao: 'Z9Y8X7', descricao: 'ESTACIONAR EM LOCAL PROIBIDO', data_infracao: '02/02/2026', valor: '260,92', normalizado_valor: 260.92 },
  ] },
  placa: PLACA,
  renavam: '12345678901',
  valor_total_debitos: 6051.58,
}
const SEFAZ_200 = { code: 200, code_message: 'ok', errors: [], header: { price: '0.28' }, data: [SEFAZ_DATA] }
const SEFAZ_ZERADA = { code: 200, code_message: 'ok', errors: [], header: { price: '0.28' }, data: [{
  ipva: { competencia: 2026, saldo_devido: 0, normalizado_saldo_devido: 0 }, ipva_divida_ativa: false,
  ipva_inscritos: [], ipva_nao_inscritos: [], licenciamentos: [], multas: { valor: 0, normalizado_valor: 0, lista: [] },
}] }

const DER_LISTA = [
  { ait: 'A1B2C3', descricao: 'TRANSITAR EM VELOCIDADE SUPERIOR', data_infracao: '10/03/2026', normalizado_valor: 130.16, situacao: 'Em aberto', local_rodovia: 'SP-123', local_km: '45', local_municipio: 'CIDADE FICTICIA', orgao_autuador: { nome: 'DER-SP' }, velocidade_medida: '98' },
  { ait: 'D4E5F6', descricao: 'DEIXAR DE GUARDAR DISTANCIA', data_infracao: '01/04/2026', normalizado_valor: 195.23, situacao: 'Em aberto', local_rodovia: 'SP-321', embarcador: 'EMPRESA X' },
  { ait: 'G7H8I9', descricao: 'AVANCAR SINAL', data_infracao: '01/01/2025', normalizado_valor: 293.47, situacao: 'Paga' },
  { ait: 'J1K2L3', descricao: 'USAR CELULAR', data_infracao: '05/05/2026', situacao: 'Notificada', local_rodovia: 'SP-055' },
]
const DER_200 = { code: 200, code_message: 'ok', errors: [], header: { price: '0.28' }, data: DER_LISTA }

function fakeSb(snap: any = { consulta: {} }, cache: Record<string, any> = {}) {
  const inserts: any[] = []; const updates: any[] = []; const upserts: any[] = []
  return {
    inserts, updates, upserts, cache,
    from: (t: string) => t === 'fonte_cache'
      ? {
          select: () => {
            const f: any = {}
            const q: any = { eq: (k: string, v: string) => { f[k] = v; return q }, maybeSingle: async () => ({ data: cache[`${f.fonte}|${f.chave}`] ?? null }) }
            return q
          },
          upsert: async (row: any) => { upserts.push(row); cache[`${row.fonte}|${row.chave}`] = { ...row, expira_em: new Date(Date.now() + 3600e3).toISOString() }; return { error: null } },
        }
      : {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: updates.at(-1)?.relatorio_snapshot ?? snap } }) }) }),
          insert: async (row: any) => { inserts.push(row); return { error: null } },
          update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
        },
  }
}

/** fetch por servico: cada path devolve a fila de respostas dada (a ultima repete). */
function prepFetch(porPath: Record<string, any[]>) {
  vi.stubGlobal('useRuntimeConfig', cfg)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const chamadas: { path: string; body: URLSearchParams }[] = []
  const spy = vi.fn(async (url: string, init: any) => {
    const path = String(url).replace(/^.*\/consultas\//, '')
    chamadas.push({ path, body: init.body })
    const fila = porPath[path]
    if (!fila) throw new Error('path inesperado: ' + path)
    const body = fila.length > 1 ? fila.shift() : fila[0]
    if (body instanceof Error) throw body
    return { status: 200, json: async () => body }
  })
  vi.stubGlobal('fetch', spy)
  return chamadas
}

describe('dispararPlanoBSp', () => {
  it('6xx de origem dispara; validacao/conta, protegido, 612 e rede nao', () => {
    for (const c of [608, 609, 605, 600, 613, 614, 615, 618]) expect(dispararPlanoBSp(c)).toBe(true)
    for (const c of [200, 612, 620, 601, 603, 604, 606, 607, 0]) expect(dispararPlanoBSp(c)).toBe(false)
  })
  it('ultima tentativa da fila: qualquer erro dispara (menos 200, 612 e protegido)', () => {
    expect(dispararPlanoBSp(0, true)).toBe(true)
    expect(dispararPlanoBSp(607, true)).toBe(true)
    expect(dispararPlanoBSp(620, true)).toBe(false)
    expect(dispararPlanoBSp(612, true)).toBe(false)
  })
})

describe('parsearSefazSp', () => {
  it('IPVA: nao inscrito + divida ativa + saldo do exercicio atual; licenciamento e multas', () => {
    const p = parsearSefazSp(SEFAZ_DATA)
    expect(p.ipva_itens.map((x) => [x.ano, x.valor_centavos])).toEqual([[2026, 150050], [2025, 140000], [2023, 120000]])
    expect(p.ipva_itens.find((x) => x.ano === 2023)).toMatchObject({ divida_ativa: true })
    expect(p.ipva_total_centavos).toBe(410050)
    expect(p.ipva_divida_ativa).toBe(true)
    expect(p.licenciamento_centavos).toBe(16000)
    expect(p.licenciamento_exercicios).toEqual([{ ano: 2025, centavos: 16000 }])
    expect(p.multas_total_centavos).toBe(39108)
    expect(p.multas_itens).toHaveLength(2)
    expect(p.multas_itens[0]).toMatchObject({ auto: 'A1B2C3', valor: 130.16, dataInfracao: '10/03/2026' })
    expect(JSON.stringify(p)).not.toMatch(/NOME FICTICIO|comprador|12345678901/)
  })
  it('saldo do exercicio atual nao duplica quando o ano ja esta nos nao inscritos', () => {
    const p = parsearSefazSp({ ...SEFAZ_DATA, ipva_inscritos: [], ipva_nao_inscritos: [{ exercicio: '2026', normalizado_valor: 1500.5 }] })
    expect(p.ipva_itens).toHaveLength(1)
    expect(p.ipva_total_centavos).toBe(150050)
  })
  it('tudo zerado (formato da resposta real sem debito)', () => {
    const p = parsearSefazSp(SEFAZ_ZERADA.data[0])
    expect(p).toMatchObject({ ipva_total_centavos: 0, licenciamento_centavos: 0, multas_total_centavos: 0, ipva_divida_ativa: false, ipva_itens: [], multas_itens: [] })
  })
})

describe('parsearDerSp', () => {
  it('em aberto com valor vira multa; sem valor vira autuacao; paga sai; whitelist', () => {
    const p = parsearDerSp(DER_LISTA)
    expect(p.multas_itens.map((m) => m.auto)).toEqual(['A1B2C3', 'D4E5F6'])
    expect(p.multas_itens[0]).toMatchObject({ local: 'SP-123, km 45', municipio: 'CIDADE FICTICIA', orgao: 'DER-SP', valor: 130.16 })
    expect(p.multas_itens[1].orgao).toBe('DER-SP')
    expect(p.autuacoes_itens).toHaveLength(1)
    expect(p.autuacoes_itens[0]).toMatchObject({ ait: 'J1K2L3', local: 'SP-055', orgao: 'DER-SP' })
    expect(JSON.stringify(p)).not.toMatch(/EMPRESA X|velocidade|98/)
  })
  it('envelope com a lista dentro e lista vazia', () => {
    expect(parsearDerSp([{ multas: DER_LISTA }]).multas_itens).toHaveLength(2)
    expect(parsearDerSp([])).toEqual({ multas_itens: [], autuacoes_itens: [] })
  })
})

describe('montarBlocoPlanoBSp', () => {
  it('mesmo shape do DETRAN-SP, origem sefaz_der, sem hodometro nem restricoes, multa repetida entra uma vez', () => {
    const b: any = montarBlocoPlanoBSp(parsearSefazSp(SEFAZ_DATA), parsearDerSp(DER_LISTA))
    expect(b).toMatchObject({ status: 'ok', fonte: 'detran_sp', uf: 'SP', origem: 'sefaz_der', ipva_total_centavos: 410050, licenciamento_centavos: 16000, ipva_divida_ativa: true, autuacoes_em_andamento: 1 })
    // SEFAZ 391,08 + so a multa do DER que a SEFAZ nao lista (D4E5F6, 195,23)
    expect(b.multas_total_centavos).toBe(39108 + 19523)
    expect(b.multas_itens.map((m: any) => m.auto)).toEqual(['A1B2C3', 'Z9Y8X7', 'D4E5F6'])
    expect(b).not.toHaveProperty('hodometro')
    expect(b).not.toHaveProperty('restricoes_detran')
    expect(b).not.toHaveProperty('hodometro_suspeito')
  })
})

describe('completarDetran SP: plano B', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('DETRAN 608 -> SEFAZ 200 + DER 612: bloco ok sefaz_der, 3 custos, sem cache do bloco do DETRAN', async () => {
    const ch = prepFetch({ 'detran/sp/debitos': [DETRAN_608], 'sefaz/sp/debitos-veiculo': [SEFAZ_200], 'der/sp/multas': [DER_612] })
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p1', placa: PLACA }, { response: RESP_SP })
    expect(r).toMatchObject({ ok: true })
    const m = sb.updates.at(-1).relatorio_snapshot.multas
    expect(m).toMatchObject({ status: 'ok', fonte: 'detran_sp', origem: 'sefaz_der', multas_total_centavos: 39108, ipva_total_centavos: 410050 })
    expect(m.consultadoEm).toBeTruthy()
    expect(sb.inserts.map((i) => [i.fonte, i.code, i.preco])).toEqual(expect.arrayContaining([
      ['infosimples_detran_sp', 608, 0.28], ['infosimples_sefaz_sp_debitos', 200, 0.28], ['infosimples_der_sp_multas', 200, 0.28], // lista: o 612 volta como 200 vazio
    ]))
    expect(sb.inserts).toHaveLength(3)
    // bruto do custo nunca leva comunicacao_venda
    expect(JSON.stringify(sb.inserts)).not.toMatch(/NOME FICTICIO/)
    expect(sb.upserts.map((u) => u.fonte).sort()).toEqual([PLANO_B_SP.der.cache, PLANO_B_SP.sefaz.cache].sort())
    // Mesmo e-CNPJ do DETRAN-SP; DER so com renavam
    const sef = ch.find((c) => c.path === 'sefaz/sp/debitos-veiculo')!.body
    const der = ch.find((c) => c.path === 'der/sp/multas')!.body
    expect(sef.get('pkcs12_cert')).toBeTruthy()
    expect(sef.get('placa')).toBe(PLACA)
    expect(der.get('pkcs12_cert')).toBeTruthy()
    expect(der.get('placa')).toBeNull()
    expect(der.get('renavam')).toBe('12345678901')
  })

  it('SEFAZ 618: indisponivel (a fila tenta de novo); na retentativa so a SEFAZ paga, o DER vem do cache', async () => {
    prepFetch({ 'detran/sp/debitos': [DETRAN_608], 'sefaz/sp/debitos-veiculo': [SEFAZ_618], 'der/sp/multas': [DER_200] })
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p1', placa: PLACA }, { response: RESP_SP, semRetry: true })
    expect(r).toMatchObject({ ok: false, code: 618 })
    expect(sb.updates.at(-1).relatorio_snapshot.multas).toEqual({ status: 'indisponivel', uf: 'SP' })
    vi.unstubAllGlobals(); vi.restoreAllMocks()
    const ch = prepFetch({ 'detran/sp/debitos': [DETRAN_608], 'sefaz/sp/debitos-veiculo': [SEFAZ_200] })
    const sb2 = fakeSb({ consulta: {}, multas: { status: 'indisponivel', uf: 'SP' } }, sb.cache)
    const r2 = await completarDetran(sb2, { id: 'p1', placa: PLACA }, { response: RESP_SP, semRetry: true })
    expect(r2).toMatchObject({ ok: true })
    expect(ch.map((c) => c.path)).toEqual(['detran/sp/debitos', 'sefaz/sp/debitos-veiculo'])
    expect(sb2.updates.at(-1).relatorio_snapshot.multas.multas_total_centavos).toBe(39108 + 19523)
  })

  it('erro de validacao (607) nao dispara o plano B', async () => {
    const ch = prepFetch({ 'detran/sp/debitos': [{ code: 607, code_message: 'renavam invalido', header: { price: '0.28' } }] })
    const sb = fakeSb()
    await completarDetran(sb, { id: 'p1', placa: PLACA }, { response: RESP_SP })
    expect(ch.map((c) => c.path)).toEqual(['detran/sp/debitos'])
    expect(sb.updates.at(-1).relatorio_snapshot.multas).toEqual({ status: 'indisponivel', uf: 'SP' })
  })

  it('timeout (0) so dispara na ultima tentativa da fila', async () => {
    let ch = prepFetch({ 'detran/sp/debitos': [new Error('The operation was aborted due to timeout')], 'sefaz/sp/debitos-veiculo': [SEFAZ_ZERADA], 'der/sp/multas': [DER_612] })
    await completarDetran(fakeSb(), { id: 'p1', placa: PLACA }, { response: RESP_SP, semRetry: true })
    expect(ch.map((c) => c.path)).toEqual(['detran/sp/debitos'])
    vi.unstubAllGlobals(); vi.restoreAllMocks()
    ch = prepFetch({ 'detran/sp/debitos': [new Error('The operation was aborted due to timeout')], 'sefaz/sp/debitos-veiculo': [SEFAZ_ZERADA], 'der/sp/multas': [DER_612] })
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'p1', placa: PLACA }, { response: RESP_SP, semRetry: true, ultimaTentativa: true })
    expect(r).toMatchObject({ ok: true })
    expect(sb.updates.at(-1).relatorio_snapshot.multas).toMatchObject({ origem: 'sefaz_der', multas_total_centavos: 0, ipva_total_centavos: 0 })
  })

  it('outra UF com 608 nao usa o plano B do SP', async () => {
    vi.stubGlobal('useRuntimeConfig', cfg)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const spy = vi.fn(async () => ({ status: 200, json: async () => DETRAN_608 }))
    vi.stubGlobal('fetch', spy)
    await completarDetran(fakeSb(), { id: 'p1', placa: PLACA }, { response: [{ ufJurisdicao: 'GO', renavam: '1' }], semRetry: true })
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('fila: ultima tentativa', () => {
  const cliente = (snap: any) => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'p', placa: PLACA, plano: 'completa', relatorio_snapshot: snap } }) }) }) }),
  })
  it('passa ultimaTentativa so quando a proxima falha esgota o job', async () => {
    const snap = { consulta: { response: RESP_SP }, multas: { status: 'indisponivel', uf: 'SP' } }
    const detran = vi.fn(async () => ({ ok: false, code: 608, motivo: 'x' }))
    await executarJob(cliente(snap), { id: 'j', pedido_id: 'p', fonte: 'detran', tentativas: 1, max_tentativas: 4 }, { detran: detran as any })
    await executarJob(cliente(snap), { id: 'j', pedido_id: 'p', fonte: 'detran', tentativas: 3, max_tentativas: 4 }, { detran: detran as any })
    expect((detran.mock.calls[0] as any)[2]).toMatchObject({ semRetry: true, ultimaTentativa: false })
    expect((detran.mock.calls[1] as any)[2]).toMatchObject({ semRetry: true, ultimaTentativa: true })
  })
})

describe('tela: bloco do plano B nao cita o DETRAN como fonte', () => {
  const bloco = { status: 'ok', fonte: 'detran_sp', uf: 'SP', origem: 'sefaz_der', multas_total_centavos: 0, ipva_total_centavos: 0, licenciamento_centavos: 0 }
  it('procedencia e nada a quitar', () => {
    expect(procedenciaDebitos({ uf: 'SP', estado: 'ok', origem: 'sefaz_der' })).toBe('Débitos e multas · SEFAZ-SP + DER-SP')
    expect(procedenciaDebitos({ uf: 'SP', estado: 'ok' })).toBe('Débitos e multas · DETRAN-SP')
    expect(resumoQuitar({ bloco, ufVeiculo: 'SP' }).nadaAQuitar).toBe('Nada a quitar na SEFAZ-SP e no DER-SP na data da consulta.')
  })
  it('RENAINF aceso nao vira "No DETRAN-SP: nada consta"', () => {
    expect(ufRenainfForaDoDetran(true, bloco, 'SP')).toBeNull()
    expect(ufRenainfForaDoDetran(true, { ...bloco, origem: undefined }, 'SP')).toBe('SP')
  })
  it('nota sem travessao e sem fornecedor', () => {
    expect(NOTA_PLANO_B_SP).not.toMatch(/—|Infosimples/i)
    expect(NOTA_PLANO_B_SP).toMatch(/Restrições e quilometragem do DETRAN-SP não fazem parte/)
  })
})
