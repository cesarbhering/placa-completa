import { describe, it, expect } from 'vitest'
import { recallDetailsLabel, RECALL_DESCRIPTION_LABEL, capAtWord, RECALL_TEXT_CAP } from './recall-details'
import { madeUpText } from '../tests/helpers/texto-ficticio'

describe('capAtWord (safety cap of a free campaign text)', () => {
  it('the cap is high: 3000 characters', () => {
    expect(RECALL_TEXT_CAP).toBe(3000)
  })

  it('keeps a text within the cap whole', () => {
    const t = madeUpText(650)
    expect(capAtWord(t, RECALL_TEXT_CAP)).toBe(t)
    expect(capAtWord(madeUpText(3000), RECALL_TEXT_CAP)).toBe(madeUpText(3000))
  })

  it('cuts a longer text at the end of a word, with "…", within the cap', () => {
    const longo = madeUpText(3600)
    const r = capAtWord(longo, RECALL_TEXT_CAP)
    expect(r.length).toBeLessThanOrEqual(RECALL_TEXT_CAP)
    expect(r.length).toBeGreaterThan(RECALL_TEXT_CAP - 40)
    expect(r.endsWith('…')).toBe(true)
    const corpo = r.slice(0, -1)
    expect(longo.startsWith(corpo)).toBe(true)
    // The next character of the original ends the word (a space, or punctuation dropped before the "…").
    expect(longo[corpo.length]).toMatch(/[ .,;:]/)
  })

  it('never cuts in the middle of a word', () => {
    expect(capAtWord('abc defgh ijk', 8)).toBe('abc…')
    // The cut falls right at the end of a word: that word stays.
    expect(capAtWord('abc def ghi', 8)).toBe('abc def…')
    // Punctuation at the cut goes before the ellipsis.
    expect(capAtWord('abc def, ghi', 9)).toBe('abc def…')
  })

  it('a text with no space at all (not real copy) is cut at the cap, still with "…"', () => {
    expect(capAtWord('abcdefghij', 5)).toBe('abcd…')
  })
})

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
