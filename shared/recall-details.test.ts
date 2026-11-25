import { describe, it, expect } from 'vitest'
import { recallDetailsLabel, RECALL_DESCRIPTION_LABEL } from './recall-details'

describe('recallDetailsLabel (summary of the folded recall texts)', () => {
  it('names both texts when the campaign has the risk and what to do', () => {
    expect(recallDetailsLabel({ risco: 'O airbag pode romper.', oQueFazer: 'Agende o reparo.' })).toBe('Ver o risco e o que fazer')
  })

  it('names only the risk when there is no what-to-do text', () => {
    expect(recallDetailsLabel({ risco: 'O airbag pode romper.' })).toBe('Ver o risco')
    expect(recallDetailsLabel({ risco: 'O airbag pode romper.', oQueFazer: null })).toBe('Ver o risco')
    expect(recallDetailsLabel({ risco: 'O airbag pode romper.', oQueFazer: '' })).toBe('Ver o risco')
  })

  it('names only what to do when there is no risk text', () => {
    expect(recallDetailsLabel({ oQueFazer: 'Agende o reparo.' })).toBe('Ver o que fazer')
    expect(recallDetailsLabel({ risco: null, oQueFazer: 'Agende o reparo.' })).toBe('Ver o que fazer')
  })

  it('returns null when there is nothing to fold, so no accordion is drawn', () => {
    expect(recallDetailsLabel({})).toBeNull()
    expect(recallDetailsLabel({ risco: null, oQueFazer: null })).toBeNull()
    expect(recallDetailsLabel({ risco: '', oQueFazer: '' })).toBeNull()
  })

  it('labels are plain Portuguese without a dash', () => {
    const labels = [
      recallDetailsLabel({ risco: 'a', oQueFazer: 'b' }),
      recallDetailsLabel({ risco: 'a' }),
      recallDetailsLabel({ oQueFazer: 'b' }),
      RECALL_DESCRIPTION_LABEL,
    ]
    expect(RECALL_DESCRIPTION_LABEL).toBe('Ver a descrição')
    for (const l of labels) expect(l).not.toMatch(/[—–]/)
  })
})
