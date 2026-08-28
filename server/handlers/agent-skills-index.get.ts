// Indice minimo de "agent skills". Servido nos dois paths que scanners de
// agent-readiness testam: /.well-known/skills/index.json e
// /agent-skills/index.json (registrados em nitro.handlers, nuxt.config.ts).
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')

  return {
    version: '1.0',
    skills: [
      {
        name: 'consulta-veicular',
        description:
          'Consulta veicular deterministica por placa: dados do veiculo, FIPE, indicadores de multa e registro de leilao. Pensado pra uso por agentes/LLMs.',
        endpoint: 'https://placacompleta.com.br/llms/json',
        method: 'GET',
        parameters: {
          query: 'Placa do veiculo (ex: ABC1D23) ou pergunta em linguagem natural contendo a placa.',
        },
        responseFormats: [
          { path: '/llms', format: 'text/plain' },
          { path: '/llms/json', format: 'application/json' },
        ],
      },
    ],
  }
})
