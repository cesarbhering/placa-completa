import { describe, it, expect, vi } from 'vitest'
vi.stubGlobal('defineEventHandler', (fn: any) => fn)
vi.mock('../utils/llms-answer', () => ({ resolveLlmsQuery: vi.fn(), renderLlmsText: vi.fn() }))
const { AI_CATALOG } = await import('./well-known-ai-catalog.get')
const { serverCard } = await import('./well-known-mcp-server-card.get')

describe('ai-catalog (ARD)', () => {
  it('estrutura', () => {
    expect(AI_CATALOG.specVersion).toBeTruthy()
    expect(AI_CATALOG.host.displayName).toBeTruthy()
    expect(AI_CATALOG.entries.length).toBe(4)
    for (const e of AI_CATALOG.entries as any[]) {
      expect(e.identifier).toMatch(/^urn:air:placacompleta\.com\.br:[a-z]+:[a-z-]+$/)
      expect(e.displayName).toBeTruthy()
      expect(e.type).toMatch(/^[a-z]+\/[a-z0-9.+-]+$/)
      expect(('url' in e) !== ('data' in e)).toBe(true)
      expect(e.representativeQueries.length).toBeGreaterThanOrEqual(2)
      expect(e.representativeQueries.length).toBeLessThanOrEqual(5)
    }
  })
})

describe('server card (SEP-1649)', () => {
  it('serverInfo, endpoint, capabilities; sem auth', () => {
    const c = serverCard()
    expect(c.serverInfo).toMatchObject({ name: 'placacompleta-llms', version: '1.0.0' })
    expect(c.transport.endpoint).toBe('https://placacompleta.com.br/mcp')
    expect(c.capabilities).toHaveProperty('tools')
    expect(c.authentication).toEqual({ required: false })
  })
})
