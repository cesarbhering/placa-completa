// Colunas do rodape (opcao 1 do Cesar, 08/out). Todo link que o rodape antigo
// tinha continua aqui (SEO). NUNCA /premium bare.
export interface ColunaRodape { titulo: string; links: { rotulo: string; to: string }[] }

export const COLUNAS_RODAPE: ColunaRodape[] = [
  {
    titulo: 'Consultas',
    links: [
      { rotulo: 'Consulta grátis', to: '/consulta-gratis' },
      { rotulo: 'Consulta veicular completa', to: '/consulta-veicular-completa' },
      { rotulo: 'Histórico veicular', to: '/historico-veicular' },
      { rotulo: 'Consulta de leilão', to: '/consulta-leilao-veiculo' },
      { rotulo: 'Laudo cautelar', to: '/laudo-cautelar' },
      { rotulo: 'Consultar por estado', to: '/consultar-placa' },
    ],
  },
  {
    titulo: 'Preços e FIPE',
    links: [
      { rotulo: 'Tabela FIPE', to: '/tabela-fipe' },
      { rotulo: 'FIPE pela placa', to: '/tabela-fipe-por-placa' },
      { rotulo: 'Cotação', to: '/cotacao' },
      { rotulo: 'Seguro de carro elétrico', to: '/seguro/carro-eletrico' },
    ],
  },
  {
    titulo: 'Aprenda',
    links: [
      { rotulo: 'Como consultar placa', to: '/como-consultar-placa' },
      { rotulo: 'Carro de leilão: como saber', to: '/carro-de-leilao/como-saber' },
      { rotulo: 'O que é RENAVAM', to: '/o-que-e/renavam' },
      { rotulo: 'O que é gravame', to: '/o-que-e/gravame' },
      { rotulo: 'O que é RENAJUD', to: '/o-que-e/renajud' },
      { rotulo: 'Multas RENAINF', to: '/o-que-e/multas-renainf' },
    ],
  },
  {
    titulo: 'Empresa',
    links: [
      { rotulo: 'Sobre', to: '/sobre' },
      { rotulo: 'Blog', to: '/blog' },
      { rotulo: 'IBV Auto', to: '/ibv' },
      { rotulo: 'Estudos', to: '/estudos' },
      // Pagina, nao mailto: a Cloudflare reescreve mailto pra um link que da 404
      // pra crawler (ver pages/contato.vue).
      { rotulo: 'Contato', to: '/contato' },
    ],
  },
]
