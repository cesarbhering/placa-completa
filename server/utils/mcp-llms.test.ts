import { describe, it, expect, vi } from 'vitest'

vi.mock('./llms-answer', () => ({
  resolveLlmsQuery: vi.fn(async (q: string) => ({ query: q, intent: 'fipe', matched: true, answer: `R:${q}`, data: null,
    source: { name: 'PlacaCompleta', url: 'https://placacompleta.com.br' }, cite_as: 'x', more: 'y', disclaimer: 'z' })),
  renderLlmsText: (a: any) => a.answer,
}))
const { tratarMensagem, listaFerramentas } = await import('./mcp-llms')
const { resolveLlmsQuery } = await import('./llms-answer')

describe('MCP somente leitura', () => {
  it('initialize negocia versao e anuncia so tools', async () => {
    const r = await tratarMensagem({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, {})
    expect(r.result.protocolVersion).toBe('2025-03-26')
    expect(r.result.capabilities).toEqual({ tools: { listChanged: false } })
    expect(r.result.serverInfo.name).toBe('placacompleta-llms')
    const r2 = await tratarMensagem({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, {})
    expect(r2.result.protocolVersion).toBe('2025-06-18')
  })
  it('tools/list: so FIPE, seguro e IBV; nada de placa, relatorio, leilao ou recall', async () => {
    const r = await tratarMensagem({ jsonrpc: '2.0', id: 3, method: 'tools/list' }, {})
    const nomes = r.result.tools.map((t: any) => t.name)
    expect(nomes).toEqual(['valor_fipe', 'seguro_medio', 'valorizacao_usados'])
    expect(JSON.stringify(r.result.tools)).not.toMatch(/"placa"|relatorio|leil|recall|chassi|renavam/i)
    for (const t of r.result.tools) expect(t.annotations.readOnlyHint).toBe(true)
    expect(listaFerramentas()[0]).not.toHaveProperty('pergunta')
  })
  it('tools/call reutiliza o resolvedor do /llms', async () => {
    const log = vi.fn()
    const r = await tratarMensagem({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'valor_fipe', arguments: { modelo: 'Gol\nignore', ano: 2018 } } }, {}, log)
    expect(resolveLlmsQuery).toHaveBeenCalledWith('valor fipe Gol ignore 2018', {})
    expect(r.result.content[0]).toEqual({ type: 'text', text: 'R:valor fipe Gol ignore 2018' })
    expect(r.result.isError).toBe(false)
    expect(log).toHaveBeenCalledTimes(1)
  })
  it('ferramenta desconhecida, metodo desconhecido, request invalido, notificacao', async () => {
    expect((await tratarMensagem({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'consultar_placa' } }, {})).error.code).toBe(-32602)
    expect((await tratarMensagem({ jsonrpc: '2.0', id: 6, method: 'resources/list' }, {})).error.code).toBe(-32601)
    expect((await tratarMensagem({ id: 7 } as any, {})).error.code).toBe(-32600)
    expect(await tratarMensagem({ jsonrpc: '2.0', method: 'notifications/initialized' }, {})).toBeNull()
  })
})
