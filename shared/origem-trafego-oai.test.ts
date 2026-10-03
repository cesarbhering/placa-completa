import { describe, it, expect } from 'vitest'
import { sanearOrigem } from './origem-trafego'

describe('oppref/obref na origem', () => {
  it('passam sem alteracao', () => {
    const o = sanearOrigem({ oppref: 'opp_AbC.123-x', obref: '123e4567-e89b-42d3-a456-426614174000', gclid: 'g' })
    expect(o.oppref).toBe('opp_AbC.123-x')
    expect(o.obref).toBe('123e4567-e89b-42d3-a456-426614174000')
  })
  it('grande demais ou estranho vira null (nunca truncado)', () => {
    expect(sanearOrigem({ oppref: 'x'.repeat(1001) }).oppref).toBeNull()
    expect(sanearOrigem({ oppref: 'a b' }).oppref).toBeNull()
    expect(sanearOrigem({}).obref).toBeNull()
  })
})
