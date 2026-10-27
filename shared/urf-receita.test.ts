import { describe, it, expect } from 'vitest'
import { textoUrf, urfReceita, normalizarUrf, URF_RECEITA } from './urf-receita'

describe('URF da Receita (orgao de despacho da importacao)', () => {
  it('727600 sem zero a esquerda = Porto de Vitória (ES)', () => {
    expect(normalizarUrf('727600')).toBe('0727600')
    expect(textoUrf('727600')).toBe('Porto de Vitória (ES), URF 0727600')
    expect(textoUrf(727600)).toBe('Porto de Vitória (ES), URF 0727600')
    expect(urfReceita('727600')?.regiao).toBe('7ª Região Fiscal')
  })
  it('Santos e Itajaí', () => {
    expect(textoUrf('0817800')).toBe('Porto de Santos (SP), URF 0817800')
    expect(textoUrf('0927800')).toBe('Itajaí (SC), URF 0927800')
  })
  it('codigo desconhecido: so o numero com "URF"', () => {
    expect(textoUrf('0727699')).toBe('URF 0727699')
    expect(urfReceita('0727699')?.nome).toBeNull()
  })
  it('vazio, zero ou lixo: nada', () => {
    for (const v of [null, undefined, '', '0', '0000000', 'abc', '12345678']) expect(textoUrf(v)).toBeNull()
  })
  it('tabela: 170 codigos de 7 digitos, UF valida, sem travessao', () => {
    const e = Object.entries(URF_RECEITA)
    expect(e.length).toBe(170)
    for (const [cod, [nome, uf]] of e) {
      expect(cod).toMatch(/^\d{7}$/)
      expect(uf).toMatch(/^[A-Z]{2}$/)
      expect(nome).not.toContain('—')
    }
  })
  it('pagina usa o texto da URF', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('pages/premium/[token].vue', 'utf8')).toContain("linhaImportacao('Órgão de despacho', textoUrf(imp.codigoOrgaoSrf))")
  })
})
