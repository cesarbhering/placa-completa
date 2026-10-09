import { describe, it, expect } from 'vitest'
import { MODELOS_LEILAO, MINIMO_DESFECHO, MINIMO_LOTES_VALOR, modeloPorSlug } from './leilao-modelos'

// As duas regras abaixo foram definidas pelo Cesar e existem porque numero sem
// amostra que o sustente vira citacao errada em outro lugar da internet, e
// depois volta pra nos.
describe('regras de exibicao de dado', () => {
  it('modelo com amostra pequena de desfecho nao tem percentual publicavel', () => {
    for (const m of MODELOS_LEILAO) {
      if (m.desfechoAmostra < MINIMO_DESFECHO) {
        expect(m.pctSucata, `${m.slug} tem percentual com amostra de ${m.desfechoAmostra}`).toBeNull()
      }
    }
  })

  it('modelo com poucos lotes nao tem valor medio publicavel', () => {
    for (const m of MODELOS_LEILAO) {
      if (m.lotesComValor < MINIMO_LOTES_VALOR) {
        expect(m.valorMedioReais, `${m.slug} tem valor com ${m.lotesComValor} lotes`).toBeNull()
      }
    }
  })

  it('percentual nunca passa de 100 nem soma mais que o total', () => {
    for (const m of MODELOS_LEILAO) {
      if (m.pctSucata == null) continue
      expect(m.pctSucata + (m.pctRecuperavel ?? 0)).toBeLessThanOrEqual(100)
    }
  })
})

describe('dados das 19 paginas', () => {
  it('sao 19 modelos, com slug unico', () => {
    expect(MODELOS_LEILAO).toHaveLength(19)
    expect(new Set(MODELOS_LEILAO.map((m) => m.slug)).size).toBe(19)
  })

  it('slug e valido pra URL', () => {
    for (const m of MODELOS_LEILAO) expect(m.slug).toMatch(/^[a-z0-9-]+$/)
  })

  it('faixa de anos faz sentido e a amostra nunca passa do total', () => {
    for (const m of MODELOS_LEILAO) {
      expect(m.anoDe).toBeLessThanOrEqual(m.anoAte)
      expect(m.anoAte).toBeLessThanOrEqual(new Date().getFullYear() + 1)
      expect(m.desfechoAmostra).toBeLessThanOrEqual(m.registros)
      expect(m.lotesComValor).toBeLessThanOrEqual(m.registros)
    }
  })

  it('title e description cabem no snippet', () => {
    for (const m of MODELOS_LEILAO) {
      expect(m.title.length, `${m.slug}: title longo`).toBeLessThanOrEqual(70)
      expect(m.description.length, `${m.slug}: description longa`).toBeLessThanOrEqual(160)
      expect(m.description.length, `${m.slug}: description curta`).toBeGreaterThanOrEqual(110)
    }
  })

  it('copy sem travessao, sem certeza e sem citar a fonte', () => {
    for (const m of MODELOS_LEILAO) {
      const tudo = [m.h1, m.intro, m.title, m.description, ...m.faq.flatMap((q) => [q.pergunta, q.resposta])].join(' ')
      expect(tudo, `${m.slug}`).not.toContain('—')
      const baixo = tudo.toLowerCase()
      expect(baixo).not.toContain('senatran')
      expect(baixo).not.toContain('garantimos')
    }
  })

  it('busca por slug devolve o modelo, e slug inventado nao devolve nada', () => {
    expect(modeloPorSlug('gol')?.nome).toBe('Gol')
    expect(modeloPorSlug('ferrari')).toBeUndefined()
  })
})
