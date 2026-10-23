import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { validarProposta, assuntoProposta, textoProposta, MSG_RECEBIDO } from './empresas'
import { DESCRICOES, descricaoNaFaixa } from './seo-meta'
import { COLUNAS_RODAPE } from './rodape-links'

const ok = () => ({
  nome: ' Ana  Souza ', empresa: 'Auto Center Bom Preço', tipo: 'Lojista', cidade: 'Campinas', uf: 'sp',
  volume_faixa: '50 a 200', whatsapp: '(19) 99876-5432', email: 'Ana@Exemplo.com.br', mensagem: '', aceite: true,
})

describe('formulario de pacote para empresas', () => {
  it('valida e saneia', () => {
    const r = validarProposta(ok())
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.dados).toEqual({ nome: 'Ana Souza', empresa: 'Auto Center Bom Preço', tipo: 'Lojista', cidade: 'Campinas', uf: 'SP', volume_faixa: '50 a 200', whatsapp: '19998765432', email: 'ana@exemplo.com.br', mensagem: null })
  })
  it('cada campo obrigatorio, faixa fora da lista e sem aceite: recusa com o campo', () => {
    for (const [campo, valor] of [['nome', ''], ['empresa', 'x'], ['tipo', 'Banco'], ['cidade', ''], ['uf', 'XX'], ['volume_faixa', '1000'], ['whatsapp', '123'], ['email', 'ana@'], ['aceite', false]] as const) {
      const r = validarProposta({ ...ok(), [campo]: valor })
      expect(r.ok, campo).toBe(false)
      if (!r.ok) expect(r.campo).toBe(campo)
    }
  })
  it('assunto e e-mail ao Cesar, sem travessao', () => {
    const r = validarProposta(ok())
    if (!r.ok) throw new Error('invalido')
    expect(assuntoProposta(r.dados)).toBe('Proposta de pacote: Auto Center Bom Preço (Lojista, 50 a 200 por mês)')
    const t = textoProposta(r.dados, 'utm_source=google')
    expect(t).toContain('Volume estimado: 50 a 200 consultas por mês')
    expect(t).toContain('Origem: utm_source=google')
    expect(t + MSG_RECEBIDO).not.toMatch(/—/)
    expect(MSG_RECEBIDO).toBe('Recebemos seu pedido. Respondemos em até 24 horas úteis.')
  })
  it('meta description na faixa, com as palavras pedidas; link no rodape', () => {
    expect(descricaoNaFaixa(DESCRICOES.paraEmpresas)).toBe(true)
    for (const p of ['consulta veicular em pacote', 'lojista', 'despachante']) expect(DESCRICOES.paraEmpresas.toLowerCase()).toContain(p)
    expect(COLUNAS_RODAPE.flatMap((c) => c.links).some((l) => l.to === '/para-empresas')).toBe(true)
  })
  it('pagina sem preco, sem travessao e sem citar orgao federal', () => {
    const v = readFileSync('pages/para-empresas.vue', 'utf8')
    const tela = v.slice(v.indexOf('<template>'))
    expect(tela).not.toMatch(/R\$\s?\d/)
    expect(v).not.toMatch(/—/)
    expect(v.toLowerCase()).not.toContain('senatran')
  })
})
