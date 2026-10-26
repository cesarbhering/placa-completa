import type { BlogPost } from './blog-posts'

// Post da eleicao presidencial (25/out/2026). Tom neutro: so fato publicado e
// mecanismo economico, sem torcida nem previsao de preco. Sem travessao, sem
// citar a fonte de dados do registro. Numeros com fonte na secao Fontes.

export const postEleicao2026Usado: BlogPost = {
  slug: 'eleicao-2026-o-que-muda-no-preco-do-carro-usado',
  title: 'Eleição 2026: o que o resultado muda no preço do carro usado',
  seoTitles: [
    'Eleição 2026: o que muda no preço do carro usado',
    'Resultado da eleição e o preço do carro usado',
    'Eleição 2026 e o preço do carro usado',
  ],
  metaDescription: 'Lula foi reeleito em 25 de outubro. Veja como juros, crédito, dólar e contas públicas podem mexer no preço do carro usado e o que fazer antes de comprar.',
  publishedAt: '2026-10-25',
  categoria: 'Estudos',
  capa: {
    src: '/images/blog/eleicao-2026-o-que-muda-no-preco-do-carro-usado.png',
    og: '/images/blog/eleicao-2026-o-que-muda-no-preco-do-carro-usado-1200.png',
    alt: 'Eleição 2026: o que o resultado muda no preço do carro usado. Juros, crédito e dólar.',
    largura: 1600,
    altura: 836,
  },
  content: [
    {
      type: 'intro',
      text: 'Luiz Inácio Lula da Silva (PT) foi reeleito presidente neste domingo, 25 de outubro, ao vencer Flávio Bolsonaro (PL) no segundo turno. Com 97% das urnas apuradas, tinha 51,74% dos votos válidos, contra 48,26%. No primeiro turno, Flávio havia ficado à frente, por 47% a 45%. Para quem está prestes a comprar ou vender um carro usado, a pergunta prática é outra: **o preço muda?** No curto prazo, quase nada muda de um dia para o outro. O que move o preço do usado são juros, crédito, dólar e o preço do carro zero, e cada um deles reage ao novo mandato no seu ritmo.',
    },
    {
      type: 'heading',
      heading: 'Juros e crédito: o fator que mais pesa',
      text: 'A maior parte dos carros usados é comprada com financiamento, então a parcela manda mais do que o preço de tabela. A Selic está em **13,75% ao ano**, depois de cinco cortes seguidos de 0,25 ponto. A próxima reunião do Copom termina em **4 de novembro**, com a decisão anunciada no fim da tarde.\n\nEm setembro, o financiamento de veículos teve o melhor resultado em 15 anos: foram 670.675 veículos financiados, e entre os automóveis leves, 342 mil contratos foram de seminovos. No mesmo mês, o preço médio de seminovos e usados caiu 1,7%, com depreciação de 5,9% em 12 meses. Se os cortes de juros continuarem, a parcela cai e a procura por usado tende a seguir firme, o que segura o preço. Se o mercado passar a cobrar mais caro para financiar o governo, a pressão vai no sentido contrário.',
    },
    {
      type: 'heading',
      heading: 'Contas públicas, inflação e dólar',
      text: 'Um dos desafios citados para o quarto mandato é equilibrar as contas públicas depois da ampliação de benefícios na campanha. É isso que o mercado costuma olhar nas primeiras semanas depois de uma eleição: sinais sobre gasto e inflação mexem no dólar e nos juros futuros.\n\nO dólar chega ao carro usado por um caminho indireto. Peças, insumos e carros importados ficam mais caros quando o real se desvaloriza, o que empurra o preço do zero quilômetro para cima. Com o zero mais caro, parte dos compradores migra para o usado, e o usado acompanha. O caminho inverso também vale: dólar mais baixo alivia o zero e esfria o usado.',
    },
    {
      type: 'heading',
      heading: 'Programas de governo e carros específicos',
      text: 'Medidas de incentivo mexem em nichos, não no mercado inteiro. O Move Brasil, por exemplo, abriu financiamento de seminovos elétricos e híbridos flex a partir de 2024, com teto de R$ 150 mil, para motoristas de aplicativo e taxistas, com prazo de até 72 meses. Programas assim aumentam a procura justamente pelos modelos que entram na regra. Vale acompanhar se a política para o setor muda nos próximos meses, porque o efeito aparece primeiro nesses modelos.',
    },
    {
      type: 'heading',
      heading: 'O que não muda com a eleição',
      text: 'Nenhum resultado de urna altera o histórico de um carro. Dois veículos do mesmo modelo e ano podem ter valores bem diferentes por causa do que consta na placa:\n\n- **Passagem por leilão:** costuma reduzir o valor de revenda e pode dificultar o seguro.\n- **Indicador de sinistro:** pesa na avaliação e na aceitação pela seguradora.\n- **Gravame e restrições:** podem travar a transferência.\n- **Recall em aberto:** é um ponto que o próximo comprador vai perguntar.\n\nA tabela FIPE dá a referência média do modelo. O histórico da placa mostra se aquele carro em particular está acima ou abaixo dessa média.',
    },
    {
      type: 'heading',
      heading: 'O que fazer agora se você vai comprar ou vender',
      text: '- **Não decida no calor da notícia.** Preço de usado se ajusta em semanas, não em horas. Compare anúncios do mesmo modelo por alguns dias.\n- **Simule o financiamento antes e depois de 4 de novembro.** A decisão do Copom diz mais sobre a sua parcela do que o resultado da eleição.\n- **Use a FIPE como referência, não como preço final.** Ela é a média; o estado e o histórico do carro definem o valor real.\n- **Consulte a placa antes de pagar.** Leilão, sinistro, gravame e recall mudam o valor do carro em qualquer cenário econômico.',
    },
    {
      type: 'faq',
      heading: 'Perguntas frequentes',
      faq: [
        { q: 'O preço do carro usado vai cair depois da eleição?', a: 'Não existe efeito automático. O preço do usado depende principalmente de juros, crédito, dólar e preço do carro zero. Esses fatores reagem ao rumo da economia ao longo das próximas semanas e meses, e não ao resultado da urna em si.' },
        { q: 'É melhor esperar para comprar carro?', a: 'Se você depende de financiamento, vale acompanhar a reunião do Copom de 4 de novembro, que define a Selic. Se vai comprar à vista, o que mais pesa é encontrar um carro com bom histórico pelo preço justo.' },
        { q: 'A tabela FIPE muda por causa da eleição?', a: 'A FIPE é calculada todo mês a partir dos preços praticados no mercado. Se juros e dólar mudarem o comportamento de compradores e vendedores, isso aparece nas tabelas dos meses seguintes, não de imediato.' },
      ],
    },
    {
      type: 'cta',
      text: 'Antes de fechar negócio, veja o que consta na placa: leilão, sinistro, gravame, recall e valor FIPE.',
      ctaLabel: 'Consultar placa grátis',
      ctaTo: '/',
    },
    {
      type: 'heading',
      heading: 'Fontes',
      text: '- [g1: Em virada histórica, Lula derrota Flávio e chega ao quarto mandato](https://g1.globo.com/politica/eleicoes/2026/noticia/2026/10/25/em-virada-historica-lula-derrota-flavio-e-chega-ao-quarto-mandato-como-presidente-do-brasil.ghtml)\n- [Agência Brasil: BC reduz juros básicos para 13,75% ao ano](https://agenciabrasil.ebc.com.br/economia/noticia/2026-09/bc-reduz-juros-basicos-para-1375-ao-ano)\n- [Vrum: Financiamento de veículos bate recorde de 15 anos (dados da Trillia, da B3)](https://www.vrum.com.br/mercado/2026/10/7525584-financiamento-de-veiculos-bate-recorde-de-15-anos-com-queda-nos-precos.html)\n- [Mercado&Consumo: Move Brasil amplia compra de seminovos por motoristas de aplicativo e taxistas](https://mercadoeconsumo.com.br/16/07/2026/economia/move-brasil-governo-amplia-compra-de-carros-seminovos-por-motoristas-de-aplicativo-e-taxistas/)',
    },
  ],
}
