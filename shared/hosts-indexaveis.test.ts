import { describe, it, expect } from 'vitest'
import { hostIndexavel } from './hosts-indexaveis'

describe('hostIndexavel', () => {
  it('so o dominio principal e o www', () => {
    for (const h of ['placacompleta.com.br', 'www.placacompleta.com.br', 'PlacaCompleta.com.br', 'placacompleta.com.br:443', 'placacompleta.com.br.']) expect(hostIndexavel(h)).toBe(true)
  })
  it('olhonamoto/olhonocaminhao seguem indexaveis (theming + self-canonical)', () => {
    for (const h of ['olhonamoto.com.br', 'www.olhonamoto.com.br', 'olhonocaminhao.com.br', 'www.olhonocaminhao.com.br']) expect(hostIndexavel(h)).toBe(true)
  })
  it('app, homolog, staging, IP, localhost e vazio: nao', () => {
    for (const h of ['app.placacompleta.com.br', 'homolog.placacompleta.com.br', 'staging.placacompleta.com.br', '127.0.0.1:8395', 'localhost:3000', 'placacompleta.com.br.evil.com', '', null, undefined]) expect(hostIndexavel(h as any)).toBe(false)
  })
})
