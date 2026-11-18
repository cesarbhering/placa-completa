import type { BlogPost } from './blog-posts'

// Post do lancamento do GTA 6 (18/nov/2026), vespera do lancamento. Estudo com
// dados: Google Trends (2013 e 2026), consultas do proprio site (so percentuais),
// estudos sobre jogos e crime, roubo e furto de veiculos (Anuario) e Fenauto.
// Estilo do Cesar: fato e numero na abertura, opiniao assumida, comparacao com o
// cotidiano, fecho curto. Sem travessao, sem citar a fonte do registro, sem preco
// do produto. Todo numero tem fonte na secao Fontes; os do Trends e das consultas
// estao em placa-completa-marketing/seo/reports/gta6-2026-11/dados.json.

export const postGta6Usado: BlogPost = {
  slug: 'gta-6-carro-usado-o-que-os-dados-dizem',
  title: 'GTA 6 e o carro usado: o que o lançamento muda no mercado, segundo os dados',
  seoTitles: [
    'GTA 6 e o carro usado: o que os dados dizem',
    'GTA 6 mexe no mercado de carro usado? Veja os dados',
    'GTA 6 e o mercado de carros usados',
  ],
  metaDescription: 'O GTA 6 sai em 19 de novembro, véspera de feriado. Cruzamos buscas do Google, estudos sobre crime e dados de roubo de veículos para ver o que muda no usado.',
  publishedAt: '2026-11-18',
  categoria: 'Estudos',
  capa: {
    src: '/images/blog/gta-6-carro-usado-o-que-os-dados-dizem.png',
    og: '/images/blog/gta-6-carro-usado-o-que-os-dados-dizem-1200.png',
    alt: 'Placa de carro com o texto GTA 6 ao lado do título: GTA 6 e o carro usado, o que os dados dizem.',
    largura: 1600,
    altura: 836,
  },
  content: [
    {
      type: 'intro',
      text: 'À meia-noite desta quarta para quinta, 19 de novembro, sai o GTA 6, e na sexta é feriado nacional. Na terça, dia 17, o brasileiro já procurava "gta 6" no Google duas vezes mais do que "tabela fipe". Com o jogo de roubar carro mais famoso do mundo ocupando o feriadão de muita gente, fomos atrás da pergunta que interessa a quem compra e vende usado: **o lançamento mexe no mercado?** Juntamos as buscas do Google, os estudos sobre crime, os números de roubo de veículos e os nossos próprios dados de consulta. A resposta curta: no preço, nenhum sinal, na atenção, um pouco, e no crime, o contrário do que se imagina.',
    },
    {
      type: 'heading',
      heading: 'Da última vez, o usado nem piscou',
      text: 'O teste já foi feito. O GTA 5 saiu numa terça-feira, 17 de setembro de 2013, e naquela semana a busca pelo jogo no Brasil chegou a quase 8 vezes o normal. Se videogame tirasse comprador da frente do anúncio, as buscas de carro teriam caído. Não caíram. Pegamos o índice diário do Google Trends para três buscas de quem está comprando carro e comparamos as semanas:',
    },
    {
      type: 'table',
      columns: ['Busca no Google (Brasil, 2013)', 'Semana anterior (9 a 15/09)', 'Semana do lançamento (16 a 22/09)', 'Semana seguinte (23 a 29/09)'],
      rows: [
        ['carros usados', '11,9', '12,3', '12,7'],
        ['webmotors', '32,3', '32,6', '34,0'],
        ['tabela fipe', '46,7', '45,6', '45,7'],
        ['gta 5', '20,1', '68,6', '63,3'],
      ],
      caption: 'Índice do Google Trends (0 a 100), média diária de cada semana. De 19 de agosto a 8 de setembro de 2013, a média de "gta 5" era 8,7. O índice mede interesse relativo, não o número de buscas.',
    },
    {
      type: 'heading',
      text: 'No sábado seguinte ao lançamento, 21 de setembro, a busca por "gta 5" foi 2,4 vezes a de "tabela fipe", e a da FIPE ficou no patamar dos outros sábados. Quem estava comprando carro continuou comprando carro, só foi jogar depois.',
    },
    {
      type: 'heading',
      heading: 'Carro se pesquisa de dia, GTA se joga de noite',
      text: 'Os nossos números ajudam a explicar por que os dois mundos quase não se cruzam. Nas últimas quatro semanas, 71% das pessoas que consultaram uma placa no PlacaCompleta fizeram isso entre 8h e 18h, com pico às 11h. Das 20h até as 2h, o horário nobre do console, foram 16%. No sábado e no domingo o movimento fica 42% abaixo de um dia útil. Carro usado se pesquisa no intervalo do trabalho, na hora do almoço, na porta da loja. GTA se joga depois da janta.\n\nPor isso, o que vai derrubar as consultas nesta sexta não é o jogo, é o feriado. Nos dois últimos feriados que caíram em segunda-feira, 12 de outubro e 2 de novembro, as consultas ficaram 32% e 25% abaixo da segunda-feira anterior. Quem olhar o gráfico de sexta e culpar o videogame vai estar prendendo o suspeito errado.',
    },
    {
      type: 'heading',
      heading: 'E a quinta-feira do lançamento?',
      text: 'Aqui existe dado, só que de fora. A BambooHR, empresa americana de software de RH, olhou os pedidos de folga de mais de 3,4 milhões de funcionários nos Estados Unidos: para o dia 19 de novembro eles estão cerca de 13% acima de uma quinta-feira comparável de 2024 e 2025. Numa pesquisa da mesma empresa com 1.530 trabalhadores, 18% dos assalariados disseram que pretendem tirar o dia. É gente para esvaziar uma reunião, não um mercado: só em outubro, o Brasil transferiu 1,6 milhão de veículos usados, segundo a Fenauto, e no ano já são 15,8 milhões.\n\nNo bolso a conta também não fecha. O jogo custa R$ 449,90 na edição padrão, dinheiro que não é entrada de carro em lugar nenhum. Ninguém desiste de um Gol, o usado mais vendido de outubro, com 62.635 transferências, por causa de um jogo. No máximo, adia a visita à loja para segunda-feira.',
    },
    {
      type: 'heading',
      heading: 'Jogo de roubar carro aumenta roubo de carro?',
      text: 'É a pergunta que acompanha a série desde 1997, e a pesquisa não encontra essa ligação, às vezes encontra o contrário. Economistas cruzaram as vendas semanais dos jogos mais vendidos nos Estados Unidos com os registros de crime violento de 2005 a 2011 e concluíram: "não encontramos evidência de aumento de crime associado a videogames, e talvez haja uma queda". Na Holanda, criminologistas olharam justamente o lançamento do GTA 5: ele esteve associado a menos delitos registrados entre homens de 12 a 25 anos. Um terceiro estudo, publicado em 2011, encontrou queda de crimes associada aos jogos e efeito menor, ou nenhum, para cinema e esporte.\n\nA explicação é quase de avó: quem está no sofá não está na rua. Os pesquisadores chamam isso de incapacitação voluntária. Um aviso honesto: nenhum desses estudos mediu roubo de veículo em separado e nenhum foi feito no Brasil. O que eles mostram é que a tese de que jogo violento vira crime na rua não aparece nos dados.',
    },
    {
      type: 'heading',
      heading: 'Quando a tela ensinou a furtar, não era um jogo',
      text: 'Existe um caso em que a tela aumentou furto de carro de verdade. Nos Estados Unidos, a partir de 2021, vídeos em redes sociais passaram a ensinar como ligar sem chave certos modelos da Kia e da Hyundai, vendidos sem imobilizador. Segundo o HLDI, instituto de dados das seguradoras americanas, os pedidos de indenização por furto desses carros no primeiro semestre de 2023 foram mais de 10 vezes os do primeiro semestre de 2020, e quase 7 vezes a taxa das outras marcas.\n\nA diferença é que o vídeo era o manual de uma falha real, de um carro real. O GTA é fantasia com marca inventada, ninguém aprende a abrir um Gol jogando.',
    },
    {
      type: 'heading',
      heading: 'O roubo que interessa é o daqui',
      text: 'Fora do videogame, o Brasil registrou 308.440 roubos e furtos de veículos em 2025, segundo o Anuário Brasileiro de Segurança Pública. É um a cada 1 minuto e 42 segundos. O número até melhorou, a taxa por 100 mil veículos caiu 14,3% sobre 2024, mas continua sendo uma frota que some todo ano, com São Paulo (112.358 casos) e Rio de Janeiro (42.725) na frente.\n\nNo jogo, o carro roubado desaparece na missão seguinte. Aqui fora, carro roubado pode voltar para o anúncio, com placa clonada e preço bom demais para ser verdade. É esse o risco que o comprador de usado corre em qualquer feriado, com ou sem lançamento.',
    },
    {
      type: 'heading',
      heading: 'O que vamos conferir',
      text: 'Previsão sem número é palpite, então ficam três, para cobrar depois:\n\n- **Quinta, 19:** as consultas de placa ficam no patamar das duas últimas quintas. Se caírem mais de 15%, o jogo levou a melhor e nós erramos.\n- **Sexta, 20:** queda de 25% a 32% sobre a sexta anterior, como nos dois últimos feriados. Se passar de 40%, tem dedo do jogo.\n- **Buscas no Google:** "tabela fipe" e "webmotors" seguem na faixa das últimas semanas, como em 2013, mesmo com "gta 6" no pico.\n\nNa semana que vem voltamos com os números, acertando ou errando. No GTA, quando o negócio dá errado, é só carregar o jogo salvo. Na compra de um carro usado não tem save.',
    },
    {
      type: 'faq',
      heading: 'Perguntas frequentes',
      faq: [
        {
          q: 'O GTA 6 vai mexer no preço do carro usado?',
          a: 'Não há sinal disso. No lançamento do GTA 5, em 2013, as buscas por carros usados, Webmotors e tabela FIPE no Brasil ficaram no mesmo patamar da semana anterior.',
        },
        {
          q: 'Jogar GTA aumenta roubo de carro?',
          a: 'Os estudos disponíveis não mostram isso. Pesquisas nos Estados Unidos e na Holanda encontraram menos crimes registrados depois de grandes lançamentos, inclusive o do GTA 5. Nenhuma delas mediu roubo de veículo em separado.',
        },
        {
          q: 'Como saber se um carro usado tem registro de roubo ou furto?',
          a: 'Pela placa. A consulta completa mostra se consta restrição de roubo ou furto, além de leilão, sinistro, gravame e recall. Confira também se o chassi gravado no carro é o mesmo do documento.',
        },
      ],
    },
    {
      type: 'cta',
      text: 'No jogo, o carro roubado some na missão seguinte. Na vida real, ele pode estar no próximo anúncio. Veja o que consta na placa antes de pagar.',
      ctaLabel: 'Consultar a placa antes de fechar',
      ctaTo: '/',
    },
    {
      type: 'heading',
      heading: 'Fontes',
      text: '- [RAP MÍDIA: horário de liberação, preço e plataformas do GTA 6 no Brasil](https://rapmidia.com.br/gta-6-que-horas-lanca-brasil-horario/)\n- [Tecnoblog: preço de GTA 6 no Brasil](https://tecnoblog.net/noticias/preco-de-gta-6-no-brasil-e-revelado-r-449/)\n- Google Trends, Brasil: buscas diárias de 12/08 a 20/10/2013 e de 24/08 a 17/11/2026, levantamento do PlacaCompleta\n- [The Loadout: pedidos de folga e pesquisa da BambooHR para 19 de novembro](https://theloadout.com/1-5-million-us-workers-plan-to-skip-19-november-for-gta-6-estimate)\n- [Vrum: mercado de usados em outubro de 2026, dados da Fenauto](https://www.vrum.com.br/mercado/2026/11/7532457-carros-usados-setor-oscila-em-outubro-mas-deve-bater-recorde-em-2026.html)\n- [Cunningham, Engelstätter e Ward: Violent Video Games and Violent Crime, Southern Economic Journal, 2016](https://doi.org/10.1002/soej.12139)\n- [Beerthuizen, Weijters e van der Laan: The release of Grand Theft Auto V and registered juvenile crime in the Netherlands, European Journal of Criminology, 2017](https://doi.org/10.1177/1477370817717070)\n- [Ward: Video Games and Crime, Contemporary Economic Policy, 2011](https://doi.org/10.1111/j.1465-7287.2010.00216.x)\n- [Highway Loss Data Institute: Hyundai and Kia theft and vandalism losses, boletim 40-25, dezembro de 2023](https://www.iihs.org/media/cecd08f1-ef97-49e4-9518-1df78bc5541a/Ve5DLg/HLDI%20Research/Bulletins/hldi_bulletin_40-25.pdf)\n- [Portal do Trânsito: roubo e furto de veículos no Anuário Brasileiro de Segurança Pública 2026](https://www.portaldotransito.com.br/noticias/fiscalizacao-e-legislacao/estatisticas/brasil-registra-um-veiculo-roubado-ou-furtado-a-cada-dois-minutos-aponta-anuario-da-seguranca-publica/)',
    },
  ],
}
