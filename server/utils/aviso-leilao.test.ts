import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'
import { avisarLeilaoTardio, tipoDoAviso, avisoLeilaoLigado, infoDoHistorico, modeloDaResposta } from './aviso-leilao'
import { textosAvisoLeilao, montarEmailAviso } from './premium-email'

// Regra do Cesar (21/out/2026): leilao ou indicio de sinistro que aparece
// DEPOIS da entrega vira e-mail ao cliente, uma vez por pedido. Since
// 18/11/2026 ("Avisar sempre"): a new auction is told even when the page
// already showed a damage sign; at most one auction notice per order, and a
// notice that had only the damage sign does not block it.
const vazio = { resumo: { tem_indicio: false }, passagens: [] }
const comLeilao = { resumo: { tem_indicio: true }, passagens: [{ nivel: 'confirmado', data_leilao: '2019-08-27', comitente: 'MAPFRE SEGUROS GERAIS S/A' }] }
const soSinistro = { ...vazio, sinistro_parceiro: { indicio: true, mensagem: 'x' } }
const leilaoESinistro = { ...comLeilao, sinistro_parceiro: { indicio: true, mensagem: 'x' } }

let sb: ReturnType<typeof supabaseMemoria>
const enviar = vi.fn(async () => true)
const pedido = (x: any = {}) => sb.tab('pedidos_premium').push({ id: 'p1', email: 'ana@x.com', placa: 'ABC1D23', token_entrega: 'tok', status: 'entregue', aviso_leilao_em: null, aviso_sinistro_em: null, ...x })
const avisar = (antes: any, depois: any, x: any = {}) => avisarLeilaoTardio(sb, 'p1', antes, depois, { enviar, ligado: true, log: () => {}, ...x })
const linha = () => sb.tab('pedidos_premium')[0]!

beforeEach(() => { sb = supabaseMemoria(); enviar.mockClear(); enviar.mockImplementation(async () => true) })

describe('gatilho', () => {
  it('auction: a page with no auction that now shows one, a damage sign before included', () => {
    expect(tipoDoAviso(vazio, comLeilao)).toBe('leilao')
    expect(tipoDoAviso(null, comLeilao)).toBe('leilao')
    expect(tipoDoAviso(soSinistro, leilaoESinistro)).toBe('leilao')
    // The page already showed an auction: not new.
    expect(tipoDoAviso(comLeilao, { ...comLeilao, passagens: [...comLeilao.passagens, { nivel: 'possivel' }] })).toBeNull()
  })
  it('damage sign alone: only on a page that showed nothing, as before', () => {
    expect(tipoDoAviso(vazio, soSinistro)).toBe('sinistro')
    expect(tipoDoAviso(null, soSinistro)).toBe('sinistro')
    expect(tipoDoAviso(soSinistro, soSinistro)).toBeNull()
    expect(tipoDoAviso(comLeilao, leilaoESinistro)).toBeNull()
    expect(tipoDoAviso(vazio, vazio)).toBeNull()
    expect(tipoDoAviso(vazio, { ...vazio, sinistro_parceiro: { indicio: false } })).toBeNull()
  })
  it('as the page shows it: a passage the model lock hides does not count, before or after', () => {
    const onix = { nivel: 'provavel', fonte: 'casa_x', fonte_tipo: 'privado', lote: '7', data_leilao: '2026-04-01', veiculo_na_fonte: { marca: 'CHEVROLET', modelo: 'ONIX 1.4 AT LTZ' } }
    const spin = { modelo: 'CHEV/SPIN 1.8L AT LTZ' }
    const soOnix = { resumo: { tem_indicio: true }, passagens: [onix] }
    // An ONIX in a SPIN report: the page hides it, so it is no auction to tell...
    expect(tipoDoAviso(vazio, soOnix, spin)).toBeNull()
    // ...and a page that showed only it showed no auction.
    expect(tipoDoAviso(soOnix, { ...soOnix, passagens: [onix, ...comLeilao.passagens] }, spin)).toBe('leilao')
    expect(tipoDoAviso(soOnix, { ...soOnix, passagens: [onix, ...comLeilao.passagens] })).toBeNull()
  })
  it('flag: 1 liga, 0 desliga, sem env so fora do staging/homolog', () => {
    expect(avisoLeilaoLigado({ public: {} }, '1')).toBe(true)
    expect(avisoLeilaoLigado({ public: {} }, '0')).toBe(false)
    expect(avisoLeilaoLigado({ public: {} }, undefined)).toBe(true)
    expect(avisoLeilaoLigado({ public: { staging: true } }, undefined)).toBe(false)
    expect(avisoLeilaoLigado({ public: { gated: true } }, undefined)).toBe(false)
  })
})

describe('envio', () => {
  it('surgiu leilao com e-mail: envia uma vez e marca aviso_leilao_em', async () => {
    pedido()
    expect(await avisar(vazio, comLeilao)).toBe('enviado')
    expect(enviar).toHaveBeenCalledOnce()
    expect((enviar.mock.calls[0] as any)[0]).toMatchObject({ email: 'ana@x.com', placa: 'ABC1D23', token: 'tok', info: { sinistro: false } })
    expect(sb.tab('pedidos_premium')[0].aviso_leilao_em).toBeTruthy()
    // nao reenvia
    expect(await avisar(vazio, { ...comLeilao, sinistro_parceiro: { indicio: true } })).toBe('ja_avisado')
    expect(enviar).toHaveBeenCalledOnce()
  })
  it('sem e-mail, sem mudanca, desligado, nao entregue: nao envia', async () => {
    pedido({ email: null })
    expect(await avisar(vazio, comLeilao)).toBe('sem_email')
    expect(await avisar(vazio, vazio)).toBe('sem_mudanca')
    expect(await avisar(vazio, comLeilao, { ligado: false })).toBe('desligado')
    sb.tab('pedidos_premium')[0].status = 'pago'
    expect(await avisar(vazio, comLeilao)).toBe('falhou')
    expect(enviar).not.toHaveBeenCalled()
  })
  it('envio falhou: desfaz a marca para tentar de novo', async () => {
    pedido()
    enviar.mockImplementation(async () => false)
    expect(await avisar(vazio, comLeilao)).toBe('falhou')
    expect(sb.tab('pedidos_premium')[0].aviso_leilao_em).toBeNull()
    expect(await avisar(vazio, soSinistro)).toBe('falhou')
    expect(linha().aviso_sinistro_em).toBeNull()
  })
})

// Cesar, 18/11/2026: "Avisar sempre".
describe('avisar sempre: a new auction after a damage sign, one auction notice per order', () => {
  it('a new auction when the page already showed a damage sign: told, with the damage paragraph', async () => {
    pedido()
    expect(await avisar(soSinistro, leilaoESinistro)).toBe('enviado')
    expect(enviar).toHaveBeenCalledOnce()
    const info = (enviar.mock.calls[0] as any)[0].info
    expect(info).toMatchObject({ sinistro: true, passagens: [{ nivel: 'confirmado' }] })
    expect(textosAvisoLeilao('ABC1D23', info).paragrafos[1]).toBe('Também consta indício de sinistro em base parceira de leilões e sinistros.')
    expect(linha().aviso_leilao_em).toBeTruthy()
    expect(linha().aviso_sinistro_em).toBeNull()
  })

  it('nothing before: told, as before', async () => {
    pedido()
    expect(await avisar(vazio, comLeilao)).toBe('enviado')
    expect(linha().aviso_leilao_em).toBeTruthy()
  })

  it('an auction already told: never again, not for another auction nor for a damage sign', async () => {
    pedido({ aviso_leilao_em: '2026-11-17T12:00:00.000Z' })
    expect(await avisar(soSinistro, leilaoESinistro)).toBe('ja_avisado')
    expect(await avisar(vazio, comLeilao)).toBe('ja_avisado')
    expect(await avisar(vazio, soSinistro)).toBe('ja_avisado')
    expect(enviar).not.toHaveBeenCalled()
    expect(linha().aviso_leilao_em).toBe('2026-11-17T12:00:00.000Z')
  })

  it('a notice with only the damage sign, then an auction: the auction is told too, once', async () => {
    pedido()
    expect(await avisar(vazio, soSinistro)).toBe('enviado')
    expect(linha().aviso_sinistro_em).toBeTruthy()
    expect(linha().aviso_leilao_em).toBeNull()
    expect((enviar.mock.calls[0] as any)[0].info).toEqual({ passagens: [], sinistro: true })
    // The damage sign alone is not told twice.
    expect(await avisar(vazio, soSinistro)).toBe('ja_avisado')
    // The auction found later.
    expect(await avisar(soSinistro, leilaoESinistro)).toBe('enviado')
    expect(linha().aviso_leilao_em).toBeTruthy()
    expect((enviar.mock.calls[1] as any)[0].info).toMatchObject({ sinistro: true, passagens: [{ nivel: 'confirmado' }] })
    expect(await avisar(soSinistro, leilaoESinistro)).toBe('ja_avisado')
    expect(enviar).toHaveBeenCalledTimes(2)
  })

  it('the auction mark is taken only while it is free: two runs at once send one e-mail', async () => {
    pedido()
    const r = await Promise.all([avisar(soSinistro, leilaoESinistro), avisar(soSinistro, leilaoESinistro)])
    expect(r.sort()).toEqual(['enviado', 'ja_avisado'])
    expect(enviar).toHaveBeenCalledOnce()
  })

  // Review of PR #763, finding 2: both runs read the order before either marks it.
  it('the damage mark is taken only while it is free: two runs at once send one e-mail', async () => {
    pedido()
    const r = await Promise.all([avisar(vazio, soSinistro), avisar(vazio, soSinistro)])
    expect(r.sort()).toEqual(['enviado', 'ja_avisado'])
    expect(enviar).toHaveBeenCalledOnce()
    expect(linha().aviso_sinistro_em).toBeTruthy()
    expect(linha().aviso_leilao_em).toBeNull()
  })

  // Lead, 18/11/2026: the same auction often comes from two sources in ways
  // that do not match, and a false "new auction" e-mail is worse than none.
  it('an auction already on the page and another one arriving: no e-mail', async () => {
    pedido()
    const outro = { nivel: 'provavel', fonte: 'casa_y', fonte_tipo: 'privado', lote: '15', data_leilao: '2021-05-04' }
    expect(await avisar(comLeilao, { ...leilaoESinistro, passagens: [...comLeilao.passagens, outro] })).toBe('sem_mudanca')
    expect(enviar).not.toHaveBeenCalled()
    expect(linha().aviso_leilao_em).toBeNull()
  })
})

describe('texto', () => {
  const tudo = (t: { titulo: string; paragrafos: string[]; assunto: string }) => [t.titulo, t.assunto, ...t.paragrafos].join(' ')
  it('confirmado com data e comitente, linguagem leiga, botao', () => {
    const t = textosAvisoLeilao('ABC1D23', infoDoHistorico(comLeilao))
    expect(t.assunto).toBe('Seu relatório da placa ABC1D23 foi atualizado')
    expect(t.paragrafos[0]).toBe('Consta no seu relatório da placa ABC1D23 um registro de leilão em 27/08/2019, com comitente Mapfre Seguros Gerais S/A. Nível confirmado: a placa ou o chassi são iguais aos deste veículo.')
    const m = montarEmailAviso({ link: 'https://x/premium/tok', ...t, botao: 'Ver relatório atualizado' })
    expect(m.html).toContain('Ver relatório atualizado')
  })
  it('possivel: pode ser outro veiculo; so sinistro: consta indicio', () => {
    expect(textosAvisoLeilao('ABC1D23', { passagens: [{ nivel: 'possivel' }], sinistro: false }).paragrafos[0]).toMatch(/registro possível de leilão\. Ele pode ser outro veículo do mesmo modelo e ano/)
    expect(textosAvisoLeilao('ABC1D23', { passagens: [], sinistro: true }).paragrafos[0]).toBe('Consta no seu relatório da placa ABC1D23 indício de sinistro em base parceira de leilões e sinistros.')
  })
  it('engine-number link: the notice does not claim plate or VIN match and never carries the number', () => {
    const motorSo = { passagens: [{ nivel: 'confirmado', data_leilao: '2019-05-10', evidencias: ['numero do motor igual', 'marca compativel', 'ano igual'] }] }
    const info = infoDoHistorico(motorSo)
    expect(info.passagens[0].ligadoPorMotor).toBe(true)
    expect(JSON.stringify(info)).not.toMatch(/evidencias|motor igual/)
    const t = textosAvisoLeilao('ABC1D23', info)
    expect(t.paragrafos[0]).toContain('Nível confirmado: o número do motor e outros dados batem com os deste veículo.')
    expect(tudo(t)).not.toContain('a placa ou o chassi são iguais')
    const prov = textosAvisoLeilao('ABC1D23', { passagens: [{ nivel: 'provavel', ligadoPorMotor: true }], sinistro: false })
    expect(prov.paragrafos[0]).toContain('Nível provável: o número do motor bate, mas faltam dados para confirmar.')
    expect(tudo(prov)).not.toContain('—')
  })
  it('engine number plus full plate match keeps the plate/VIN wording', () => {
    const info = infoDoHistorico({ passagens: [{ nivel: 'confirmado', evidencias: ['numero do motor igual', 'placa completa igual'] }] })
    expect(textosAvisoLeilao('ABC1D23', info).paragrafos[0]).toContain('a placa ou o chassi são iguais')
  })
  it('nunca afirma, sem travessao, sem o nome do fornecedor nem orgao federal', () => {
    for (const info of [infoDoHistorico(comLeilao), { passagens: [{ nivel: 'possivel' }], sinistro: true }, { passagens: [], sinistro: true }]) {
      const s = tudo(textosAvisoLeilao('ABC1D23', info))
      expect(s).not.toMatch(new RegExp('—|senatran|' + 'avali' + 'service', 'i'))
      expect(s).not.toMatch(/\bfoi (leiloado|batido|sinistrado)/i)
    }
  })
})

describe('alert e-mail counts the same cards as the page (one card per auction, 13/11/2026)', () => {
  it('duplicate canhao passage and joined notice do not add "more records"', () => {
    const h = {
      resumo: { tem_indicio: true },
      passagens: [
        { fonte: 'detran_xx', fonte_tipo: 'detran', nivel: 'confirmado', lote: '0315', data_leilao: '2026-06-18' },
        { fonte: 'canhao:cdn.exemplo-cdn.net', fonte_tipo: 'privado', nivel: 'confirmado', lote: '315', data_leilao: '2026-06-18' },
        { fonte: 'detran_xx', fonte_tipo: 'detran', nivel: 'confirmado', situacao: 'notificado', detalhes: { tipo_registro: 'notificacao_leilao', data_publicacao: '2026-05-02' } },
      ],
    }
    const info = infoDoHistorico(h)
    expect(info.passagens).toHaveLength(1)
    expect(textosAvisoLeilao('ABC1D23', info).paragrafos.join(' ')).not.toMatch(/Há mais/)
  })
})

describe('alert e-mail applies the model lock before joining cards (review of PR #750)', () => {
  const h = {
    resumo: { tem_indicio: true },
    passagens: [
      { fonte: 'casa_x', fonte_tipo: 'privado', nivel: 'possivel', lote: '12', data_leilao: '2026-03-10', veiculo_na_fonte: { marca: 'CHEVROLET', modelo: 'ONIX 1.4 AT LTZ' } },
      { fonte: 'canhao:cdn.exemplo.net', fonte_tipo: 'privado', nivel: 'confirmado', lote: '012', data_leilao: '2026-03-10' },
    ],
  }

  it('the confirmed canhao auction stays in the e-mail info', () => {
    const info = infoDoHistorico(h, { modelo: 'CHEV/SPIN 1.8L AT LTZ' })
    expect(info.passagens).toHaveLength(1)
    expect(info.passagens[0].nivel).toBe('confirmado')
  })

  it('the model comes from the order snapshot', async () => {
    pedido({ resposta: { descricaoMarcaModelo: 'CHEV/SPIN 1.8L AT LTZ' } })
    expect(await avisar(vazio, h)).toBe('enviado')
    const info = (enviar.mock.calls[0] as any)[0].info
    expect(info.passagens.map((p: any) => p.nivel)).toEqual(['confirmado'])
  })
})

describe('alert e-mail reads the model from the real snapshot format (review 2 of PR #750)', () => {
  // A 'provavel' passage of an ONIX in a SPIN report: the page hides it.
  const h = {
    resumo: { tem_indicio: true },
    passagens: [
      { fonte: 'casa_x', fonte_tipo: 'privado', nivel: 'provavel', lote: '7', data_leilao: '2026-04-01', veiculo_na_fonte: { marca: 'CHEVROLET', modelo: 'ONIX 1.4 AT LTZ' } },
      { fonte: 'casa_y', fonte_tipo: 'privado', nivel: 'confirmado', lote: '9', data_leilao: '2026-05-01' },
    ],
  }
  // What the snapshot stores: normalizarResposta gives a flat object.
  const snapshot = { consulta: { response: { placa: 'ABC1D23', descricaoMarcaModelo: 'CHEV/SPIN 1.8L AT LTZ' } } }

  it('modeloDaResposta reads a flat object and a one-item list', () => {
    expect(modeloDaResposta(snapshot.consulta.response)).toBe('CHEV/SPIN 1.8L AT LTZ')
    expect(modeloDaResposta([snapshot.consulta.response])).toBe('CHEV/SPIN 1.8L AT LTZ')
    expect(modeloDaResposta(null)).toBeNull()
    expect(modeloDaResposta({ descricaoMarcaModelo: '  ' })).toBeNull()
  })

  it('selects the response itself, not its first list item', async () => {
    const selects: string[] = []
    const from = sb.from.bind(sb)
    const espiao: any = { ...sb, from: (t: string) => { const q: any = from(t); const sel = q.select; q.select = (c?: string, o?: any) => { if (c) selects.push(c); return sel(c, o) }; return q } }
    pedido({ resposta: snapshot.consulta.response })
    expect(await avisarLeilaoTardio(espiao, 'p1', vazio, h, { enviar, ligado: true, log: () => {} })).toBe('enviado')
    const sel = selects.find((c) => c.includes('relatorio_snapshot')) || ''
    expect(sel).toMatch(/resposta:relatorio_snapshot->consulta->response(,|$)/)
    expect(sel).not.toMatch(/->0/)
  })

  it.each([
    ['response as a flat object', snapshot.consulta.response],
    ['response as a one-item list', [snapshot.consulta.response]],
  ])('the model lock runs with %s', async (_n, resposta) => {
    pedido({ resposta })
    expect(await avisar(vazio, h)).toBe('enviado')
    const info = (enviar.mock.calls[0] as any)[0].info
    expect(info.passagens.map((p: any) => p.nivel)).toEqual(['confirmado'])
  })
})
