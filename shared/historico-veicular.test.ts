import { describe, it, expect } from 'vitest'
import COM from '../server/utils/__fixtures__/parceiro-historico-com-registros.json'
import SEM from '../server/utils/__fixtures__/parceiro-historico-sem-registros.json'
import ROUBO from '../server/utils/__fixtures__/parceiro-historico-roubo-indenizacao.json'
import EDITAL from '../server/utils/__fixtures__/parceiro-historico-edital-lote.json'
import { NOME_FORNECEDOR_HISTORICO_RE } from '../server/utils/parceiro-historico-env'
import {
  parsearRespostaHistorico, historicoLeilaoComHistorico, historicoVeicularParaTela, tituloPassagemParceira,
  telaDonos, telaUso, telaSinistro, casaDoRegistro, tipoDoDono, mesesDePosse, tempoDePosse,
  historicoDoVeiculo, nomeDeEmpresa, passagensDoHistorico, MOTIVO_CHASSI_DIVERGENTE, ehOrgaoPublico,
  faltasDaResposta, respostaIncompleta, historicoPedeReserva,
} from './historico-veicular'
import LEILAO_REAL from '../server/utils/__fixtures__/parceiro-leilao-real.json'
import { historicoNaTela, historicoParaExibicao } from './leilao-exibicao'
import { linhasBasesSemRegistro, rotuloIndicadorLeilao, historicoComParceiro, parsearRespostaParceiro } from './fonte-parceira'
import { historicoLgpd } from './leilao-lgpd'

// Fixtures: the four handoff examples with every identifying trace replaced
// (plates, VIN, dates, states, model, insurer, bank, house, lots).
const CHASSI = '9XXHV00000X000001'
const copia = (x: any) => structuredClone(x)
const bloco = (x: any) => parsearRespostaHistorico(copia(x))!
const vazio = () => ({ resumo: { tem_indicio: false, nivel_max: null, n_confirmado: 0, n_provavel: 0, n_possivel: 0, possiveis_ambiguos: 0, fontes_com_passagem: [] }, passagens: [] as any[], linha_do_tempo: null, recorrencia: null })
function comIndicador(base: any, codigo: string, ind: Record<string, unknown>) {
  const r = copia(base)
  r.dados.indicadores = r.dados.indicadores.map((i: any) => (i.codigo === codigo ? { ...i, ...ind } : i))
  return r
}

describe('parser of the vehicle history answer', () => {
  it('with records: owners, previous use, insurance and auction, all clean', () => {
    const b = bloco(COM)
    expect(b.status).toBe('ok')
    expect(b.donos).toMatchObject({ total: 12, semData: 3, trocasRapidas: 6, ufZeroKm: 'PR', ufs: ['PR', 'BA', 'GO'] })
    expect(b.donos!.atual).toMatchObject({ data: '2017-07-12', tempo: '8 anos e 4 meses', tipo: 'pessoa', uf: 'PR', atual: true })
    expect(b.donos!.registros).toHaveLength(9)
    expect(b.donos!.registros[0].data).toBe('2017-07-12')
    expect(b.donos!.registros.find((o) => o.data === '2012-06-26')?.tipo).toBe('loja')
    expect(b.uso).toMatchObject({ locadora: null, taxiPcd: false, viatura: false, lojaSalvados: false, empresas: [{ loja: true, ano: '2012' }] })
    expect(b.uso!.financeiras).toEqual([{ instituicao: 'BANCO EXEMPLO S.A. ARRENDAMENTO MERCANTIL', ano: '2007' }])
    expect(b.sinistro).toMatchObject({ indenizacoes: [{ seguradora: 'TOKIO MARINE SEGURADORA', ano: '2024' }], monta: { nivel: 'media', ano: '2019' }, parecer: 'alto' })
    expect(b.leilao!.indicioSinistro).toBe(true)
    expect(b.leilao!.chassiFonte).toBe(CHASSI)
  })

  it('without records: owners only, no insurance block, no auction', () => {
    const b = bloco(SEM)
    expect(b.donos).toMatchObject({ total: 2, semData: 0, trocasRapidas: 0, ufs: ['GO'] })
    expect(b.donos!.atual).toMatchObject({ data: '2017-12-26', tipo: 'pessoa' })
    expect(b.donos!.registros.map((o) => o.tipo)).toEqual(['pessoa', 'empresa'])
    expect(b.uso!.empresas).toEqual([{ loja: false, ano: '2015' }])
    expect(b.uso!.frotista).toEqual({ veiculos: 120, data: '2015-10-06' })
    expect(b.sinistro!.parecer).toBeNull()
    expect(telaSinistro(b.sinistro)).toBeNull()
    expect(b.leilao).toEqual({ registros: [], indicioSinistro: false, chassiFonte: '9XXHV00000X000002' })
  })

  it('theft with recovery and total loss: years only, no police report data', () => {
    const b = bloco(ROUBO)
    expect(b.sinistro!.roubo).toEqual([{ evento: 'registro', ano: '2019' }, { evento: 'recuperacao', ano: '2021' }, { evento: 'devolucao', ano: '2021' }])
    expect(b.sinistro!.recuperado).toBe(true)
    expect(b.sinistro!.indenizacoes).toEqual([{ seguradora: 'HDI SEGUROS', ano: '2025' }])
    expect(b.sinistro!.parecer).toBe('alto')
  })

  it('not a success, no data or not an object: null', () => {
    expect(parsearRespostaHistorico({ ...copia(COM), success: false })).toBeNull()
    expect(parsearRespostaHistorico({ success: true })).toBeNull()
    expect(parsearRespostaHistorico('erro')).toBeNull()
    expect(parsearRespostaHistorico(null)).toBeNull()
  })
})

describe('no personal data leaves the parser', () => {
  const CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/
  const CNPJ = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/
  const SO_DIGITOS = /\b\d{11}\b|\b\d{14}\b/
  for (const [nome, fx] of [['with records', COM], ['without records', SEM], ['theft', ROUBO], ['edital', EDITAL]] as const) {
    it(`${nome}: snapshot block, report JSON and auction section`, () => {
      const b = bloco(fx)
      const tela = historicoVeicularParaTela(b)
      const leilao = historicoLgpd(historicoLeilaoComHistorico(vazio(), b, { chassi: CHASSI }))
      for (const json of [JSON.stringify(b), JSON.stringify(tela), JSON.stringify(leilao)]) {
        // Names, companies, other cities, police station, description. The owner
        // city shows (17/11/2026), so in the fixtures it is CIDADE EXEMPLO.
        expect(json).not.toMatch(/FICTICI/i)
        expect(json).not.toMatch(CPF)
        expect(json).not.toMatch(CNPJ)
        expect(json).not.toMatch(SO_DIGITOS)
        expect(json).not.toMatch(/documento|boletim|delegacia|razao_social|municipio|endereco|"nome"/i)
        expect(json).not.toMatch(NOME_FORNECEDOR_HISTORICO_RE)
        expect(json).not.toMatch(/queryId|hash_autenticacao/)
      }
      // The VIN the partner answered for stays on the server side.
      expect(JSON.stringify(tela)).not.toContain('9XXHV')
    })
  }
  it('indicators that only feed the opinion never show their text', () => {
    const t = JSON.stringify(telaSinistro(bloco(ROUBO).sinistro))
    expect(t).not.toMatch(/ALERTA DE RISCO|OCORR[EÊ]NCIA POLICIAL|crime|730 dias|terceiros/i)
  })
})

describe('auction records of the partner', () => {
  it('edital with a real lot is a passage; the automatic "no lot" entry is not', () => {
    const regs = bloco(COM).leilao!.registros
    expect(regs).toContainEqual({ tipo: 'edital', ano: '2019', lote: '57', casa: 'Casa Exemplo Leilões', comitente: null })
    expect(regs.some((r) => r.ano === '2024' && r.tipo !== 'salvado')).toBe(false)
    const e = bloco(EDITAL).leilao!.registros
    expect(e).toEqual([{ tipo: 'edital', ano: '2021', lote: '212', casa: null, comitente: null }])
  })

  it('salvage sale by an insurer is a passage; bank (P7) never is', () => {
    const regs = bloco(COM).leilao!.registros
    expect(regs).toContainEqual({ tipo: 'salvado', ano: '2024', lote: null, casa: null, comitente: 'TOKIO MARINE SEGURADORA S/A' })
    expect(regs.some((r) => /BANCO/.test(String(r.comitente)))).toBe(false)
  })

  it('public body auction without a lot is a passage; an entry with neither stays out', () => {
    const r = copia(SEM)
    r.dados.outros_produtos.leiloes = [
      { ano: 2006, leiloeiro: 'WEB - LEILOES ONLINE', lote: 'NADA CONSTA', comitente: 'PREFEITURA MUNICIPAL DE CIDADE EXEMPLO' },
      { ano: 2024, leiloeiro: 'WEB - LEILOES ONLINE', lote: 'NADA CONSTA' },
    ]
    expect(bloco(r).leilao!.registros).toEqual([{ tipo: 'orgao', ano: '2006', lote: null, casa: null, comitente: 'PREFEITURA MUNICIPAL DE CIDADE EXEMPLO' }])
  })

  it('insurer as holder goes to previous use, not to the auction section', () => {
    const r = comIndicador(SEM, 'P1', { status: 'positivo', conteudo: [{ seguradora: 'HDI SEGUROS S/A', tipoEvento: 'Titularidade em Carteira de Seguradora', ano: '2019' }] })
    const b = bloco(r)
    expect(b.uso!.seguradoras).toEqual([{ seguradora: 'HDI SEGUROS S/A', ano: '2019' }])
    expect(b.leilao!.registros).toEqual([])
  })

  it('auction house: a house name, never a person nor a generic text', () => {
    expect(casaDoRegistro('PALACIO DOS LEILÃO')).toBe('Palácio dos Leilões')
    expect(casaDoRegistro('CASA EXEMPLO LEILÕES')).toBe('Casa Exemplo Leilões')
    expect(casaDoRegistro('Atuação compartilhada entre múltiplos leiloeiros durante o certame')).toBeNull()
    expect(casaDoRegistro('WEB - LEILOES ONLINE')).toBeNull()
    expect(casaDoRegistro('JOAO DA SILVA')).toBeNull()
    expect(casaDoRegistro('JOAO DA SILVA LEILOEIRO OFICIAL')).toBeNull()
    expect(casaDoRegistro('N/C')).toBeNull()
  })
})

describe('auction section with the partner part', () => {
  it('our base empty: partner passages with year-only titles, indicator says both bases', () => {
    const h = historicoLeilaoComHistorico(vazio(), bloco(COM), { chassi: CHASSI })
    expect(h.parceiro).toEqual({ status: 'ok', id_consulta: null, consultado_em: null })
    expect(h.sinistro_parceiro).toEqual({ indicio: true, mensagem: null })
    expect(h.resumo).toMatchObject({ tem_indicio: true, n_confirmado: 2, fontes_com_passagem: ['parceiro'] })
    expect(h.passagens.map((p: any) => tituloPassagemParceira(p))).toEqual(['Leilão em 2019', 'Venda de salvado pela Tokio Marine Seguradora S/A, registrada em 2024'])
    expect(h.passagens[0]).toMatchObject({ fonte: 'parceiro', fonte_exibicao: 'Base parceira', nivel: 'confirmado', data_leilao: null, ano_leilao: '2019', lote: '57', evidencias: ['chassi igual'] })
    expect(rotuloIndicadorLeilao(h.passagens)).toBe('Histórico de leilão (bases consultadas)')
  })

  it('VIN of the partner differs from ours: nothing of the partner, no damage flag (review 1, item 8)', () => {
    const base = vazio()
    const h = historicoLeilaoComHistorico(base, bloco(COM), { chassi: '9XXHV00000X999999' })
    expect(h).toBe(base)
    expect(h.passagens).toHaveLength(0)
    expect(h.parceiro).toBeUndefined()
    expect(h.sinistro_parceiro).toBeUndefined()
  })

  it('our base did not answer (null): no section is made up', () => {
    expect(historicoLeilaoComHistorico(null, bloco(COM), { chassi: CHASSI })).toBeNull()
  })

  it('empty state lines: nothing found, only damage, or call failed', () => {
    expect(linhasBasesSemRegistro(historicoLeilaoComHistorico(vazio(), bloco(SEM), {}))[1]).toEqual({ tag: 'Base parceira', texto: 'Nada encontrado na base do nosso parceiro premium.', tom: 'ok' })
    const soDano = comIndicador(SEM, 'P15', { status: 'positivo', mensagem: 'ATENÇÃO: EM 2020, O VEÍCULO APRESENTOU APONTAMENTO DE PEQUENA MONTA.', conteudo: 'ATENÇÃO: EM 2020, O VEÍCULO APRESENTOU APONTAMENTO DE PEQUENA MONTA.' })
    expect(linhasBasesSemRegistro(historicoLeilaoComHistorico(vazio(), bloco(soDano), {}))[1].tom).toBe('alerta')
    const falhou = historicoLeilaoComHistorico(vazio(), { status: 'falhou', consultadoEm: '2026-10-02T15:00:00Z' }, {})
    expect(linhasBasesSemRegistro(falhou)[1]).toEqual({ tag: 'Base parceira', texto: 'Não foi possível consultar agora.', tom: 'cinza' })
  })

  it('same auction in our base (strong passage, same year and lot or principal): one card, ours', () => {
    const nossa = (x: any) => ({ nivel: 'confirmado', fonte: 'copart', fonte_tipo: 'privado', data_leilao: '2019-08-27', lote: '00057', comitente: null, ...x })
    const base = { ...vazio(), passagens: [nossa({}), nossa({ data_leilao: '2024-03-02', lote: '9', comitente: 'TOKIO MARINE SEGURADORA S/A' })], resumo: { ...vazio().resumo, tem_indicio: true, n_confirmado: 2 } }
    const h = historicoLeilaoComHistorico(base, bloco(COM), { chassi: CHASSI })
    expect(h.passagens).toHaveLength(4)
    const tela: any = historicoParaExibicao(h)
    expect(tela.passagens.map((p: any) => p.fonte)).toEqual(['copart', 'copart'])
    expect(tela.resumo).toMatchObject({ n_confirmado: 2, fontes_com_passagem: ['copart'] })
  })

  it('a weak passage of ours, or another year, never absorbs the partner card', () => {
    const fraca = { ...vazio(), passagens: [{ nivel: 'possivel', fonte: 'copart', fonte_tipo: 'privado', data_leilao: '2019-08-27', lote: '57' }] }
    expect((historicoParaExibicao(historicoLeilaoComHistorico(fraca, bloco(COM), { chassi: CHASSI })) as any).passagens).toHaveLength(3)
    const outroAno = { ...vazio(), passagens: [{ nivel: 'confirmado', fonte: 'copart', fonte_tipo: 'privado', data_leilao: '2018-08-27', lote: '57' }] }
    expect((historicoNaTela(historicoLeilaoComHistorico(outroAno, bloco(COM), { chassi: CHASSI }), null) as any).passagens).toHaveLength(3)
  })

  it('failed call with our base empty marks the partner line; with a state already set, keeps it', () => {
    expect(historicoLeilaoComHistorico(vazio(), { status: 'teto', consultadoEm: null }, {}).parceiro).toEqual({ status: 'teto', consultado_em: null })
    const comEstado = { ...vazio(), parceiro: { status: 'ok' } }
    expect(historicoLeilaoComHistorico(comEstado, { status: 'falhou', consultadoEm: null }, {})).toBe(comEstado)
  })
})

describe('review 1 of PR #752', () => {
  const comLeiloes = (leiloes: any[]) => { const r = copia(SEM); r.dados.outros_produtos.leiloes = leiloes; return r }

  // Item 1: generic principal or no lot is not a passage.
  it.each(['DIVERSOS', 'PARTICULAR', 'EMPRESA', 'PARTICULAR/EMPRESA', 'VARIOS', 'NAO INFORMADO'])('principal "%s" without a lot: not a passage', (comitente) => {
    expect(bloco(comLeiloes([{ ano: 2024, leiloeiro: 'WEB - LEILOES', lote: 'NADA CONSTA', comitente }])).leilao!.registros).toEqual([])
  })
  it.each(['NÃO CONSTA', 'NAO CONSTA', 'S/N', 'SN', 'SEM NUMERO', 'SEM NÚMERO', '000', '0000', 'N/A', 'SEM LOTE'])('lot "%s" is no lot', (lote) => {
    expect(bloco(comLeiloes([{ ano: 2024, leiloeiro: 'CASA EXEMPLO LEILÕES', lote }])).leilao!.registros).toEqual([])
  })
  it('real lot with a generic principal: the edital stays, without the principal', () => {
    expect(bloco(comLeiloes([{ ano: 2021, leiloeiro: 'CASA EXEMPLO LEILÕES', lote: '7', comitente: 'DIVERSOS' }])).leilao!.registros)
      .toEqual([{ tipo: 'edital', ano: '2021', lote: '7', casa: 'Casa Exemplo Leilões', comitente: null }])
  })

  // Item 6: the holder name field is never read; no CNPJ or CPF with a company name.
  it('bank record with only the holder name: no name on screen', () => {
    const r = comIndicador(SEM, 'P7', { status: 'positivo', conteudo: [{ ano: '2010', nome: 'JOAO PAN DE SOUZA', documento: '000.000.000-00', tipoEntidade: 'financeira' }] })
    expect(telaUso(bloco(r).uso)!.linhas.find((l) => l.titulo === 'Banco ou financeira')!.texto).toBe('Esteve em nome de banco ou financeira em 2010')
    expect(JSON.stringify(bloco(r))).not.toMatch(/JOAO|SOUZA/)
    const seg = comIndicador(comIndicador(SEM, 'P14', { status: 'positivo', conteudo: [{ nome: 'JOAO PAN DE SOUZA', ano: '2020' }] }), 'P1', { status: 'positivo', conteudo: [{ nome: 'JOAO PAN DE SOUZA', tipoEvento: 'Venda Direta / Remarketing', ano: '2020' }] })
    const b = bloco(seg)
    expect(b.sinistro!.indenizacoes).toEqual([{ seguradora: null, ano: '2020' }])
    expect(b.leilao!.registros).toEqual([{ tipo: 'salvado', ano: '2020', lote: null, casa: null, comitente: null }])
    expect(JSON.stringify(b)).not.toMatch(/JOAO|SOUZA/)
  })
  it('CNPJ or CPF inside a company name never reaches the screen', () => {
    const r = comIndicador(SEM, 'P7', { status: 'positivo', conteudo: [{ ano: '2010', instituicao: 'BANCO EXEMPLO S/A 00.000.000/0001-00' }] })
    expect(bloco(r).uso!.financeiras).toEqual([{ instituicao: 'BANCO EXEMPLO S/A', ano: '2010' }])
    expect(nomeDeEmpresa('SEGURADORA EXEMPLO S/A - 00000000000100')).toBe('SEGURADORA EXEMPLO S/A')
    expect(nomeDeEmpresa('BANCO EXEMPLO S/A 000.000.000-00')).toBe('BANCO EXEMPLO S/A')
    expect(nomeDeEmpresa('00.000.000/0001-00')).toBeNull()
    const leilao = comLeiloes([{ ano: 2006, lote: 'NADA CONSTA', comitente: 'PREFEITURA MUNICIPAL DE CIDADE EXEMPLO 00.000.000/0001-00' }])
    expect(bloco(leilao).leilao!.registros[0].comitente).toBe('PREFEITURA MUNICIPAL DE CIDADE EXEMPLO')
    const tela = historicoVeicularParaTela({ status: 'ok', consultadoEm: null, uso: { financeiras: [{ instituicao: 'BANCO EXEMPLO S/A 00000000000100', ano: '2010' }] } } as any)!
    expect(tela.uso!.financeiras).toEqual([{ instituicao: 'BANCO EXEMPLO S/A', ano: '2010' }])
  })

  // Item 7: insurer as holder, "registrada em".
  it('insurer as holder says "registrada em <ano>"', () => {
    const r = comIndicador(SEM, 'P1', { status: 'positivo', conteudo: [{ seguradora: 'HDI SEGUROS S/A', tipoEvento: 'Titularidade em Carteira de Seguradora', ano: '2019' }] })
    expect(telaUso(bloco(r).uso)!.linhas.find((l) => l.titulo === 'Seguradora')!.texto).toBe('Esteve em nome da HDI Seguros S/A, registrada em 2019')
  })

  // Item 8: another VIN, nothing of it; the reason stays, never the VIN.
  it('VIN of the partner differs from the vehicle: only the reason stays', () => {
    const b = bloco(COM)
    expect(historicoDoVeiculo(b, '9XXHV00000X000001')).toBe(b)
    expect(historicoDoVeiculo(b, '9XXHV0000')).toBe(b) // partial VIN: cannot tell
    const d = historicoDoVeiculo({ ...b, consultadoEm: '2026-10-02T15:00:00.000Z' }, '9XXHV00000X999999')!
    expect(d).toEqual({ status: 'divergente', consultadoEm: '2026-10-02T15:00:00.000Z', motivo: MOTIVO_CHASSI_DIVERGENTE })
    expect(JSON.stringify(d)).not.toContain('9XXHV')
    expect(historicoVeicularParaTela(d)).toEqual({ status: 'divergente', consultadoEm: '2026-10-02T15:00:00.000Z' })
    expect(historicoDoVeiculo({ status: 'falhou', consultadoEm: null }, '9XXHV00000X999999')).toEqual({ status: 'falhou', consultadoEm: null })
  })

  // Item 10: P24 or P18 alone never open the insurance block.
  it('exposure or police record alone: no insurance block; with a visible line, they still feed the opinion', () => {
    expect(telaSinistro(bloco(comIndicador(SEM, 'P24', { status: 'positivo' })).sinistro)).toBeNull()
    expect(telaSinistro(bloco(comIndicador(SEM, 'P18', { status: 'positivo' })).sinistro)).toBeNull()
    const comRoubo = comIndicador(comIndicador(SEM, 'P10', { status: 'positivo', conteudo: [{ tipo: 'DECLARAÇÃO', ano: '2020' }] }), 'P24', { status: 'positivo' })
    const t = telaSinistro(bloco(comRoubo).sinistro)!
    expect(t.linhas.map((l) => l.titulo)).toEqual(['Roubo ou furto'])
    expect(t.parecer!.tom).toBe('atencao')
  })

  // Item 12: the auction partner already in the history (operator run).
  it('with the auction partner already there: damage flag is the OR, the same auction is not repeated', () => {
    const antiga = { nivel: 'confirmado', fonte: 'parceiro', fonte_tipo: 'parceiro', fonte_exibicao: 'Base parceira', data_leilao: '2024-03-02', lote: null, comitente: 'TOKIO MARINE SEGURADORA S/A' }
    const comParceira = { ...vazio(), passagens: [antiga], resumo: { ...vazio().resumo, tem_indicio: true, n_confirmado: 1 }, parceiro: { status: 'ok', id_consulta: 'x1', consultado_em: '2026-10-01T00:00:00Z' }, sinistro_parceiro: { indicio: true, mensagem: 'EXISTE REGISTRO DE INDICIO DE SINISTRO' } }
    const semNada = historicoLeilaoComHistorico(comParceira, bloco(SEM), {})
    expect(semNada.sinistro_parceiro).toEqual({ indicio: true, mensagem: 'EXISTE REGISTRO DE INDICIO DE SINISTRO' })
    expect(semNada.parceiro).toEqual({ status: 'ok', id_consulta: 'x1', consultado_em: '2026-10-01T00:00:00Z' })
    const comDados = historicoLeilaoComHistorico(comParceira, bloco(COM), { chassi: CHASSI })
    expect(comDados.passagens.map((p: any) => p.data_leilao ?? p.ano_leilao)).toEqual(['2024-03-02', '2019'])
    expect(comDados.sinistro_parceiro.indicio).toBe(true)
  })

  // Item 13: agreement and the same spelling in the card and in the block.
  it('one old record without a date: singular', () => {
    expect(telaDonos(bloco(ROUBO).donos)!.nota).toMatch(/^Há mais 1 registro antigo sem data, que só entra no total\. /)
  })
  it('insurer acronym in capitals in the card and in the block', () => {
    const b = bloco(ROUBO)
    const salvado = passagensDoHistorico(b.leilao, {}).find((p) => p.registro === 'salvado')!
    expect(salvado.comitente).toBe('HDI Seguros S/A')
    expect(tituloPassagemParceira(salvado)).toBe('Venda de salvado pela HDI Seguros S/A, registrada em 2025')
    expect(telaSinistro(b.sinistro)!.linhas[0].detalhe).toMatch(/^HDI Seguros, registrada em 2025\./)
  })
})

describe('review 2 of PR #752', () => {
  const comLeiloes = (leiloes: any[]) => { const r = copia(SEM); r.dados.outros_produtos.leiloes = leiloes; return r }

  // Item 6: without a lot, only a public body makes a passage; a lot needs a digit.
  it.each(['BANCO EXEMPLO S/A', 'EMPRESA PRIVADA', 'PARTICULAR - EMPRESA', 'PARTICULAR OU EMPRESA', 'TOKIO MARINE SEGURADORA S/A'])('principal "%s" without a lot: not a passage', (comitente) => {
    expect(bloco(comLeiloes([{ ano: 2025, leiloeiro: 'WEB - LEILOES', lote: 'NADA CONSTA', comitente }])).leilao!.registros).toEqual([])
  })
  it.each(['PREFEITURA MUNICIPAL DE CIDADE EXEMPLO', 'DETRAN EXEMPLO', 'SECRETARIA DE ESTADO DA FAZENDA', 'POLÍCIA MILITAR', 'DEPARTAMENTO DE ESTRADAS', 'GOVERNO DO ESTADO', 'RECEITA FEDERAL', 'DER EXEMPLO', 'TRIBUNAL DE JUSTIÇA', 'MUNICÍPIO DE EXEMPLO'])('public body "%s" without a lot: a passage', (comitente) => {
    expect(ehOrgaoPublico(comitente)).toBe(true)
    expect(bloco(comLeiloes([{ ano: 2006, lote: 'NADA CONSTA', comitente }])).leilao!.registros).toMatchObject([{ tipo: 'orgao', ano: '2006', lote: null }])
  })
  it.each(['*', '.', 'LOTE A', '-'])('lot "%s" has no digit: not a lot', (lote) => {
    expect(bloco(comLeiloes([{ ano: 2024, leiloeiro: 'CASA EXEMPLO LEILÕES', lote }])).leilao!.registros).toEqual([])
  })
  it('a real lot keeps a company as principal', () => {
    expect(bloco(comLeiloes([{ ano: 2022, lote: 'A12', comitente: 'BANCO EXEMPLO S/A' }])).leilao!.registros)
      .toEqual([{ tipo: 'edital', ano: '2022', lote: 'A12', casa: null, comitente: 'BANCO EXEMPLO S/A' }])
  })

  // Item 7: no CNPJ or CPF in the house name.
  it('house name never carries a CNPJ or CPF', () => {
    expect(casaDoRegistro('EXEMPLO LEILOES LTDA 00.000.000/0001-00')).toBe('Exemplo Leiloes Ltda')
    expect(casaDoRegistro('JOAO DA SILVA LEILOES 00000000000')).toBe('Joao da Silva Leiloes')
    expect(casaDoRegistro('EXEMPLO LEILOES LTDA - 00000000000100')).toBe('Exemplo Leiloes Ltda')
    const b = bloco(comLeiloes([{ ano: 2022, lote: '7', leiloeiro: 'EXEMPLO LEILOES LTDA 00.000.000/0001-00' }]))
    expect(JSON.stringify(b.leilao)).not.toMatch(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{11}/)
    expect(b.leilao!.registros[0].casa).toBe('Exemplo Leiloes Ltda')
  })
})

describe('what goes to the page', () => {
  it('allow-list: the auction part, the partner VIN and unknown fields never go', () => {
    const b: any = bloco(COM)
    b.donos.nome = 'X'
    b.donos.registros[0].documento = '1'
    b.sinistro.cpf = '1'
    b.extra = { a: 1 }
    const t: any = historicoVeicularParaTela(b)
    expect(t.leilao).toBeUndefined()
    expect(t.extra).toBeUndefined()
    expect(t.donos.nome).toBeUndefined()
    expect(t.donos.registros[0].documento).toBeUndefined()
    expect(t.sinistro.cpf).toBeUndefined()
    expect(Object.keys(t).sort()).toEqual(['consultadoEm', 'donos', 'sinistro', 'status', 'uso'])
  })
  it('failed or capped: only the state', () => {
    expect(historicoVeicularParaTela({ status: 'falhou', consultadoEm: null, donos: { total: 3 } })).toEqual({ status: 'falhou', consultadoEm: null })
    expect(historicoVeicularParaTela({ status: 'outro' })).toBeNull()
    expect(historicoVeicularParaTela(null)).toBeNull()
  })
})

describe('report blocks (copy)', () => {
  it('owners: a tenure inside the sentence starts in lower case', () => {
    const atual = { data: '2026-11-11', tempo: 'Menos de 1 mês', meses: 0, tipo: 'pessoa' as const, uf: 'PR', cidade: null, ufCidade: null, atual: true }
    const antes = { data: '2026-10-20', tempo: 'Menos de 1 mês', meses: 0, tipo: 'pessoa' as const, uf: 'PR', cidade: null, ufCidade: null, atual: false }
    const t = telaDonos({ total: 2, atual, ufs: ['PR'], ufZeroKm: 'PR', registros: [atual, antes], semData: 0, trocasRapidas: 0 })!
    expect(t.linhas.map((l) => l.posse)).toEqual(['Dono atual, há menos de 1 mês', 'Ficou menos de 1 mês'])
    expect(t.atual).toMatchObject({ tempo: 'Menos de 1 mês' })
  })
  it('owners: totals, current owner, states, five most recent, quick changes alert, LGPD note', () => {
    const t = telaDonos(bloco(COM).donos, 'carro')!
    expect(t).toMatchObject({ total: 12, totalTexto: 'donos encontrados', atual: { desde: '12/07/2017', tempo: '8 anos e 4 meses' }, estados: ['PR', 'BA', 'GO'], zeroKm: 'PR' })
    expect(t.linhas).toHaveLength(9)
    expect(t.linhas[0]).toMatchObject({ data: '12/07/2017', tipo: 'Pessoa', uf: 'PR', posse: 'Dono atual, há 8 anos e 4 meses', curta: false, atual: true })
    expect(t.linhas.find((l) => l.tipo === 'Loja de usados')).toMatchObject({ posse: 'Ficou 2 meses', curta: true })
    expect(t.alertaTrocaRapida).toBe('Troca rápida de dono: 6 donos ficaram menos de 1 ano com o carro. Vale perguntar o motivo ao vendedor.')
    expect(t.nota).toBe('Há mais 3 registros antigos sem data, que só entram no total. Não mostramos nome nem documento de nenhum proprietário, em conformidade com a LGPD.')
    expect(telaDonos(bloco(SEM).donos)!.alertaTrocaRapida).toBeNull()
    expect(telaDonos(null)).toBeNull()
  })

  it('previous use: only when there is something; bank by name, private company never', () => {
    const t = telaUso(bloco(COM).uso)!
    expect(t.linhas).toEqual([
      { titulo: 'Loja de usados', texto: 'Passou por loja de usados em 2012', tom: 'neutro' },
      { titulo: 'Banco ou financeira', texto: 'Esteve em nome de Banco Exemplo S.A. Arrendamento Mercantil em 2007', tom: 'neutro' },
    ])
    expect(t.nota).toBe('Sem registro de locadora, táxi, viatura ou frota pública.')
    expect(telaUso(bloco(SEM).uso)!.linhas.map((l) => l.titulo)).toEqual(['Compra em lote', 'Empresa'])
    expect(JSON.stringify(telaUso(bloco(SEM).uso))).not.toMatch(/FICTICIA|LUBRIFICANTES/)
    const nada = bloco(EDITAL).uso!
    expect(telaUso({ ...nada, empresas: [] })).toBeNull()
  })

  it('previous use flags from the indicators', () => {
    let r = comIndicador(SEM, 'P4', { status: 'positivo' })
    r = comIndicador(r, 'P27', { status: 'positivo' })
    r = comIndicador(r, 'P8', { status: 'positivo' })
    const t = telaUso(bloco(r).uso)!
    expect(t.linhas.map((l) => l.titulo)).toEqual(['Locadora', 'Compra em lote', 'Empresa', 'Táxi ou PCD', 'Loja de salvados'])
    expect(t.linhas.find((l) => l.titulo === 'Loja de salvados')!.tom).toBe('alerta')
    expect(t.nota).toBe('Sem registro de viatura ou frota pública.')
  })

  it('insurance: total loss and damage are high risk; small damage or accident only call attention', () => {
    const alto = telaSinistro(bloco(COM).sinistro, 'carro')!
    expect(alto.linhas.map((l) => [l.titulo, l.valor])).toEqual([['Indenização integral', 'Sim'], ['Dano registrado', 'Média monta']])
    expect(alto.linhas[0].detalhe).toBe('Tokio Marine Seguradora, registrada em 2024. A seguradora pagou o valor do carro ao dono.')
    expect(alto.parecer).toMatchObject({ tom: 'alerta', titulo: 'Alto risco de o seguro ser recusado' })
    const pequena = bloco(comIndicador(SEM, 'P15', { status: 'positivo', conteudo: 'ATENÇÃO: EM 2020, O VEÍCULO APRESENTOU APONTAMENTO DE PEQUENA MONTA.' }))
    expect(telaSinistro(pequena.sinistro)!.parecer).toMatchObject({ tom: 'atencao', titulo: 'Pode haver restrição no seguro' })
    const acidente = bloco(comIndicador(SEM, 'P13', { status: 'positivo', conteudo: [{ data: '24/02/2022 00:30', municipio: 'SAO PAULO', uf: 'SP', tipo: 'COLISAO', endereco: 'RUA EXEMPLO 1' }] }))
    const ta = telaSinistro(acidente.sinistro)!
    expect(ta.linhas).toEqual([{ titulo: 'Acidente de trânsito', valor: 'Colisao', detalhe: '24/02/2022, em Sao Paulo/SP', tom: 'atencao' }])
    expect(JSON.stringify(acidente)).not.toMatch(/RUA EXEMPLO/)
    expect(ta.parecer!.tom).toBe('atencao')
  })

  it('accident indicator without records: one line with the year; with records in the other, only the records', () => {
    const so12 = bloco(comIndicador(SEM, 'P12', { status: 'positivo', mensagem: 'ATENÇÃO: EM 2021, O VEÍCULO POSSUI REGISTRO DE ACIDENTE.', conteudo: null }))
    expect(so12.sinistro!.acidentes).toEqual([{ data: '2021', local: null, tipo: null }])
    expect(telaSinistro(so12.sinistro)!.linhas[0]).toMatchObject({ titulo: 'Acidente de trânsito', valor: 'Registro', detalhe: '2021' })
    const os2 = comIndicador(comIndicador(SEM, 'P12', { status: 'positivo', conteudo: null }), 'P13', { status: 'positivo', conteudo: [{ data: '10/03/2022', uf: 'PR', tipo: 'CAPOTAMENTO' }] })
    expect(bloco(os2).sinistro!.acidentes).toEqual([{ data: '2022-03-10', local: 'PR', tipo: 'Capotamento' }])
  })

  it('insurance restriction and suspicious VIN are high risk', () => {
    expect(bloco(comIndicador(SEM, 'P9', { status: 'positivo' })).sinistro!.parecer).toBe('alto')
    expect(bloco(comIndicador(SEM, 'P16', { status: 'positivo' })).sinistro!.parecer).toBe('alto')
    expect(bloco(comIndicador(SEM, 'P33', { status: 'positivo' })).sinistro!.parecer).toBe('atencao')
  })
})

describe('owner type and time helpers', () => {
  it('type from document, CNAE and legal nature of the record itself', () => {
    expect(tipoDoDono({ tipo: 'Pessoa física', classificacaoEntidade: 'particular' })).toBe('pessoa')
    expect(tipoDoDono({ tipo: 'Pessoa juridica', cnae: '4511102' })).toBe('loja')
    expect(tipoDoDono({ tipo: 'Pessoa juridica', cnae: '6440900' })).toBe('banco')
    expect(tipoDoDono({ tipo: 'Pessoa juridica', cnae: '7711000' })).toBe('locadora')
    expect(tipoDoDono({ tipo: 'Pessoa juridica', cnae: '6512000' })).toBe('seguradora')
    expect(tipoDoDono({ tipo: 'Pessoa juridica', codigoNaturezaJuridica: '1244' })).toBe('orgao')
    expect(tipoDoDono({ tipo: 'Pessoa juridica', cnae: '4732600' })).toBe('empresa')
    expect(tipoDoDono({})).toBeNull()
  })
  it('time with the vehicle', () => {
    expect(mesesDePosse('8 anos e 4 meses')).toBe(100)
    expect(mesesDePosse('1 mês (Vigente)')).toBe(1)
    expect(mesesDePosse('1 ano')).toBe(12)
    expect(mesesDePosse('Tempo não informado')).toBeNull()
    expect(tempoDePosse('3 anos e 5 meses (Vigente)')).toBe('3 anos e 5 meses')
    expect(tempoDePosse('Tempo não informado')).toBeNull()
  })
})

// Partial answers (Cesar, 17/11/2026): the partner answers success and charges
// even when one of its internal sources failed. Complete = the three sources
// true AND at least one owner; anything else makes the auction partner the
// fallback for that order.
describe('partial answer classifier', () => {
  const comFontes = (fontes: Record<string, unknown>) => { const r = copia(COM); r.dados.raw_sources = { ...r.dados.raw_sources, ...fontes }; return r }
  const semDonos = (x: any = COM) => { const r = copia(x); r.dados.proprietarios = { total: 0, historico: [] }; return r }

  it('each internal source that failed, zero owners, a complete answer and no answer', () => {
    expect(faltasDaResposta(comFontes({ e2Success: false }))).toEqual(['registro'])
    expect(faltasDaResposta(comFontes({ e5Success: false }))).toEqual(['donos'])
    expect(faltasDaResposta(comFontes({ infosinistrosSuccess: false }))).toEqual(['sinistros'])
    // Zero owners is a failure even with the owners source true (every vehicle has one).
    expect(faltasDaResposta(semDonos())).toEqual(['sem donos'])
    expect(faltasDaResposta(comFontes({ e5Success: false, infosinistrosSuccess: false }))).toEqual(['donos', 'sinistros'])
    expect(faltasDaResposta(copia(COM))).toEqual([])
    expect(faltasDaResposta(copia(SEM))).toEqual([])
    expect(faltasDaResposta(null)).toEqual(['resposta'])
    expect(faltasDaResposta({ success: true })).toEqual(['resposta'])
  })

  it('a flag that is missing counts as failed', () => {
    const r = copia(COM)
    delete r.dados.raw_sources
    expect(faltasDaResposta(r)).toEqual(['registro', 'donos', 'sinistros'])
  })

  it('the clean block says whether it came whole; a partial one stays ok with what came', () => {
    expect(bloco(COM)).toMatchObject({ status: 'ok', completa: true })
    expect(bloco(COM).faltas).toBeUndefined()
    const p = bloco(comFontes({ infosinistrosSuccess: false }))
    expect(p).toMatchObject({ status: 'ok', completa: false, faltas: ['sinistros'], donos: { total: 12 } })
    expect(bloco(semDonos())).toMatchObject({ status: 'ok', completa: false, faltas: ['sem donos'], donos: null })
    // Never on the page.
    const tela: any = historicoVeicularParaTela(p)
    expect(tela.completa).toBeUndefined()
    expect(tela.faltas).toBeUndefined()
  })

  it('respostaIncompleta: by the flag; blocks stored before the check only by "no owners"', () => {
    expect(respostaIncompleta(bloco(comFontes({ e2Success: false })))).toBe(true)
    expect(respostaIncompleta(bloco(COM))).toBe(false)
    const antigo = (x: any) => { const b: any = bloco(x); delete b.completa; delete b.faltas; return b }
    expect(respostaIncompleta(antigo(semDonos()))).toBe(true)
    expect(respostaIncompleta(antigo(COM))).toBe(false)
    expect(respostaIncompleta({ status: 'falhou', consultadoEm: null })).toBe(false)
    expect(respostaIncompleta(null)).toBe(false)
  })

  it('historicoPedeReserva: partial or other-VIN answer at once; no good answer only once the queue gave up; never on a complete answer', () => {
    const parcial = bloco(comFontes({ infosinistrosSuccess: false }))
    const completo = bloco(COM)
    expect(historicoPedeReserva(parcial, null)).toBe(true)
    expect(historicoPedeReserva(parcial, 'pendente')).toBe(true)
    expect(historicoPedeReserva(completo, 'esgotado')).toBe(false)
    expect(historicoPedeReserva(completo, null)).toBe(false)
    // Answer for another VIN: nothing of it is shown (no auction, no damage), and it is final.
    const divergente = historicoDoVeiculo(bloco(COM), '9XXHV00000X999999')
    expect(divergente).toMatchObject({ status: 'divergente' })
    expect(historicoPedeReserva(divergente, null)).toBe(true)
    expect(historicoPedeReserva(divergente, 'pendente')).toBe(true)
    expect(historicoPedeReserva(divergente, 'ok')).toBe(true)
    for (const st of ['falhou', 'teto'] as const) {
      const b = { status: st, consultadoEm: null }
      // The queue may still bring it: not yet.
      expect(historicoPedeReserva(b, 'pendente')).toBe(false)
      expect(historicoPedeReserva(b, 'rodando')).toBe(false)
      expect(historicoPedeReserva(b, null)).toBe(false)
      // The queue gave up (timeout, HTTP error, balance or its daily ceiling).
      expect(historicoPedeReserva(b, 'esgotado')).toBe(true)
    }
    // Never called (no block at all) and the queue gave up.
    expect(historicoPedeReserva(null, 'esgotado')).toBe(true)
    expect(historicoPedeReserva(null, 'ok')).toBe(false)
  })

  it('the classification carries no name or document', () => {
    const p = bloco(semDonos(comFontes({ infosinistrosSuccess: false })))
    expect(JSON.stringify({ completa: p.completa, faltas: p.faltas })).not.toMatch(/FICTICIA|\d{3}\.\d{3}\.\d{3}-\d{2}/)
  })
})

describe('auction section with the auction partner as the fallback', () => {
  const parceira = () => historicoComParceiro(vazio(), parsearRespostaParceiro(copia(LEILAO_REAL))!, { chassi: CHASSI, tipo: 'placa', consultadoEm: '2026-11-17T21:00:00Z' })

  it('partial vehicle history: the auction partner records stay, the same auction is not repeated, the damage flag is the OR of both', () => {
    const h = parceira()
    expect(h.parceiro.status).toBe('ok')
    // Partial answer whose claims source failed: no damage flag of its own.
    const r = copia(SEM)
    r.dados.raw_sources.infosinistrosSuccess = false
    const hv = bloco(r)
    expect(hv.completa).toBe(false)
    const junto = historicoLeilaoComHistorico(h, hv, { chassi: CHASSI })
    expect(junto.passagens.filter((p: any) => p.fonte === 'parceiro').length).toBeGreaterThanOrEqual(h.passagens.length)
    expect(junto.sinistro_parceiro.indicio).toBe(true)
    expect(junto.parceiro).toEqual(h.parceiro)
  })

  it('vehicle history failed or capped: the auction partner result is what shows', () => {
    const h = parceira()
    for (const st of ['falhou', 'teto'] as const) {
      const junto = historicoLeilaoComHistorico(h, { status: st, consultadoEm: null }, { chassi: CHASSI })
      expect(junto).toBe(h)
    }
    expect(historicoLeilaoComHistorico(h, null, { chassi: CHASSI })).toBe(h)
  })
})

// Owner city (Cesar, 17/11/2026): each owner line shows "City/UF", so the buyer
// sees where the vehicle lived. The same records bring name, document and
// company name: those never leave the parser.
describe('owner city', () => {
  const dono = (x: Record<string, unknown>) => ({
    nome: 'NOME SIGILOSO', razao_social: 'RAZAO SIGILOSA LTDA', documento: '000.000.000-00', documentoOriginal: '00000000000',
    tipo: 'Pessoa fisica', classificacaoEntidade: 'particular', atual: false, ...x,
  })
  const pj = { tipo: 'Pessoa juridica', classificacaoEntidade: 'empresa_privada', documento: '00.000.000/0001-00', documentoOriginal: '00000000000100' }
  const DONOS = [
    dono({ ...pj, ordem: 1, cnae: '7711000', data: '10/01/2012', tempoDePosse: '3 anos', uf: 'PR', municipio: 'VILA NOVA DO EXEMPLO', municipio_uf: 'OUTRA EXEMPLO/PR' }),
    dono({ ordem: 2, data: '10/01/2015', tempoDePosse: '3 anos', uf: 'SC', municipio: '', municipio_uf: 'SERRA MODELO/SC' }),
    dono({ ordem: 3, data: '10/01/2018', tempoDePosse: '2 anos', uf: 'SC', municipio: 'NAO INFORMADO', municipio_uf: '/SC' }),
    dono({ ...pj, ordem: 4, cnae: '4732600', data: '10/01/2020', tempoDePosse: '1 ano', uf: 'RS' }),
    dono({ ordem: 5, data: '10/01/2021', tempoDePosse: '4 anos e 10 meses (Vigente)', uf: 'RS', municipio: 'PORTO MODELO', municipio_uf: 'PORTO MODELO/RS', atual: true }),
  ]
  const resposta = (donos: any[] = DONOS) => {
    const r = copia(SEM)
    r.dados.proprietarios = { total: donos.length, proprietario_atual: copia(donos.find((x) => x.atual) ?? null), historico: copia(donos) }
    return r
  }

  it('reads "municipio", falls back to "municipio_uf" before the slash, and is null without either', () => {
    const b = bloco(resposta())
    expect(b.donos!.registros.map((o) => [o.data, o.cidade, o.ufCidade])).toEqual([
      ['2021-01-10', 'Porto Modelo', 'RS'],
      ['2020-01-10', null, null],
      ['2018-01-10', null, null],
      ['2015-01-10', 'Serra Modelo', 'SC'],
      ['2012-01-10', 'Vila Nova do Exemplo', 'PR'],
    ])
    expect(b.donos!.atual).toMatchObject({ data: '2021-01-10', cidade: 'Porto Modelo', atual: true })
  })

  it('the city goes with the state of "municipio_uf"; without a valid one there, with "uf"', () => {
    const b = bloco(resposta([
      dono({ ordem: 1, data: '10/01/2015', tempoDePosse: '3 anos', uf: 'BA', municipio: 'VILA EXEMPLO', municipio_uf: 'VILA EXEMPLO/PE' }),
      dono({ ordem: 2, data: '10/01/2018', tempoDePosse: '2 anos', municipio: 'SERRA MODELO', municipio_uf: 'SERRA MODELO/SC' }),
      dono({ ordem: 3, data: '10/01/2020', tempoDePosse: '1 ano', uf: 'RS', municipio: 'PORTO MODELO', municipio_uf: 'PORTO MODELO/XX' }),
      dono({ ordem: 4, data: '10/01/2021', tempoDePosse: '4 anos (Vigente)', uf: 'RS', municipio: 'PORTO MODELO', atual: true }),
    ]))
    // The block (cache and snapshot) keeps only a valid state of the city.
    expect(b.donos!.registros.map((o) => o.ufCidade)).toEqual([null, null, 'SC', 'PE'])
    const t = telaDonos(historicoVeicularParaTela(b)!.donos)!
    expect(t.linhas.map((l) => [l.local, l.uf, l.atual])).toEqual([
      ['Porto Modelo/RS', 'RS', true],
      ['Porto Modelo/RS', 'RS', false],
      ['Serra Modelo/SC', null, false],
      ['Vila Exemplo/PE', 'BA', false],
    ])
    // The states the vehicle went through still come from "uf" only.
    expect(t.estados).toEqual(['GO', 'BA', 'RS'])
  })

  it('a city is a string with a letter and no digit: a document, a code or an object is null', () => {
    const b = bloco(resposta([
      dono({ ordem: 1, data: '10/01/2015', tempoDePosse: '1 ano', uf: 'PR', municipio: 'CIDADE 000.000.000-00' }),
      dono({ ordem: 2, data: '10/01/2016', tempoDePosse: '1 ano', uf: 'PR', municipio: 3550308 }),
      dono({ ordem: 3, data: '10/01/2017', tempoDePosse: '1 ano', uf: 'PR', municipio: { nome: 'VILA EXEMPLO' } }),
      dono({ ordem: 4, data: '10/01/2018', tempoDePosse: '1 ano', uf: 'PR', municipio: '...', municipio_uf: 3550308 }),
      dono({ ordem: 5, data: '10/01/2019', tempoDePosse: '1 ano', uf: 'PR', municipio: 3550308, municipio_uf: 'VILA EXEMPLO/SC' }),
    ]))
    expect(b.donos!.registros.map((o) => [o.data, o.cidade, o.ufCidade])).toEqual([
      ['2019-01-10', 'Vila Exemplo', 'SC'],
      ['2018-01-10', null, null],
      ['2017-01-10', null, null],
      ['2016-01-10', null, null],
      ['2015-01-10', null, null],
    ])
    expect(JSON.stringify(b)).not.toMatch(/000\.000|3550308|\[object/)
  })

  it('the report JSON lets the city and its state through, the city cut to 60 characters', () => {
    const b: any = JSON.parse(JSON.stringify(bloco(resposta())))
    b.donos.registros[1].cidade = 'Vila Exemplo '.repeat(10)
    const tela = historicoVeicularParaTela(b)!
    expect(tela.donos!.atual!.cidade).toBe('Porto Modelo')
    expect(tela.donos!.registros.map((o) => [o.cidade, o.ufCidade])).toEqual([
      ['Porto Modelo', 'RS'],
      ['Vila Exemplo Vila Exemplo Vila Exemplo Vila Exemplo Vila Exe', null],
      [null, null],
      ['Serra Modelo', 'SC'],
      ['Vila Nova do Exemplo', 'PR'],
    ])
  })

  it('the report JSON drops a city that is not a name, even from a snapshot made elsewhere', () => {
    const r = (x: object) => ({ data: '2021-01-10', tempo: '4 anos', meses: 48, tipo: 'pessoa', uf: 'RS', atual: false, ...x })
    const tela = historicoVeicularParaTela({
      status: 'ok', consultadoEm: null,
      donos: {
        total: 4, atual: null, ufs: ['RS'], ufZeroKm: null, semData: 0, trocasRapidas: 0,
        registros: [
          r({ cidade: 'CIDADE 000.000.000-00', ufCidade: 'PE' }),
          r({ cidade: 3550308, ufCidade: 'PE' }),
          r({ cidade: { nome: 'Vila Exemplo' }, ufCidade: 'PE' }),
          r({ cidade: 'Vila Exemplo', ufCidade: 'XX' }),
        ],
      },
    })!
    expect(tela.donos!.registros.map((o) => [o.cidade, o.ufCidade])).toEqual([[null, null], [null, null], [null, null], ['Vila Exemplo', null]])
    expect(telaDonos(tela.donos)!.linhas.map((l) => l.local)).toEqual(['RS', 'RS', 'RS', 'Vila Exemplo/RS'])
  })

  it('name, document and company name never reach the block nor the report JSON, even when the answer brings them', () => {
    const b = bloco(resposta())
    const tela = historicoVeicularParaTela(b)!
    for (const json of [JSON.stringify(b), JSON.stringify(tela), JSON.stringify(telaDonos(tela.donos))]) {
      expect(json).toContain('Porto Modelo')
      expect(json).not.toMatch(/SIGILOS/i)
      expect(json).not.toMatch(/000\.000\.000-00|00\.000\.000\/0001-00|\b\d{11}\b|\b\d{14}\b/)
      // Keys only: the LGPD note on screen says "nome nem documento".
      expect(json).not.toMatch(/"(nome|documento\w*|razao_social|municipio\w*)":/i)
    }
  })

  it('each line shows "City/UF"; a city without a state shows the city; the states stay UF only', () => {
    const t = telaDonos(historicoVeicularParaTela(bloco(resposta()))!.donos)!
    expect(t.linhas.map((l) => [l.tipo, l.local])).toEqual([
      ['Pessoa', 'Porto Modelo/RS'],
      ['Empresa', 'RS'],
      ['Pessoa', 'SC'],
      ['Pessoa', 'Serra Modelo/SC'],
      ['Locadora', 'Vila Nova do Exemplo/PR'],
    ])
    expect(t.estados).toEqual(['GO', 'PR', 'SC', 'RS'])
    const o = (x: object) => ({ data: '2020-01-10', tempo: '1 ano', meses: 12, tipo: 'pessoa' as const, uf: null, cidade: null, ufCidade: null, atual: false, ...x })
    const soCidade = telaDonos({ total: 2, atual: null, ufs: [], ufZeroKm: null, registros: [o({ cidade: 'Vila Exemplo' }), o({ data: '2019-01-10' })], semData: 0, trocasRapidas: 0 })!
    expect(soCidade.linhas.map((l) => l.local)).toEqual(['Vila Exemplo', null])
  })

  it('a snapshot stored before the city shows only the state', () => {
    const r = (x: object) => ({ data: '2021-01-10', tempo: '4 anos', meses: 48, tipo: 'pessoa', uf: 'RS', atual: false, ...x })
    const antigo = {
      status: 'ok', consultadoEm: '2026-11-10T12:00:00.000Z', completa: true,
      donos: {
        total: 2, atual: r({ atual: true }), ufs: ['PR', 'RS'], ufZeroKm: 'PR',
        registros: [r({ atual: true }), r({ data: '2015-01-10', tempo: '3 anos', meses: 36, tipo: 'locadora', uf: 'PR' })],
        semData: 0, trocasRapidas: 0,
      },
    }
    const tela = historicoVeicularParaTela(antigo)!
    expect(tela.donos!.registros.map((o) => o.cidade)).toEqual([null, null])
    expect(telaDonos(tela.donos)!.linhas.map((l) => [l.local, l.atual, l.posse])).toEqual([['RS', true, 'Dono atual, há 4 anos'], ['PR', false, 'Ficou 3 anos']])
  })

  it('the current owner is still found by date, tenure and state, with the city or without it on one side', () => {
    const tela = historicoVeicularParaTela(bloco(resposta()))!
    const atuais = (d: any) => telaDonos(d)!.linhas.filter((l) => l.atual).map((l) => [l.data, l.local, l.posse])
    expect(atuais(tela.donos)).toEqual([['10/01/2021', 'Porto Modelo/RS', 'Dono atual, há 4 anos e 10 meses']])
    // A snapshot fixed by hand may carry the city on the current owner or on its record only.
    const soNoRegistro: any = structuredClone(tela.donos)
    soNoRegistro.atual.cidade = null
    expect(atuais(soNoRegistro)).toEqual([['10/01/2021', 'Porto Modelo/RS', 'Dono atual, há 4 anos e 10 meses']])
  })
})
