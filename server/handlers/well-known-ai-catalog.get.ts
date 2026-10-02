// GET /.well-known/ai-catalog.json (ARD, modelo ai-catalog). So aponta pro que
// ja e publico pra agentes: /llms (texto), /llms/json, /llms.txt e o MCP
// somente leitura (/mcp, via server card). Nada de placa, relatorio ou auth.
const BASE = 'https://placacompleta.com.br'
const NS = 'urn:air:placacompleta.com.br'

export const AI_CATALOG = {
  specVersion: '1.0',
  host: { displayName: 'PlacaCompleta', identifier: 'did:web:placacompleta.com.br' },
  entries: [
    {
      identifier: `${NS}:api:llms`,
      displayName: 'PlacaCompleta /llms (resposta em texto)',
      type: 'text/plain',
      url: `${BASE}/llms?query={pergunta}`,
      representativeQueries: ['valor fipe do gol 2018', 'seguro medio no rio de janeiro', 'carros usados valorizaram no ultimo mes'],
    },
    {
      identifier: `${NS}:api:llms-json`,
      displayName: 'PlacaCompleta /llms/json (resposta estruturada)',
      type: 'application/json',
      url: `${BASE}/llms/json?query={pergunta}`,
      representativeQueries: ['valor fipe do onix 2020 em json', 'seguro do jeep compass', 'ranking do seguro mais caro por estado'],
    },
    {
      identifier: `${NS}:doc:llms-txt`,
      displayName: 'PlacaCompleta llms.txt (guia para agentes)',
      type: 'text/markdown',
      url: `${BASE}/llms.txt`,
      representativeQueries: ['como um agente consulta a PlacaCompleta', 'quais dados publicos a PlacaCompleta oferece'],
    },
    {
      identifier: `${NS}:server:mcp`,
      displayName: 'PlacaCompleta MCP (somente leitura: FIPE, seguro medio, IBV)',
      type: 'application/mcp-server-card+json',
      url: `${BASE}/.well-known/mcp/server-card.json`,
      representativeQueries: ['valor fipe de um modelo via MCP', 'seguro medio por estado no Brasil', 'indice de valorizacao de carros usados'],
    },
  ],
}

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'application/json')
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return AI_CATALOG
})
