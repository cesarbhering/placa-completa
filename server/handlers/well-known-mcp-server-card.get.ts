import { MCP_NOME, MCP_VERSAO, MCP_PROTOCOLOS, MCP_ENDPOINT, listaFerramentas } from '../utils/mcp-llms'

// GET /.well-known/mcp/server-card.json (SEP-1649). Descreve o MCP somente
// leitura em /mcp. Publico, sem autenticacao (como o /llms).
export function serverCard() {
  return {
    $schema: 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
    version: '1.0',
    protocolVersion: MCP_PROTOCOLOS[0],
    serverInfo: { name: MCP_NOME, title: 'PlacaCompleta (dados publicos para agentes)', version: MCP_VERSAO },
    description: 'Somente leitura: valor FIPE por modelo, seguro medio por estado/modelo e IBV Auto (valorizacao de usados). Nao consulta placa nem relatorio.',
    websiteUrl: 'https://placacompleta.com.br',
    transport: { type: 'streamable-http', endpoint: MCP_ENDPOINT },
    capabilities: { tools: { listChanged: false } },
    authentication: { required: false },
    tools: listaFerramentas().map(({ name, title, description }) => ({ name, title, description })),
  }
}

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'application/json')
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return serverCard()
})
