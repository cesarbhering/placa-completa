// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import RJ from './__fixtures__/infosimples-detran-rj-restricoes.json'
import {
  precisaNadaConstaRj, parsearNadaConstaRj, completarNadaConstaRj, completarDetran, CONSULTAS_COM_DOCUMENTO,
  AVISO_DEBITOS_RJ, AVISO_IPVA_RJ, _definirEsperaLockDocumento,
} from './infosimples-detran'
import { completarHistoricoVeicular, _limparEmVooHistorico, _limparAlertaTetoHistorico } from './parceiro-historico'
import { resumoQuitar } from '../../shared/detran-quitar'
import { fonteConcluida } from '../../shared/fontes-relatorio'
import { ttlDaFonte } from './fonte-cache'
import { _resetarEmVoo } from './tarefas-em-voo'
import {
  CPF, CPF_DIGITOS, CNPJ, CNPJ_DIGITOS, NOME, RENAVAM, PLACA, H, RUNTIME, vazamentos, respostaSenatran, respostaParceira,
  banco, comPedido, comRespostaPaga, snapDe, pedidoCompleta as pedido, esperarVoo, depsParceira, stubFetchPorRota, capturarLogs,
} from '../../tests/helpers/documento-do-dono'

// DETRAN-RJ (Cesar, 18/11/2026): the restrictions query does not bring fines
// nor IPVA, because the state asks for the owner's document. With the owner's
// CPF or CNPJ (read on the server from the vehicle history partner answer) the
// nada consta query (detran/rj/nada-consta, renavam + cpf or cnpj) brings the
// fines. Only unpaid ones count; the IPVA stays unknown, so the report never
// says "nada a quitar". Same shared piece and same "whoever arrives last" as
// the SEFAZ-MG IPVA.

const RESPONSE = respostaSenatran('RJ')

const blocoRj = (x: any = {}) => ({
  status: 'ok', fonte: 'detran_rj', multas_total_centavos: null, ipva_total_centavos: null, licenciamento_centavos: null,
  multas_itens: [], restricoes_detran: [], debitos_indisponiveis: true, aviso_debitos: AVISO_DEBITOS_RJ, ...x,
})

/** One fine as the nada consta lists it (fictitious). */
const multaRj = (x: any = {}) => ({
  auto_de_infracao: 'E00000001', auto_de_renainf: '0000000001',
  descricao: 'TRANSITAR EM VELOCIDADE SUPERIOR A MAXIMA PERMITIDA EM ATE 20%', enquadramento_da_infracao: '745-50',
  data_infracao: '10/03/2026', normalizado_data_infracao: '2026-03-10', hora: '14:32',
  local_da_infracao: 'AV FICTICIA 1000 - BAIRRO TESTE', orgao_emissor: 'ORGAO AUTUADOR TESTE', agente_emissor: 'AGENTE TESTE 000',
  valor_original: 'R$ 130,16', valor_a_ser_pago: 'R$ 130,16', situacao: 'EM ABERTO', status_de_pagamento: 'NÃO PAGO',
  data_pagamento_com_desconto: '10/05/2026', normalizado_data_pagamento_com_desconto: '2026-05-10',
  ...x,
})

const MULTAS = [
  multaRj(),
  multaRj({ auto_de_infracao: 'E00000002', descricao: 'ESTACIONAR EM LOCAL PROIBIDO', valor_original: 'R$ 195,23', valor_a_ser_pago: 'R$ 195,23', data_infracao: '02/04/2026', hora: '09h05' }),
  multaRj({ auto_de_infracao: 'E00000003', status_de_pagamento: 'PAGO', valor_a_ser_pago: 'R$ 88,38' }),
  multaRj({ auto_de_infracao: 'E00000004', situacao: 'CANCELADA', valor_a_ser_pago: 'R$ 293,47' }),
]
const TOTAL_ABERTAS = 32539

/** Nada consta answer: the data has no owner, but the header echoes the document sent. */
function nadaConsta200(multas: any[], doc = CPF) {
  return {
    code: 200, code_message: 'A requisição foi processada com sucesso.',
    header: { price: '0.24', parameters: { renavam: RENAVAM, [doc.length > 14 ? 'cnpj' : 'cpf']: doc.replace(/\D/g, '') } },
    data: [{ renavam: RENAVAM, data_da_consulta: '18/11/2026', normalizado_data_da_consulta: '2026-11-18', multas }],
    site_receipts: ['https://storage.invalid/comprovante'],
  }
}

let chamadasRj: URLSearchParams[]
/** fetch of the DETRAN-RJ restrictions (fixture) and of the nada consta. */
function stubFetch(nadaConsta: any) {
  chamadasRj = stubFetchPorRota({ '/detran/rj/nada-consta': nadaConsta, '/detran/restricoes': RJ })['/detran/rj/nada-consta']!
}

let sb: any
beforeEach(() => {
  sb = banco()
  chamadasRj = []
  vi.stubGlobal('useRuntimeConfig', () => RUNTIME)
  _definirEsperaLockDocumento(5)
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

describe('trigger: DETRAN-RJ block without the debts', () => {
  it('fires for the ready RJ block whose fines and IPVA were not consulted', () => {
    expect(precisaNadaConstaRj(blocoRj())).toBe(true)
  })

  it('not when the fines already came, the block is not a ready RJ one, or it was filled by hand', () => {
    expect(precisaNadaConstaRj(blocoRj({ multas_fonte: 'detran_rj_nada_consta' }))).toBe(false)
    expect(precisaNadaConstaRj(blocoRj({ fonte: 'detran_mg' }))).toBe(false)
    expect(precisaNadaConstaRj({ status: 'indisponivel', uf: 'RJ' })).toBe(false)
    expect(precisaNadaConstaRj(blocoRj({ debitos_indisponiveis: false }))).toBe(false)
    expect(precisaNadaConstaRj(blocoRj({ backfill_manual: 'colado a mao', preenchido_manual_em: '2026-11-18T10:00:00Z' }))).toBe(false)
    expect(precisaNadaConstaRj(null)).toBe(false)
  })
})

describe('DETRAN-RJ nada consta parser', () => {
  it('only unpaid fines, in the report format (auto, local and agency included), never the agent', () => {
    const itens = parsearNadaConstaRj({ renavam: RENAVAM, multas: MULTAS })
    expect(itens).toEqual([
      { auto: 'E00000001', descricao: 'TRANSITAR EM VELOCIDADE SUPERIOR A MAXIMA PERMITIDA EM ATE 20%', dataInfracao: '10/03/2026', horaInfracao: '14:32', dataVencimento: null, valor: 130.16, local: 'AV FICTICIA 1000 - BAIRRO TESTE', municipio: null, orgao: 'ORGAO AUTUADOR TESTE' },
      { auto: 'E00000002', descricao: 'ESTACIONAR EM LOCAL PROIBIDO', dataInfracao: '02/04/2026', horaInfracao: '09:05', dataVencimento: null, valor: 195.23, local: 'AV FICTICIA 1000 - BAIRRO TESTE', municipio: null, orgao: 'ORGAO AUTUADOR TESTE' },
    ])
    expect(JSON.stringify(itens)).not.toContain('AGENTE')
  })

  it('paid, settled or cancelled never shows; "NÃO PAGO" is open', () => {
    const casos = [
      [{ status_de_pagamento: 'NÃO PAGO' }, 1], [{ status_de_pagamento: 'NAO PAGO' }, 1], [{ status_de_pagamento: '' }, 1],
      [{ status_de_pagamento: 'PAGO' }, 0], [{ status_de_pagamento: 'PAGO COM DESCONTO' }, 0], [{ status_de_pagamento: 'QUITADO' }, 0],
      [{ situacao: 'CANCELADA' }, 0], [{ situacao: 'QUITADA' }, 0], [{ situacao: 'BAIXADA' }, 0],
    ] as const
    for (const [x, n] of casos) expect(parsearNadaConstaRj({ multas: [multaRj(x)] })).toHaveLength(n)
  })

  it('the value to pay now; the original when it is missing', () => {
    expect(parsearNadaConstaRj({ multas: [multaRj({ valor_a_ser_pago: 'R$ 104,13' })] })?.[0]?.valor).toBe(104.13)
    expect(parsearNadaConstaRj({ multas: [multaRj({ valor_a_ser_pago: null })] })?.[0]?.valor).toBe(130.16)
  })

  it('the same fine listed twice counts once', () => {
    expect(parsearNadaConstaRj({ multas: [multaRj(), multaRj()] })).toHaveLength(1)
  })

  it('no fines: empty; an answer without the list: unknown (null)', () => {
    expect(parsearNadaConstaRj({ renavam: RENAVAM, multas: [] })).toEqual([])
    expect(parsearNadaConstaRj({ renavam: RENAVAM })).toBeNull()
    expect(parsearNadaConstaRj(null)).toBeNull()
  })

  it('config: nada consta by document and renavam, its cost and its 24 h plate cache', () => {
    expect(CONSULTAS_COM_DOCUMENTO.RJ).toMatchObject({ uf: 'RJ', path: 'detran/rj/nada-consta', fonteCusto: 'infosimples_detran_rj_nada_consta', fonteCache: 'nada_consta_rj' })
    expect(ttlDaFonte('nada_consta_rj')).toBe(24 * H)
    expect(AVISO_IPVA_RJ).toBe('IPVA do RJ não está disponível nesta consulta.')
  })
})

describe('the nada consta call', () => {
  it('fires with the owner document: one call (cpf + renavam), the unpaid fines in the block, the IPVA still unknown', async () => {
    comPedido(sb, { uf: 'RJ', multas: blocoRj({ nada_consta_pendente: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CPF))
    stubFetch(nadaConsta200(MULTAS))
    expect(await completarNadaConstaRj(sb, 'p1')).toMatchObject({ feito: 'ok' })
    expect(chamadasRj).toHaveLength(1)
    const corpo = chamadasRj[0]!
    expect(corpo.get('cpf')).toBe(CPF_DIGITOS)
    expect(corpo.get('renavam')).toBe(RENAVAM)
    expect(corpo.get('ignore_site_receipt')).toBe('1')
    for (const k of ['cnpj', 'placa', 'chassi', 'uf', 'pkcs12_cert', 'login_cpf']) expect(corpo.has(k)).toBe(false)
    const m = snapDe(sb).multas
    expect(m).toMatchObject({
      fonte: 'detran_rj', multas_fonte: 'detran_rj_nada_consta', multas_total_centavos: TOTAL_ABERTAS,
      debitos_indisponiveis: true, aviso_debitos: AVISO_IPVA_RJ, ipva_total_centavos: null,
    })
    expect(m.multas_itens.map((x: any) => x.auto)).toEqual(['E00000001', 'E00000002'])
    for (const k of ['nada_consta_pendente', 'nada_consta_indisponivel', 'nada_consta_sem_documento']) expect(m[k]).toBeUndefined()
    expect(sb.tab('premium_custos')).toEqual([expect.objectContaining({ pedido_id: 'p1', fonte: 'infosimples_detran_rj_nada_consta', preco: 0.24, code: 200 })])
    expect(sb.tab('fonte_cache')).toEqual([expect.objectContaining({ fonte: 'nada_consta_rj', chave: PLACA, status: 'ok', payload: { itens: m.multas_itens } })])
    // The box: what to pay for the fines, never "nada a quitar", and the IPVA notice.
    const r = resumoQuitar({ bloco: m })
    expect(r).toMatchObject({ totalCentavos: TOTAL_ABERTAS, nadaAQuitar: null, avisoDebitos: AVISO_IPVA_RJ, semMultas: null })
    expect(r.linhas).toEqual([{ rotulo: 'Multas em aberto', centavos: TOTAL_ABERTAS }])
  })

  it('a company owner goes as cnpj', async () => {
    comPedido(sb, { uf: 'RJ', multas: blocoRj({ nada_consta_pendente: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CNPJ))
    stubFetch(nadaConsta200(MULTAS, CNPJ))
    expect(await completarNadaConstaRj(sb, 'p1')).toMatchObject({ feito: 'ok' })
    expect(chamadasRj[0]!.get('cnpj')).toBe(CNPJ_DIGITOS)
    expect(chamadasRj[0]!.has('cpf')).toBe(false)
  })

  it('without the full document: the block stays as today, no call', async () => {
    comPedido(sb, { uf: 'RJ', multas: blocoRj({ nada_consta_pendente: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira('***.456.789-**'))
    stubFetch(nadaConsta200(MULTAS))
    expect(await completarNadaConstaRj(sb, 'p1')).toMatchObject({ feito: 'sem_documento' })
    expect(chamadasRj).toHaveLength(0)
    const m = snapDe(sb).multas
    expect(m).toMatchObject({ debitos_indisponiveis: true, aviso_debitos: AVISO_DEBITOS_RJ, multas_total_centavos: null, multas_itens: [], nada_consta_sem_documento: true })
    expect(m.nada_consta_pendente).toBeUndefined()
    expect(m.multas_fonte).toBeUndefined()
    expect(sb.tab('premium_custos')).toHaveLength(0)
    // Fines not consulted: no "Nenhuma multa" line, the old notice stays.
    expect(resumoQuitar({ bloco: m })).toMatchObject({ semMultas: null, avisoDebitos: AVISO_DEBITOS_RJ })
  })

  it('does not fire outside the Completa', async () => {
    comPedido(sb, { uf: 'RJ', plano: 'basica', multas: blocoRj({ nada_consta_pendente: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CPF))
    stubFetch(nadaConsta200(MULTAS))
    expect(await completarNadaConstaRj(sb, 'p1')).toMatchObject({ feito: 'pulado' })
    expect(chamadasRj).toHaveLength(0)
    expect(snapDe(sb).multas.nada_consta_pendente).toBeUndefined()
  })

  it('612: no unpaid fine (charged); the IPVA is still unknown, so never "nada a quitar"', async () => {
    comPedido(sb, { uf: 'RJ', multas: blocoRj({ nada_consta_pendente: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CPF))
    stubFetch({ code: 612, code_message: 'A consulta não retornou dados.', errors: ['Nenhuma multa encontrada'], header: { price: '0.24' } })
    expect(await completarNadaConstaRj(sb, 'p1')).toMatchObject({ feito: 'ok' })
    const m = snapDe(sb).multas
    expect(m).toMatchObject({ multas_itens: [], multas_total_centavos: 0, multas_fonte: 'detran_rj_nada_consta', debitos_indisponiveis: true, aviso_debitos: AVISO_IPVA_RJ })
    expect(resumoQuitar({ bloco: m })).toMatchObject({
      totalCentavos: 0, nadaAQuitar: null, avisoDebitos: AVISO_IPVA_RJ, semMultas: 'Nenhuma multa em aberto no DETRAN-RJ na data da consulta.',
    })
    expect(sb.tab('premium_custos')).toEqual([expect.objectContaining({ fonte: 'infosimples_detran_rj_nada_consta', code: 612, preco: 0.24 })])
  })

  it('failure: the block stays as today, not cached, never called again for the order', async () => {
    comPedido(sb, { uf: 'RJ', multas: blocoRj({ nada_consta_pendente: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CPF))
    stubFetch({ code: 609, code_message: 'Erro na origem.', errors: ['Origem fora do ar'], header: { price: '0.24' } })
    expect(await completarNadaConstaRj(sb, 'p1')).toMatchObject({ feito: 'indisponivel', code: 609 })
    const m = snapDe(sb).multas
    expect(m).toMatchObject({ aviso_debitos: AVISO_DEBITOS_RJ, debitos_indisponiveis: true, multas_total_centavos: null, nada_consta_indisponivel: true })
    expect(sb.tab('fonte_cache')).toHaveLength(0)
    expect(await completarNadaConstaRj(sb, 'p1')).toMatchObject({ feito: 'pulado' })
    expect(chamadasRj).toHaveLength(1)
  })

  it('plate cache (24 h): no call and no document needed', async () => {
    comPedido(sb, { uf: 'RJ', multas: blocoRj({ nada_consta_pendente: true }) })
    const itens = parsearNadaConstaRj({ multas: MULTAS })
    sb.tab('fonte_cache').push({ fonte: 'nada_consta_rj', chave: PLACA, status: 'ok', payload: { itens }, consultado_em: new Date().toISOString(), expira_em: new Date(Date.now() + H).toISOString() })
    stubFetch(nadaConsta200(MULTAS))
    expect(await completarNadaConstaRj(sb, 'p1')).toMatchObject({ feito: 'ok', cache: true })
    expect(chamadasRj).toHaveLength(0)
    expect(snapDe(sb).multas).toMatchObject({ multas_total_centavos: TOTAL_ABERTAS, aviso_debitos: AVISO_IPVA_RJ })
  })
})

describe('restrictions and partner answer at different times: whoever finishes last fires, once', () => {
  it('partner answer first, DETRAN-RJ later: writing the RJ block fires the call', async () => {
    comPedido(sb, { uf: 'RJ' })
    stubFetch(nadaConsta200(MULTAS))
    await completarHistoricoVeicular(sb, pedido(), depsParceira(respostaParceira(CPF)))
    await esperarVoo()
    expect(chamadasRj).toHaveLength(0)
    expect((await completarDetran(sb, { id: 'p1', placa: PLACA }, { response: [RESPONSE] })).ok).toBe(true)
    await esperarVoo()
    expect(chamadasRj).toHaveLength(1)
    expect(snapDe(sb).multas).toMatchObject({ multas_fonte: 'detran_rj_nada_consta', multas_total_centavos: TOTAL_ABERTAS })
    expect(snapDe(sb).multas.restricoes_detran).toEqual([{ tipo: 'restricao', texto: 'EXISTE INTENCAO/COMUNICACAO DE VENDA' }])
  })

  it('DETRAN-RJ first, partner answer later: as today until the document comes, then the call', async () => {
    comPedido(sb, { uf: 'RJ' })
    stubFetch(nadaConsta200(MULTAS))
    expect((await completarDetran(sb, { id: 'p1', placa: PLACA }, { response: [RESPONSE] })).ok).toBe(true)
    await esperarVoo()
    expect(chamadasRj).toHaveLength(0)
    expect(snapDe(sb).multas).toMatchObject({ aviso_debitos: AVISO_DEBITOS_RJ, nada_consta_sem_documento: true })
    await completarHistoricoVeicular(sb, pedido(), depsParceira(respostaParceira(CPF)))
    await esperarVoo()
    expect(chamadasRj).toHaveLength(1)
    expect(snapDe(sb).multas).toMatchObject({ multas_fonte: 'detran_rj_nada_consta', aviso_debitos: AVISO_IPVA_RJ })
  })

  it('both triggers at the same moment: one call', async () => {
    comPedido(sb, { uf: 'RJ', multas: blocoRj({ nada_consta_pendente: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CPF))
    let soltar: () => void = () => {}
    stubFetch(() => new Promise((ok) => { soltar = () => ok(nadaConsta200(MULTAS)) }))
    const a = completarNadaConstaRj(sb, 'p1')
    const b = completarNadaConstaRj(sb, 'p1')
    await vi.waitFor(() => expect(chamadasRj).toHaveLength(1))
    soltar()
    const r = await Promise.all([a, b])
    expect(chamadasRj).toHaveLength(1)
    expect(r.map((x) => x.feito).sort()).toEqual(['ok', 'pulado'])
  })

  it('while the call is out the DETRAN source is not done, so the page keeps waiting for it', () => {
    expect(fonteConcluida('detran', { multas: blocoRj({ nada_consta_pendente: true }) })).toBe(false)
    expect(fonteConcluida('detran', { multas: blocoRj({ nada_consta_sem_documento: true }) })).toBe(true)
    expect(fonteConcluida('detran', { multas: blocoRj() })).toBe(true)
  })

  it('the DETRAN queue job picks up a call left waiting', async () => {
    comPedido(sb, { uf: 'RJ', multas: blocoRj({ nada_consta_pendente: true }) })
    comRespostaPaga(sb, 'p1', respostaParceira(CPF))
    stubFetch(nadaConsta200(MULTAS))
    expect(await completarDetran(sb, { id: 'p1', placa: PLACA }, { response: [RESPONSE], semRetry: true })).toMatchObject({ pulado: 'ja tem detran_rj' })
    await esperarVoo()
    expect(chamadasRj).toHaveLength(1)
  })
})

describe('no owner name, CPF or CNPJ outside the restricted table (RJ)', () => {
  it('snapshot, plate cache, cost (detail and raw) and logs never carry them; the raw keeps the fines without the agent', async () => {
    const logs = capturarLogs()
    comPedido(sb, { id: 'p1', uf: 'RJ' })
    comPedido(sb, { id: 'p2', uf: 'RJ' })
    let resposta: any = nadaConsta200(MULTAS)
    stubFetch(() => resposta)
    await completarDetran(sb, { id: 'p1', placa: PLACA }, { response: [RESPONSE] })
    await esperarVoo()
    await completarHistoricoVeicular(sb, pedido('p1'), depsParceira(respostaParceira(CPF)))
    await esperarVoo()
    // p2: company owner, and the DETRAN-RJ refuses echoing the CNPJ and the name.
    resposta = {
      code: 607, code_message: `Parâmetro cnpj ${CNPJ_DIGITOS} inválido para ${NOME}`, errors: [`O CNPJ ${CNPJ} de ${NOME} não corresponde ao RENAVAM`],
      header: { price: '0.24', parameters: { cnpj: CNPJ_DIGITOS, renavam: RENAVAM } },
    }
    sb.tab('fonte_cache').splice(0)
    comRespostaPaga(sb, 'p2', respostaParceira(CNPJ, { proprietarios: { total: 1, proprietario_atual: { nome: NOME, razao_social: NOME, documentoOriginal: CNPJ } } }))
    await completarDetran(sb, { id: 'p2', placa: PLACA }, { response: [RESPONSE] })
    await esperarVoo()
    expect(chamadasRj).toHaveLength(2)
    expect(snapDe(sb, 'p1').multas.multas_fonte).toBe('detran_rj_nada_consta')
    expect(snapDe(sb, 'p2').multas.nada_consta_indisponivel).toBe(true)

    expect(vazamentos(JSON.stringify(sb.tab('pedidos_premium').map((p: any) => p.relatorio_snapshot)))).toEqual([])
    expect(vazamentos(JSON.stringify(sb.tab('fonte_cache')))).toEqual([])
    expect(vazamentos(JSON.stringify(sb.tab('premium_custos')))).toEqual([])
    expect(vazamentos(logs.join('\n'))).toEqual([])
    const custos = sb.tab('premium_custos').filter((c: any) => c.fonte === 'infosimples_detran_rj_nada_consta')
    expect(custos).toHaveLength(2)
    expect(custos[0].bruto.multas).toHaveLength(MULTAS.length)
    expect(custos[0].bruto.multas[0]).toMatchObject({ auto_de_infracao: 'E00000001', status_de_pagamento: 'NÃO PAGO', valor_a_ser_pago: 'R$ 130,16' })
    expect(JSON.stringify(custos)).not.toMatch(/AGENTE|parameters|storage\.invalid/)
  })
})
