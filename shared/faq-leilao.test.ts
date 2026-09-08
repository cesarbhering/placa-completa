import { describe, it, expect } from 'vitest'
import { PERGUNTAS_LEILAO } from './faq-leilao'

// A copy desta pagina foi escrita sob regras que existem por motivo juridico,
// nao estetico: a consulta devolve INDICIO, e prometer certeza sobre o passado
// de um veiculo especifico e o tipo de frase que vira processo.
describe('FAQ de carro de leilao', () => {
  it('nao promete certeza', () => {
    for (const q of PERGUNTAS_LEILAO) {
      const texto = `${q.pergunta} ${q.resposta}`.toLowerCase()
      for (const proibido of ['garantimos', 'garantia de que', 'com certeza absoluta que', 'confirmamos que']) {
        expect(texto, `"${proibido}" promete o que a consulta nao entrega`).not.toContain(proibido)
      }
    }
  })

  it('nao nomeia a fonte dos dados do relatorio', () => {
    for (const q of PERGUNTAS_LEILAO) {
      const texto = `${q.pergunta} ${q.resposta}`.toLowerCase()
      expect(texto).not.toContain('senatran')
      expect(texto).not.toContain('serpro')
    }
  })

  it('sem travessao', () => {
    for (const q of PERGUNTAS_LEILAO) {
      expect(`${q.pergunta}${q.resposta}`).not.toContain('—')
    }
  })

  it('tem as seis perguntas aprovadas, e cada uma responde de verdade', () => {
    expect(PERGUNTAS_LEILAO).toHaveLength(6)
    for (const q of PERGUNTAS_LEILAO) {
      expect(q.pergunta.endsWith('?')).toBe(true)
      // Resposta curta demais vira snippet ruim e nao responde ninguem.
      expect(q.resposta.length).toBeGreaterThan(80)
    }
  })
})
