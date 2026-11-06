import { describe, it, expect } from 'vitest'
import { linkCompartilharWhatsapp, urlResultadoCompartilhado, textoCompartilhar, rotuloVeiculo, placaParaLink } from './compartilhar-whatsapp'

const PLACA = 'AAA1A11'

function textoDoLink(link: string): string {
  const u = new URL(link)
  expect(u.origin + u.pathname).toBe('https://wa.me/')
  return u.searchParams.get('text') || ''
}

describe('compartilhar resultado no WhatsApp', () => {
  it('URL publica do resultado com as UTMs do compartilhamento', () => {
    expect(urlResultadoCompartilhado(PLACA)).toBe(
      'https://placacompleta.com.br/placa/AAA1A11?utm_source=whatsapp&utm_medium=share&utm_campaign=resultado_gratis',
    )
  })

  it('normaliza a placa (minuscula, hifen, espaco) e recusa placa invalida', () => {
    expect(placaParaLink(' aaa-1a11 ')).toBe('AAA1A11')
    expect(urlResultadoCompartilhado('aaa-1a11')).toContain('/placa/AAA1A11?')
    expect(urlResultadoCompartilhado('')).toBe('')
    expect(urlResultadoCompartilhado('AAA1')).toBe('')
    expect(linkCompartilharWhatsapp({ placa: null })).toBe('')
  })

  it('wa.me sem numero, texto codificado e decodificavel', () => {
    const link = linkCompartilharWhatsapp({ placa: PLACA, modelo: 'Uno', ano: '2015' })
    expect(link.startsWith('https://wa.me/?text=')).toBe(true)
    // codificado: nada de espaco, & ou ? cru depois do text=
    const cru = link.slice('https://wa.me/?text='.length)
    expect(cru).not.toMatch(/[ &?:/]/)
    expect(textoDoLink(link)).toBe(
      'Olha o que apareceu na consulta da placa deste Uno 2015: https://placacompleta.com.br/placa/AAA1A11?utm_source=whatsapp&utm_medium=share&utm_campaign=resultado_gratis',
    )
  })

  it('sem modelo ou ano, cai no texto generico', () => {
    expect(rotuloVeiculo('', '2015')).toBe('deste carro')
    expect(rotuloVeiculo('Uno', null)).toBe('deste Uno')
    expect(rotuloVeiculo('Uno', 'abc')).toBe('deste Uno')
    expect(textoCompartilhar('https://x')).toBe('Olha o que apareceu na consulta da placa deste carro: https://x')
  })

  it('nunca leva dado pessoal, valor ou detalhe do pago; nem travessao ou palavras proibidas', () => {
    const texto = textoDoLink(linkCompartilharWhatsapp({ placa: PLACA, modelo: 'Uno', ano: 2015 }))
    expect(texto).not.toMatch(/R\$|\d+,\d{2}/)       // valor
    expect(texto).not.toMatch(/@|cpf|chassi|token|premium|leil|roubo|multa/i)
    // a frase legivel (fora da URL; a UTM resultado_gratis e do Lead, pra medicao)
    expect(texto.replace(/https:\/\/\S+/, '')).not.toMatch(/gr[aá]tis|senatran|detran/i)
    expect(texto).not.toContain('—')
    // o unico numero alem do ano e o que esta dentro da URL
    expect(texto.replace(/https:\/\/\S+/, '').replace('2015', '')).not.toMatch(/\d/)
  })
})
