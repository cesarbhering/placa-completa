import { describe, it, expect } from 'vitest'
import { LEILAO_FORA_DO_DOCUMENTO, leilaoSemOcorrencia, PALAVRAS_DE_ACUSACAO } from './leilao-copy'

const TODAS = [LEILAO_FORA_DO_DOCUMENTO, leilaoSemOcorrencia('esta moto')]

describe('copy da secao de leilao', () => {
  it('fala do documento, nao de quem o emite', () => {
    for (const frase of TODAS) {
      const baixa = frase.toLowerCase()
      for (const palavra of PALAVRAS_DE_ACUSACAO) {
        expect(baixa, `"${palavra}" acusa alguem de omitir`).not.toContain(palavra)
      }
      expect(baixa).not.toContain('detran')
    }
  })

  it('nunca afirma que o veiculo passou por leilao: fala de registro', () => {
    expect(LEILAO_FORA_DO_DOCUMENTO).toMatch(/registro/i)
    expect(LEILAO_FORA_DO_DOCUMENTO).toMatch(/pode não constar/i)
  })

  it('sem ocorrencia usa o nome do veiculo que veio do segmento', () => {
    expect(leilaoSemOcorrencia('esta moto')).toContain('esta moto')
    expect(leilaoSemOcorrencia('este veículo')).toContain('este veículo')
  })

  it('sem travessao em nenhuma frase', () => {
    for (const frase of TODAS) expect(frase).not.toContain('—')
  })
})
