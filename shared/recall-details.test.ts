import { describe, it, expect } from 'vitest'
import { recallDetailsLabel, RECALL_DESCRIPTION_LABEL, capAtWord, RECALL_TEXT_CAP, endOldCut, OLD_RECALL_TEXT_CUT } from './recall-details'
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
    expect(capAtWord('abcdef ghi jklmn', 13)).toBe('abcdef ghi…')
    // The cut falls right at the end of a word: that word stays.
    expect(capAtWord('abc def ghi', 8)).toBe('abc def…')
    // Punctuation at the cut goes before the ellipsis.
    expect(capAtWord('abc def, ghi', 9)).toBe('abc def…')
  })

  it('a text with no space at all (not real copy) is cut at the cap, still with "…"', () => {
    expect(capAtWord('abcdefghij', 5)).toBe('abcd…')
  })

  it('a last space before half the cap does not throw the text away: cut at the cap', () => {
    const r = capAtWord(`Veja ${'x'.repeat(3200)}`, RECALL_TEXT_CAP)
    expect(r).toBe(`Veja ${'x'.repeat(2994)}…`)
    expect(r).toHaveLength(RECALL_TEXT_CAP)
  })
})

describe('endOldCut (texts held cut at 600 by orders before 24/11/2026)', () => {
  it('the old cut length is 600', () => {
    expect(OLD_RECALL_TEXT_CUT).toBe(600)
  })

  it('a 600-character text cut in the middle of a word ends at the last whole word, with "…"', () => {
    const inicio = madeUpText(586)
    const cortado = `${inicio} freio dianteiro`.slice(0, 600)
    expect(cortado).toHaveLength(600)
    expect(cortado.endsWith(' freio diantei')).toBe(true)
    expect(endOldCut(cortado)).toBe(`${inicio} freio…`)
  })

  it('when the old cut fell right after a word, that word stays', () => {
    const inicio = madeUpText(590)
    const t = `${inicio} acidente.`
    expect(t).toHaveLength(600)
    expect(endOldCut(t)).toBe(`${inicio} acidente…`)
  })

  it('any other length is shown as it is', () => {
    for (const n of [120, 599, 601, 650, 1500]) expect(endOldCut(madeUpText(n))).toBe(madeUpText(n))
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
