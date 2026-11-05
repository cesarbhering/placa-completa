import type { BlogPost } from './blog-posts'

// Tabela FIPE de novembro/2026 (05/nov/2026), no estilo do Cesar: cena concreta,
// opiniao assumida, pergunta retorica, comparacao com o cotidiano, ditado no fecho.
// Numeros: fipe-api propria, 39.506 linhas versao x ano-modelo com preco em out e nov/2026,
// comparadas com nov/2025. Mediana por linha. Levantamento e scripts no repo de marketing
// (seo/reports/fipe-2026-11). Sem travessao, sem fonte de registro, sem preco.

export const postFipeNovembro2026: BlogPost = {
  slug: 'tabela-fipe-novembro-2026-usado-caiu',
  title: 'Tabela FIPE de novembro de 2026: o usado caiu 0,9% no mês e 4,7% em um ano',
  seoTitles: [
    'Tabela FIPE de novembro de 2026: o usado caiu de novo',
    'FIPE de novembro de 2026: quem mais caiu e quem subiu',
    'Tabela FIPE novembro 2026: usado caiu 4,7% em um ano',
  ],
  metaDescription: 'Tabela FIPE de novembro de 2026: o carro usado caiu 0,9% no mês e 4,7% em 12 meses. Marcas, populares, elétricos, híbridos e motos.',
  publishedAt: '2026-11-05',
  categoria: 'Estudos',
  capa: {
    src: '/images/blog/tabela-fipe-novembro-2026-usado-caiu.png',
    og: '/images/blog/tabela-fipe-novembro-2026-usado-caiu-1200.png',
    alt: 'Tabela FIPE de novembro de 2026: o usado caiu 0,9% no mês e 4,7% no ano. 47% das versões de carro usado caíram exatamente 0,9%.',
    largura: 1600,
    altura: 836,
  },
  content: [
    {
      type: 'intro',
      text: 'Um Jeep Compass Longitude 2022 valia R$ 126.836 na tabela FIPE de novembro do ano passado. Na tabela que saiu agora, novembro de 2026, vale R$ 112.633. São R$ 14.203 que sumiram da garagem em doze meses sem o dono tirar o carro da vaga. Pegamos as 39.506 linhas da tabela nova (cada versão em cada ano-modelo, carros e motos) e comparamos com outubro e com novembro de 2025. O resumo é curto: **o carro usado caiu 0,9% no mês e 4,7% em um ano**, e em 84% das versões o preço de hoje é menor que o de um ano atrás. Preços citados aqui são sempre da tabela FIPE.',
    },
    {
      type: 'heading',
      heading: 'O corte padrão de 0,9%',
      text: 'Primeiro a curiosidade que explica o resto. De todas as linhas de carro usado da tabela, 47% caíram exatamente 0,9% de outubro para novembro. Não 0,8%, não 1,1%: 0,9%, em quase metade do catálogo, do Uno ao Lamborghini. É o jeito da tabela de dizer "não tive negócio suficiente desse carro este mês, aplico o ajuste da casa". Outros 6% caíram 0,5% redondos e 5% subiram 3,5% redondos.\n\nIsso importa para quem compra e vende: a mediana de -0,9% é o piso, não o retrato. Onde houve negociação de verdade, a queda foi outra: Jeep Commander -2,6% no mês, Mitsubishi Outlander -2,6%, BMW 530e -3,5%. E o 0 km não acompanhou nada disso: mediana de 0,0% no mês e +0,8% em doze meses. O novo segurou, o usado derreteu.',
    },
    {
      type: 'heading',
      heading: 'Quanto mais novo o usado, mais caiu',
      text: 'Aqui está o dado que mais chama a atenção de quem acompanha o mercado. Um carro ano-modelo 2010 vale hoje, na mediana, 0,2% a mais que há um ano. O de 2011, a mesma coisa. O de 2016 perdeu 2,2%, o de 2020 perdeu 4,0%, o de 2022 perdeu 6,6% e o de 2024 perdeu 8,2%. A curva é limpa: cada ano a mais de juventude custou mais um ponto percentual.\n\nFunciona como aluguel de temporada em cidade de praia: o apartamento novo na orla é o que mais cai quando a temporada acaba, o quitinete velho do centro não cai porque nunca subiu. O seminovo de 2024 e 2025 comprou na alta do pós-pandemia, com juro alto, e agora devolve. O carro de 16 anos já devolveu tudo que tinha para devolver.',
    },
    {
      type: 'table',
      columns: ['Ano-modelo', 'Variação em 12 meses', 'FIPE mediana (nov/2026)'],
      rows: [
        ['2010', '+0,2%', 'R$ 43.312'],
        ['2012', '-0,7%', 'R$ 53.830'],
        ['2014', '-1,1%', 'R$ 63.536'],
        ['2016', '-2,2%', 'R$ 74.199'],
        ['2018', '-3,5%', 'R$ 93.608'],
        ['2020', '-4,0%', 'R$ 114.148'],
        ['2022', '-6,6%', 'R$ 158.130'],
        ['2023', '-7,5%', 'R$ 187.012'],
        ['2024', '-8,2%', 'R$ 198.002'],
        ['2025', '-8,2%', 'R$ 221.885'],
      ],
      caption: 'Mediana das versões de carro de cada ano-modelo com preço em novembro de 2025 e novembro de 2026. Tabela FIPE, referência novembro de 2026.',
    },
    {
      type: 'heading',
      heading: 'Marcas: o luxo paga a conta',
      text: 'Por marca, a conta em doze meses é uma escadaria onde o luxo está no degrau de baixo. Land Rover -13,2%, Volvo -11,8%, Jaguar -11,2%, Audi -10,5%, Lexus -10,3%, BMW -9,7%. Um Audi e-tron, na mediana das versões, perdeu R$ 69.921 em um ano. Um BMW X7, R$ 89.362. Um Aston Martin DBS 2022 perdeu R$ 856.778, que dá para comprar quinze Gols 2022 só com a desvalorização.\n\nNo outro extremo, as marcas de volume: Volkswagen -2,0%, Hyundai -2,5%, Fiat -2,6%, Renault -2,8%, Honda -3,1%, Nissan -3,1%, Ford -3,2%, Toyota -3,5%, Chevrolet -4,5%. As chinesas ficaram no meio da tabela, mas no meio ruim: Caoa Chery -8,7%, GWM -8,3%, BYD -7,0%. No mês, a pior marca foi a Jeep, com -1,21% e 201 de 238 versões em queda.',
    },
    {
      type: 'table',
      columns: ['Marca', 'Variação em 12 meses', 'Variação no mês', 'Versões'],
      rows: [
        ['Land Rover', '-13,2%', '-0,9%', '314'],
        ['Volvo', '-11,8%', '-0,9%', '215'],
        ['Jaguar', '-11,2%', '-0,9%', '121'],
        ['Audi', '-10,5%', '-0,9%', '411'],
        ['BMW', '-9,7%', '-0,9%', '432'],
        ['Jeep', '-8,9%', '-1,2%', '224'],
        ['Caoa Chery', '-8,7%', '-1,1%', '62'],
        ['GWM', '-8,3%', '-0,9%', '47'],
        ['BYD', '-7,0%', '-0,9%', '34'],
        ['Mercedes-Benz', '-5,6%', '-0,9%', '842'],
        ['Chevrolet', '-4,5%', '-0,5%', '618'],
        ['Toyota', '-3,5%', '-0,7%', '428'],
        ['Honda', '-3,1%', '-0,6%', '213'],
        ['Fiat', '-2,6%', '-0,5%', '683'],
        ['Hyundai', '-2,5%', '-0,5%', '387'],
        ['Volkswagen', '-2,0%', '-0,5%', '565'],
      ],
      caption: 'Mediana das versões usadas (ano-modelo 2016 em diante) de cada marca. "Versões" é o número de linhas versão x ano-modelo com preço nas duas referências. Tabela FIPE, referência novembro de 2026.',
    },
    {
      type: 'heading',
      heading: 'Os populares: Compass derrete, Gol sobe',
      text: 'Entre os carros que o brasileiro compra de verdade, tomando o ano-modelo 2022 como régua, o Jeep Compass foi o pior: -11,3% em doze meses, R$ 15.705 a menos na mediana das versões. Depois vêm Hilux (-8,1%, R$ 16.329), Ranger (-8,3%), Tracker (-7,7%), Creta (-6,9%), Corolla (-6,1%, R$ 8.280) e Onix (-5,8%, R$ 4.159). O T-Cross 2022 perdeu 4,9%, o Polo 4,3%, o HB20 2,5%, a Strada 2,1%, o Argo 1,4%.\n\nE quem subiu? O Mobi 2022, +0,7%. O Gol 1.0 2022, +1,5%: valia R$ 51.441 e vale R$ 52.214. O Gol 2023, último ano de produção, +5,4%. A família Gol inteira fechou o ano em +2,7%, a melhor entre todos os modelos relevantes da tabela, seguida de March (+2,0%), Etios (+1,5%) e Jimny (+0,6%). O carro que saiu de linha virou o único que sobe, o que diz muito sobre o que o brasileiro de orçamento curto quer comprar e não encontra mais no 0 km.\n\nVale a pergunta: se o Compass 2022 caiu R$ 15 mil num ano, por que o anúncio na esquina ainda pede o preço de 2025? Porque o vendedor consulta a FIPE do dia que comprou, não a do dia que vende.',
    },
    {
      type: 'table',
      columns: ['Modelo (ano-modelo 2022)', 'Variação em 12 meses', 'Diferença em R$', 'FIPE mediana (nov/2026)'],
      rows: [
        ['Jeep Compass', '-11,3%', 'R$ -15.705', 'R$ 122.410'],
        ['Toyota Hilux', '-8,1%', 'R$ -16.329', 'R$ 230.993'],
        ['Ford Ranger', '-8,3%', 'R$ -13.293', 'R$ 141.819'],
        ['Chevrolet Tracker', '-7,7%', 'R$ -7.866', 'R$ 88.303'],
        ['Hyundai Creta', '-6,9%', 'R$ -8.664', 'R$ 103.452'],
        ['Toyota Corolla', '-6,1%', 'R$ -8.280', 'R$ 126.958'],
        ['Chevrolet Onix', '-5,8%', 'R$ -4.159', 'R$ 69.158'],
        ['Fiat Toro', '-5,6%', 'R$ -6.654', 'R$ 107.377'],
        ['Nissan Kicks', '-5,4%', 'R$ -5.097', 'R$ 88.173'],
        ['VW T-Cross', '-4,9%', 'R$ -4.696', 'R$ 96.580'],
        ['VW Polo', '-4,3%', 'R$ -4.250', 'R$ 78.598'],
        ['Renault Kwid', '-3,2%', 'R$ -1.533', 'R$ 45.436'],
        ['Hyundai HB20', '-2,5%', 'R$ -2.056', 'R$ 73.623'],
        ['Fiat Strada', '-2,1%', 'R$ -2.181', 'R$ 88.596'],
        ['Fiat Argo', '-1,4%', 'R$ -1.120', 'R$ 63.112'],
        ['Fiat Mobi', '+0,7%', 'R$ +323', 'R$ 50.032'],
        ['VW Gol', '+1,5%', 'R$ +773', 'R$ 56.752'],
      ],
      caption: 'Mediana das versões de cada modelo no ano-modelo 2022, novembro de 2025 contra novembro de 2026. Tabela FIPE, referência novembro de 2026.',
    },
    {
      type: 'heading',
      heading: 'Elétricos e híbridos: a conta do pioneiro',
      text: 'Nos carros de 2022 em diante, onde elétrico e híbrido já existem em quantidade para comparar, o resultado em doze meses é este: combustão -6,5%, elétrico -9,5%, híbrido -11,7%. Em dinheiro a distância é maior, porque o eletrificado é mais caro: a versão a combustão perdeu R$ 10.803 na mediana, a elétrica R$ 27.075 e a híbrida R$ 44.871.\n\nO exemplo mais limpo é o Corolla Cross 2023, que tem as duas motorizações na mesma carroceria: o XRE flex caiu 6,9% (de R$ 139.494 para R$ 129.823), o XRV híbrido caiu 8,9% (de R$ 151.512 para R$ 138.029). O BYD Song Plus Premium 2024 é o pior dos eletrificados de volume, -26,3%, de R$ 208.224 para R$ 153.552. O Nissan Leaf 2024, -27,2%. O Haval H6 2024 perdeu R$ 24.741 (-11,6%). O Dolphin Plus 2024, -7,5%.\n\nA exceção, e ela é saborosa, é o Kwid E-Tech 2024: subiu 6,6% em doze meses, de R$ 67.689 para R$ 72.125, enquanto o Kwid Intense a gasolina do mesmo ano caiu 7,2%. O elétrico mais barato do país é o único elétrico que valorizou. Nos leilões e nas lojas, elétrico de luxo usado é o que mais aparece com desconto, e agora a tabela está dizendo o mesmo.',
    },
    {
      type: 'heading',
      heading: 'Motos: a CG segura, a scooter elétrica não',
      text: 'Moto usada caiu menos: -0,76% no mês e -3,8% em doze meses, na mediana de 3.410 versões. A Honda CG 160 Fan 2023 valia R$ 16.876 há um ano e vale R$ 16.590 (-1,7%), e subiu 0,3% no mês. A PCX 160 2023 perdeu 4,3% no ano. A Biz 125 2023 perdeu 5,2% no ano, mas subiu 3,5% só em novembro. A Pop 110i ES, nos anos 2025 a 2027, caiu 5% no mês, a maior queda mensal entre as motos de volume.\n\nO que despenca nas motos é o mesmo que despenca nos carros: scooter elétrica (Niu NQi GTS 2022 -23%, Yamaha Neo\'s 2026 -22%) e grande cilindrada de luxo (BMW R 1250 RT 2023 -27%, R$ 40.810 a menos; Harley CVO Street Glide 2024 -19,7%).',
    },
    {
      type: 'heading',
      heading: 'Os números que não cabem em gráfico',
      text: 'O Jeep Grand Cherokee 80 Anos 2021 caiu 12,9% só em novembro: R$ 40 mil num mês, R$ 136.536 em doze meses. O Uno Ciao 2021 caiu 12,5% no mês. O Polo 1.0 2026 subiu 8,1% no mês, provavelmente uma revisão de tabela. O Toyota Corolla GR Core 0 km caiu 10,8%. E o Suzuki Jimny Canvas de 2017 a 2019 subiu 16,1% em doze meses, um dos raros SUVs da tabela que valem mais hoje que há um ano.\n\nA tabela FIPE diz quanto o carro vale. Não diz de onde ele veio. Antes de pagar os R$ 112.633 do Compass 2022 pela tabela nova, vale consultar a placa e ver se o carro passou por leilão, se há restrição, se tem recall aberto ou indício de sinistro. No interior se diz que preço bom tem dois donos: o que vende e o que paga. A tabela cuida do primeiro, a consulta cuida do segundo.',
    },
    {
      type: 'faq',
      heading: 'Perguntas frequentes',
      faq: [
        {
          q: 'Como foi feito o levantamento?',
          a: 'Comparamos todas as linhas da tabela FIPE (cada versão em cada ano-modelo, carros e motos) com preço em outubro e novembro de 2026, e as mesmas linhas em novembro de 2025. Foram 39.506 linhas. "Usado" é ano-modelo 2016 em diante, sem 0 km. Usamos mediana por linha, para uma versão rara não distorcer a marca ou o modelo.',
        },
        {
          q: 'A FIPE caiu 0,9% em todos os carros?',
          a: 'Não. A mediana foi -0,9% porque 47% das linhas receberam exatamente esse ajuste. Onde houve negociação suficiente, a variação foi própria: Jeep -1,2% no mês, Nissan -0,4%, Gol +0,9%, BMW 530e -3,5%.',
        },
        {
          q: 'Elétrico usado é mau negócio?',
          a: 'Depende do lado. Para quem vende, perdeu mais que o combustão (-9,5% contra -6,5% em doze meses nos carros de 2022 em diante). Para quem compra, é exatamente onde há mais desconto sobre o 0 km. O Kwid E-Tech, o mais barato, foi o único que valorizou.',
        },
        {
          q: 'O preço da FIPE é o preço que devo pagar?',
          a: 'É a referência de negociação, não o preço do carro. Um Compass 2022 pela tabela vale R$ 112.633, mas um Compass 2022 que passou por leilão ou tem sinistro vale bem menos. Consulte a placa antes de pagar a tabela.',
        },
      ],
    },
    {
      type: 'cta',
      heading: 'Consulte a placa antes de pagar a FIPE',
      text: 'Veja marca, modelo, ano, cor e o valor FIPE do carro pela placa. Na consulta completa, passagem por leilão, restrições, indícios de sinistro e recall.',
      ctaLabel: 'Consultar placa',
      ctaTo: '/',
    },
  ],
}
