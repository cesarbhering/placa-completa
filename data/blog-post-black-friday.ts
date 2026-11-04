import type { BlogPost } from './blog-posts'

// Post da Black Friday do usado (04/nov/2026), escrito no estilo do Cesar:
// cena concreta na abertura, opiniao assumida, pergunta retorica, comparacao
// com o cotidiano, ditado no fecho. Sem travessao, sem citar a fonte do
// registro, sem preco. Numero de lotes e da rodada de 03/11 da base propria.

export const postBlackFridayUsado: BlogPost = {
  slug: 'black-friday-carro-usado-golpe-anuncio',
  title: 'Black Friday de carro usado: o desconto que vem com leilão de brinde',
  seoTitles: [
    'Black Friday de carro usado: o desconto com leilão de brinde',
    'Black Friday do carro usado: cuidado com o desconto',
    'Black Friday de carro usado e o golpe do anúncio',
  ],
  metaDescription: 'Em novembro o anúncio de carro usado ganha "preço de Black Friday". Veja por que a pressa é a arma do golpe e o que conferir pela placa antes de fechar.',
  publishedAt: '2026-11-04',
  categoria: 'Estudos',
  capa: {
    src: '/images/blog/black-friday-carro-usado-golpe-anuncio.png',
    og: '/images/blog/black-friday-carro-usado-golpe-anuncio-1200.png',
    alt: 'Black Friday do usado: o desconto que vem com leilão de brinde. Etiqueta de 20% de desconto com "só até sexta" riscado.',
    largura: 1600,
    altura: 836,
  },
  content: [
    {
      type: 'intro',
      text: 'Em 3 de novembro, uma terça-feira comum, entraram 2.152 carros novos na nossa base de leilões. Numa noite. Em outubro a média era de algumas dezenas por dia. Novembro chega, o mercado acelera, e junto com os descontos de verdade chega aquele anúncio de Gol 2019 por R$ 12 mil abaixo da FIPE, "só até sexta", "preço de Black Friday, não vai durar". Quem acompanha o mercado de usado sabe: **desconto grande e prazo curto, no mesmo anúncio, é a receita do golpe há muito tempo**, novembro só dá a ele uma roupa nova.',
    },
    {
      type: 'heading',
      heading: 'A pressa é a mercadoria',
      text: 'O golpe do carro usado não vende carro, vende pressa. O vendedor some do WhatsApp quando você pede o renavam, mas responde em dez segundos quando pergunta do sinal. O documento "está com o despachante". A vistoria "não precisa, o carro é novinho". E o preço, esse sim, está pronto na hora, sempre uns 20% abaixo da tabela, porque abaixo disso ninguém acredita e acima disso ninguém corre.\n\nFunciona assim como promoção de loja de eletrodoméstico em novembro: a televisão sobe de preço em outubro para "cair" em novembro. No carro usado o truque é parecido, só que o que sobe não é o preço, é o seu medo de perder o negócio. E quem compra com medo de perder não confere, e quem não confere leva pra casa um carro que passou por leilão, tem restrição de roubo ou simplesmente não é daquele que está vendendo.',
    },
    {
      type: 'heading',
      heading: 'Por que eu confiaria num anúncio de novembro?',
      text: 'Essa é a pergunta certa, e a resposta é: não confie no anúncio, confie na placa. O anúncio o vendedor escreve, a placa não. Pela placa dá para saber marca, modelo, ano e cor em segundos, e com a consulta completa dá para ver se o chassi apareceu em algum dos mais de 2 milhões de registros de leilão que guardamos, se há restrição, se o carro tem passagem por sinistro. Mais de 40 mil pessoas fizeram isso desde agosto no PlacaCompleta, a maioria pelo celular, na porta da loja ou na frente do carro, antes de passar o Pix do sinal.\n\nCinco minutos de consulta contra o "só até sexta" do vendedor. Se o anúncio for honesto, o carro continua lá na segunda. Se não for, você acabou de economizar o carro inteiro.',
    },
    {
      type: 'heading',
      heading: 'O que conferir antes de pagar o sinal',
      text: 'Peça a placa e consulte antes de qualquer conversa sobre preço. Compare o nome do documento com o nome de quem recebe o dinheiro, e se for "um amigo", "a empresa do cunhado", desconfie. Confira se o chassi gravado no vidro e no motor é o mesmo do documento. Veja se o modelo aparece em leilão com frequência, porque carro que vai muito a leilão é carro que volta muito ao mercado "arrumado". E lembre que o desconto da Black Friday vale para televisão, para carro usado o preço justo já é a FIPE, o resto é história.\n\nNo interior se diz que o barato sai caro. Em novembro, sai de guincho.',
    },
    {
      type: 'faq',
      heading: 'Perguntas frequentes',
      faq: [
        {
          q: 'Carro de leilão é sempre golpe?',
          a: 'Não. Carro de leilão pode ser um bom negócio quando o comprador sabe que ele veio de leilão e paga o preço de carro de leilão. O problema é o carro de leilão vendido como carro de particular, pelo preço de particular.',
        },
        {
          q: 'O que a consulta pela placa mostra?',
          a: 'Na consulta gratuita, marca, modelo, ano, cor e se o modelo aparece com frequência em leilões. Na consulta completa, registros de leilão por chassi, restrições, indícios de sinistro e o valor FIPE para comparar com o anúncio.',
        },
        {
          q: 'O vendedor não quer passar a placa. E agora?',
          a: 'Esse já é o resultado da consulta. Carro com documentação em dia não tem placa escondida, a placa fica na rua o dia inteiro.',
        },
      ],
    },
    {
      type: 'cta',
      text: 'Pegue a placa do anúncio e confira antes de falar de preço.',
      ctaLabel: 'Consultar a placa antes de fechar',
      ctaTo: '/',
    },
  ],
}
