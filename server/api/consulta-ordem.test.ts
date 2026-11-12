import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Consulta gratis (12/nov/2026): a geo por IP corre junto com os limites e a
// busca da placa, sem mudar a ordem turnstile -> gate -> limite -> rate limit.
const src = readFileSync('server/api/consulta.post.ts', 'utf8')
const pos = (s: string) => { const i = src.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i }

describe('consulta gratis: order of the checks', () => {
  it('keeps turnstile, email gate, IP limit and rate limit in the same order', () => {
    const ordem = [
      pos('await decidirTurnstile('),
      pos('await avaliarGateEmail('),
      pos('await checarLimiteIpWdapi('),
      pos('const [recipientRes, ipRes] = await Promise.all(['),
      pos('await consultarPlacaWdapiDetalhado(placaClean)'),
    ]
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem)
  })

  it('starts the IP geo lookup without awaiting it and reads it only after the plate lookup', () => {
    expect(src).not.toMatch(/await lookupIpGeo\(/)
    const inicio = pos('const ipGeoP = lookupIpGeo(ip)')
    expect(inicio).toBeGreaterThan(pos('await decidirTurnstile('))
    expect(inicio).toBeLessThan(pos('await avaliarGateEmail('))
    const leituras = [...src.matchAll(/await ipGeoP/g)].map((m) => m.index!)
    expect(leituras.length).toBeGreaterThan(0)
    for (const i of leituras) expect(i).toBeGreaterThan(pos('await consultarPlacaWdapiDetalhado(placaClean)'))
  })
})
