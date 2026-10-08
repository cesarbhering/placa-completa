import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { itemInformativo, itensQueRestringem, explicaRestricao, EXPLICA_RESTRICAO_GENERICA } from './restricoes'

// 08/out: PRINCIPAL_CONDUTOR caia no texto generico ("condiciona ou impede a
// transferencia"). E cadastro informativo: aparece, mas nao conta como restricao.
describe('principal condutor (item informativo)', () => {
  it('reconhece as variacoes de grafia', () => {
    for (const s of ['PRINCIPAL_CONDUTOR', 'principal condutor', 'PRINCIPAL-CONDUTOR', ' Principal  Condutor ', 'PRINCIPAL_CONDUTOR_FILE_VEICULOS']) {
      expect(itemInformativo(s)?.titulo).toBe('Principal condutor')
    }
    expect(itemInformativo('ALIENACAO_FIDUCIARIA')).toBeNull()
    expect(itemInformativo('')).toBeNull()
  })
  it('texto aprovado, sem travessao e sem o generico', () => {
    const t = itemInformativo('PRINCIPAL_CONDUTOR')!.texto
    expect(t).toContain('Não impede a transferência.')
    expect(t).not.toMatch(/—/)
    expect(t).not.toBe(EXPLICA_RESTRICAO_GENERICA)
  })
  it('sai da lista que restringe e preserva o resto (inclusive snapshots ja entregues)', () => {
    expect(itensQueRestringem(['PRINCIPAL_CONDUTOR', 'RESTRICAO_BENEFICIO_TRIBUTARIO'])).toEqual(['RESTRICAO_BENEFICIO_TRIBUTARIO'])
    expect(itensQueRestringem(['PRINCIPAL_CONDUTOR'])).toEqual([])
    expect(itensQueRestringem(undefined)).toBeUndefined()
  })
  it('restricao de verdade segue com a explicacao de sempre', () => {
    expect(explicaRestricao('GRAVAME')).toContain('financiado')
  })
})

describe('relatorio usa os itens que restringem nas contas', () => {
  const src = readFileSync('pages/premium/[token].vue', 'utf8')
  it('cartoes (gravame/outras restricoes), veredito e "so RENAVE" filtram informativos', () => {
    expect(src).toContain('const itens = itensQueRestringem(v.value?.restricoesItens)')
    expect(src.match(/itensQueRestringem\(/g)!.length).toBeGreaterThanOrEqual(3)
    expect(src).toContain("r.info ? 'Informação' : 'Restrição'")
  })
})
