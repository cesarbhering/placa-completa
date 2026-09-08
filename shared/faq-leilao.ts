// FAQ da pagina /carro-de-leilao. Fica fora do componente porque as mesmas
// perguntas alimentam DUAS coisas que precisam bater exatamente: o texto na
// tela e o JSON-LD do FAQPage. Duplicar as respostas seria a forma mais facil
// de o Google indexar uma resposta que a pagina nao mostra mais.
export interface PerguntaLeilao {
  pergunta: string
  resposta: string
}

export const PERGUNTAS_LEILAO: PerguntaLeilao[] = [
  {
    pergunta: 'Carro de leilão é ruim?',
    resposta: 'Não necessariamente. Depende do tipo de leilão. Um carro recuperado de financiamento ou de disputa judicial pode estar em ótimo estado. Já um carro de sucata ou recuperável exige mais cuidado e inspeção técnica antes de comprar.',
  },
  {
    pergunta: 'Como descobrir se um carro já foi de leilão pela placa?',
    resposta: 'Consultando a placa numa base que cruza os dados do veículo com registros de leilões públicos. A consulta retorna um indício de passagem quando existe um registro compatível, não uma certeza absoluta, mas é uma informação que o documento do carro não mostra sozinho.',
  },
  {
    pergunta: 'Onde fica registrado que um carro foi a leilão?',
    resposta: 'Não existe um único lugar centralizado e visível pro comprador comum. A informação existe em registros de leiloeiras e órgãos de trânsito, mas normalmente não aparece de forma automática no CRLV que o vendedor te mostra.',
  },
  {
    pergunta: 'Carro de leilão perde a garantia de fábrica?',
    resposta: 'A passagem por leilão em si não cancela a garantia de fábrica se o carro ainda estiver dentro do prazo e das condições da montadora. O que pode afetar a garantia é o tipo de dano que levou o carro ao leilão, principalmente em casos de sucata por sinistro.',
  },
  {
    pergunta: 'É seguro comprar um carro de leilão?',
    resposta: 'Pode ser, dependendo do tipo de leilão e do estado real do carro. O cuidado essencial é descobrir a origem antes de negociar o preço, e fazer uma inspeção técnica quando houver qualquer indício de sinistro grave.',
  },
  {
    pergunta: 'Qual a diferença entre carro de leilão e carro salvado?',
    resposta: 'Carro de leilão é qualquer veículo vendido nesse formato, por qualquer motivo. Carro salvado é um caso específico: passou por sinistro grave, foi classificado como sucata ou recuperável, e precisou de reparo estrutural antes de voltar a circular. Todo carro salvado passa por leilão, mas nem todo carro de leilão é salvado.',
  },
]
