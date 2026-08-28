// GET /.well-known/api-catalog (RFC 9727) - catalogo minimo apontando pro
// endpoint de agentes /llms. Agent-readiness: scanners fazem GET com
// Accept: application/linkset+json e esperam esse content-type de volta.
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'application/linkset+json')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')

  return {
    linkset: [
      {
        anchor: 'https://placacompleta.com.br/',
        'api-catalog': [
          {
            href: 'https://placacompleta.com.br/llms',
            title: 'Consulta veicular por placa (texto)',
            type: 'text/plain',
          },
          {
            href: 'https://placacompleta.com.br/llms/json',
            title: 'Consulta veicular por placa (JSON estruturado)',
            type: 'application/json',
          },
        ],
      },
    ],
  }
})
