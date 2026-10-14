import { describe, it, expect } from 'vitest'
import { dadosDe } from './dados-de'

describe('dadosDe', () => {
  it('outro dia: "Dados de dd/mm"', () => {
    expect(dadosDe('2026-10-12T15:00:00Z', '2026-10-14T15:00:00Z')).toBe('Dados de 12/10')
  })
  it('mesmo dia em Brasilia: nada', () => {
    expect(dadosDe('2026-10-14T03:30:00Z', '2026-10-14T23:00:00Z')).toBeNull()
  })
  it('vira o dia em Brasilia, nao em UTC', () => {
    // 14/10 02:00Z = 13/10 23:00 BRT
    expect(dadosDe('2026-10-14T02:00:00Z', '2026-10-14T15:00:00Z')).toBe('Dados de 13/10')
  })
  it('sem data: nada', () => {
    expect(dadosDe(null, '2026-10-14T15:00:00Z')).toBeNull()
    expect(dadosDe('lixo', '2026-10-14T15:00:00Z')).toBeNull()
  })
  it('sem travessao', () => {
    expect(dadosDe('2026-01-02T15:00:00Z', '2026-10-14T15:00:00Z')).not.toContain('—')
  })
})
