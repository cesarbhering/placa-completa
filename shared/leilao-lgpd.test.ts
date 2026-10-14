import { describe, expect, it } from 'vitest'
import { comitentePublico, historicoLgpd, passagemLgpd, refEhProcesso, semProcesso } from './leilao-lgpd'

// Nomes e numeros 100% sinteticos.
describe('LGPD do historico de leilao', () => {
  it('corta CNJ com e sem pontuacao e "Processo nº"', () => {
    expect(semProcesso('Veiculo GOL 1.0 - Processo nº 0001234-56.2019.8.26.0100')).toBe('Veiculo GOL 1.0')
    expect(semProcesso('Leilao judicial 00012345620198260100 lote 3')).toBe('Leilao judicial lote 3')
    expect(semProcesso('Autos n. 123/2019, 1a Vara')).toBe('1a Vara')
    expect(semProcesso('Fiat Uno 2010 prata')).toBe('Fiat Uno 2010 prata')
  })

  it('ref de processo vira null; edital comum fica', () => {
    expect(refEhProcesso('0001234-56.2019.8.26.0100')).toBe(true)
    expect(refEhProcesso('Processo 123/2018')).toBe(true)
    expect(refEhProcesso('12345')).toBe(false)
    expect(passagemLgpd({ fonte: 'sodre', ref: '12345' }).ref).toBe('12345')
    expect(passagemLgpd({ fonte: 'superbid', ref: '0001234-56.2019.8.26.0100' }).ref).toBeNull()
    expect(passagemLgpd({ fonte: 'eleiloes', ref: '1234567' }).ref).toBeNull()
  })

  it('comitente so empresa ou orgao; pessoa fisica vira null', () => {
    expect(comitentePublico('FULANO DE TAL BELTRANO')).toBeNull()
    expect(comitentePublico('Maria Exemplo Frota Camara')).toBeNull()
    expect(comitentePublico('Laurentino Ficticio Silva')).toBeNull()
    expect(comitentePublico('BANCO EXEMPLO S/A')).toBe('BANCO EXEMPLO S/A')
    expect(comitentePublico('Seguradora Ficticia SA')).toBe('Seguradora Ficticia SA')
    expect(comitentePublico('LOCADORA TESTE LTDA')).toBe('LOCADORA TESTE LTDA')
    expect(comitentePublico('DETRAN-SP')).toBe('DETRAN-SP')
    expect(comitentePublico('Tribunal de Justiça do Estado X')).toBe('Tribunal de Justiça do Estado X')
    expect(comitentePublico('PARTICULAR/EMPRESA')).toBe('PARTICULAR/EMPRESA')
    expect(comitentePublico('')).toBeNull()
  })

  it('passagem: tira processo_judicial e partes, limpa textos fundos, preserva controle', () => {
    const p = passagemLgpd({
      nivel: 'confirmado', fonte: 'superbid', ref: '0001234-56.2019.8.26.0100', comitente: 'FULANO FICTICIO',
      edital_ref: 'abc.123', fotos: ['https://fotos.placacompleta.com.br/a.jpg'],
      detalhes: { processo_judicial: '0001234-56.2019.8.26.0100', judicial: true, monta: 'media', executado: 'FULANO', comitente_nome: 'CICRANO FICTICIO' },
      veiculo_na_fonte: { titulo: 'VW GOL 2012 - Proc. 0001234-56.2019.8.26.0100' },
      evidencias: ['placa', 'CNJ 00012345620198260100'],
    })
    expect(p.ref).toBeNull()
    expect(p.comitente).toBeNull()
    expect(p.detalhes).toEqual({ judicial: true, monta: 'media', comitente_nome: null })
    expect(p.veiculo_na_fonte.titulo).toBe('VW GOL 2012')
    expect(p.evidencias).toEqual(['placa', 'CNJ'])
    expect(p.edital_ref).toBe('abc.123')
    expect(p.fotos).toEqual(['https://fotos.placacompleta.com.br/a.jpg'])
    expect(JSON.stringify(p)).not.toMatch(/0001234|00012345620198260100|FULANO/)
  })

  it('historico: formato desconhecido volta igual; passagens saneadas', () => {
    expect(historicoLgpd(null)).toBeNull()
    expect(historicoLgpd({ x: 1 })).toEqual({ x: 1 })
    const h = historicoLgpd({ resumo: {}, passagens: [{ fonte: 'superbid', comitente: 'PESSOA FICTICIA', ref: null }] })
    expect(h.passagens[0].comitente).toBeNull()
  })
})
