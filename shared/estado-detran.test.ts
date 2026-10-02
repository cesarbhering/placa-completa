import { describe, it, expect } from 'vitest'
import { ESTADO_DETRAN } from './estado-detran'

describe('estado-detran', () => {
  it('PE, CE, SP, MG e BA', () => {
    expect(Object.keys(ESTADO_DETRAN).sort()).toEqual(['BA', 'CE', 'MG', 'PE', 'SP'])
  })
  for (const [uf, e] of Object.entries(ESTADO_DETRAN)) {
    it(`${uf}: N >= 30 em todo percentual e regras de copy`, () => {
      for (const d of e.dados) {
        const n = Number(d.texto.match(/Entre (\d+) ve/)?.[1])
        expect(n).toBeGreaterThanOrEqual(30)
      }
      const tudo = JSON.stringify(e)
      expect(tudo).not.toMatch(/—|R\$\s*\d|infosimples|wdapi|somos o DETRAN/i)
    })
  }
})
