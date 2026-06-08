export interface IbvPost {
  slug: string
  title: string
  metaDescription: string
  publishedAt: string // ISO date string
  source: string
  referenceMonth: string // e.g. "Março 2026"
  /** Optional short title for the OG image (fits the card width better than the full title). */
  ogTitle?: string
  /** Optional eye-catching number for the OG image (e.g. "+0,43%"). */
  ogHighlight?: string
  content: IbvPostSection[]
}

export interface IbvPostSection {
  type: 'intro' | 'heading' | 'paragraph' | 'highlight' | 'cta' | 'image'
  heading?: string
  text?: string
  ctaLabel?: string
  ctaTo?: string
  // image type
  src?: string    // path relative to /public, e.g. /images/ibv/marco-2026/variacao-mensal.png
  alt?: string
  caption?: string
}

export const ibvPosts: IbvPost[] = [
  {
    slug: 'abril-2026',
    title: 'IBV Auto Abril 2026: Preços de Usados Sobem 0,27% — Desaceleração Marca o Fim do Trimestre',
    metaDescription: 'IBV Auto de abril desacelerou para +0,27% (ante +0,71% em março). Celta +2,66%, Palio +1,47% e Onix +0,57% puxaram as altas; Fox -1,29%, Nivus -1,00%, Gol -0,50% caíram. Tocantins lidera regiões com +1,97%.',
    publishedAt: '2026-05-12',
    source: 'Banco BV (IBV Auto)',
    referenceMonth: 'Abril 2026',
    content: [
      {
        type: 'intro',
        text: 'O Índice BV Auto (IBV) de abril de 2026 mostra uma desaceleração nítida da inflação de carros usados no Brasil: alta de apenas 0,27% sobre março, bem abaixo do +0,71% do mês anterior. Para quem acompanha o mercado, o dado sugere que o ciclo de aceleração de preços observado no primeiro trimestre (média de +0,72%) está perdendo força. No acumulado de 12 meses, os preços subiram 6,99% — também um leve recuo em relação aos 7,33% do fechamento de março.',
      },
      {
        type: 'image',
        src: '/images/ibv/abril-2026/variacao-mensal.png',
        alt: 'Gráfico de barras com variação mensal dos preços de automóveis leves usados de jan/25 a abr/26, mostrando +0,27% em abril/26',
        caption: 'Variação mensal do IBV Auto — destaque para a desaceleração em abril. Fonte: Banco BV (IBV Auto), maio/2026.',
      },
      {
        type: 'heading',
        heading: 'O que mudou em abril',
        text: 'Em março, o IBV foi puxado por modelos premium e populares ao mesmo tempo — Hilux SW4 com +5,17%, Corolla com +1,03% e Onix com +0,94%. Em abril, o padrão se inverte: a alta foi puxada por modelos mais antigos, populares e descontinuados. O Chevrolet Celta liderou com +2,66%, seguido por Fiat Palio (+1,47%) e GM Onix (+0,57%) — este último entre os destaques pelo terceiro mês consecutivo.\n\nNa ponta negativa, o VW Fox foi o que mais caiu (-1,29%), seguido por VW Nivus (-1,00%) e VW Gol (-0,50%). É interessante notar que os três modelos em queda são da mesma montadora — sinal de pressão competitiva específica no portfólio da Volkswagen no mercado de usados.',
      },
      {
        type: 'image',
        src: '/images/ibv/abril-2026/modelos-alta-baixa.png',
        alt: 'Modelos com maior alta e maior queda no IBV Auto abril 2026: GM Celta +2,66%, Fiat Palio +1,47%, GM Onix +0,57% nas altas; VW Fox -1,29%, VW Nivus -1,00%, VW Gol -0,50% nas baixas',
        caption: 'Modelos de maior destaque positivo e negativo em abril de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Variação por região: Tocantins na liderança, Centro-Oeste em queda',
        text: 'A grande surpresa de abril foi o Tocantins, que liderou a variação mensal com alta de +1,97%, seguido por Acre (+1,78%), Amazonas (+1,58%), Amapá (+1,37%) e Roraima (+1,22%). O Norte foi a região mais aquecida do mês, com altas acima de 1% em praticamente todos os estados — movimento expressivo considerando que historicamente o Norte tem menos volume e maior volatilidade.\n\nNa contramão, o Centro-Oeste foi o destaque negativo. Mato Grosso do Sul caiu -0,57%, Mato Grosso recuou -0,48% e o Rio Grande do Sul também registrou queda (-0,45%) — quatro estados ficaram negativos junto com Distrito Federal (-0,12%) e Pernambuco (-0,24%). No total, 21 dos 27 estados ainda registraram alta no mês, mostrando que o cenário geral segue de alta, apenas com menor intensidade.\n\nNo acumulado de 12 meses, a liderança regional segue clara: Minas Gerais (+8,52%) e Rio de Janeiro (+8,16%) lideram, seguidos por Amazonas (+7,43%), Alagoas (+7,41%) e Maranhão (+7,28%). Na ponta menor, Mato Grosso (+4,50%), Espírito Santo (+4,85%) e Santa Catarina (+5,17%) — todos ainda em alta, mas em ritmo bem mais lento.',
      },
      {
        type: 'image',
        src: '/images/ibv/abril-2026/variacao-por-uf.png',
        alt: 'Gráfico de barras: variação mensal por estado em abril de 2026, com Tocantins liderando em +1,97% e Mato Grosso do Sul fechando em -0,57%',
        caption: 'Variação mensal por estado (UF) — abril de 2026. Brasil em +0,27%. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'image',
        src: '/images/ibv/abril-2026/mapa-brasil-acumulado.png',
        alt: 'Mapa do Brasil com variação acumulada em 12 meses por estado em abril de 2026 — Minas Gerais lidera com 8,5%',
        caption: 'Variação acumulada em 12 meses por estado. Fonte: Banco BV (IBV Auto), maio/2026.',
      },
      {
        type: 'heading',
        heading: 'Elétricos continuam desvalorizando rápido',
        text: 'O dado mais relevante para compradores de carros elétricos: a depreciação dos modelos elétricos seguiu acelerando em abril. Modelos elétricos lançados em 2023 acumulam desvalorização de -45,6% até abril de 2026 (era -44,6% até março — piorou em 1 ponto percentual em um único mês). Modelos elétricos de 2022 já perderam -49,0% do valor original.\n\nComparativo do ano modelo 2023:\n- Elétricos: -45,6%\n- Híbridos: -25,2%\n- Combustão: -19,3%\n\nA diferença é estrutural: a entrada constante de modelos elétricos novos no Brasil — com tecnologia superior e preços mais agressivos — pressiona o valor de revenda dos modelos antigos. Se você comprou um elétrico 2023 por R$ 250 mil, vale algo perto de R$ 135 mil hoje.\n\nPara quem está comprando, o lado bom: é a melhor janela dos últimos anos para entrar em um elétrico usado com desconto significativo. Para quem tem um elétrico para vender, o sinal é claro — esperar não vai ajudar.',
      },
      {
        type: 'image',
        src: '/images/ibv/abril-2026/desvalorizacao-2023.png',
        alt: 'Gráfico comparando desvalorização de elétricos (-45,6%), híbridos (-25,2%) e veículos a combustão (-19,3%) ano modelo 2023 até abril de 2026',
        caption: 'Desvalorização acumulada por tipo de propulsão — modelos ano 2023. Fonte: Banco BV.',
      },
      {
        type: 'highlight',
        heading: 'O que isso significa para você?',
        text: 'Se você está vendendo um carro popular (Onix, Celta, Palio), abril ainda foi um bom mês, mas o ritmo de alta diminuiu — se for vender, não há ganho esperando muito mais. Se você tem um VW Fox, Nivus ou Gol, a queda foi expressiva: considere vender logo ou aceitar segurar com preço pressionado. Se está no Centro-Oeste e quer comprar, espere mais um mês: os preços recuaram e podem continuar pressionados localmente. Para elétricos usados, abril confirmou: comprar tem desconto cada vez maior, vender tem urgência cada vez maior.',
      },
      {
        type: 'cta',
        text: 'Quer saber quanto vale o seu carro pela placa, com base na FIPE atualizada?',
        ctaLabel: 'Consultar Placa Grátis',
        ctaTo: '/',
      },
    ],
  },
  {
    slug: 'vencedores-perdedores-abril-2026',
    title: 'Vencedores e Perdedores de Abril 2026: Celta dispara +2,66% e Fox cai -1,29% no IBV Auto',
    metaDescription: 'GM Celta +2,66%, Fiat Palio +1,47% e GM Onix +0,57% lideram altas em abril. VW Fox -1,29%, VW Nivus -1,00% e VW Gol -0,50% caem. Volkswagen sob pressão competitiva.',
    publishedAt: '2026-05-12',
    source: 'Banco BV (IBV Auto)',
    referenceMonth: 'Abril 2026',
    content: [
      {
        type: 'intro',
        text: 'O IBV Auto de abril de 2026 fechou em +0,27% para o Brasil — uma desaceleração significativa frente a +0,71% de março. Mas o detalhe está nos extremos: o Chevrolet Celta valorizou 2,66% em um único mês, enquanto o VW Fox perdeu 1,29%. Quase 4 pontos percentuais separando os extremos. E o padrão dos vencedores muda completamente em relação a março: em vez de SUVs premium e sedãs intermediários (Hilux SW4, Corolla), os destaques de abril são populares antigos.',
      },
      {
        type: 'image',
        src: '/images/ibv/abril-2026/modelos-alta-baixa.png',
        alt: 'Modelos com maior alta e maior queda no IBV Auto de abril de 2026: GM Celta +2,66%, Fiat Palio +1,47%, GM Onix +0,57% nas altas; VW Fox -1,29%, VW Nivus -1,00%, VW Gol -0,50% nas baixas',
        caption: 'Modelos com maiores variações em abril de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Os modelos que mais valorizaram em abril',
        text: 'O Chevrolet Celta liderou a alta de abril com expressivos +2,66%. O Celta foi descontinuado em 2016 — já são quase 10 anos sem produção. Ainda assim, o estoque de usados é gigantesco (foram mais de 1,7 milhão de unidades vendidas no Brasil) e a demanda persiste porque o Celta é um dos carros mais baratos do mercado nacional de usados. Quando o preço do zero-km sobe (caso do Onix em 2026), o Celta vira alternativa para quem não consegue chegar nos populares novos. A alta de abril foi quase 3× maior que a média do índice.\n\nO Fiat Palio subiu +1,47% — outro modelo descontinuado (em 2017) que mantém volume relevante no mercado brasileiro. O Palio foi por décadas o segundo carro mais vendido do Brasil. Como o Celta, cumpre o papel de "alternativa barata" quando o segmento popular novo fica inacessível. A alta de abril é sintoma de mercado pressionado por baixo, não por cima.\n\nO Chevrolet Onix subiu +0,57% e aparece entre os destaques pelo terceiro mês consecutivo. O Onix é o carro mais vendido do Brasil, o que significa que qualquer movimento sustentado de preço dele tem impacto desproporcional no IBV. Três meses consecutivos de alta indicam que a pressão sobre os populares não foi um pico — é tendência. Para quem está com um Onix usado e pensando em vender, o cenário ainda é favorável, mas com o ritmo desacelerando.',
      },
      {
        type: 'heading',
        heading: 'Os modelos que mais perderam — três VWs',
        text: 'Curiosamente, os três modelos com maior queda em abril são todos da Volkswagen.\n\nO VW Fox foi o maior recuo: -1,29%. O Fox foi descontinuado em 2021 e está numa trajetória estrutural de queda, mas a aceleração de abril é notável. Sem produção, sem reposição na concessionária e com Polo Track e Argo dominando o segmento de hatches populares novos, o Fox perde espaço de forma contínua.\n\nO VW Nivus caiu -1,00% — surpresa, porque é um modelo ATUAL, ainda em produção. O Nivus é um SUV compacto que enfrenta competição direta crescente: Chevrolet Tracker renovado, Hyundai Creta atualizado, e os SUVs chineses chegando com força (BYD, GWM, Caoa Chery). A queda de 1% num modelo novo é sinal de pressão competitiva no segmento, não de problema do produto em si.\n\nO VW Gol recuou -0,50%. Já era esperado — o Gol foi descontinuado em 2023 e é símbolo de uma geração de carros de entrada que perdem espaço a cada mês. A queda de abril segue a tendência estrutural, mas a aceleração é uma luz amarela para quem espera vender.\n\nO padrão dos três: pressão competitiva específica no portfólio Volkswagen, seja por descontinuação (Fox, Gol) ou por concorrência ativa (Nivus). Não é uma queda do mercado em geral — é uma queda concentrada numa marca.',
      },
      {
        type: 'heading',
        heading: 'Variação por região: Tocantins surpreende',
        text: 'A grande surpresa de abril foi o Tocantins, liderando as altas mensais com +1,97% — mais de 7× a média nacional. Seguido por Acre (+1,78%), Amazonas (+1,58%), Amapá (+1,37%) e Roraima (+1,22%). O Norte foi a região mais aquecida do mês, com altas acima de 1% em quase todos os estados.\n\nNa contramão, o Centro-Oeste foi o destaque negativo:\n- Mato Grosso do Sul: -0,57%\n- Mato Grosso: -0,48%\n- Rio Grande do Sul: -0,45%\n- Pernambuco: -0,24%\n- Distrito Federal: -0,12%\n\nMT é também o estado com menor inflação acumulada em 12 meses (+4,50%) — possivelmente ligado à dinâmica do agronegócio, principal motor econômico do Centro-Oeste, que enfrentou pressão de margens no início de 2026.\n\nPara quem está comprando carro no Centro-Oeste, abril foi um bom mês. Para quem está vendendo lá, especialmente em MT/MS, espere o ciclo virar antes de listar.',
      },
      {
        type: 'image',
        src: '/images/ibv/abril-2026/variacao-por-uf.png',
        alt: 'Gráfico de barras com variação mensal por estado em abril de 2026: Tocantins lidera com +1,97%, Mato Grosso do Sul fecha com -0,57%',
        caption: 'Variação mensal por estado (UF) — abril de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Líderes regionais em 12 meses',
        text: 'No acumulado de 12 meses até abril, a hierarquia regional consolidou:\n\n- Minas Gerais: +8,52%\n- Rio de Janeiro: +8,16%\n- Amazonas: +7,43%\n- Alagoas: +7,41%\n- Maranhão: +7,28%\n\nMG e RJ vinham na liderança desde março (+7,75% cada) e abriram distância em abril. Para vendedores, são os dois estados onde o ciclo de valorização foi mais favorável nos últimos 12 meses. Para compradores, é onde o ágio de mercado está mais alto.',
      },
      {
        type: 'image',
        src: '/images/ibv/abril-2026/mapa-brasil-acumulado.png',
        alt: 'Mapa do Brasil com variação acumulada em 12 meses por estado em abril de 2026 — concentração de alta em MG, RJ e Norte',
        caption: 'Variação acumulada em 12 meses por estado. Fonte: Banco BV (IBV Auto), maio/2026.',
      },
      {
        type: 'highlight',
        heading: 'Como usar essa informação',
        text: 'Se você tem um Celta, Palio ou Onix e pensa em vender: abril foi favorável, mas o ritmo desacelerou — vale acelerar a decisão. Se você tem um VW Fox, Nivus ou Gol: a janela de queda abriu — pesa muito esperar mais. Se você está em MG ou RJ vendendo, o ciclo acumulado segue favorável. Se você está em MT/MS comprando, esta é a janela. Se você tem um elétrico usado, a queda de valor segue acelerando — vender quanto antes é a melhor estratégia.',
      },
      {
        type: 'cta',
        text: 'Quer saber o valor atualizado do seu carro pela placa?',
        ctaLabel: 'Consultar Placa Grátis',
        ctaTo: '/',
      },
    ],
  },
  {
    slug: 'vencedores-perdedores-marco-2026',
    title: 'Vencedores e Perdedores de Março 2026: Hilux SW4 dispara +5,17% enquanto Fiesta cai -3,56%',
    metaDescription: 'Hilux SW4 +5,17%, Corolla +1,03%, Onix +0,94% lideraram as altas em março. Fiesta -3,56%, HR-V -0,76% e Gol -0,66% puxaram para baixo. Análise completa com contexto de mercado.',
    publishedAt: '2026-04-07',
    source: 'Banco BV (IBV Auto)',
    referenceMonth: 'Março 2026',
    content: [
      {
        type: 'intro',
        text: 'O IBV Auto de março de 2026 fechou em +0,71% para o Brasil — mas a média não conta a história completa. Enquanto a Hilux SW4 valorizou 5,17% em um único mês, o Ford Fiesta perdeu 3,56%. Isso é uma distância de quase 9 pontos percentuais entre os extremos do mesmo mercado, no mesmo período. Aqui analisamos o que está por trás de cada movimento.',
      },
      {
        type: 'image',
        src: '/images/ibv/marco-2026/modelos-alta-baixa.png',
        alt: 'Modelos com maior alta e maior queda no IBV Auto de março de 2026: Hilux SW4 +5,17%, Corolla +1,03%, Onix +0,94% nas altas; Fiesta -3,56%, HR-V -0,76%, Gol -0,66% nas baixas',
        caption: 'Modelos com maiores variações em março de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Os modelos que mais valorizaram',
        text: 'A Toyota Hilux SW4 foi o grande destaque positivo de março, com alta de +5,17% — um salto que não tem paralelo entre os modelos monitorados no mês. A SW4 é uma SUV de grande porte com motor 2.8 turbodiesel, posicionada acima da Hilux picape convencional. O movimento de março reflete uma combinação de oferta enxuta no mercado de usados (poucos proprietários vendem esse modelo antes de 3–4 anos) e demanda consistente de compradores que buscam capacidade off-road sem pagar o preço de um Land Cruiser. No acumulado de 12 meses, a SW4 está entre os modelos que mais subiram no segmento premium.\n\nO Toyota Corolla subiu +1,03% em março. O dado é mais importante do que parece: o Corolla é o sedã mais vendido do Brasil na faixa intermediária e seu preço de tabela novo cresceu nos últimos 18 meses, o que puxa o usado para cima por arbitragem. Quem compra um Corolla 2022 ou 2023 usado está pagando menos do que o novo — e isso sustenta a demanda. A valorização de março confirma uma tendência de alta consistente desde meados de 2025.\n\nO GM Onix registrou +0,94% — e isso é a notícia que mais importa para o bolso da maioria dos brasileiros. O Onix é o carro mais vendido do Brasil, tanto zero quanto usado, e aparece em alta pelo segundo mês consecutivo em 2026. A pressão vem dos dois lados: o preço do zero-km sobe (câmbio, insumos), e a procura por usados aumenta como alternativa. Quem está com um Onix na garagem e pensa em vender está num bom momento.',
      },
      {
        type: 'heading',
        heading: 'Os modelos que mais perderam',
        text: 'O Ford Fiesta registrou queda de -3,56% — o maior recuo entre os modelos destacados pelo IBV de março, e um número expressivo para apenas 30 dias. O Fiesta foi descontinuado no Brasil em 2021 e a Ford encerrou operações no país logo depois. Sem rede de concessionárias ativa, sem peças diretas de fábrica e sem modelo substituto na mesma faixa de preço, os compradores que poderiam considerar o Fiesta migraram para alternativas com suporte mais fácil. A tendência de queda do Fiesta não é de março: é estrutural e deve continuar.\n\nO Honda HR-V caiu -0,76% em março. O HR-V enfrenta um problema diferente: o mercado de SUVs compactos ficou extremamente competitivo nos últimos dois anos. Chegaram o Jeep Renegade atualizado, o Caoa Chery Tiggo, e versões atualizadas de rivais com mais conteúdo. O HR-V de segunda geração (lançado em 2022) ainda se segura bem, mas as versões mais antigas — 2016 a 2020 — começam a perder atratividade relativa. A queda de março reflete essa pressão competitiva.\n\nO VW Gol recuou -0,66%. Para quem está vendendo um Gol, o dado preocupa. O Gol foi descontinuado em 2023 e é o maior símbolo de uma geração de carros de entrada que estão perdendo espaço para o Polo Track e o Argo. A depreciação do Gol deve se acelerar ao longo de 2026, especialmente nas versões mais antigas, à medida que a distância para o zero-km atual aumenta.',
      },
      {
        type: 'image',
        src: '/images/ibv/marco-2026/variacao-mensal.png',
        alt: 'Gráfico de barras: variação mensal dos preços de automóveis leves usados — taxa mensal jan/25 a mar/26',
        caption: 'Variação mensal do IBV Auto — contexto histórico. Fonte: Banco BV (IBV Auto), abril/2026.',
      },
      {
        type: 'heading',
        heading: 'O que une os vencedores — e o que separa os perdedores',
        text: 'Olhando os três modelos em alta, há um padrão claro: todos têm produção ativa ou rede de apoio robusta, e todos atendem a segmentos onde a oferta de usados é menor do que a demanda. A SW4 é escassa. O Corolla tem uma fila de espera no zero-km. O Onix vende tanto que qualquer variação de demanda impacta rapidamente o preço.\n\nNa ponta negativa, o padrão também é claro: modelos descontinuados (Fiesta, Gol) ou sob pressão competitiva crescente (HR-V) tendem a perder valor de forma acelerada. Descontinuação não significa queda imediata — mas com o tempo, a ausência de uma versão nova no mercado torna cada ano modelo mais antigo relativamente menos atraente.\n\nA região importa, mas menos do que o modelo. Pernambuco valorizou +1,43% em março no agregado, mas um Fiesta em PE caiu junto com o mercado nacional de Fiestas. O preço de um modelo específico é determinado principalmente pela dinâmica nacional daquele modelo, não pelo estado onde o carro está registrado.',
      },
      {
        type: 'image',
        src: '/images/ibv/marco-2026/variacao-por-uf.png',
        alt: 'Gráfico de barras com variação mensal por estado em março de 2026',
        caption: 'Contexto regional: variação por estado em março de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'highlight',
        heading: 'O que fazer com essa informação?',
        text: 'Se você tem um Onix ou Corolla e está pensando em vender, março foi um bom mês e a tendência de curto prazo segue favorável. Se você tem um Fiesta ou Gol e está esperando o preço subir para vender — os dados sugerem que esperar pode não ajudar: a trajetória desses modelos é de queda estrutural. Para quem está comprando, o HR-V com leve queda em março pode ser uma janela — especialmente nas versões 2019–2021, que equilibram preço e equipamentos.',
      },
      {
        type: 'cta',
        text: 'Quer saber quanto vale o seu carro agora, pelo número da placa?',
        ctaLabel: 'Consultar Placa Grátis',
        ctaTo: '/',
      },
    ],
  },
  {
    slug: 'marco-2026',
    title: 'IBV Auto Março 2026: Preços de Carros Usados Sobem 0,71% — Veja os Modelos e Estados que Mais Subiram',
    metaDescription: 'Inflação de automóveis usados acelerou em março de 2026, com alta de 0,71%. Descubra quais modelos e estados puxaram o aumento e como isso afeta o valor do seu carro.',
    publishedAt: '2026-04-07',
    source: 'Banco BV (IBV Auto)',
    referenceMonth: 'Março 2026',
    content: [
      {
        type: 'intro',
        text: 'O Índice BV Auto (IBV) de março de 2026, divulgado pelo banco BV, mostra que a inflação de automóveis usados voltou a acelerar: alta de 0,71% em relação a fevereiro, quando o avanço havia sido de 0,55%. No acumulado de 12 meses, os preços subiram 7,33%.',
      },
      {
        type: 'image',
        src: '/images/ibv/marco-2026/variacao-mensal.png',
        alt: 'Gráfico de barras: Variação mensal dos preços de automóveis leves usados — taxa mensal jan/25 a mar/26',
        caption: 'Variação mensal dos preços de automóveis usados. Fonte: Banco BV (IBV Auto), abril/2026.',
      },
      {
        type: 'heading',
        heading: 'Quais modelos mais subiram?',
        text: 'A Hilux SW4 (+5,17%), o Corolla (+1,03%) e o Onix (+0,94%) foram os veículos que mais contribuíram para a aceleração do índice. O Onix aparece entre as maiores altas pelo segundo mês consecutivo, sinalizando pressão contínua nos populares. Na ponta negativa, Ford Fiesta (-3,56%), Honda HR-V (-0,76%) e VW Gol (-0,66%) registraram queda.',
      },
      {
        type: 'image',
        src: '/images/ibv/marco-2026/modelos-alta-baixa.png',
        alt: 'Modelos com maior alta e maior queda no IBV Auto de março de 2026: Hilux SW4, Corolla, Onix nas altas; Ford Fiesta, Honda HR-V, VW Gol nas baixas',
        caption: 'Modelos de destaque no IBV Auto de março de 2026. Fonte: Banco BV.',
      },
      {
        type: 'heading',
        heading: 'E por região?',
        text: 'O Sudeste puxou a alta com variação de 0,78%, destaque para São Paulo com forte alta de 0,97%. O Nordeste também subiu expressivamente (0,72%). No total, 23 dos 27 estados registraram alta.\n\nOs destaques estaduais: Pernambuco liderou com +1,43%, seguido de Rio Grande do Sul e Sergipe (+1,23% cada). Na contramão, Tocantins (-0,38%) e Goiás (-0,35%) registraram leve queda. No acumulado de 12 meses, Minas Gerais e Rio de Janeiro lideram com +7,75% cada.',
      },
      {
        type: 'image',
        src: '/images/ibv/marco-2026/variacao-por-uf.png',
        alt: 'Gráfico de barras com variação mensal por estado: PE lidera com +1,43%, TO fecha com -0,38%',
        caption: 'Variação mensal por estado (UF) — março de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'image',
        src: '/images/ibv/marco-2026/mapa-brasil-acumulado.png',
        alt: 'Mapa do Brasil com variação acumulada em 12 meses por estado — maior concentração no Nordeste e Sudeste',
        caption: 'Variação acumulada em 12 meses por estado. Fonte: Banco BV (IBV Auto), abril/2026.',
      },
      {
        type: 'heading',
        heading: 'Elétricos desvalorizam mais',
        text: 'Um dado relevante para quem está de olho em carros elétricos usados: modelos elétricos de 2023 acumulam desvalorização de -44,6% até março de 2026, muito acima dos híbridos (-25,9%) e dos veículos a combustão (-21,6%). Modelos elétricos de 2022 já perderam -52,7% do valor original.',
      },
      {
        type: 'highlight',
        heading: 'O que isso significa para você?',
        text: 'Se você está pensando em vender seu carro, o mercado segue favorável, especialmente para modelos populares como Onix e Corolla. Se está comprando, fique atento aos elétricos usados, que oferecem descontos significativos, mas com desvalorização acelerada.',
      },
      {
        type: 'cta',
        text: 'Quer saber quanto vale o seu carro hoje?',
        ctaLabel: 'Consultar Placa Grátis',
        ctaTo: '/',
      },
    ],
  },
  {
    slug: 'maio-2026',
    title: 'IBV Auto Maio 2026: Usados sobem 0,43% — Kwid lidera altas, Onix Plus puxa quedas',
    metaDescription: 'IBV Auto de maio acelerou para +0,43% (ante +0,27% em abril). Renault Kwid +4,58%, Honda HR-V +1,85% e VW Gol +1,60% lideram altas; Onix Plus -1,39%, Mobi -1,14% e Uno -1,12% caem. Centro-Oeste lidera regiões com +0,99%; Norte vira para -0,23%.',
    publishedAt: '2026-06-08',
    source: 'Banco BV (IBV Auto)',
    referenceMonth: 'Maio 2026',
    ogTitle: 'Usados sobem 0,43% em maio. Kwid lidera, Onix Plus puxa quedas.',
    ogHighlight: '+0,43%',
    content: [
      {
        type: 'intro',
        text: 'O Índice BV Auto (IBV) de maio de 2026 mostra reaceleração da inflação de carros usados no Brasil: alta de 0,43% sobre abril — quase o dobro do +0,27% registrado no mês anterior, mas ainda abaixo da média de +0,72% do primeiro trimestre. No acumulado de 12 meses, os preços subiram 6,94% — leve desaceleração frente aos 6,99% fechados em abril.',
      },
      {
        type: 'image',
        src: '/images/ibv/maio-2026/variacao-mensal.png',
        alt: 'Gráfico de barras com variação mensal dos preços de automóveis leves usados de jan/25 a mai/26, mostrando +0,43% em maio/26',
        caption: 'Variação mensal do IBV Auto — reaceleração em maio após desaceleração de abril. Fonte: Banco BV (IBV Auto), junho/2026.',
      },
      {
        type: 'heading',
        heading: 'O que mudou em maio',
        text: 'Em abril, a alta foi puxada por populares antigos e descontinuados (Celta, Palio). Em maio, o quadro muda: o Renault Kwid lidera com +4,58% — uma alta excepcional para um único mês, mais de 10× a média do índice. Honda HR-V vem na sequência com +1,85% e o VW Gol fecha o pódio com +1,60%. Foram esses três os modelos que mais contribuíram para a aceleração do índice.\n\nNa ponta negativa, o destaque é a virada do Chevrolet Onix. Depois de puxar a alta do índice por três meses consecutivos, o Onix caiu -0,36% em maio. Seu irmão sedã, o Onix Plus, registrou a maior queda do mês com -1,39%. Em seguida vieram Fiat Mobi (-1,14%) e Fiat Uno (-1,12%) — sinal de que a pressão nas pontas migrou para o segmento de sedãs compactos e ultra populares.',
      },
      {
        type: 'image',
        src: '/images/ibv/maio-2026/modelos-alta-baixa.png',
        alt: 'Modelos com maior alta e maior queda no IBV Auto maio 2026: Renault Kwid +4,58%, Honda HR-V +1,85%, VW Gol +1,60% nas altas; Onix Plus -1,39%, Mobi -1,14%, Uno -1,12%, Onix -0,36% nas baixas',
        caption: 'Modelos de maior destaque positivo e negativo em maio de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Variação por região: Centro-Oeste assume e Norte devolve a alta',
        text: 'A inversão regional foi nítida: em abril, o Centro-Oeste foi o destaque negativo (com MS, MT e RS em queda) e o Norte foi o mais aquecido (TO, AC e AM lideraram as altas). Em maio, os papéis se invertem. O Centro-Oeste registrou +0,99% e foi a região com maior alta — puxada pelo Mato Grosso do Sul, que avançou +1,19% e teve a maior taxa entre os 27 estados. GO (+0,98%) e MT (+0,91%) completam o trio do Centro-Oeste no topo.\n\nO Norte fez o caminho inverso e fechou em -0,23%, devolvendo parte da forte alta de abril. Cinco dos sete estados da região terminaram negativos, com Amapá e Tocantins empatados em -0,41% — as maiores quedas do mês entre todos os estados. No total, 20 dos 27 estados ainda registraram alta no mês.\n\nNo acumulado de 12 meses, o ranking ganhou nova liderança: Rio de Janeiro assume com +7,84%, seguido por Paraná (+7,42%) e Minas Gerais (+7,29%) — MG perdeu o primeiro lugar que detinha em abril. Na ponta menor: Espírito Santo (+4,91%), Mato Grosso (+5,05%) e Santa Catarina (+5,27%). Todos ainda em alta, mas em ritmo bem mais lento.',
      },
      {
        type: 'image',
        src: '/images/ibv/maio-2026/variacao-por-uf.png',
        alt: 'Gráfico de barras: variação mensal por estado em maio de 2026, com Mato Grosso do Sul liderando em +1,19% e Tocantins/Amapá fechando em -0,41%',
        caption: 'Variação mensal por estado (UF) — maio de 2026. Brasil em +0,43%. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'image',
        src: '/images/ibv/maio-2026/mapa-brasil-acumulado.png',
        alt: 'Mapa do Brasil com variação acumulada em 12 meses por estado em maio de 2026 — Rio de Janeiro lidera com +7,84%',
        caption: 'Variação acumulada em 12 meses por estado. Fonte: Banco BV (IBV Auto), junho/2026.',
      },
      {
        type: 'heading',
        heading: 'Elétricos seguem desvalorizando mais que o mercado',
        text: 'A foto da depreciação por tipo de propulsão continuou estável em maio, com a hierarquia já consolidada nos meses anteriores. Modelos elétricos lançados em 2023 acumulam desvalorização de 45,6% até maio de 2026 — o mesmo nível visto até abril. Há sinal de estabilização, mas o patamar permanece alto.\n\nComparativo por ano modelo até maio/2026:\n- 2023 — Elétricos: -45,6% | Híbridos: -25,2% | Combustão: -20,0%\n- 2022 — Elétricos: -49,3% | Híbridos: -18,9% | Combustão: -13,4%\n- 2021 — Híbridos: -17,0% | Combustão: -5,1%\n\nO racional segue o mesmo: a entrada constante de elétricos novos no Brasil, com tecnologia superior e preços mais agressivos, pressiona o valor de revenda dos modelos antigos. Para quem está comprando elétrico usado, a janela de desconto se mantém aberta. Para quem está vendendo, o sinal estrutural continua claro.',
      },
      {
        type: 'image',
        src: '/images/ibv/maio-2026/desvalorizacao-2023.png',
        alt: 'Gráfico comparando desvalorização de elétricos (-45,6%), híbridos (-25,2%) e veículos a combustão (-20,0%) ano modelo 2023 até maio de 2026',
        caption: 'Desvalorização acumulada por tipo de propulsão — modelos ano 2023. Fonte: Banco BV.',
      },
      {
        type: 'highlight',
        heading: 'O que isso significa para você?',
        text: 'Se você tem um Renault Kwid, Honda HR-V ou VW Gol, maio foi um mês excepcional de valorização — janela favorável para vender. Se você tem um Onix Plus, Mobi ou Uno, a queda foi expressiva e acelerada: vale acelerar a decisão. Se está no Centro-Oeste e quer vender, este foi o melhor mês recente — especialmente em MS, MT e GO. No Norte, a janela é o oposto: bom mês para comprar, mês difícil para vender. Para elétricos usados, o cenário não muda — comprar tem desconto cada vez maior, vender tem urgência cada vez maior.',
      },
      {
        type: 'cta',
        text: 'Quer saber quanto vale o seu carro pela placa, com base na FIPE atualizada?',
        ctaLabel: 'Consultar Placa Grátis',
        ctaTo: '/',
      },
    ],
  },
  {
    slug: 'vencedores-perdedores-maio-2026',
    title: 'Vencedores e Perdedores de Maio 2026: Kwid dispara +4,58% e Onix Plus cai -1,39% no IBV Auto',
    metaDescription: 'Renault Kwid +4,58%, Honda HR-V +1,85% e VW Gol +1,60% lideram altas em maio. Onix Plus -1,39%, Mobi -1,14% e Uno -1,12% caem. Onix vira após 3 meses no topo. MS lidera estados com +1,19%.',
    publishedAt: '2026-06-08',
    source: 'Banco BV (IBV Auto)',
    referenceMonth: 'Maio 2026',
    ogTitle: 'Vencedores e perdedores de maio. Kwid +4,58%, Onix Plus -1,39%.',
    ogHighlight: 'Maio',
    content: [
      {
        type: 'intro',
        text: 'O IBV Auto de maio de 2026 fechou em +0,43% para o Brasil — quase o dobro do +0,27% de abril. Mas o detalhe está nos extremos: o Renault Kwid valorizou 4,58% em um único mês, enquanto o Onix Plus perdeu 1,39%. Quase 6 pontos percentuais separando os extremos. E o padrão muda completamente em relação a abril: em vez de populares antigos descontinuados (Celta, Palio) liderando, é a vez dos populares atuais e premium acessível dispararem.',
      },
      {
        type: 'image',
        src: '/images/ibv/maio-2026/modelos-alta-baixa.png',
        alt: 'Modelos com maior alta e maior queda no IBV Auto de maio de 2026: Renault Kwid +4,58%, Honda HR-V +1,85%, VW Gol +1,60% nas altas; Onix Plus -1,39%, Mobi -1,14%, Uno -1,12%, Onix -0,36% nas baixas',
        caption: 'Modelos com maiores variações em maio de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Os modelos que mais valorizaram em maio',
        text: 'O Renault Kwid liderou a alta de maio com expressivos +4,58% — alta atípica para um único mês e mais de 10× a média do índice. O Kwid é hoje um dos hatches mais baratos do mercado brasileiro de zero-km. Quando o preço do popular novo sobe ou trava em escassez, o Kwid usado vira destino natural de quem foi expulso do segmento de entrada. A alta de maio sugere demanda represada migrando para o seminovo barato.\n\nO Honda HR-V subiu +1,85% — o SUV mais conhecido da Honda no Brasil entrou na geração nova em 2022 e segue como referência de SUV compacto premium acessível. A alta de maio mostra que o segmento de SUV médio ainda tem fôlego, mesmo com a chegada agressiva dos SUVs chineses. Para quem tem um HR-V usado, é janela boa de venda.\n\nO VW Gol fechou o pódio com +1,60%. O movimento é particularmente interessante porque, em abril, o Gol foi um dos três modelos que mais caíram (-0,50%) — virou em um mês. O Gol descontinuado em 2023 segue como um dos sedãs/hatches mais procurados no usado por questão de preço, e a alta de maio sugere que a queda de abril foi exagerada e o mercado corrigiu.',
      },
      {
        type: 'heading',
        heading: 'Os modelos que mais perderam — Onix Plus, Mobi, Uno e o fim do reinado do Onix',
        text: 'A maior queda do mês foi do Chevrolet Onix Plus com -1,39%. O Onix Plus é o sedã derivado do Onix hatch, e essa queda forte indica que a pressão competitiva no segmento de sedãs compactos ficou pesada: HB20S, Versa, Virtus e os chineses (BYD Dolphin, Caoa Chery) seguem disputando o mesmo bolso. Para quem tem um Onix Plus, a janela de queda abriu — não vale esperar.\n\nO Fiat Mobi caiu -1,14%. O Mobi é o carro mais barato em produção no Brasil, mas perdeu espaço para Kwid e Renault Kardian na disputa pelo segmento de entrada. Em maio, a curva de queda foi acelerada.\n\nO Fiat Uno recuou -1,12%. O Uno é descontinuado desde 2021, mas segue com volume gigantesco no usado. A queda de maio acompanha a tendência estrutural de erosão dos populares descontinuados — sem reposição, sem suporte e com versões novas concorrendo no mesmo preço.\n\nO destaque mais simbólico, porém, foi o Chevrolet Onix: -0,36% após puxar a alta do índice por TRÊS meses consecutivos. É a primeira queda do modelo mais vendido do Brasil em 2026. O movimento pode ser correção natural depois de três meses no topo, mas também pode marcar o início de pressão maior no popular nacional — algo a acompanhar nos próximos meses.',
      },
      {
        type: 'heading',
        heading: 'Variação por região: Centro-Oeste vira líder e Norte devolve a alta',
        text: 'A inversão regional foi a história do mês. O Centro-Oeste, que em abril foi o destaque negativo (MS -0,57%, MT -0,48%), passou em maio à condição de líder regional com +0,99%. Mato Grosso do Sul foi o estado com maior alta entre os 27, em +1,19%. GO (+0,98%) e MT (+0,91%) completam o trio do Centro-Oeste no topo.\n\nNa contramão, o Norte — que em abril liderou com Tocantins em +1,97% e Acre em +1,78% — fechou maio em -0,23%, com cinco dos sete estados da região em baixa. Amapá e Tocantins lideraram as quedas, ambos em -0,41% (as maiores do mês). O movimento devolve parcialmente a forte alta de abril e sugere ajuste de mercado depois do pico anterior.\n\nAo todo, 20 dos 27 estados registraram alta em maio — mostra que o ambiente segue dominantemente positivo, apenas com geografia bem diferente.\n\nPara quem está comprando no Norte agora, esta é a melhor janela em meses. Para quem está vendendo no Centro-Oeste, especialmente em MS, é a melhor janela do ano.',
      },
      {
        type: 'image',
        src: '/images/ibv/maio-2026/variacao-por-uf.png',
        alt: 'Gráfico de barras com variação mensal por estado em maio de 2026: Mato Grosso do Sul lidera com +1,19%, Tocantins e Amapá fecham com -0,41%',
        caption: 'Variação mensal por estado (UF) — maio de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Líderes regionais em 12 meses — RJ assume',
        text: 'No acumulado de 12 meses até maio, a hierarquia ganhou nova liderança:\n\n- Rio de Janeiro: +7,84%\n- Paraná: +7,42%\n- Minas Gerais: +7,29%\n- Pernambuco: +7,17%\n- Alagoas: +7,06%\n\nMinas Gerais, que vinha liderando em abril (+8,52%), recuou para terceiro. O Rio de Janeiro assumiu a ponta — para vendedores fluminenses, é o melhor ciclo acumulado dos últimos meses.\n\nNa ponta menor: Espírito Santo (+4,91%), Mato Grosso (+5,05%) e Santa Catarina (+5,27%). Esses três estados acumulam menos da metade da inflação dos líderes — o que para compradores significa menos ágio de mercado, e para vendedores significa que o ciclo de valorização vai chegar mais devagar.',
      },
      {
        type: 'image',
        src: '/images/ibv/maio-2026/mapa-brasil-acumulado.png',
        alt: 'Mapa do Brasil com variação acumulada em 12 meses por estado em maio de 2026 — concentração de alta em RJ, PR, MG e Nordeste',
        caption: 'Variação acumulada em 12 meses por estado. Fonte: Banco BV (IBV Auto), junho/2026.',
      },
      {
        type: 'highlight',
        heading: 'Como usar essa informação',
        text: 'Se você tem um Renault Kwid, Honda HR-V ou VW Gol e pensa em vender: maio foi excepcional — acelere a decisão antes que o mercado corrija. Se você tem um Onix Plus, Mobi ou Uno: a janela de queda abriu, vender antes de mais erosão é a estratégia. Se você tem um Chevrolet Onix: três meses no topo terminaram em maio — a melhor janela de venda do ano talvez já tenha passado. Se você está em MS, GO ou MT vendendo, a janela está aberta agora. Se você está no Norte (especialmente AP e TO) comprando, é a melhor janela em meses. Se você tem um elétrico usado, a desvalorização segue estrutural — vender quanto antes continua sendo a melhor estratégia.',
      },
      {
        type: 'cta',
        text: 'Quer saber o valor atualizado do seu carro pela placa?',
        ctaLabel: 'Consultar Placa Grátis',
        ctaTo: '/',
      },
    ],
  },
]

export function findIbvPost(slug: string): IbvPost | undefined {
  return ibvPosts.find(p => p.slug === slug)
}
