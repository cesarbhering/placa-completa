// Guia "Como saber se o carro e de leilao" (plano SEO 02/out, item #7). Regras:
// nunca afirmar que um carro especifico e de leilao, nenhum valor de leilao em
// R$, nenhum numero de desvalorizacao inventado, sem travessao, sem fornecedor.
//
// Numero (prod, so leitura, agregado): eventos_funil com sinal de leilao
// respondido (positivo ou negativo), 1 por placa, 20/09 a 02/10/2026 (o sinal
// so passou a ser gravado em 20/09): 67 de 1.234 placas = 5,4%.

export const LEVANTAMENTO_SINAL = {
  n: 1234,
  positivos: 67,
  pct: '5,4%',
  periodo: 'entre 20 de setembro e 2 de outubro de 2026',
}

export const PASSOS = [
  { nome: 'Peça o documento e o histórico', texto: 'Peça o CRLV e pergunte direto se o carro já passou por leilão. Confira se o documento tem alguma observação de sinistro, recuperação ou remarcação de chassi.' },
  { nome: 'Confira o chassi em todos os lugares', texto: 'O número do chassi do documento precisa bater com o gravado no assoalho ou na coluna, com a etiqueta das portas e com a gravação dos vidros. Divergência ou gravação retocada é sinal de alerta.' },
  { nome: 'Olhe o motor e as etiquetas', texto: 'Confira o número do motor e procure as etiquetas de identificação. Etiqueta faltando, raspada ou recolocada pede uma explicação do vendedor.' },
  { nome: 'Procure sinais de reparo', texto: 'Diferença de tom na pintura, solda aparente, massa nas longarinas e peças de lataria com parafusos mexidos indicam batida e reparo, que é comum em carro recuperado de sinistro.' },
  { nome: 'Consulte a placa ou o chassi', texto: 'Uma consulta pela placa cruza o veículo com registros de leilão: o indicador do registro nacional e bases montadas a partir de editais de DETRANs e catálogos de leiloeiras. É o que mostra o que não está no carro nem no documento.' },
]

export const SINAIS = [
  'Chassi remarcado, retocado ou com gravação diferente da original',
  'Etiquetas de identificação faltando ou recolocadas',
  'Solda, massa ou repintura em partes estruturais',
  'Documento com observação de sinistro ou recuperação',
  'Preço bem abaixo da Tabela FIPE sem uma explicação clara',
]

export const FAQ_COMO_SABER = [
  { pergunta: 'Leilão aparece no documento do carro?', resposta: 'Nem sempre. Alguns registros aparecem como indicador no cadastro nacional do veículo, mas muitos leilões não ficam visíveis no documento que o vendedor mostra, principalmente depois de transferências. Por isso vale cruzar a placa com uma base de leilões.' },
  { pergunta: 'Carro de leilão pode ser financiado?', resposta: 'Depende da instituição. Muitas financeiras recusam ou exigem condições diferentes para veículos com passagem por leilão, principalmente os de sinistro. Consulte o banco antes de fechar negócio.' },
  { pergunta: 'Quanto um carro de leilão desvaloriza?', resposta: 'Não existe um número fixo. A perda de valor na revenda depende do tipo de leilão, do estado do carro e do mercado: um carro recuperado de financiamento perde menos que um classificado como sinistro. Em geral ele vale menos que um equivalente sem passagem.' },
  { pergunta: 'Seguradora aceita carro de leilão?', resposta: 'Algumas sim, outras recusam ou pedem vistoria, e a indenização pode ser calculada de outro jeito. Pergunte à seguradora antes de comprar, informando a passagem por leilão.' },
  { pergunta: 'Como consultar se um carro é de leilão pelo chassi?', resposta: 'O relatório completo usa o chassi do registro nacional junto com a placa para cruzar com a base de leilões. Basta informar a placa: o chassi vem do cadastro oficial.' },
]
