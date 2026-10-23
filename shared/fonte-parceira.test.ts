import { describe, it, expect } from 'vitest'
import REAL from '../server/utils/__fixtures__/parceiro-leilao-real.json'
import {
  parsearRespostaParceiro, passagensDoParceiro, historicoComParceiro, nossaBaseVazia, naoInformado, rotuloIndicadorLeilao,
  FONTE_PARCEIRA, ROTULO_PARCEIRA,
} from './fonte-parceira'
import { fonteExibicaoLeilao } from './leilao-exibicao'
import { passagemPrecisaDeFoto } from './foto-lote'
import { montarChecklist } from './checklist-compra'

// Fixture = resposta REAL do teste de 20/out/2026 (formato que difere da doc),
// com placa, chassi, id e usuario trocados por ficticios.
const CHASSI = '9XXAA00000X000001'
const vazio = () => ({ resumo: { tem_indicio: false, nivel_max: null, n_confirmado: 0, n_provavel: 0, n_possivel: 0, possiveis_ambiguos: 0, fontes_com_passagem: [] }, passagens: [], indice_atualizado_em: null, aviso: null, linha_do_tempo: [] })

describe('resposta da base parceira', () => {
  it('formato real: {consulta, resultados}', () => {
    const r = parsearRespostaParceiro(REAL)!
    expect(r.idConsulta).toBe('00000000-0000-4000-8000-000000000001')
    expect(r.tempoMs).toBe(706)
    expect(r.temRegistro).toBe(true)
    expect(r.leiloes).toHaveLength(1)
    expect(r.leiloes[0]).toMatchObject({ marca: 'HONDA', dataLeilao: '2019-08-27', comitente: 'MAPFRE SEGUROS GERAIS S/A', condicao: null, patio: null, leiloeiro: null, lote: null, situacaoChassi: null })
    expect(r.sinistro).toEqual({ indicio: true, mensagem: 'EXISTE REGISTRO DE INDICIO DE SINISTRO' })
  })
  it('formato da documentacao: {resposta, retorno.resultados} e sinistro.mensagem', () => {
    const doc = { resposta: { idConsulta: 'x1', tempoTotalMs: 10 }, retorno: { resultados: { leilao: { temRegistro: false, leiloes: [] }, sinistro: { indicioDeSinistro: 0, mensagem: 'NADA CONSTA' } } } }
    const r = parsearRespostaParceiro(doc)!
    expect(r).toMatchObject({ idConsulta: 'x1', temRegistro: false, leiloes: [], sinistro: { indicio: false, mensagem: 'NADA CONSTA' } })
    expect(parsearRespostaParceiro({ resposta: {}, retorno: { leilao: { temRegistro: false } } })!.temRegistro).toBe(false)
  })
  it('sem bloco de leilao nem de sinistro: nao confia', () => {
    expect(parsearRespostaParceiro({ consulta: {} })).toBeNull()
    expect(parsearRespostaParceiro('erro')).toBeNull()
    expect(parsearRespostaParceiro(null)).toBeNull()
  })
  it('N/C, NC, NAO DIVULGADO e 0 viram null na exibicao', () => {
    for (const v of ['N/C', 'NC', 'NAO DIVULGADO', 'Não divulgado', '0', '', '  ', null]) expect(naoInformado(v)).toBeNull()
    expect(naoInformado('MAPFRE')).toBe('MAPFRE')
  })
})

describe('passagens e historico', () => {
  const r = parsearRespostaParceiro(REAL)!
  it('passagem confirmada, rotulo da base parceira, sem leiloeiro, sem foto', () => {
    const [p] = passagensDoParceiro(r, { chassi: CHASSI, tipo: 'placa' })
    expect(p).toMatchObject({ nivel: 'confirmado', fonte: FONTE_PARCEIRA, fonte_tipo: FONTE_PARCEIRA, fonte_exibicao: ROTULO_PARCEIRA, data_leilao: '2019-08-27', comitente: 'MAPFRE SEGUROS GERAIS S/A', leiloeiro: null, lote: null })
    expect(p.evidencias).toEqual(['chassi igual'])
    expect(fonteExibicaoLeilao(p)).toBe('Base parceira')
    expect(passagemPrecisaDeFoto({ ...p, lote: '12' })).toBe(false)
  })
  it('chassi completo diferente do nosso: possivel, com o conflito', () => {
    const [p] = passagensDoParceiro(r, { chassi: '9XXAA00000X000002', tipo: 'placa' })
    expect(p.nivel).toBe('possivel')
    expect(p.conflitos).toEqual(['chassi diferente do deste veículo'])
  })
  it('historico vazio + resposta: resumo recalculado, sinistro e estado gravados', () => {
    const h = historicoComParceiro(vazio(), r, { chassi: CHASSI, tipo: 'placa', consultadoEm: '2026-10-20T19:00:58Z' })
    expect(h.resumo).toMatchObject({ tem_indicio: true, nivel_max: 'confirmado', n_confirmado: 1, fontes_com_passagem: ['parceiro'] })
    expect(h.passagens).toHaveLength(1)
    expect(h.linha_do_tempo).toBeNull()
    expect(h.sinistro_parceiro).toEqual({ indicio: true, mensagem: 'EXISTE REGISTRO DE INDICIO DE SINISTRO' })
    expect(h.parceiro).toEqual({ status: 'ok', id_consulta: '00000000-0000-4000-8000-000000000001', consultado_em: '2026-10-20T19:00:58Z' })
  })
  it('nossa base vazia: so com historico presente, zero passagens e sem indicio', () => {
    expect(nossaBaseVazia(vazio())).toBe(true)
    expect(nossaBaseVazia(null)).toBe(false)
    expect(nossaBaseVazia({ ...vazio(), passagens: [{ nivel: 'possivel' }] })).toBe(false)
    expect(nossaBaseVazia({ ...vazio(), resumo: { ...vazio().resumo, tem_indicio: true } })).toBe(false)
  })
  it('checklist com indicio de sinistro', () => {
    const c = montarChecklist({ sinistro: true })
    expect(c.vistoria[0]).toMatchObject({ id: 'r-sinistro', doRelatorio: true })
    expect(c.vistoria[0].texto).toMatch(/^Consta indício de sinistro em base parceira/)
  })
})

describe('rotulo do indicador de leilao', () => {
  const nossa = { nivel: 'confirmado', fonte: 'superbid', fonte_tipo: 'privado' }
  const parceira = passagensDoParceiro(parsearRespostaParceiro(REAL)!, { chassi: CHASSI, tipo: 'placa' })[0]
  it('so nossas fontes: fontes publicas', () => {
    expect(rotuloIndicadorLeilao([nossa])).toBe('Histórico de leilão (fontes públicas)')
    expect(rotuloIndicadorLeilao([])).toBe('Histórico de leilão (fontes públicas)')
    expect(rotuloIndicadorLeilao(null)).toBe('Histórico de leilão (fontes públicas)')
  })
  it('com passagem da base parceira (sozinha ou misturada): bases consultadas, nunca fontes publicas', () => {
    expect(rotuloIndicadorLeilao([parceira])).toBe('Histórico de leilão (bases consultadas)')
    expect(rotuloIndicadorLeilao([nossa, parceira])).toBe('Histórico de leilão (bases consultadas)')
    expect(rotuloIndicadorLeilao([nossa, parceira])).not.toMatch(/públicas/)
  })
})

describe('secao sem registro: uma linha por base (21/out/2026)', () => {
  it('nossa base sempre, com a quantidade da fonte unica', async () => {
    const { linhasBasesSemRegistro } = await import('./fonte-parceira')
    const { BASE_LEILAO_TEXTO } = await import('./base-leilao')
    expect(linhasBasesSemRegistro({ resumo: {} })).toEqual([{ tag: 'Base própria', texto: `Nada encontrado na nossa base, com ${BASE_LEILAO_TEXTO}.`, tom: 'ok' }])
  })
  it('parceira: nada (verde), so sinistro (alerta), falhou/teto (cinza)', async () => {
    const { linhasBasesSemRegistro } = await import('./fonte-parceira')
    expect(linhasBasesSemRegistro({ parceiro: { status: 'ok' }, sinistro_parceiro: { indicio: false } })[1]).toEqual({ tag: 'Base parceira', texto: 'Nada encontrado na base do nosso parceiro premium.', tom: 'ok' })
    expect(linhasBasesSemRegistro({ parceiro: { status: 'ok' }, sinistro_parceiro: { indicio: true } })[1]).toMatchObject({ tom: 'alerta', texto: 'Nenhum registro de leilão. Consta indício de sinistro.' })
    for (const st of ['falhou', 'teto']) expect(linhasBasesSemRegistro({ parceiro: { status: st } })[1]).toMatchObject({ tom: 'cinza', texto: 'Não foi possível consultar agora.' })
    for (const l of linhasBasesSemRegistro({ parceiro: { status: 'ok' } })) expect(l.texto).not.toMatch(new RegExp('—|' + 'avali' + 'service', 'i'))
  })
})
