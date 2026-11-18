// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MG from './__fixtures__/infosimples-detran-mg.json'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'
import {
  precisaIpvaSefazMg, ipvaMgAtrasado, documentoDoDonoAtual, parsearIpvaSefazMg, completarIpvaSefazMg,
  completarDetran, DETRAN_UFS, _definirEsperaLockIpvaMg,
} from './infosimples-detran'
import { completarHistoricoVeicular, _limparEmVooHistorico, _limparAlertaTetoHistorico } from './parceiro-historico'
import { cfgHistorico } from './parceiro-historico-env'
import { ttlDaFonte } from './fonte-cache'
import { _resetarEmVoo, quantasEmVoo } from './tarefas-em-voo'

// IPVA in arrears at the DETRAN-MG without a value (Cesar, 18/11/2026): the
// open amount comes from the SEFAZ-MG, asked with the owner's CPF or CNPJ
// (read on the server from the vehicle history partner answer, which lives
// only in the restricted table) plus the renavam. Completa only. Whoever of
// the two (DETRAN block, partner answer) arrives last fires the call, once.

// Fictitious owner data, marked so that any leak is easy to spot. Not real people.
const CPF = '123.456.789-09' // ggignore
const CPF_DIGITOS = '12345678909' // ggignore
const CNPJ = '11.222.333/0001-81' // ggignore
const CNPJ_DIGITOS = '11222333000181' // ggignore
const NOME = 'DONO FICTICIO MARCADO'
const CHASSI = '9XXHV00000X000001' // ggignore
const RENAVAM = '00987654321'
const PLACA = 'TST2B34'
const ANO = new Date().getFullYear()
const H = 60 * 60 * 1000

const RESPONSE = { ufJurisdicao: 'MG', renavam: '987654321', chassi: CHASSI, placa: PLACA } // ggignore
const RUNTIME = { infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p' }
const ADM = [
  { exercicio: String(ANO - 2), valor: 'R$ 250,10', normalizado_valor: 250.1 },
  { exercicio: String(ANO - 1), valor: 'R$ 560,90', normalizado_valor: 560.9 },
  { exercicio: String(ANO), valor: 'R$ 470,61', normalizado_valor: 470.61 },
]
const TOTAL_ADM = 128161

const blocoMg = (x: any = {}) => ({
  status: 'ok', fonte: 'detran_mg', multas_total_centavos: 0, ipva_total_centavos: null, ipva_pago_ano: ANO - 3,
  multas_itens: [], restricoes_detran: [], ...x,
})

/** Vehicle history partner answer as stored in the restricted table (only there it has name and document). */
function respostaParceira(doc: string | null = CPF, dados: any = {}, fontes: any = {}) {
  return {
    success: true, queryId: 'q-teste', custo_debitado: 1.9,
    dados: {
      placa: PLACA, chassi: CHASSI,
      proprietarios: {
        total: 1,
        proprietario_atual: { ordem: 1, nome: NOME, documento: '***.456.789-**', documentoOriginal: doc, tipo: 'Pessoa fisica', uf: 'MG', atual: true },
        historico: [{ ordem: 1, nome: NOME, documento: '***.456.789-**', tipo: 'Pessoa fisica', data: '2020-01-02', uf: 'MG', atual: true }],
      },
      raw_sources: { e2Success: true, e5Success: true, infosinistrosSuccess: true, ...fontes },
      ...dados,
    },
  }
}

/** SEFAZ-MG answer: it echoes the owner (name and document) and the parameters. */
function sefaz200(adm: any[], ativa: any[] = [], doc = CPF) {
  return {
    code: 200, code_message: 'A requisição foi processada com sucesso.',
    header: { price: '0.24', parameters: { cpf: doc.replace(/\D/g, ''), renavam: RENAVAM } },
    data: [{ renavam: RENAVAM, identificacao: doc, tipo_identificacao: 'CPF', nome_razao_social: NOME, debitos_adm: adm, debitos_divida_ativa: ativa }],
    site_receipts: ['https://storage.invalid/comprovante'],
  }
}

/** In-memory database with the RPCs these flows use (named lock with lease, partner reservation and snapshot key). */
function banco() {
  let seq = 0
  const sb: any = supabaseMemoria({
    rpc: (nome: string, a: any) => {
      if (nome === 'job_lock_pegar') {
        const t = sb.tab('job_lock')
        const agora = Date.now()
        const ate = new Date(agora + a.p_segundos * 1000).toISOString()
        const l = t.find((x: any) => x.nome === a.p_nome)
        if (!l) { t.push({ nome: a.p_nome, dono: a.p_dono, ate }); return true }
        if (Date.parse(l.ate) < agora || l.dono === a.p_dono) { Object.assign(l, { dono: a.p_dono, ate }); return true }
        return false
      }
      if (nome === 'parceiro_historico_reservar') {
        const id = `reserva-${++seq}`
        sb.tab('parceiro_historico_chamadas').push({ id, pedido_id: a.p_pedido, placa: a.p_placa, em_andamento: true, cobrada: false, cache_hit: false, criado_em: new Date().toISOString() })
        return id
      }
      if (nome === 'snapshot_gravar_historico_veicular') {
        const p = sb.tab('pedidos_premium').find((x: any) => x.id === a.p_pedido)
        if (!p?.relatorio_snapshot) return false
        p.relatorio_snapshot = { ...p.relatorio_snapshot, historicoVeicular: a.p_valor }
        return true
      }
      return true
    },
  })
  return sb
}

function comPedido(sb: any, x: { id?: string; plano?: string; multas?: any; snap?: any } = {}) {
  const snap: any = { consulta: { response: { ...RESPONSE } }, ...(x.snap || {}) }
  if (x.multas) snap.multas = structuredClone(x.multas)
  sb.tab('pedidos_premium').push({ id: x.id ?? 'p1', placa: PLACA, plano: x.plano ?? 'completa', relatorio_snapshot: snap })
}

function comRespostaPaga(sb: any, pedidoId: string | null, bruto: any, criadoEm = new Date().toISOString()) {
  sb.tab('parceiro_historico_chamadas').push({ id: `pago-${pedidoId}`, pedido_id: pedidoId, placa: PLACA, cobrada: true, cache_hit: false, sucesso: true, resposta_bruta: structuredClone(bruto), criado_em: criadoEm })
}

const snapDe = (sb: any, id = 'p1') => sb.tab('pedidos_premium').find((p: any) => p.id === id)?.relatorio_snapshot
const pedido = (id = 'p1') => ({ id, placa: PLACA, plano: 'completa' })
const esperarVoo = () => vi.waitFor(() => expect(quantasEmVoo()).toBe(0), { timeout: 3000 })

let chamadasSefaz: URLSearchParams[]
/** fetch of the DETRAN-MG (overdue IPVA: paid up to 3 years ago, debt restriction) and of the SEFAZ-MG. */
function stubFetch(sefaz: any) {
  const detran = { code: 200, header: { price: '0.28' }, data: [{ ...MG, ipva_pago: String(ANO - 3), impedimentos_e_restricoes: 'VEICULO AUTUADO POR DEBITO DE IPVA', multas: [] }] }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    if (url.endsWith('/sefaz/mg/debitos-ipva')) {
      chamadasSefaz.push(init.body)
      const r = typeof sefaz === 'function' ? await sefaz() : sefaz
      return { status: 200, json: async () => r }
    }
    if (url.endsWith('/detran/mg/multas-descritivos')) return { status: 200, json: async () => detran }
    throw new Error(`url inesperada ${url}`)
  }))
}

/** Partner client that answers `corpo` (the queue job and the step after the delivery use the same function). */
const depsParceira = (corpo: any) => ({
  cfg: cfgHistorico({ parceiroHistoricoLigado: 'on', parceiroHistoricoKey: 'chave-de-teste' }),
  http: async () => ({ status: 200, text: async () => JSON.stringify(corpo) }),
  alertar: async () => {}, log: () => {}, esperar: async () => {}, reservaLeilao: async () => {},
})

let sb: any
beforeEach(() => {
  sb = banco()
  chamadasSefaz = []
  vi.stubGlobal('useRuntimeConfig', () => RUNTIME)
  _definirEsperaLockIpvaMg(5)
  _resetarEmVoo()
  _limparEmVooHistorico()
  _limparAlertaTetoHistorico()
})
afterEach(async () => {
  await esperarVoo().catch(() => {})
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  _resetarEmVoo()
})

describe('trigger: IPVA in arrears in the DETRAN-MG block', () => {
  const hoje = new Date('2026-11-18T12:00:00-03:00')

  it('fires when the IPVA was paid up to a past year and the DETRAN brought no value', () => {
    expect(precisaIpvaSefazMg(blocoMg({ ipva_pago_ano: 2023 }), hoje)).toBe(true)
    expect(precisaIpvaSefazMg(blocoMg({ ipva_pago_ano: 2025 }), hoje)).toBe(true)
  })

  it('fires on a restriction about an IPVA debt, even with the current year paid', () => {
    const restricao = [{ tipo: 'administrativa', texto: 'VEICULO AUTUADO POR DEBITO DE IPVA' }]
    expect(precisaIpvaSefazMg(blocoMg({ ipva_pago_ano: 2026, restricoes_detran: restricao }), hoje)).toBe(true)
    expect(ipvaMgAtrasado({ ipva_pago_ano: null, restricoes_detran: [{ tipo: 'administrativa', texto: 'Débito de IPVA em aberto' }] }, hoje)).toBe(true)
  })

  it('does not fire with the IPVA up to date or without any sign of arrears', () => {
    expect(precisaIpvaSefazMg(blocoMg({ ipva_pago_ano: 2026 }), hoje)).toBe(false)
    expect(precisaIpvaSefazMg(blocoMg({ ipva_pago_ano: null }), hoje)).toBe(false)
    expect(precisaIpvaSefazMg(blocoMg({ ipva_pago_ano: 2026, restricoes_detran: [{ tipo: 'administrativa', texto: 'VEICULO ISENTO DE IPVA' }] }), hoje)).toBe(false)
  })

  it('does not fire when the DETRAN brought the value or the SEFAZ already answered', () => {
    expect(precisaIpvaSefazMg(blocoMg({ ipva_pago_ano: 2023, ipva_total_centavos: 50000 }), hoje)).toBe(false)
    expect(precisaIpvaSefazMg(blocoMg({ ipva_pago_ano: 2023, ipva_itens: [{ ano: 2025, vencimento: null, valor_centavos: 100 }] }), hoje)).toBe(false)
    expect(precisaIpvaSefazMg(blocoMg({ ipva_pago_ano: 2023, ipva_fonte: 'sefaz_mg', ipva_total_centavos: 0, ipva_itens: [] }), hoje)).toBe(false)
  })

  it('only a ready DETRAN-MG block, never one filled by hand', () => {
    expect(precisaIpvaSefazMg(blocoMg({ ipva_pago_ano: 2023, fonte: 'detran_sp' }), hoje)).toBe(false)
    expect(precisaIpvaSefazMg({ status: 'indisponivel', uf: 'MG' }, hoje)).toBe(false)
    expect(precisaIpvaSefazMg(blocoMg({ ipva_pago_ano: 2023, backfill_manual: 'colado a mao' }), hoje)).toBe(false)
    expect(precisaIpvaSefazMg(blocoMg({ ipva_pago_ano: 2023, preenchido_manual_em: '2026-11-18T10:00:00Z' }), hoje)).toBe(false)
    expect(precisaIpvaSefazMg(null, hoje)).toBe(false)
  })
})

describe('owner document from the partner answer (server only)', () => {
  it('the full CPF or CNPJ of the current owner, digits only', () => {
    expect(documentoDoDonoAtual(respostaParceira(CPF), CHASSI)).toEqual({ tipo: 'cpf', numero: CPF_DIGITOS })
    expect(documentoDoDonoAtual(respostaParceira(CNPJ), CHASSI)).toEqual({ tipo: 'cnpj', numero: CNPJ_DIGITOS })
  })

  it('masked, missing, "not disclosed" or with a wrong check digit: no document', () => {
    const invalidos = ['***.456.789-**', '', null, 'NÃO DIVULGADO', '123.456.789-00', '000.000.000-00', '11.222.333/0001-80', '12.345'] // ggignore
    for (const doc of invalidos) expect(documentoDoDonoAtual(respostaParceira(doc), CHASSI)).toBeNull()
    // Only documentoOriginal counts: the masked field is never taken.
    expect(documentoDoDonoAtual({ dados: { proprietarios: { proprietario_atual: { documento: CPF } } } }, CHASSI)).toBeNull()
    expect(documentoDoDonoAtual(null, CHASSI)).toBeNull()
  })

  it('an answer for another VIN: no document (it would be someone else)', () => {
    expect(documentoDoDonoAtual(respostaParceira(CPF), '9XXHV00000X999999')).toBeNull() // ggignore
    // Without the VIN in the answer there is nothing to compare: the document counts.
    expect(documentoDoDonoAtual(respostaParceira(CPF, { chassi: null }), CHASSI)).toEqual({ tipo: 'cpf', numero: CPF_DIGITOS })
  })
})

describe('SEFAZ-MG parser', () => {
  it('administrative and active-debt years become IPVA items, each debt counted once', () => {
    const itens = parsearIpvaSefazMg({
      identificacao: CPF, nome_razao_social: NOME, tipo_identificacao: 'CPF',
      debitos_adm: [...ADM, { exercicio: '2022', valor: 'R$ 100,00' }],
      // 2022 shows in both lists: the same debt, counted once (as active debt)
      debitos_divida_ativa: [{ exercicio: '2022', normalizado_valor: 100 }, { exercicio: '2021', valor: 'R$ 90,50' }],
    })
    expect(itens).toEqual([
      { ano: ANO, vencimento: null, valor_centavos: 47061 },
      { ano: ANO - 1, vencimento: null, valor_centavos: 56090 },
      { ano: ANO - 2, vencimento: null, valor_centavos: 25010 },
      { ano: 2022, vencimento: null, valor_centavos: 10000, divida_ativa: true },
      { ano: 2021, vencimento: null, valor_centavos: 9050, divida_ativa: true },
    ])
    expect(JSON.stringify(itens)).not.toMatch(/FICTICIO|123\.456|12345678909/)
  })

  it('two equal installments of the same year in one list are two debts', () => {
    const itens = parsearIpvaSefazMg({ debitos_adm: [{ exercicio: '2025', normalizado_valor: 100 }, { exercicio: '2025', normalizado_valor: 100 }], debitos_divida_ativa: [] })
    expect(itens?.map((x) => x.valor_centavos)).toEqual([10000, 10000])
  })

  it('empty lists: nothing open; an answer without the lists: unknown (null)', () => {
    expect(parsearIpvaSefazMg({ debitos_adm: [], debitos_divida_ativa: [] })).toEqual([])
    expect(parsearIpvaSefazMg({ debitos_adm: [{ exercicio: '2025', normalizado_valor: 0 }] })).toEqual([])
    expect(parsearIpvaSefazMg({ renavam: RENAVAM })).toBeNull()
    expect(parsearIpvaSefazMg(null)).toBeNull()
  })

  it('config: SEFAZ-MG by document and renavam, cost and 24 h plate cache of its own', () => {
    expect((DETRAN_UFS.MG as any).ipvaSefaz).toMatchObject({ path: 'sefaz/mg/debitos-ipva', fonteCusto: 'infosimples_sefaz_mg_ipva', semCredencial: true, soRenavam: true })
    expect((DETRAN_UFS.MG as any).ipvaSefaz.sempre).toBeUndefined()
    expect(ttlDaFonte('ipva_sefaz_mg')).toBe(24 * H)
  })
})

describe('the SEFAZ-MG call', () => {
  it('fires with IPVA in arrears and the owner document: one call (cpf + renavam), the years in the block', async () => {
    comPedido(sb, { multas: blocoMg({ ipva_pendente_sefaz: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CPF))
    stubFetch(sefaz200(ADM))
    expect(await completarIpvaSefazMg(sb, 'p1')).toMatchObject({ feito: 'ok' })
    expect(chamadasSefaz).toHaveLength(1)
    const corpo = chamadasSefaz[0]!
    expect(corpo.get('cpf')).toBe(CPF_DIGITOS)
    expect(corpo.get('renavam')).toBe(RENAVAM)
    // No receipt kept at the provider (the page shows the owner); no plate, VIN or credential.
    expect(corpo.get('ignore_site_receipt')).toBe('1')
    for (const k of ['cnpj', 'placa', 'chassi', 'pkcs12_cert', 'pkcs12_pass', 'login_cpf', 'login_senha']) expect(corpo.has(k)).toBe(false)
    const m = snapDe(sb).multas
    expect(m).toMatchObject({
      fonte: 'detran_mg', ipva_fonte: 'sefaz_mg', ipva_total_centavos: TOTAL_ADM,
      ipva_itens: [{ ano: ANO, vencimento: null, valor_centavos: 47061 }, { ano: ANO - 1, vencimento: null, valor_centavos: 56090 }, { ano: ANO - 2, vencimento: null, valor_centavos: 25010 }],
    })
    for (const k of ['ipva_pendente_sefaz', 'ipva_sefaz_indisponivel', 'ipva_sefaz_sem_documento']) expect(m[k]).toBeUndefined()
    expect(sb.tab('premium_custos')).toEqual([expect.objectContaining({ pedido_id: 'p1', fonte: 'infosimples_sefaz_mg_ipva', preco: 0.24, code: 200 })])
    expect(sb.tab('fonte_cache')).toEqual([expect.objectContaining({ fonte: 'ipva_sefaz_mg', chave: PLACA, status: 'ok', payload: { itens: m.ipva_itens } })])
  })

  it('a company owner goes as cnpj', async () => {
    comPedido(sb, { multas: blocoMg({ ipva_pendente_sefaz: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CNPJ))
    stubFetch(sefaz200(ADM, [], CNPJ))
    expect(await completarIpvaSefazMg(sb, 'p1')).toMatchObject({ feito: 'ok' })
    expect(chamadasSefaz[0]!.get('cnpj')).toBe(CNPJ_DIGITOS)
    expect(chamadasSefaz[0]!.has('cpf')).toBe(false)
  })

  it('without a full document (masked): unavailable, no call', async () => {
    comPedido(sb, { multas: blocoMg({ ipva_pendente_sefaz: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira('***.456.789-**'))
    stubFetch(sefaz200(ADM))
    expect(await completarIpvaSefazMg(sb, 'p1')).toMatchObject({ feito: 'sem_documento' })
    expect(chamadasSefaz).toHaveLength(0)
    const m = snapDe(sb).multas
    expect(m).toMatchObject({ ipva_sefaz_indisponivel: true, ipva_sefaz_sem_documento: true })
    expect(m.ipva_pendente_sefaz).toBeUndefined()
    expect(sb.tab('premium_custos')).toHaveLength(0)
  })

  it('without any partner answer yet (failed or still out): unavailable, no call', async () => {
    comPedido(sb, { multas: blocoMg({ ipva_pendente_sefaz: true }) })
    stubFetch(sefaz200(ADM))
    expect(await completarIpvaSefazMg(sb, 'p1')).toMatchObject({ feito: 'sem_documento' })
    expect(chamadasSefaz).toHaveLength(0)
  })

  it('the partner answered for another VIN: no document, no call', async () => {
    comPedido(sb, { multas: blocoMg({ ipva_pendente_sefaz: true }), snap: { historicoVeicular: { status: 'divergente', consultadoEm: null } } })
    comRespostaPaga(sb, 'p1', respostaParceira(CPF))
    stubFetch(sefaz200(ADM))
    expect(await completarIpvaSefazMg(sb, 'p1')).toMatchObject({ feito: 'sem_documento' })
    expect(chamadasSefaz).toHaveLength(0)
  })

  it('does not fire outside the Completa: no call, the waiting flag goes away', async () => {
    comPedido(sb, { plano: 'basica', multas: blocoMg({ ipva_pendente_sefaz: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CPF))
    stubFetch(sefaz200(ADM))
    expect(await completarIpvaSefazMg(sb, 'p1')).toMatchObject({ feito: 'pulado' })
    expect(chamadasSefaz).toHaveLength(0)
    const m = snapDe(sb).multas
    for (const k of ['ipva_pendente_sefaz', 'ipva_sefaz_indisponivel', 'ipva_sefaz_sem_documento', 'ipva_fonte']) expect(m[k]).toBeUndefined()
  })

  it('does not fire for a block that is not waiting (IPVA up to date, value from the DETRAN, SEFAZ done)', async () => {
    stubFetch(sefaz200(ADM))
    const casos = [blocoMg({ ipva_pago_ano: ANO }), blocoMg({ ipva_total_centavos: 9900 }), blocoMg({ ipva_fonte: 'sefaz_mg', ipva_itens: [], ipva_total_centavos: 0 }), blocoMg()]
    for (const [i, multas] of casos.entries()) {
      comPedido(sb, { id: `p${i}`, multas })
      comRespostaPaga(sb, `p${i}`, respostaParceira(CPF))
      expect(await completarIpvaSefazMg(sb, `p${i}`)).toMatchObject({ feito: 'pulado' })
    }
    expect(chamadasSefaz).toHaveLength(0)
  })

  it('a 200 in an unknown shape: unavailable, never a made-up value; the cost keeps only the key names', async () => {
    comPedido(sb, { multas: blocoMg({ ipva_pendente_sefaz: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CPF))
    stubFetch({ code: 200, header: { price: '0.24' }, data: [{ identificacao: CPF, nome_razao_social: NOME, debitos: [{ ano: '2025', total: 'R$ 10,00' }] }] })
    expect(await completarIpvaSefazMg(sb, 'p1')).toMatchObject({ feito: 'indisponivel', code: 200 })
    expect(snapDe(sb).multas).toMatchObject({ ipva_sefaz_indisponivel: true })
    expect(snapDe(sb).multas.ipva_total_centavos).toBeNull()
    const [custo] = sb.tab('premium_custos')
    expect(custo.bruto).toEqual({ formato_desconhecido: true, chaves: { debitos: [{ ano: 'string', total: 'string' }] } })
    expect(JSON.stringify(custo)).not.toMatch(/FICTICIO|123\.456|12345678909/)
    expect(sb.tab('fonte_cache')).toHaveLength(0)
  })

  it('612: nothing open (charged and cached)', async () => {
    comPedido(sb, { multas: blocoMg({ ipva_pendente_sefaz: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CPF))
    stubFetch({ code: 612, code_message: 'A consulta não retornou dados.', errors: ['Nenhum débito encontrado'], header: { price: '0.24' } })
    expect(await completarIpvaSefazMg(sb, 'p1')).toMatchObject({ feito: 'ok' })
    expect(snapDe(sb).multas).toMatchObject({ ipva_itens: [], ipva_total_centavos: 0, ipva_fonte: 'sefaz_mg' })
    expect(sb.tab('premium_custos')).toEqual([expect.objectContaining({ fonte: 'infosimples_sefaz_mg_ipva', preco: 0.24, code: 612 })])
    expect(sb.tab('fonte_cache')[0]).toMatchObject({ fonte: 'ipva_sefaz_mg', payload: { itens: [] } })
  })

  it('SEFAZ failure: unavailable for good, not cached, never called again for the order', async () => {
    comPedido(sb, { multas: blocoMg({ ipva_pendente_sefaz: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CPF))
    stubFetch({ code: 609, code_message: 'Erro na origem.', errors: ['Origem fora do ar'], header: { price: '0.24' } })
    expect(await completarIpvaSefazMg(sb, 'p1')).toMatchObject({ feito: 'indisponivel', code: 609 })
    const m = snapDe(sb).multas
    expect(m).toMatchObject({ ipva_sefaz_indisponivel: true })
    expect(m.ipva_sefaz_sem_documento).toBeUndefined()
    expect(m.ipva_pendente_sefaz).toBeUndefined()
    expect(sb.tab('fonte_cache')).toHaveLength(0)
    expect(sb.tab('premium_custos')).toEqual([expect.objectContaining({ code: 609, preco: 0.24 })])
    expect(await completarIpvaSefazMg(sb, 'p1')).toMatchObject({ feito: 'pulado' })
    expect(chamadasSefaz).toHaveLength(1)
  })

  it('plate cache (24 h): no call and no document needed', async () => {
    comPedido(sb, { multas: blocoMg({ ipva_pendente_sefaz: true }) })
    const itens = [{ ano: ANO, vencimento: null, valor_centavos: 47061 }]
    sb.tab('fonte_cache').push({ fonte: 'ipva_sefaz_mg', chave: PLACA, status: 'ok', payload: { itens }, consultado_em: new Date().toISOString(), expira_em: new Date(Date.now() + H).toISOString() })
    stubFetch(sefaz200(ADM))
    expect(await completarIpvaSefazMg(sb, 'p1')).toMatchObject({ feito: 'ok', cache: true })
    expect(chamadasSefaz).toHaveLength(0)
    expect(snapDe(sb).multas).toMatchObject({ ipva_itens: itens, ipva_total_centavos: 47061, ipva_fonte: 'sefaz_mg' })
  })

  it('an order served by the partner plate cache takes the document from the paid answer of the same plate', async () => {
    comPedido(sb, { id: 'p2', multas: blocoMg({ ipva_pendente_sefaz: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CPF), new Date(Date.now() - 3 * 24 * H).toISOString())
    stubFetch(sefaz200(ADM))
    expect(await completarIpvaSefazMg(sb, 'p2')).toMatchObject({ feito: 'ok' })
    expect(chamadasSefaz[0]!.get('cpf')).toBe(CPF_DIGITOS)
  })

  it('a paid answer of the plate older than the partner cache does not count', async () => {
    comPedido(sb, { id: 'p2', multas: blocoMg({ ipva_pendente_sefaz: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CPF), new Date(Date.now() - 40 * 24 * H).toISOString())
    stubFetch(sefaz200(ADM))
    expect(await completarIpvaSefazMg(sb, 'p2')).toMatchObject({ feito: 'sem_documento' })
    expect(chamadasSefaz).toHaveLength(0)
  })
})

describe('DETRAN and partner arrive at different times: whoever finishes last fires, once', () => {
  it('partner answer first, DETRAN later: writing the DETRAN block fires the call', async () => {
    comPedido(sb)
    stubFetch(sefaz200(ADM))
    await completarHistoricoVeicular(sb, pedido(), depsParceira(respostaParceira(CPF)))
    await esperarVoo()
    expect(chamadasSefaz).toHaveLength(0) // no DETRAN block yet
    expect((await completarDetran(sb, { id: 'p1', placa: PLACA }, { response: [RESPONSE] })).ok).toBe(true)
    await esperarVoo()
    expect(chamadasSefaz).toHaveLength(1)
    expect(snapDe(sb).multas).toMatchObject({ ipva_fonte: 'sefaz_mg', ipva_total_centavos: TOTAL_ADM })
    expect(snapDe(sb).historicoVeicular.status).toBe('ok')
  })

  it('DETRAN first, partner answer later: unavailable until it comes, then the call', async () => {
    comPedido(sb)
    stubFetch(sefaz200(ADM))
    expect((await completarDetran(sb, { id: 'p1', placa: PLACA }, { response: [RESPONSE] })).ok).toBe(true)
    await esperarVoo()
    expect(chamadasSefaz).toHaveLength(0)
    expect(snapDe(sb).multas).toMatchObject({ ipva_sefaz_indisponivel: true, ipva_sefaz_sem_documento: true })
    await completarHistoricoVeicular(sb, pedido(), depsParceira(respostaParceira(CPF)))
    await esperarVoo()
    expect(chamadasSefaz).toHaveLength(1)
    const m = snapDe(sb).multas
    expect(m).toMatchObject({ ipva_fonte: 'sefaz_mg', ipva_total_centavos: TOTAL_ADM })
    for (const k of ['ipva_pendente_sefaz', 'ipva_sefaz_indisponivel', 'ipva_sefaz_sem_documento']) expect(m[k]).toBeUndefined()
  })

  it('a partial partner answer that still brings the full document fires', async () => {
    comPedido(sb)
    stubFetch(sefaz200(ADM))
    await completarDetran(sb, { id: 'p1', placa: PLACA }, { response: [RESPONSE] })
    await esperarVoo()
    // The claims source failed (partial answer), the owner came with the full document.
    await completarHistoricoVeicular(sb, pedido(), depsParceira(respostaParceira(CPF, {}, { infosinistrosSuccess: false })))
    await esperarVoo()
    expect(chamadasSefaz).toHaveLength(1)
    expect(snapDe(sb).multas.ipva_fonte).toBe('sefaz_mg')
  })

  it('a partial partner answer with the document masked leaves it unavailable, without a call', async () => {
    comPedido(sb)
    stubFetch(sefaz200(ADM))
    await completarDetran(sb, { id: 'p1', placa: PLACA }, { response: [RESPONSE] })
    await esperarVoo()
    await completarHistoricoVeicular(sb, pedido(), depsParceira(respostaParceira('***.456.789-**', {}, { e5Success: false })))
    await esperarVoo()
    expect(chamadasSefaz).toHaveLength(0)
    expect(snapDe(sb).multas).toMatchObject({ ipva_sefaz_indisponivel: true, ipva_sefaz_sem_documento: true })
  })

  it('both triggers at the same moment: one call', async () => {
    comPedido(sb, { multas: blocoMg({ ipva_pendente_sefaz: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CPF))
    let soltar: () => void = () => {}
    stubFetch(() => new Promise((ok) => { soltar = () => ok(sefaz200(ADM)) }))
    const a = completarIpvaSefazMg(sb, 'p1')
    const b = completarIpvaSefazMg(sb, 'p1')
    await vi.waitFor(() => expect(chamadasSefaz).toHaveLength(1))
    soltar()
    const r = await Promise.all([a, b])
    expect(chamadasSefaz).toHaveLength(1)
    expect(r.map((x) => x.feito).sort()).toEqual(['ok', 'pulado'])
    expect(snapDe(sb).multas.ipva_total_centavos).toBe(TOTAL_ADM)
  })

  it('DETRAN block and partner answer landing together: one call', async () => {
    comPedido(sb)
    stubFetch(sefaz200(ADM))
    await Promise.all([
      completarDetran(sb, { id: 'p1', placa: PLACA }, { response: [RESPONSE] }),
      completarHistoricoVeicular(sb, pedido(), depsParceira(respostaParceira(CPF))),
    ])
    await esperarVoo()
    expect(chamadasSefaz).toHaveLength(1)
    expect(snapDe(sb).multas).toMatchObject({ ipva_fonte: 'sefaz_mg', ipva_total_centavos: TOTAL_ADM })
  })

  it('the DETRAN queue job picks up an IPVA left waiting (a call cut in the middle)', async () => {
    comPedido(sb, { multas: blocoMg({ ipva_pendente_sefaz: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CPF))
    stubFetch(sefaz200(ADM))
    expect(await completarDetran(sb, { id: 'p1', placa: PLACA }, { response: [RESPONSE], semRetry: true })).toMatchObject({ pulado: 'ja tem detran_mg' })
    await esperarVoo()
    expect(chamadasSefaz).toHaveLength(1)
    expect(snapDe(sb).multas.ipva_fonte).toBe('sefaz_mg')
  })

  it('a vehicle from another state never gets the SEFAZ-MG, even with the partner document', async () => {
    comPedido(sb, { snap: { consulta: { response: { ...RESPONSE, ufJurisdicao: 'SP' } } } })
    stubFetch(sefaz200(ADM))
    await completarHistoricoVeicular(sb, pedido(), depsParceira(respostaParceira(CPF)))
    await esperarVoo()
    expect(chamadasSefaz).toHaveLength(0)
  })
})

describe('no owner name, CPF or CNPJ outside the restricted table', () => {
  it('snapshot, plate cache, cost (detail and raw) and logs never carry them', async () => {
    const logs: string[] = []
    for (const k of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, k).mockImplementation((...a: any[]) => { logs.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')) })
    }
    // p1: person, DETRAN first, partner later, SEFAZ answers echoing the owner.
    // p2: company, the SEFAZ refuses and echoes the CNPJ in its messages.
    comPedido(sb, { id: 'p1' })
    comPedido(sb, { id: 'p2' })
    let resposta: any = sefaz200(ADM)
    stubFetch(() => resposta)
    await completarDetran(sb, { id: 'p1', placa: PLACA }, { response: [RESPONSE] })
    await esperarVoo()
    await completarHistoricoVeicular(sb, pedido('p1'), depsParceira(respostaParceira(CPF)))
    await esperarVoo()
    resposta = {
      code: 607, code_message: `Parâmetro cnpj ${CNPJ_DIGITOS} inválido para ${NOME}`, errors: [`O CNPJ ${CNPJ} de ${NOME} não corresponde ao RENAVAM`],
      header: { price: '0.24', parameters: { cnpj: CNPJ_DIGITOS, renavam: RENAVAM } },
    }
    sb.tab('fonte_cache').splice(0) // p2 must call (same plate)
    comRespostaPaga(sb, 'p2', respostaParceira(CNPJ, { proprietarios: { total: 1, proprietario_atual: { nome: NOME, razao_social: NOME, documentoOriginal: CNPJ } } }))
    await completarDetran(sb, { id: 'p2', placa: PLACA }, { response: [RESPONSE] })
    await esperarVoo()
    expect(chamadasSefaz).toHaveLength(2)
    expect(snapDe(sb, 'p1').multas.ipva_fonte).toBe('sefaz_mg')
    expect(snapDe(sb, 'p2').multas.ipva_sefaz_indisponivel).toBe(true)

    const marcados = [CPF, CPF_DIGITOS, CNPJ, CNPJ_DIGITOS, NOME, '456.789-09', '333/0001']
    const vazou = (s: string) => marcados.filter((x) => s.includes(x))
    expect(vazou(JSON.stringify(sb.tab('pedidos_premium').map((p: any) => p.relatorio_snapshot)))).toEqual([])
    expect(vazou(JSON.stringify(sb.tab('fonte_cache')))).toEqual([])
    const custos = sb.tab('premium_custos').filter((c: any) => c.fonte === 'infosimples_sefaz_mg_ipva')
    expect(custos).toHaveLength(2)
    expect(vazou(JSON.stringify(custos))).toEqual([])
    expect(vazou(JSON.stringify(sb.tab('premium_custos')))).toEqual([])
    expect(vazou(logs.join('\n'))).toEqual([])
    // The SEFAZ answer itself (years and values) is kept, without the owner.
    expect(custos[0].bruto).toEqual({ debitos_adm: ADM, debitos_divida_ativa: [] })
    // Where it does live: the restricted table only.
    expect(JSON.stringify(sb.tab('parceiro_historico_chamadas'))).toContain(CPF)
  })
})
