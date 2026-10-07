import { describe, it, expect } from 'vitest'
import { fonteExibicaoLeilao, comitenteExibicao, fraseComitente, COMITENTE_GENERICO } from './leilao-exibicao'

describe('fonte da passagem', () => {
  it('casa privada mostra o nome (reverte "Leiloeira particular")', () => {
    expect(fonteExibicaoLeilao({ fonte: 'copart', fonte_tipo: 'privado', fonte_exibicao: 'Leiloeira particular' })).toBe('Copart')
    expect(fonteExibicaoLeilao({ fonte: 'superbid', fonte_tipo: 'privado' })).toBe('Superbid')
    expect(fonteExibicaoLeilao({ fonte: 'sodre', fonte_tipo: 'privado' })).toBe('Sodré Santoro')
    expect(fonteExibicaoLeilao({ fonte: 'freitas', fonte_tipo: 'privado' })).toBe('Freitas Leiloeiro')
    expect(fonteExibicaoLeilao({ fonte: 'casa_nova', fonte_tipo: 'privado', fonte_exibicao: 'Leiloeira particular' })).toBe('Casa Nova')
  })
  it('DETRAN como hoje', () => {
    expect(fonteExibicaoLeilao({ fonte: 'detran_sp', fonte_tipo: 'detran', fonte_exibicao: 'Detran SP' })).toBe('Detran SP')
    expect(fonteExibicaoLeilao({ fonte: 'detran_rs', fonte_tipo: 'detran' })).toBe('Detran RS')
  })
})

describe('comitente', () => {
  it('generico da Copart vira a frase explicita, sem frase de tipo', () => {
    expect(comitenteExibicao('PARTICULAR/EMPRESA')).toEqual({ texto: COMITENTE_GENERICO, generico: true })
    expect(fraseComitente('PARTICULAR/EMPRESA')).toBeNull()
  })
  it('nome real humanizado', () => {
    expect(comitenteExibicao('TRIBUNAL DE JUSTICA DO ESTADO DE SAO PAULO')?.texto).toBe('Tribunal de Justica do Estado de Sao Paulo')
    expect(comitenteExibicao('Tribunal De Justiça Do Estado De São Paulo')?.texto).toBe('Tribunal De Justiça Do Estado De São Paulo')
    expect(comitenteExibicao('CPFL SERVICOS, EQUIPAMENTOS, INDUSTRIA E COMERCIO S/A')?.texto).toBe('CPFL Servicos, Equipamentos, Industria e Comercio S/A')
    expect(comitenteExibicao('')).toBeNull()
  })
  it('frase por tipo, sempre "costuma ser", sem travessao', () => {
    expect(fraseComitente('Tribunal de Justiça do Estado de São Paulo')).toBe('Justiça: leilão judicial, por dívida ou processo.')
    expect(fraseComitente('Mapfre Seguro Gerais S A')).toBe('Seguradora: costuma ser carro indenizado por sinistro ou roubo.')
    expect(fraseComitente('FINANCEIRA')).toBe('Banco ou financeira: costuma ser retomada de financiamento.')
    expect(fraseComitente('BANCO BRADESCO S/A')).toBe('Banco ou financeira: costuma ser retomada de financiamento.')
    expect(fraseComitente('Localiza Rent a Car')).toBe('Locadora: costuma ser renovação de frota.')
    expect(fraseComitente('DETRAN TO')).toBe('Órgão público: costuma ser veículo apreendido ou removido ao pátio.')
    expect(fraseComitente('Klabin SA')).toBeNull()
    expect(fraseComitente('TERMOPERNAMBUCO')).toBeNull()
    for (const c of ['FINANCEIRA', 'Mapfre Seguros', 'DETRAN', 'Tribunal', 'Movida']) expect(fraseComitente(c)).not.toContain('—')
  })
})

import { paginaPublicaLeilao, AVISO_PAGINA_PUBLICA } from './leilao-exibicao'
describe('pagina publica', () => {
  it('so https de leiloeira conhecida', () => {
    expect(paginaPublicaLeilao('https://www.superbid.net/oferta/1')).toBe('https://www.superbid.net/oferta/1')
    expect(paginaPublicaLeilao('https://superbid.net/oferta/1')).toBe('https://superbid.net/oferta/1')
    expect(paginaPublicaLeilao('https://user:pw@www.superbid.net/x')).toBeNull()
    expect(paginaPublicaLeilao(null)).toBeNull()
    expect(AVISO_PAGINA_PUBLICA).not.toContain('—')
  })
})
