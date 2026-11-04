import { describe, it, expect } from 'vitest'
import { anteriorATabelaFipe, MENSAGEM_FIPE_ANTERIOR, FIPE_ANO_MINIMO } from '../shared/fipe-cobertura'

describe('cobertura da tabela FIPE', () => {
  it('ano anterior a 1985 e anterior a tabela', () => {
    expect(anteriorATabelaFipe(1973)).toBe(true)
    expect(anteriorATabelaFipe('1984')).toBe(true)
    expect(anteriorATabelaFipe(1985)).toBe(false)
    expect(anteriorATabelaFipe(2016)).toBe(false)
    expect(anteriorATabelaFipe(null)).toBe(false)
    expect(anteriorATabelaFipe(0)).toBe(false)
  })
  it('mensagem cita o ano minimo e nao tem travessao', () => {
    expect(MENSAGEM_FIPE_ANTERIOR).toContain(String(FIPE_ANO_MINIMO))
    expect(MENSAGEM_FIPE_ANTERIOR).not.toContain('—')
  })
})
