import { BASE_LEILAO_TEXTO } from '../shared/base-leilao'
export interface IbvPost {
  slug: string
  title: string
  /** Title da aba/SERP: 50 a 60 caracteres no total (shared/seo-titulo.ts). O H1 continua sendo `title`. */
  seoTitle: string
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
    slug: 'setembro-2026',
    title: 'IBV Auto Setembro 2026: usados voltam a subir (+0,30%) depois da queda de agosto',
    seoTitle: 'IBV Auto Setembro 2026: Usados Voltam a Subir 0,30%',
    metaDescription: 'IBV Auto de setembro sobe 0,30% após -0,01% em agosto; 12 meses em +5,12%. Sandero, Gol e Creta lideram altas; Sul +0,75%, Centro-Oeste -0,53%.',
    publishedAt: '2026-10-06',
    source: 'Banco BV (IBV Auto) + análise PlacaCompleta',
    referenceMonth: 'Setembro 2026',
    ogTitle: 'IBV de setembro volta a subir: +0,30%, depois do -0,01% de agosto.',
    ogHighlight: '+0,30%',
    content: [
      {
        type: 'intro',
        text: 'O Índice BV Auto (IBV) de setembro de 2026 subiu **+0,30%**, depois da leve queda de agosto (-0,01%). É uma volta ao positivo, mas sem retomar o ritmo do ano passado: no terceiro trimestre, o índice acumulou **+0,36%**, contra **+2,04%** no mesmo período de 2025. Em 12 meses, a alta segue em **+5,12%**, o mesmo número de agosto. No ano, os usados acumulam **+3,86%**, um pouco abaixo dos +4,05% de 2025.',
      },
      {
        type: 'image',
        src: '/images/ibv/setembro-2026/variacao-mensal.png',
        alt: 'Gráfico de barras com a variação mensal do IBV Auto de jan/2025 a set/2026, com setembro voltando a +0,30% depois do -0,01% de agosto',
        caption: 'Setembro volta ao positivo depois do único mês negativo da série recente. Fonte dos dados: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Uma recuperação, não uma retomada',
        text: 'O +0,30% de setembro é igual ao de setembro de 2025, mas o contexto é outro: em 2025, o índice vinha de três meses acima de +0,6% (junho a agosto). Agora ele vem de julho (+0,07%) e agosto (-0,01%). O ano de 2026 segue com a valorização do usado existindo, só que mais contida, e o acumulado de 12 meses parou de cair, estacionado em +5,12%.',
      },
      {
        type: 'heading',
        heading: 'Quais modelos mais subiram e mais caíram?',
        text: 'Segundo o Banco BV, as maiores contribuições de alta vieram de **Renault Sandero (+1,88%)**, **VW Gol (+1,51%)** e **Hyundai Creta (+1,39%)**. Do outro lado, pesaram para baixo **Toyota Hilux SW4 (-1,60%)**, **Honda HR-V (-1,19%)** e **VW Polo (-0,97%)**.\n\nDe novo, os populares com preço de entrada (Sandero e Gol) puxam a alta. Entre as quedas, dois SUVs (SW4 e HR-V) e o Polo, um hatch relativamente recente.',
      },
      {
        type: 'image',
        src: '/images/ibv/setembro-2026/modelos-alta-baixa.png',
        alt: 'Infográfico com os modelos de maior alta e maior queda no IBV Auto de setembro de 2026: Renault Sandero, VW Gol e Hyundai Creta em alta; Toyota Hilux SW4, Honda HR-V e VW Polo em queda',
        caption: 'Modelos de destaque no IBV Auto de setembro de 2026. Fonte: Banco BV.',
      },
      {
        type: 'heading',
        heading: 'Por região: o Sul vira o jogo, o Centro-Oeste devolve',
        text: 'O **Sul teve a maior alta do mês (+0,75%)**, depois de ter caído -0,44% em agosto. O **Centro-Oeste teve a menor variação (-0,53%)**, devolvendo a alta de +0,81% do mês anterior. Três das cinco regiões subiram.\n\nPor estado, **16 subiram e 11 caíram**. O **Maranhão liderou (+1,17%)**, no segundo mês seguido de alta forte (+0,76% em agosto). O **Mato Grosso teve a maior queda (-1,05%)**, uma inversão completa depois de subir +1,06% em agosto.',
      },
      {
        type: 'image',
        src: '/images/ibv/setembro-2026/variacao-por-uf.png',
        alt: 'Gráfico de barras com a variação mensal por estado em setembro de 2026, do Maranhão no topo ao Mato Grosso no fundo',
        caption: 'Variação mensal por estado em setembro de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'image',
        src: '/images/ibv/setembro-2026/mapa-brasil-acumulado.png',
        alt: 'Mapa do Brasil com a variação acumulada em 12 meses por estado até setembro de 2026, Rio de Janeiro com a maior alta e Mato Grosso com a menor',
        caption: 'Variação acumulada em 12 meses por estado. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: '12 meses: Rio de Janeiro segue na frente',
        text: 'No acumulado de 12 meses, as maiores altas são do **Rio de Janeiro (+6,71%)**, **Maranhão (+6,21%)** e **Alagoas (+6,13%)**. As menores ficaram com **Mato Grosso (+2,86%)**, **São Paulo (+3,13%)** e **Pará (+3,57%)**. São Paulo, o maior mercado de usados do país, segue entre os que menos valorizaram.',
      },
      {
        type: 'heading',
        heading: 'O que a nossa base mostra',
        text: 'Levantamento PlacaCompleta com cerca de 9 mil placas consultadas em setembro de 2026 (cada placa contada uma vez):\n\n- **Os carros que as pessoas checam antes de comprar têm, em média, 12,5 anos.** O IBV mede transações financiadas; quem consulta a placa está olhando, em boa parte, carros mais velhos.\n- **No Sul, região que mais subiu no IBV, os carros consultados são os mais antigos do país: 14,5 anos em média** (15,8 no Rio Grande do Sul).\n- **São Paulo concentra 24% das consultas**, num mês em que o IBV paulista ficou estável (-0,03%).\n- **Desde 20 de setembro, 6,0% das placas consultadas tinham registro de leilão na nossa base** (59 de 988). Entre os estados com amostra suficiente, Bahia (9,8%) e São Paulo (8,9%) ficaram acima da média.',
      },
      {
        type: 'heading',
        heading: 'Elétricos: veja a análise dedicada',
        text: 'Setembro também trouxe o corte por tipo de propulsão: os elétricos 2023 já acumulam -46,90% de desvalorização. Detalhamos no [post de elétricos de setembro](/ibv/eletricos-setembro-2026).',
      },
      {
        type: 'highlight',
        heading: 'O que isso significa para você?',
        text: 'Para quem vende, setembro mostra que agosto não foi o começo de uma queda generalizada: o mercado voltou a subir, mas devagar. Para quem compra, o cenário segue favorável em São Paulo, Mato Grosso e Pará, os estados que menos valorizaram em 12 meses. E, como mostra a nossa base, quem compra usado está olhando carros com mais de 12 anos em média: idade em que histórico de leilão, gravame e restrição pesam mais na decisão. Detalhamos estado a estado em [Vencedores e Perdedores de setembro](/ibv/vencedores-perdedores-setembro-2026).',
      },
      {
        type: 'cta',
        text: `Quer saber quanto vale o carro pela placa, com FIPE atualizada e histórico de leilão (base com ${BASE_LEILAO_TEXTO})?`,
        ctaLabel: 'Consultar placa',
        ctaTo: '/',
      },
    ],
  },
  {
    slug: 'vencedores-perdedores-setembro-2026',
    title: 'Vencedores e Perdedores de Setembro 2026: Maranhão lidera, Mato Grosso devolve a alta de agosto',
    seoTitle: 'IBV Setembro 2026: Maranhão Lidera, Mato Grosso Cai',
    metaDescription: 'Vencedores e perdedores de setembro no IBV Auto: Maranhão +1,17%, Roraima +0,96% e Paraná +0,90% lideram; Mato Grosso -1,05% e Bahia -0,74% caem.',
    publishedAt: '2026-10-06',
    source: 'Banco BV (IBV Auto) + análise PlacaCompleta',
    referenceMonth: 'Setembro 2026',
    ogTitle: 'Setembro: Maranhão sobe, Mato Grosso devolve tudo.',
    ogHighlight: 'Setembro',
    content: [
      {
        type: 'intro',
        text: 'Setembro foi o mês das inversões. Dos quatro estados que mais subiram, três tinham caído em agosto. Dos quatro que mais caíram, todos tinham subido em agosto. Com o índice nacional em **+0,30%**, a diferença entre o primeiro (**Maranhão, +1,17%**) e o último (**Mato Grosso, -1,05%**) passou de 2 pontos percentuais.',
      },
      {
        type: 'image',
        src: '/images/ibv/setembro-2026/variacao-por-uf.png',
        alt: 'Gráfico de barras da variação mensal por estado em setembro de 2026, com Maranhão no topo e Mato Grosso no fundo',
        caption: 'Setembro: Maranhão lidera com +1,17%, Mato Grosso cai -1,05%. Fonte dos dados: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Os 4 estados que mais subiram',
        text: '- **Maranhão: +1,17%** (12 meses: +6,21%). É o único do topo que já vinha subindo: +0,76% em agosto. Nos últimos seis meses, só caiu em julho.\n- **Roraima: +0,96%** (12 meses: +4,80%). Recuperação depois de -0,88% em agosto. Mercado pequeno, que oscila muito de um mês para o outro.\n- **Paraná: +0,90%** (12 meses: +5,67%). Sai de dois meses levemente negativos (-0,25% e -0,04%).\n- **Santa Catarina: +0,65%** (12 meses: +4,20%). Devolve a queda de agosto (-0,57%) e volta ao ritmo do primeiro semestre.',
      },
      {
        type: 'heading',
        heading: 'Os 4 estados que mais caíram',
        text: '- **Mato Grosso: -1,05%** (12 meses: +2,86%, o menor do país). Devolve quase exatamente a alta de agosto (+1,06%).\n- **Bahia: -0,74%** (12 meses: +4,79%). Depois de +0,73% em agosto. Na série de seis meses, alterna alta e queda.\n- **Pará: -0,55%** (12 meses: +3,57%, terceiro menor do país).\n- **Mato Grosso do Sul: -0,55%** (12 meses: +5,23%). Depois de +0,81% em agosto.',
      },
      {
        type: 'image',
        src: '/images/ibv/setembro-2026/variacao-por-uf-acumulado.png',
        alt: 'Gráfico de barras com a variação acumulada em 12 meses por estado até setembro de 2026, Rio de Janeiro na liderança e Mato Grosso na lanterna',
        caption: 'Variação acumulada em 12 meses por estado até setembro de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'O que a nossa base mostra nesses estados',
        text: 'Levantamento PlacaCompleta com as placas consultadas em setembro de 2026, pelo estado de registro do veículo:\n\n- **Paraná:** 745 placas consultadas, carros com 14,2 anos em média e valor FIPE mediano de R$ 39,9 mil. Só 3,2% das placas com resposta tinham registro de leilão, metade da média nacional (6,0%).\n- **Santa Catarina:** 364 placas, 13,6 anos em média, FIPE mediana de R$ 44,0 mil. 8,1% com registro de leilão.\n- **Bahia:** 532 placas, carros mais novos (10,7 anos) e FIPE mediana de R$ 32,7 mil. **9,8% com registro de leilão, a maior taxa entre os estados com amostra suficiente.**\n- **Maranhão:** 89 placas, 10,2 anos em média e FIPE mediana de R$ 22,5 mil, uma das mais baixas do país. O estado que mais valoriza é também um dos que consulta carros mais baratos.\n\n(Percentuais de leilão só para estados com pelo menos 30 placas com resposta, medidos desde 20/09.)',
      },
      {
        type: 'highlight',
        heading: 'Como usar essa informação',
        text: 'Inversão de um mês não é tendência. Mato Grosso e Bahia caíram depois de subir; Paraná e Santa Catarina subiram depois de cair. Para quem compra, o dado que mais pesa é o de 12 meses: Mato Grosso (+2,86%), São Paulo (+3,13%) e Pará (+3,57%) seguem com o usado valorizando menos. Para quem compra na Bahia, onde quase 1 em cada 10 placas consultadas tinha registro de leilão, vale consultar o histórico antes de fechar.',
      },
      {
        type: 'cta',
        text: 'Quer saber o valor atualizado do carro pela placa, com histórico de leilão incluído?',
        ctaLabel: 'Consultar placa',
        ctaTo: '/',
      },
    ],
  },
  {
    slug: 'eletricos-setembro-2026',
    title: 'Elétricos Usados Setembro 2026: desvalorização volta a aumentar nos três tipos',
    seoTitle: 'Elétricos Usados Setembro 2026: Desvalorização Volta a Subir',
    metaDescription: 'Elétricos usados em setembro, pelo IBV Auto (Banco BV): 2023 acumulam -46,90%, híbridos -27,89% e combustão -22,20%. Os de 2022 chegam a -50,24%.',
    publishedAt: '2026-10-06',
    source: 'Banco BV (IBV Auto) + análise PlacaCompleta',
    referenceMonth: 'Setembro 2026',
    ogTitle: 'Elétrico 2023 já perdeu 46,9% do valor. O combustão, 22,2%.',
    ogHighlight: '-46,9%',
    content: [
      {
        type: 'intro',
        text: 'O relatório de setembro do Banco BV mostra a desvalorização aumentando de novo nos três tipos de motorização. Os elétricos lançados em 2023 acumulam **-46,90%**, os híbridos **-27,89%** e os modelos a combustão comparáveis **-22,20%**. Em agosto, os mesmos grupos estavam em -46,15%, -26,36% e -21,72%.',
      },
      {
        type: 'image',
        src: '/images/ibv/setembro-2026/desvalorizacao-2023.png',
        alt: 'Gráfico de linhas com a desvalorização acumulada de elétricos, híbridos e combustão para modelos 2023 até setembro de 2026',
        caption: 'Modelos 2023: elétricos -46,9%, híbridos -27,9%, combustão -22,2%. Fonte dos dados: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Por ano-modelo',
        text: 'Desvalorização acumulada até setembro de 2026, segundo o Banco BV:\n\n- **Modelos 2023:** Elétricos -46,90% | Híbridos -27,89% | Combustão -22,20%\n- **Modelos 2022:** Elétricos -50,24% | Híbridos -22,72% | Combustão -14,78%\n- **Modelos 2021:** Híbridos -17,04% | Combustão -6,91%\n\nNos modelos 2023, os híbridos tiveram o maior aumento recente da desvalorização. Nos modelos 2022, elétricos e híbridos ficaram quase estáveis no mês, enquanto o combustão piorou mais (de -14,07% para -14,78%). Nos 2021, os híbridos até melhoraram um pouco (de -17,47% para -17,04%).',
      },
      {
        type: 'image',
        src: '/images/ibv/setembro-2026/desvalorizacao-2022.png',
        alt: 'Gráfico com a desvalorização acumulada de elétricos, híbridos e combustão para modelos 2022 até setembro de 2026',
        caption: 'Modelos 2022: elétricos passam de metade do valor perdido. Fonte dos dados: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Por que o elétrico segue perdendo mais',
        text: 'A explicação do Banco BV continua a mesma: a pressão vem do preço do zero-km. Mais concorrência e políticas comerciais agressivas das montadoras líderes no segmento derrubam o preço do novo, e o usado acompanha. Parte dessa pressão já passa para os híbridos; os modelos a combustão seguem os mais resistentes.',
      },
      {
        type: 'heading',
        heading: 'O que a nossa base mostra',
        text: 'Levantamento PlacaCompleta com cerca de 9 mil placas consultadas em setembro de 2026: **as marcas chinesas somaram só 1,0% das placas consultadas** (92), e a BYD, 0,3% (30). BYD e GWM de 2022 em diante, onde está a maior parte dos elétricos e híbridos à venda, foram 45 placas, 0,5% do total.\n\nOu seja: o usado eletrificado ainda é um nicho entre quem consulta placa antes de comprar. A desvalorização forte afeta quem já tem o carro, mas a maior parte dos compradores de usado ainda está olhando modelos a combustão.',
      },
      {
        type: 'highlight',
        heading: 'O que isso significa para quem tem, ou quer comprar',
        text: 'Quem tem elétrico 2022 ou 2023 já absorveu quase metade da perda, e setembro não mostrou recuperação. Quem quer comprar um elétrico usado encontra preço muito abaixo da tabela original, mas precisa olhar com cuidado a bateria, a garantia e o histórico do carro. Em um mercado de nicho, cada unidade conta.',
      },
      {
        type: 'cta',
        text: `Comprando um usado, elétrico ou não? Consulte a placa antes: histórico de leilão, restrição e indicador de sinistro, numa base com ${BASE_LEILAO_TEXTO}.`,
        ctaLabel: 'Consultar placa',
        ctaTo: '/',
      },
    ],
  },
  {
    slug: 'agosto-2026',
    title: 'IBV Auto Agosto 2026: primeira queda do ano (-0,01%) e o ciclo de alta perde força',
    seoTitle: 'IBV Auto Agosto 2026: Primeira Queda do Ano (-0,01%)',
    metaDescription: 'IBV Auto de agosto fecha em -0,01%, a primeira queda do ano, e o acumulado de 12 meses desacelera para +5,12%. Uno lidera as altas e Ka, as quedas.',
    publishedAt: '2026-09-04',
    source: 'Banco BV (IBV Auto)',
    referenceMonth: 'Agosto 2026',
    ogTitle: 'IBV de agosto vira negativo: -0,01%. O ciclo de alta perdeu força de vez.',
    ogHighlight: '-0,01%',
    content: [
      {
        type: 'intro',
        text: 'O Índice BV Auto (IBV) de agosto de 2026 fechou em **-0,01%**, a primeira leitura negativa da série recente depois de um julho que já tinha desacelerado para +0,07%. Não é um tombo, é um sinal: dois meses seguidos de freio, o segundo já cruzando pro vermelho. No acumulado de 12 meses, o índice está em **+5,12%**, ante os +6,10% de julho, a valorização do usado segue existindo, só que cada vez mais fraca. No ano, o acumulado de 2026 está em +3,55%, praticamente empatado com o mesmo período de 2025 (+3,74%).',
      },
      {
        type: 'image',
        src: '/images/ibv/agosto-2026/variacao-mensal.png',
        alt: 'Gráfico de barras com a variação mensal do IBV Auto de jan/2025 a ago/2026, mostrando a virada para negativo em agosto',
        caption: 'Agosto é a primeira barra negativa da série recente. Fonte dos dados: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'De +0,92% a -0,01% em sete meses: o gráfico de uma desaceleração',
        text: 'Olhando a série completa, o padrão é claro: agosto de 2025 marcou o pico do ciclo (+0,92%), e desde então o índice mensal só perdeu força, com solavancos (janeiro de 2026 chegou a repicar para +0,90%) mas numa tendência de queda que culmina no -0,01% de agora. Não é um evento isolado, é o fim de um ciclo de valorização que durou mais de um ano.',
      },
      {
        type: 'heading',
        heading: 'Quais modelos mais subiram e mais caíram?',
        text: 'Segundo o resumo divulgado pelo Banco BV, o **Fiat Uno liderou as altas com +1,68%**, seguido por **VW Fox (+1,39%)** e **Toyota Corolla (+0,51%)**. Do outro lado, o **Ford Ka foi a maior queda (-2,27%)**, com **Fiat Mobi (-2,06%)** e **VW T-Cross (-1,66%)** completando o trio negativo.\n\nO padrão dos vencedores repete o que já vimos em meses anteriores: populares antigos e baratos (Uno, Fox) puxando a demanda de quem foi empurrado para a base da pirâmide. O T-Cross entre as maiores quedas chama atenção por ser um SUV compacto relativamente recente, sinal de que a pressão de preço já alcança segmentos mais caros, não só o popular de entrada.',
      },
      {
        type: 'image',
        src: '/images/ibv/agosto-2026/modelos-alta-baixa.png',
        alt: 'Infográfico com os modelos de maior alta e maior queda no IBV Auto de agosto de 2026: Fiat Uno, VW Fox e Toyota Corolla em alta; Ford Ka, Fiat Mobi e VW T-Cross em queda',
        caption: 'Modelos de destaque no IBV Auto de agosto de 2026. Fonte: Banco BV.',
      },
      {
        type: 'heading',
        heading: 'Por região: Centro-Oeste sobe, Sul puxa a queda',
        text: 'O **Centro-Oeste foi a região que mais subiu no mês (+0,81%)**, acelerando frente aos +0,29% de julho. No extremo oposto, o **Sul teve a maior queda (-0,44%)**, uma reversão completa: em julho a região tinha subido +0,22%. O Sudeste ficou perto de zero (-0,11%), no mesmo padrão de estagnação do índice nacional.\n\nPor estado, o mês foi mais positivo do que negativo na contagem bruta: **19 dos 27 estados subiram, 8 caíram**. O **Piauí liderou com +1,27%**, revertendo a forte queda de julho (-1,08%), clássico movimento de correção depois de um mês ruim. **Distrito Federal (+1,12%)** e **Mato Grosso (+1,06%)** completam o topo. Na ponta oposta, **Roraima teve a maior queda (-0,88%)**, seguido de **Amapá (-0,83%)** e **Rio Grande do Sul (-0,74%)**.',
      },
      {
        type: 'image',
        src: '/images/ibv/agosto-2026/variacao-por-uf.png',
        alt: 'Gráfico de barras com a variação mensal por estado em agosto de 2026, do maior ao menor, com Piauí no topo e Roraima no fundo',
        caption: 'Variação mensal por estado (UF) em agosto de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'image',
        src: '/images/ibv/agosto-2026/mapa-brasil-acumulado.png',
        alt: 'Mapa do Brasil colorido com a variação acumulada em 12 meses por estado até agosto de 2026, Rio de Janeiro liderando e Santa Catarina na lanterna',
        caption: 'Variação acumulada em 12 meses por estado. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: '12 meses: Rio de Janeiro assume a liderança',
        text: 'No acumulado de 12 meses, o **Rio de Janeiro passou a liderar com +6,28%**, à frente de **Sergipe (+6,18%)** e **Mato Grosso (+6,15%)**. Na outra ponta, **Santa Catarina (+3,20%)** e **São Paulo (+3,33%)** seguem com a menor valorização do país, os dois estados mais líquidos e concorridos do mercado de usados, onde a oferta maior segura o preço para baixo. O Brasil em 12 meses está em +5,12%.',
      },
      {
        type: 'heading',
        heading: 'Elétricos: veja a análise dedicada',
        text: 'O relatório de agosto também trouxe o corte por tipo de propulsão (elétrico, híbrido, combustão), com um dado que já está virando polêmica: quem comprou elétrico chinês 0km em 2022 já perdeu metade do valor de tabela. Analisamos em detalhe no [post dedicado de agosto](/ibv/eletricos-agosto-2026).',
      },
      {
        type: 'highlight',
        heading: 'O que isso significa para você?',
        text: 'Se você está pensando em vender, agosto reforça o recado de julho: o ciclo de alta perdeu força e a primeira leitura negativa em meses é um sinal de que esperar mais não deve compensar. Se você está comprando, o momento favorece: 8 estados já caíram no mês, e a tendência de 12 meses desacelera mês a mês (+6,10% em julho, +5,12% em agosto). Quem é de Roraima, Amapá ou Rio Grande do Sul pega o mercado local em queda no mês; quem é do Rio, Sergipe ou Mato Grosso ainda segura o acumulado de 12 meses mais forte do país. Detalhamos modelo a modelo e estado a estado no post [Vencedores e Perdedores de agosto](/ibv/vencedores-perdedores-agosto-2026).',
      },
      {
        type: 'cta',
        text: `Quer saber quanto vale o seu carro pela placa, com FIPE atualizada e histórico de leilão (base com ${BASE_LEILAO_TEXTO})?`,
        ctaLabel: 'Consultar Placa Grátis',
        ctaTo: '/',
      },
    ],
  },
  {
    slug: 'vencedores-perdedores-agosto-2026',
    title: 'Vencedores e Perdedores de Agosto 2026: Uno lidera as altas, Ford Ka despenca, Piauí lidera entre estados',
    seoTitle: 'IBV Agosto 2026: Uno Lidera Altas e Ford Ka Despenca',
    metaDescription: 'Vencedores e perdedores de agosto no IBV Auto: Uno +1,68%, Fox +1,39% e Corolla +0,51% sobem; Ka -2,27% e Mobi -2,06% caem. Piauí lidera (+1,27%).',
    publishedAt: '2026-09-04',
    source: 'Banco BV (IBV Auto)',
    referenceMonth: 'Agosto 2026',
    ogTitle: 'Vencedores e perdedores de agosto: Uno sobe, Ka despenca.',
    ogHighlight: 'Agosto',
    content: [
      {
        type: 'intro',
        text: 'O IBV Auto de agosto fechou no vermelho pela primeira vez em meses (-0,01%), mas nos extremos o mercado teve movimento de sobra. Segundo o resumo divulgado pelo Banco BV, o **Fiat Uno subiu 1,68%** e o **Ford Ka caiu 2,27%**, quase 4 pontos percentuais de distância entre o topo e o fundo da tabela de modelos.',
      },
      {
        type: 'image',
        src: '/images/ibv/agosto-2026/modelos-alta-baixa.png',
        alt: 'Infográfico com os modelos de maior alta e maior queda no IBV Auto de agosto de 2026',
        caption: 'Modelos de destaque no IBV Auto de agosto de 2026. Fonte: Banco BV.',
      },
      {
        type: 'heading',
        heading: 'Os modelos que mais valorizaram em agosto',
        text: 'O **Fiat Uno (+1,68%)** no topo é o retrato mais claro do momento do mercado: carro fora de linha, ticket de entrada baixíssimo, puxado pela demanda de quem foi empurrado pra base da pirâmide de preço. O **VW Fox (+1,39%)** segue a mesma lógica de popular antigo com procura firme, vale lembrar que o Fox já tinha aparecido no topo em junho e no fundo em julho, um modelo que oscila forte mês a mês.\n\nJá o **Toyota Corolla (+0,51%)** é o ponto fora da curva: um sedã médio, não um popular de entrada, mantendo valorização positiva num mês em que o índice geral foi negativo. Reforça a reputação da marca de segurar valor de revenda mesmo em ciclo de desaceleração.',
      },
      {
        type: 'heading',
        heading: 'Os modelos que mais perderam em agosto',
        text: 'A maior queda foi do **Ford Ka (-2,27%)**. A Ford encerrou a produção no Brasil em 2021, e um modelo descontinuado sem reposição de peças nova tende a perder valor de forma mais acelerada conforme envelhece, sem um zero-km equivalente para ancorar o preço do usado.\n\nO **Fiat Mobi (-2,06%)** é o dado mais estrutural da lista: hatch de entrada relativamente recente, sofrendo pressão direta da onda de populares chineses (BYD Dolphin Mini, GWM) que chegou com preço agressivo. Já o **VW T-Cross (-1,66%)** fechando o trio é o alerta que interessa a quem tem SUV compacto: mesmo um modelo em linha ainda ativo já sente a mesma pressão que os populares, sinal de que a queda não fica restrita à base da pirâmide.',
      },
      {
        type: 'heading',
        heading: 'Por estado: Piauí corrige a queda de julho, Roraima vira a lanterna',
        text: 'No mês, **19 dos 27 estados subiram e 8 caíram**, uma contagem bruta melhor do que a de julho, mesmo com o índice nacional fechando negativo (as quedas, concentradas em poucos estados, pesaram mais que as altas espalhadas). O **Piauí liderou com +1,27%**, uma reversão completa depois de ter sido a maior queda de julho (-1,08%): o tipo de correção que acontece quando um mercado local cai rápido demais e devolve parte da perda. **Distrito Federal (+1,12%)** e **Mato Grosso (+1,06%)** vêm na sequência.\n\nNa ponta oposta, **Roraima teve a maior queda do mês (-0,88%)**, revertendo a leve queda de julho (-0,19%) para um recuo bem mais forte. **Amapá (-0,83%)** e **Rio Grande do Sul (-0,74%)** completam o trio negativo.',
      },
      {
        type: 'image',
        src: '/images/ibv/agosto-2026/variacao-por-uf.png',
        alt: 'Gráfico de barras da variação mensal por estado em agosto de 2026, com Piauí no topo e Roraima no fundo',
        caption: 'Agosto: Piauí lidera com +1,27%, Roraima cai -0,88%. Fonte dos dados: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'O que une os vencedores e o que separa os perdedores',
        text: 'Os vencedores de agosto (Uno, Fox, Corolla) não têm um fio condutor único: dois são populares de entrada muito antigos, um é um sedã médio consolidado. O que os une é ausência de concorrência direta recente, nenhum dos três compete de frente com o volume de lançamento chinês que pressiona o mercado.\n\nJá os perdedores (Ka, Mobi, T-Cross) têm uma lógica mais clara: Ka é descontinuado sem reposição; Mobi e T-Cross competem direto com a onda de SUVs e hatches compactos chineses que chegou com preço agressivo no zero-km. É a mesma dinâmica que já vimos pressionando o Jeep Compass em meses anteriores, agora alcançando modelos de ticket menor.',
      },
      {
        type: 'image',
        src: '/images/ibv/agosto-2026/variacao-por-uf-acumulado.png',
        alt: 'Gráfico de barras com a variação acumulada em 12 meses por estado até agosto de 2026, Rio de Janeiro na liderança',
        caption: 'Variação acumulada em 12 meses por estado até agosto de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Líderes em 12 meses: Rio de Janeiro assume a ponta',
        text: 'No acumulado de 12 meses até agosto:\n\n- Rio de Janeiro: +6,28%\n- Sergipe: +6,18%\n- Mato Grosso: +6,15%\n\nNa ponta menor: Santa Catarina (+3,20%) e São Paulo (+3,33%), os dois mercados mais líquidos do país, onde a oferta maior mantém o preço do usado mais contido. O Brasil em 12 meses está em +5,12%, desacelerando frente aos +6,10% de julho.',
      },
      {
        type: 'highlight',
        heading: 'Como usar essa informação',
        text: 'Se você tem Uno, Fox ou Corolla, agosto foi um mês favorável para vender. Se tem Ford Ka, a ausência de zero-km equivalente tende a manter a pressão de queda; não há razão estrutural para o cenário virar. Se tem Mobi ou T-Cross, a concorrência chinesa deve continuar pressionando, considerar vender agora, antes de mais perda. No mapa, quem vende em Roraima, Amapá ou Rio Grande do Sul pega o mercado local em queda no mês; quem vende no Rio, Sergipe ou Mato Grosso ainda surfa o acumulado de 12 meses mais forte do país.',
      },
      {
        type: 'cta',
        text: 'Quer saber o valor atualizado do seu carro pela placa, com histórico de leilão incluído?',
        ctaLabel: 'Consultar Placa Grátis',
        ctaTo: '/',
      },
    ],
  },
  {
    slug: 'eletricos-agosto-2026',
    title: 'Elétricos Usados Agosto 2026: o tombo de 50% já aconteceu, agora a queda estabilizou',
    seoTitle: 'Elétricos Usados Agosto 2026: Queda de 50% Estabiliza',
    metaDescription: 'Elétricos usados em agosto: pelo IBV Auto, os de 2022 acumulam -50,1% contra -14,1% da combustão. Na FIPE, em 12 meses, os dois caíram igual: -2,3%.',
    publishedAt: '2026-09-04',
    source: 'Banco BV (IBV Auto) + análise PlacaCompleta',
    referenceMonth: 'Agosto 2026',
    ogTitle: 'Elétrico 2022 já perdeu metade do valor. O combustão equivalente, 14%.',
    ogHighlight: '-50,1%',
    content: [
      {
        type: 'intro',
        text: 'O relatório de agosto do Banco BV trouxe um número que resume o problema de quem comprou elétrico chinês 0km em 2022: a desvalorização acumulada já chegou a **-50,1%**. Metade do valor, em menos de 4 anos. O combustão equivalente do mesmo ano-modelo perdeu **-14,1%** no mesmo período. A diferença não é sutil, é de mais de 3 vezes.',
      },
      {
        type: 'heading',
        heading: 'O tamanho da diferença, por ano-modelo',
        text: 'A desvalorização acumulada até agosto de 2026, segundo o Banco BV, por ano-modelo e tipo de propulsão:\n\n- **Modelos 2023:** Elétricos -46,15% | Híbridos -26,36% | Combustão -21,72%\n- **Modelos 2022:** Elétricos -50,10% | Híbridos -22,59% | Combustão -14,07%\n- **Modelos 2021:** Híbridos -17,47% | Combustão -6,49% (sem elétrico 2021 nessa cesta)\n\nEm todos os anos-modelo com dado disponível, a ordem é sempre a mesma: elétrico perde mais que híbrido, híbrido perde mais que combustão. Na safra 2022, a distância é a maior de todas: o elétrico perdeu **3,6 vezes mais valor proporcional** do que o combustão equivalente.',
      },
      {
        type: 'image',
        src: '/images/ibv/agosto-2026/desvalorizacao-2022.png',
        alt: 'Gráfico de barras comparando a desvalorização acumulada de elétricos, híbridos e combustão para modelos 2022 até agosto de 2026',
        caption: 'Elétricos 0km de 2022 perderam metade do valor de tabela. Fonte dos dados: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Por que o elétrico chinês perde tanto valor',
        text: 'A explicação apontada pelo próprio Banco BV não é sobre a tecnologia em si: é sobre o preço do zero-km. A entrada agressiva de BYD, GWM e outras montadoras chinesas no Brasil, com guerra de preço constante nos modelos novos, empurra o valor do 0km pra baixo mês a mês, e, como o usado se referencia no preço do novo equivalente, o efeito cascateia direto pra quem já comprou.\n\nQuem pagou o preço de lançamento em 2022, antes da guerra de preço se intensificar, é quem mais sente: o carro dele compete no usado com um 0km cada vez mais barato do mesmo modelo (ou um substituto ainda mais barato). O combustão não tem esse problema na mesma escala porque o zero-km a combustão não caiu de preço no mesmo ritmo, ficou até mais caro em termos reais em boa parte do período.',
      },
      {
        type: 'heading',
        heading: 'O tombo já aconteceu. E agora?',
        text: 'A pergunta que fica depois do número acumulado é: essa sangria continua, ou já parou de piorar? Pra responder, cruzamos o dado do Banco BV (acumulado desde o lançamento) com um levantamento próprio na tabela FIPE, medindo só os **últimos 12 meses**, comparando sempre o mesmo ano-modelo ao longo do tempo (sem misturar safras diferentes, o erro mais comum nesse tipo de conta).\n\nO resultado muda a leitura: nos últimos 12 meses, a média de variação de 6 elétricos/híbridos chineses (BYD Dolphin, Dolphin Mini, Seal, Song Plus, GWM Haval H6 híbrido e Ora 03) ficou em **-2,3%**, exatamente empatada com a média de 6 combustão equivalentes (Corolla Cross, Compass, T-Cross, HB20, Pulse e Onix), também em **-2,3%**. Ou seja: o tombo grande dos elétricos já aconteceu, majoritariamente entre 2023 e 2025, puxado pela queda de preço do 0km chinês. Nos últimos 12 meses, elétrico e combustão desvalorizaram praticamente igual.',
      },
      {
        type: 'heading',
        heading: 'O que não estabilizou: a dispersão entre modelos',
        text: 'Empate na média não quer dizer que ficou tudo igual. Levantamento PlacaCompleta (tabela FIPE): entre os elétricos, a variação de 12 meses foi de **+1,4% (BYD Dolphin Mini, o único que não perdeu valor) a -8,0% (GWM Ora 03, o pior)**. Entre os combustão, o intervalo foi bem mais estreito: de **-0,3% (Toyota Corolla Cross) a -3,6% (VW T-Cross)**.\n\nNo combustão, a categoria já protege um pouco: todo modelo desvaloriza de forma parecida. No elétrico chinês, não. Escolher o modelo certo pesa muito mais no bolso do que escolher "elétrico" em si, a diferença entre acertar e errar o modelo é de quase 10 pontos percentuais.',
      },
      {
        type: 'image',
        src: '/images/ibv/agosto-2026/desvalorizacao-2023.png',
        alt: 'Gráfico de barras comparando a desvalorização acumulada de elétricos, híbridos e combustão para modelos 2023 até agosto de 2026',
        caption: 'Modelos 2023: elétrico perde mais que o dobro do combustão equivalente. Fonte dos dados: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'O que isso significa pra quem tem, ou quer comprar',
        text: 'Para quem já tem um elétrico chinês 2022, a notícia ruim já aconteceu: metade do valor já foi embora, e segurar o carro esperando recuperação não tem base nos dados até aqui. Para quem está pensando em COMPRAR um elétrico usado, o quadro é oposto: um desconto de 50% sobre o valor de tabela original é uma oportunidade real, desde que a bateria esteja auditada e a garantia ainda cubra o carro.\n\nRecomendações práticas antes de fechar negócio:\n\n1. **Auditar o estado de saúde da bateria (SoH)** antes de qualquer coisa. Abaixo de 85% é sinal de alerta.\n2. **Confirmar a garantia de bateria e se ela transfere** para o segundo dono.\n3. **Considerar que o desconto de tabela não é desconto real** se o carro tiver histórico de sinistro, restrição ou passagem por leilão, isso pesa tanto quanto (ou mais que) a desvalorização de mercado. Vale conferir o histórico completo antes de fechar.',
      },
      {
        type: 'highlight',
        heading: 'O que esperar dos próximos meses',
        text: 'A leitura mais honesta dos dois levantamentos juntos: o estrago grande já foi feito entre 2023 e 2025, e nos últimos 12 meses o ritmo de queda do elétrico chinês se igualou ao do combustão. Isso não é recuperação, é estabilização num patamar já bem mais baixo. Enquanto a guerra de preço no 0km chinês continuar, modelos específicos ainda podem sofrer puxadas fortes (como o Ora 03, -8,0% em 12 meses) mesmo com a média do grupo estabilizada. Pra quem decide comprar ou vender, o modelo importa mais do que a categoria. Para uma leitura do mercado de usados como um todo, veja a [análise completa do IBV Auto de agosto](/ibv/agosto-2026).',
      },
      {
        type: 'cta',
        text: `Comprando um usado, elétrico ou não? Consulte a placa antes: histórico de leilão, restrição e indicador de sinistro, numa base com ${BASE_LEILAO_TEXTO}.`,
        ctaLabel: 'Consultar Placa Grátis',
        ctaTo: '/',
      },
    ],
  },
  {
    slug: 'julho-2026',
    title: 'IBV Auto Julho 2026: Preços de usados quase param (+0,07%) e 16 dos 27 estados caem',
    seoTitle: 'IBV Auto Julho 2026: Usados Quase Param e 16 Estados Caem',
    metaDescription: 'IBV Auto de julho desacelera para +0,07%, o menor avanço de 2026, ante +0,57% em junho. Pela primeira vez no ano, 16 dos 27 estados fecham em queda.',
    publishedAt: '2026-08-06',
    source: 'Banco BV (IBV Auto)',
    referenceMonth: 'Julho 2026',
    ogTitle: 'Usados quase param em julho: +0,07%. E 16 estados já caem.',
    ogHighlight: '+0,07%',
    content: [
      {
        type: 'intro',
        text: 'O Índice BV Auto (IBV) de julho de 2026 praticamente estacionou: alta de apenas **0,07%** sobre junho. É o menor avanço mensal de todo o ano de 2026 e um freio brusco frente aos +0,57% de junho. Depois de três meses acelerando (abril +0,27%, maio +0,43%, junho +0,57%), o mercado de usados desacelerou de uma vez. E há um dado que o número nacional esconde: pela **primeira vez em 2026, a maioria dos estados fechou em queda** — 16 dos 27. O Brasil só ficou no positivo porque as poucas altas foram concentradas e um pouco maiores que as quedas.',
      },
      {
        type: 'image',
        src: '/images/ibv/julho-2026/desaceleracao-mensal.png',
        alt: 'Gráfico de barras com a variação mensal do IBV Auto de jan/25 a jul/26, destacando o freio de julho em +0,07%',
        caption: 'A barra de julho é a menor de toda a série de 2026. Fonte dos dados: Banco BV (IBV Auto). Gráfico: PlacaCompleta.',
      },
      {
        type: 'heading',
        heading: 'O freio de julho: um mercado quase de lado',
        text: 'Um índice de +0,07% em um mês significa, na prática, preços de lado. Um usado que valia R$ 60 mil no fim de junho vale R$ 60.042 no fim de julho: variação que se perde no arredondamento de qualquer anúncio. Depois de um primeiro semestre forte, o mercado deu uma pausa clara.\n\nO que trava um índice desses não é uma queda generalizada, e sim o equilíbrio entre forças opostas. Em julho, 11 estados ainda subiram e 16 caíram; as altas por acaso pesaram um pouco mais, e o resultado nacional ficou levemente positivo. Não é um mercado em queda. É um mercado que perdeu o fôlego da alta e ainda não decidiu o próximo passo.',
      },
      {
        type: 'image',
        src: '/images/ibv/julho-2026/variacao-estados.png',
        alt: 'Gráfico de barras da variação mensal por estado em julho de 2026, com 16 estados no vermelho e Amapá liderando a alta',
        caption: 'Julho inverteu o quadro de junho: de zero estados no vermelho para 16. Fonte dos dados: Banco BV (IBV Auto). Gráfico: PlacaCompleta.',
      },
      {
        type: 'heading',
        heading: 'A virada regional: Sul e Centro-Oeste seguram, Nordeste puxa pra baixo',
        text: 'Em junho, os 27 estados subiram juntos. Em julho, o mapa se partiu. Só duas das cinco grandes regiões terminaram no positivo: **Centro-Oeste (+0,29%)** e **Sul (+0,22%)**. O Sudeste ficou praticamente zerado (-0,01%), e Norte (-0,07%) e **Nordeste (-0,19%)** fecharam no vermelho.\n\nNos estados, o **Amapá liderou com +0,71%** e o **Piauí foi o fundo do poço com -1,08%** — quase 1,8 ponto percentual separando o topo do último. Chama atenção que o Piauí, que estava entre os que mais subiam no primeiro semestre, tenha virado a maior queda do mês. É o tipo de correção que costuma acontecer quando um mercado local sobe rápido demais e depois devolve parte do ganho.',
      },
      {
        type: 'heading',
        heading: 'Cruzamento exclusivo: onde o carro valoriza x onde o seguro é caro',
        text: 'Aqui entra uma leitura que só conseguimos fazer porque juntamos os dados do IBV com a nossa própria análise de seguro por estado (base SUSEP corrigida pelo IPCA). A pergunta natural é: o carro valoriza mais justamente onde é mais caro de segurar? A resposta, medida estado a estado, é **não**. A correlação entre valorização em 12 meses e prêmio médio de seguro é de apenas 0,12 — estatisticamente, quase nenhuma. São duas dimensões independentes.\n\nMas o cruzamento revela um caso específico e real: o **Rio de Janeiro junta as duas pontas ruins pro bolso do dono**. É dos estados onde o usado mais segura valor (+7,65% em 12 meses, você paga caro pra comprar) E, ao mesmo tempo, tem o seguro mais caro do país (R$ 2.615/ano na nossa cesta de populares). O oposto é São Paulo: valoriza o menos entre todos (+4,46% em 12 meses, ou seja, é mais fácil comprar barato) e tem seguro apenas mediano. Comprar em SP e segurar em SP é, na média, o combo mais leve pro bolso.',
      },
      {
        type: 'image',
        src: '/images/ibv/julho-2026/valorizacao-x-seguro.png',
        alt: 'Gráfico de dispersão cruzando valorização do usado em 12 meses (IBV) com seguro médio por estado (análise PlacaCompleta), destacando o Rio de Janeiro no canto de maior valorização e maior seguro',
        caption: 'Cada ponto é um estado. Valorizar e ser caro de segurar são coisas independentes (correlação 0,12); o Rio, em vermelho, é a exceção que junta as duas. Fontes: Banco BV (IBV Auto) e análise SUSEP/IPCA do PlacaCompleta.',
      },
      {
        type: 'heading',
        heading: '12 meses e acumulado do ano: o quadro ainda é de alta',
        text: 'O freio de julho é um dado de curto prazo. Na janela mais longa, o mercado de usados segue valorizado. No **acumulado de 12 meses o IBV está em +6,10%**, com **Minas Gerais (+7,66%) e Rio de Janeiro (+7,65%) empatados na liderança**, seguidos pelo Rio Grande do Sul (+6,51%). Na outra ponta, Pará (+4,14%), Mato Grosso (+4,37%) e São Paulo (+4,46%) valorizaram menos.\n\nNo **acumulado de 2026 (janeiro a julho), o índice sobe +3,56%** — ritmo ainda saudável, mas que agora depende do segundo semestre para não perder força. Julho foi o primeiro sinal amarelo do ano.\n\nO detalhe por modelo confirma o clima de indecisão: segundo o resumo divulgado pelo próprio Banco BV, GM Celta (+2,62%), Fiat Palio (+2,20%) e Nissan Kicks (+1,92%) puxaram as altas, enquanto VW Fox (-2,01%), Jeep Compass (-1,74%) e GM Onix (-1,11%) lideraram as quedas. Analisamos modelo por modelo, estado por estado, no post [Vencedores e Perdedores de julho](/ibv/vencedores-perdedores-julho-2026).',
      },
      {
        type: 'highlight',
        heading: 'O que isso significa para você?',
        text: 'Se você está pensando em vender, o recado é de urgência moderada: a onda de valorização do primeiro semestre perdeu força em julho, e esperar mais pode não render o ganho que rendia até junho. Se você está comprando, o freio joga a seu favor: a pressão de alta afrouxou e, em 16 estados, os preços até recuaram no mês. Se você é do Piauí, Nordeste ou Norte, o momento local é claramente de queda; se é de MG, RJ ou RS, seu carro ainda vale bem no acumulado do ano. E se você tem elétrico, vale ver nossa [análise dedicada de julho](/ibv/eletricos-julho-2026): o quadro mudou de forma interessante.',
      },
      {
        type: 'cta',
        text: 'Quer saber quanto vale o seu carro pela placa, com a FIPE atualizada?',
        ctaLabel: 'Consultar Placa Grátis',
        ctaTo: '/',
      },
    ],
  },
  {
    slug: 'vencedores-perdedores-julho-2026',
    title: 'Vencedores e Perdedores de Julho 2026: Celta reaparece no topo, Fox despenca e 16 estados caem',
    seoTitle: 'IBV Julho 2026: Celta Volta ao Topo e Fox Despenca',
    metaDescription: 'Vencedores e perdedores de julho no IBV Auto: Celta +2,62%, Palio +2,20% e Kicks +1,92% sobem; Fox -2,01% e Compass -1,74% caem. Amapá lidera (+0,71%).',
    publishedAt: '2026-08-06',
    source: 'Banco BV (IBV Auto)',
    referenceMonth: 'Julho 2026',
    ogTitle: 'Vencedores e perdedores de julho: Celta volta, Fox despenca.',
    ogHighlight: 'Julho',
    content: [
      {
        type: 'intro',
        text: 'O IBV Auto de julho fechou quase de lado para o Brasil (+0,07%), mas nos extremos o mês teve movimento. Pelo resumo divulgado pelo Banco BV, o **GM Celta subiu 2,62%** e o **VW Fox caiu 2,01%** — quase 4,7 pontos percentuais entre o topo e o fundo. Duas viradas chamam atenção: o Fox, que vinha de valorização forte em junho (+2,53%), virou a maior queda de julho; e o clássico Celta reapareceu na liderança das altas, sinal do apetite por popular barato de entrada.',
      },
      {
        type: 'heading',
        heading: 'Os modelos que mais valorizaram em julho',
        text: 'O **GM Celta (+2,62%)** no topo diz muito sobre o momento. É um carro fora de linha desde 2015, de baixíssimo valor de entrada, e quando ele lidera a valorização o recado é de demanda empurrada para a base da pirâmide: quem foi expulso do zero-km e do seminovo mais caro procura o usado mais barato que ainda roda bem. É o mesmo fenômeno que colocou Kwid e Fox no topo em meses anteriores.\n\nO **Fiat Palio (+2,20%)** segue a mesma lógica de popular de baixo custo com demanda firme. Já o **Nissan Kicks (+1,92%)** é o ponto fora da curva positivo: um SUV compacto num pódio dominado por populares de entrada. A alta do Kicks sugere que o segmento de SUV de entrada seminovo encontrou um piso e voltou a ter procura, depois de meses de pressão.',
      },
      {
        type: 'heading',
        heading: 'Os modelos que mais perderam em julho',
        text: 'A maior queda foi do **VW Fox (-2,01%)**, e ela é quase um espelho do mês anterior. Em junho, o Fox foi a segunda maior ALTA do país (+2,53%); em julho, a maior queda. Movimento clássico de correção: subiu demais, devolveu parte. Para quem tem um Fox e não vendeu na alta de junho, o momento ideal passou.\n\nO **Jeep Compass (-1,74%)** é o dado mais estrutural da lista. SUV médio de ticket alto, ele sofre com a pressão dos SUVs chineses (BYD Song, Chery Tiggo) e com a chegada de novas gerações híbridas que tornam o Compass a combustão menos desejado no usado. Não é correção pontual; é tendência de segmento.\n\nO **GM Onix (-1,11%)** fechando o trio negativo é o sinal mais importante para o índice como um todo. O Onix é o carro mais vendido do Brasil: quando ele cai, puxa o IBV inteiro. A queda de julho ajuda a explicar por que o número nacional praticamente parou, mesmo com Celta e Palio subindo forte.',
      },
      {
        type: 'heading',
        heading: 'Por estado: a virada que o número nacional esconde',
        text: 'Se em junho os 27 estados subiram juntos, julho fez o oposto: **16 dos 27 fecharam em queda**. O **Amapá liderou com +0,71%** e o **Piauí despencou -1,08%**, a maior queda do mês. É uma reviravolta e tanto para o Piauí, que estava entre os estados que mais valorizavam no primeiro semestre — exatamente o tipo de mercado que sobe rápido e depois corrige.\n\nNo agregado regional, só o **Centro-Oeste (+0,29%)** e o **Sul (+0,22%)** seguraram a alta. O **Nordeste (-0,19%)** foi a região que mais recuou, com Norte (-0,07%) e Sudeste (praticamente zero, -0,01%) no meio do caminho. É a geografia da desaceleração: o interior produtor do Centro-Oeste e do Sul ainda sustenta preço, enquanto Nordeste e Norte já entraram em correção.',
      },
      {
        type: 'image',
        src: '/images/ibv/julho-2026/variacao-estados.png',
        alt: 'Gráfico de barras da variação mensal por estado em julho de 2026, com 16 estados no vermelho, Amapá no topo (+0,71%) e Piauí no fundo (-1,08%)',
        caption: 'Julho: 16 estados em queda. Amapá no topo, Piauí no fundo. Fonte dos dados: Banco BV (IBV Auto). Gráfico: PlacaCompleta.',
      },
      {
        type: 'heading',
        heading: 'Cruzamento exclusivo: valorização x custo de seguro por estado',
        text: 'Aqui vai uma leitura que só o PlacaCompleta pode publicar, porque junta os dados do IBV com a nossa análise de seguro por estado (base SUSEP corrigida pelo IPCA). Cruzando os 27 estados, **não existe relação clara entre valorizar e ser caro de segurar** — a correlação é de meros 0,12. Ou seja, escolher um estado achando que "onde valoriza é onde o seguro pesa" não se sustenta nos números.\n\nCom uma exceção que salta aos olhos: o **Rio de Janeiro reúne as duas piores pontas pro dono**. Lidera a valorização em 12 meses (+7,65%, ou seja, você paga caro pra comprar) e tem, ao mesmo tempo, o seguro mais caro do país (R$ 2.615/ano na nossa cesta de populares). No extremo oposto está **São Paulo**: a menor valorização do país em 12 meses (+4,46%, mais fácil comprar barato) combinada com seguro apenas mediano. Para quem tem flexibilidade de onde comprar e emplacar, o dado é concreto: SP é o combo mais leve, o Rio o mais pesado.',
      },
      {
        type: 'image',
        src: '/images/ibv/julho-2026/valorizacao-x-seguro.png',
        alt: 'Gráfico de dispersão cruzando valorização do usado em 12 meses com seguro médio por estado, com o Rio de Janeiro destacado no canto de maior valorização e maior seguro',
        caption: 'Cada ponto é um estado. O Rio (vermelho) é a exceção que junta alta valorização e seguro caro. Fontes: Banco BV (IBV Auto) e análise SUSEP/IPCA do PlacaCompleta.',
      },
      {
        type: 'heading',
        heading: 'Líderes em 12 meses: MG e RJ empatam na frente',
        text: 'No acumulado de 12 meses até julho, a hierarquia é de empate no topo:\n\n- Minas Gerais: +7,66%\n- Rio de Janeiro: +7,65%\n- Rio Grande do Sul: +6,51%\n\nMG e RJ tecnicamente empatados, separados por 1 centésimo. Na ponta menor: Pará (+4,14%), Mato Grosso (+4,37%) e São Paulo (+4,46%). SP entre os últimos, de novo, reflete o mercado paulista mais líquido e concorrido, que segura os preços do usado para baixo — bom para quem compra, menos bom para quem vende. O IBV do Brasil em 12 meses está em +6,10%.',
      },
      {
        type: 'highlight',
        heading: 'Como usar essa informação',
        text: 'Se você tem Celta, Palio ou Kicks, julho foi um bom mês e o momento de venda segue favorável. Se tem VW Fox, a janela boa foi junho: ele já virou pra queda. Se tem Jeep Compass ou Onix, a pressão é real e tende a continuar; adiar a venda tem custo. No mapa, quem vende no Piauí, Nordeste ou Norte pega o mercado local em correção; quem vende em MG, RJ ou RS ainda surfa o acumulado de 12 meses. E se você compra e segura o carro, lembre do combo: SP pesa menos no total, o Rio pesa mais. Para elétricos, veja o [post dedicado de julho](/ibv/eletricos-julho-2026).',
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
    slug: 'eletricos-julho-2026',
    title: 'Elétricos Usados Julho 2026: pela primeira vez o elétrico para de piorar (e é a combustão que acelera a perda)',
    seoTitle: 'Elétricos Usados Julho 2026: Desvalorização Estabiliza',
    metaDescription: 'Elétricos usados em julho: o IBV Auto mostra a desvalorização estável (2023 em -46,1%, 2022 em -50,1%) enquanto a combustão acelera as perdas.',
    publishedAt: '2026-08-06',
    source: 'Banco BV (IBV Auto) + análise PlacaCompleta',
    referenceMonth: 'Julho 2026',
    ogTitle: 'Vira o jogo: o elétrico usado para de piorar e a combustão acelera a queda.',
    ogHighlight: '-46,1%',
    content: [
      {
        type: 'intro',
        text: 'Desde que começamos a acompanhar o mercado de elétricos usados, a história foi sempre a mesma: elétrico desvaloriza muito mais que combustão, e piora todo mês. Os dados do IBV Auto de julho de 2026 trazem, pela primeira vez, uma virada nessa narrativa. O elétrico usado **parou de piorar** — e quem passou a acelerar a perda de valor foi o **carro a combustão**. A distância entre as duas propulsões, que só aumentava, começou a encolher. Não porque o elétrico se recuperou, mas porque a combustão finalmente começou a devolver o valor que tinha segurado.',
      },
      {
        type: 'heading',
        heading: 'O panorama de julho: elétrico estável, combustão piorando',
        text: 'A foto agregada do Banco BV em julho de 2026, por ano-modelo:\n\n- **Modelos 2023:** Elétricos -46,1% | Híbridos -26,8% | Combustão -21,4%\n- **Modelos 2022:** Elétricos -50,1% | Híbridos -18,9% | Combustão -15,6%\n- **Modelos 2021:** Híbridos -14,6% | Combustão -4,5%\n\nO que muda em relação a junho é o **vetor**, não o patamar. Nos modelos 2023, o elétrico ficou praticamente parado (estava -46,1% em junho, segue -46,1%), enquanto o combustão piorou de -19,6% para -21,4%, quase 2 pontos de perda em um único mês. Nos modelos 2022, o elétrico até melhorou de leve (de -50,5% para -50,1%) e o combustão de novo piorou (de -13,2% para -15,6%). O híbrido, no meio, seguiu estável ou recuperando.\n\nÉ a primeira vez que vemos esse padrão: as três categorias convergindo, com o elétrico parando de cair e o combustão indo buscá-lo.',
      },
      {
        type: 'image',
        src: '/images/ibv/julho-2026/desvalorizacao-combustivel.png',
        alt: 'Gráfico de barras comparando a desvalorização acumulada de elétricos, híbridos e combustão para os modelos 2022 e 2023 até julho de 2026',
        caption: 'Elétrico usado ainda perde cerca de 2x mais que o combustão equivalente, mas em julho a distância parou de crescer. Fonte dos dados: Banco BV. Gráfico: PlacaCompleta.',
      },
      {
        type: 'heading',
        heading: 'Por que a combustão começou a cair mais rápido',
        text: 'A explicação mais provável é de mercado, não de tecnologia. Ao longo de 2024 e 2025, o combustão usado se manteve caro porque o zero-km ficou escasso e careiro: quem não achava carro novo migrava para o seminovo a combustão e segurava o preço dele. Em 2026, com a oferta de zero-km normalizando e o próprio índice geral desacelerando (o IBV de julho subiu só +0,07%), essa demanda represada afrouxou. O combustão, que estava artificialmente firme, começou a corrigir.\n\nO elétrico, por outro lado, já havia feito a maior parte do estrago. Depois de perder perto de metade do valor em 3 anos, chegou num piso onde o desconto já é grande o bastante para atrair comprador. É o comportamento típico de um ativo que despencou: em algum momento fica barato demais para continuar caindo.',
      },
      {
        type: 'heading',
        heading: 'A janela de compra do elétrico usado ficou ainda melhor',
        text: 'Para quem quer comprar, o quadro de julho reforça a tese que defendemos desde o início: **é a melhor janela do mercado brasileiro de elétricos**. Um modelo 2022 que perdeu 50% do valor de tabela custa hoje metade do que custou zero, e agora com um agravante favorável ao comprador: o preço parou de cair, então o risco de comprar hoje e ver desvalorizar amanhã diminuiu.\n\nAs recomendações práticas seguem valendo:\n\n1. **Auditar a bateria antes de fechar.** Estado de saúde (SoH) abaixo de 85% é sinal amarelo. Concessionárias autorizadas fazem o teste por custo baixo.\n2. **Confirmar a garantia de bateria.** Boa parte das marcas dá 8 anos; um carro de 2-3 anos ainda tem folga grande de cobertura. Verifique se transfere para o segundo dono.\n3. **Preferir modelos com plataforma compartilhada** com uma versão a combustão (peças e manutenção mais acessíveis).\n4. **Contar o seguro na conta.** O prêmio de um elétrico costuma ser mais alto que o de um combustão equivalente por causa do custo de reparo da bateria. Veja nossas estimativas de [seguro de carro elétrico por estado](/seguro/carro-eletrico) antes de decidir; o valor muda bastante conforme a UF.',
      },
      {
        type: 'heading',
        heading: 'Vendendo elétrico usado: a urgência afrouxou (um pouco)',
        text: 'Este é o primeiro mês em que não repetimos o velho conselho de "venda o quanto antes, a qualquer custo". Com o preço do elétrico estabilizando, a pressão de perder valor a cada 30 dias diminuiu. Isso não significa que voltou a valorizar — significa que a sangria mensal parou. Se você tem um elétrico 2022 ou 2023, dá para respirar e escolher melhor o momento e o comprador, em vez de aceitar a primeira oferta com medo da próxima queda.\n\nA ressalva: o patamar de perda continua alto (perto de -50% para a safra 2022). Estabilizar em -50% não é bom, é apenas menos ruim do que continuar caindo. E o vetor pode mudar de novo se a BYD, a GWM e a Chery retomarem a guerra de preços no zero-km, o que arrastaria a média do usado para baixo outra vez.',
      },
      {
        type: 'highlight',
        heading: 'O que esperar dos próximos meses',
        text: 'Nossa leitura para os próximos 90 dias: o elétrico deve seguir estável ou cair muito de leve, e o combustão deve continuar corrigindo enquanto o mercado geral desacelera. Se esse movimento se mantiver, a distância entre as duas propulsões vai continuar encolhendo — não porque o elétrico virou bom negócio de revenda, mas porque a combustão perdeu o prêmio de escassez que a segurava. Para o comprador de elétrico, é a confirmação de que dá para agir com mais calma. Para uma leitura do mercado inteiro, veja a [análise completa do IBV Auto de julho](/ibv/julho-2026).',
      },
      {
        type: 'cta',
        text: 'Quer saber o valor FIPE atualizado do seu carro pela placa?',
        ctaLabel: 'Consultar Placa Grátis',
        ctaTo: '/',
      },
    ],
  },
  {
    slug: 'seguro-mais-caro-brasil-2026',
    title: 'As 5 regiões com seguro de carro mais caro do Brasil (e as 5 mais baratas)',
    seoTitle: 'Seguro de Carro Mais Caro do Brasil: 5 Regiões em 2026',
    metaDescription: 'Seguro de carro mais caro do Brasil: comparamos Onix, HB20, Gol, Strada e Corolla nas 41 regiões, com dados SUSEP corrigidos pelo IPCA. Spread de 87%.',
    publishedAt: '2026-07-24',
    source: 'SUSEP (base R_AUTO) + IPCA/IBGE',
    referenceMonth: 'Julho 2026',
    ogTitle: 'Onde o seguro é mais caro no Brasil',
    ogHighlight: '+87%',
    content: [
      {
        type: 'intro',
        text: 'O mesmo carro, com o mesmo condutor, pode pagar quase o dobro de seguro dependendo de onde ele dorme. Compilamos o seguro médio anual de uma cesta de 5 populares (Chevrolet Onix, Hyundai HB20, VW Gol, Fiat Strada e Toyota Corolla) nas **41 regiões de tarifação** usadas pelas seguradoras, a partir de dados oficiais da SUSEP corrigidos pela inflação do seguro medida pelo IBGE. O resultado: **87% de diferença** entre a região mais cara e a mais barata do país.',
      },
      { type: 'heading', heading: 'As 5 regiões com seguro mais CARO' },
      {
        type: 'paragraph',
        text: '1. **Grande Rio de Janeiro**: R$ 2.615/ano\n2. **Amapá**: R$ 2.498/ano\n3. **Roraima**: R$ 2.421/ano\n4. **Maranhão**: R$ 2.380/ano\n5. **Pará**: R$ 2.353/ano',
      },
      {
        type: 'paragraph',
        text: 'O Rio metropolitano no topo não surpreende ninguém: índice de roubo e furto de veículos historicamente entre os maiores do país, densidade de tráfego e custo de reparo elevado. A surpresa é o **Norte dominando o restante do pódio**. Amapá, Roraima e Pará combinam três fatores que encarecem o risco: logística cara de peças (tudo chega de longe), rede menor de oficinas referenciadas e frota segurada pequena, o que dilui menos o risco entre os segurados.',
      },
      { type: 'heading', heading: 'As 5 regiões com seguro mais BARATO' },
      {
        type: 'paragraph',
        text: '1. **Ribeirão Preto e demais municípios de SP**: R$ 1.398/ano\n2. **Oeste de Santa Catarina**: R$ 1.410/ano\n3. **Interior do Rio Grande do Sul**: R$ 1.469/ano\n4. **Espírito Santo**: R$ 1.498/ano\n5. **Blumenau e demais regiões de SC**: R$ 1.542/ano',
      },
      {
        type: 'paragraph',
        text: 'O padrão é claro: **interior do Sul e do Sudeste**. Menos roubo, trânsito mais leve, oficina mais barata. Um Onix que paga R$ 2,6 mil de seguro na Grande Rio custa R$ 1,4 mil no interior paulista — o mesmo carro, praticamente metade do preço.',
      },
      {
        type: 'highlight',
        text: 'A diferença entre a região mais cara (Grande Rio, R$ 2.615) e a mais barata (interior de SP, R$ 1.398) é de **87%**. Na prática, o CEP pesa tanto quanto o modelo na conta do seguro.',
      },
      { type: 'heading', heading: 'Metodologia' },
      {
        type: 'paragraph',
        text: 'Calculamos o prêmio médio anual de seguro compreensivo da cesta de populares (Onix, HB20, Gol, Strada e Corolla, anos-modelo 2020-2021) em cada uma das 41 regiões de tarifação da SUSEP, usando a base oficial de apólices R_AUTO. Os valores foram corrigidos pelo subitem "seguro voluntário de veículo" do IPCA/IBGE pra refletir preços de hoje. Estimativas estatísticas: o valor real do seu seguro depende do seu perfil e da cobertura.',
      },
      {
        type: 'paragraph',
        text: 'Quer saber o seguro médio do SEU carro na SUA região? Consulte a placa no PlacaCompleta e receba a estimativa por e-mail, ou veja o [seguro médio de carro elétrico por estado](/seguro/carro-eletrico).',
      },
      { type: 'cta', ctaLabel: 'Pedir cotação real gratuita', ctaTo: '/cotacao' },
    ],
  },
  {
    slug: 'abril-2026',
    title: 'IBV Auto Abril 2026: Preços de Usados Sobem 0,27%, Desaceleração Marca o Fim do Trimestre',
    seoTitle: 'IBV Auto Abril 2026: Usados Sobem 0,27% e Desaceleram',
    metaDescription: 'IBV Auto de abril desacelera para +0,27% (ante +0,71% em março). Celta +2,66% e Palio +1,47% puxam as altas; Fox -1,29% cai. Tocantins lidera com +1,97%.',
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
    seoTitle: 'IBV Abril 2026: Celta Dispara +2,66% e Fox Cai -1,29%',
    metaDescription: 'Vencedores e perdedores de abril no IBV Auto: Celta +2,66%, Palio +1,47% e Onix +0,57% sobem; Fox -1,29%, Nivus -1,00% e Gol -0,50% caem.',
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
    seoTitle: 'IBV Março 2026: Hilux SW4 Sobe +5,17% e Fiesta Cai',
    metaDescription: 'Vencedores e perdedores de março no IBV Auto: Hilux SW4 +5,17%, Corolla +1,03% e Onix +0,94% sobem; Fiesta -3,56%, HR-V -0,76% e Gol -0,66% caem.',
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
    title: 'IBV Auto Março 2026: Preços de Carros Usados Sobem 0,71%, Veja os Modelos e Estados que Mais Subiram',
    seoTitle: 'IBV Auto Março 2026: Preços de Carros Usados Sobem 0,71%',
    metaDescription: 'IBV Auto de março: preços de carros usados aceleram e sobem 0,71%. Veja os modelos e estados que puxaram a alta e o efeito no valor do seu carro.',
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
    title: 'IBV Auto Maio 2026: Usados sobem 0,43%, Kwid lidera altas e Onix Plus puxa quedas',
    seoTitle: 'IBV Auto Maio 2026: Usados Sobem 0,43% e Kwid Lidera',
    metaDescription: 'IBV Auto de maio acelera para +0,43% (ante +0,27% em abril). Kwid +4,58% e HR-V +1,85% lideram; Onix Plus -1,39% cai. Centro-Oeste sobe +0,99%.',
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
    seoTitle: 'IBV Maio 2026: Kwid Dispara +4,58% e Onix Plus Cai',
    metaDescription: 'Vencedores e perdedores de maio no IBV Auto: Kwid +4,58%, HR-V +1,85% e Gol +1,60% sobem; Onix Plus -1,39%, Mobi -1,14% e Uno -1,12% caem.',
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
  {
    slug: 'junho-2026',
    title: 'IBV Auto Junho 2026: Usados sobem 0,57% e todos os 27 estados fecham no positivo',
    seoTitle: 'IBV Auto Junho 2026: Usados Sobem 0,57% em Todo o País',
    metaDescription: 'IBV Auto de junho acelera para +0,57% e os 27 estados fecham no positivo. Kwid +3,52% e Fox +2,53% lideram as altas; o 1º semestre acumula +3,49%.',
    publishedAt: '2026-07-16',
    source: 'Banco BV (IBV Auto)',
    referenceMonth: 'Junho 2026',
    ogTitle: 'Usados sobem 0,57% em junho. Kwid dispara e Fox surpreende.',
    ogHighlight: '+0,57%',
    content: [
      {
        type: 'intro',
        text: 'O Índice BV Auto (IBV) de junho de 2026 mostra continuidade da aceleração observada em maio: alta de 0,57% sobre o mês anterior, ante +0,43% em maio e +0,27% em abril. É o terceiro mês consecutivo de aceleração, mas o índice segue abaixo da média do primeiro trimestre (+0,72%). No acumulado do primeiro semestre, os preços subiram 3,49%, quase o dobro dos 1,98% registrados no mesmo período de 2025. No acumulado de 12 meses, o IBV fechou junho em +6,87%, leve desaceleração frente aos 6,94% de maio.',
      },
      {
        type: 'image',
        src: '/images/ibv/junho-2026/variacao-mensal.png',
        alt: 'Gráfico de barras com variação mensal dos preços de automóveis leves usados de jan/25 a jun/26, mostrando +0,57% em junho/26',
        caption: 'Variação mensal do IBV Auto. Três meses consecutivos de aceleração após o piso de abril. Fonte: Banco BV (IBV Auto), julho/2026.',
      },
      {
        type: 'heading',
        heading: 'O que mudou em junho',
        text: 'O Renault Kwid continua no topo pelo segundo mês consecutivo, agora com +3,52% (era +4,58% em maio). Alta significativa e sustentada, difícil de explicar apenas por fatores de estoque. É pressão real de demanda no popular usado. A grande surpresa do mês foi o VW Fox: +2,53%. O Fox foi um dos maiores destaques de queda em abril (-1,29%), zerou em maio, e agora dispara. Movimento típico de mercado que corrigiu queda exagerada. O GM Onix voltou pra alta com +0,94% depois da queda de -0,36% em maio, retomando o padrão de 3 meses consecutivos que tinha antes.\n\nNa ponta negativa, virada nítida do Honda HR-V: em maio foi um dos três modelos que MAIS subiram (+1,85%), agora é a maior queda do mês (-1,21%). Correção da subida anterior. Junto vieram VW T-Cross (-1,12%), pressão contínua no segmento de SUV compacto que a VW enfrenta, e Hyundai HB20 (-0,44%), sinal de que a pressão no popular pode estar chegando aos líderes de vendas.',
      },
      {
        type: 'image',
        src: '/images/ibv/junho-2026/modelos-alta-baixa.png',
        alt: 'Modelos com maior alta e maior queda no IBV Auto junho 2026: Renault Kwid +3,52%, VW Fox +2,53%, GM Onix +0,94% nas altas; Honda HR-V -1,21%, VW T-Cross -1,12%, Hyundai HB20 -0,44% nas baixas',
        caption: 'Modelos de maior destaque positivo e negativo em junho de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Variação por região: Sudeste lidera e todos os 27 estados sobem',
        text: 'Nova inversão regional. Em maio, o Centro-Oeste liderou com +0,99%. Em junho, cai pra última posição com +0,32%. O Sudeste assume a ponta com +0,83%, puxado por Minas Gerais que registrou a MAIOR variação entre os 27 estados: +1,64%. Bahia (+1,42%) e Piauí (+1,19%) completam o pódio dos estados individuais.\n\nO fato mais relevante do mês não é quem liderou. É que TODOS os 27 estados brasileiros registraram alta em junho. É a primeira vez em 2026 que isso acontece. A menor variação foi de MS (+0,09%), quase zero, mas ainda positiva. Sinal de que a pressão de alta se generalizou geograficamente, algo que não víamos há meses.\n\nNo acumulado de 12 meses, a hierarquia mudou pouco: Minas Gerais segue líder com folga (+8,48%), seguido por Rio de Janeiro (+7,20%), Sergipe (+7,08%) e Piauí (+7,06%). Na ponta menor, Mato Grosso permanece no fundo do ranking (+4,34%), seguido por São Paulo (+5,27%) e Santa Catarina (+5,38%).',
      },
      {
        type: 'image',
        src: '/images/ibv/junho-2026/variacao-por-uf.png',
        alt: 'Gráfico de barras: variação mensal por estado em junho de 2026, com Minas Gerais liderando em +1,64% e Mato Grosso do Sul fechando em +0,09%',
        caption: 'Variação mensal por estado (UF) em junho de 2026. Todos os 27 estados no positivo. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'image',
        src: '/images/ibv/junho-2026/mapa-brasil-acumulado.png',
        alt: 'Mapa do Brasil com variação acumulada em 12 meses por estado em junho de 2026, com Minas Gerais liderando em +8,48%',
        caption: 'Variação acumulada em 12 meses por estado. Fonte: Banco BV (IBV Auto), julho/2026.',
      },
      {
        type: 'heading',
        heading: 'Elétricos seguem em desvalorização estrutural',
        text: 'A foto por tipo de propulsão mudou pouco em relação a maio, mas piorou marginalmente para elétricos: modelos elétricos lançados em 2023 acumulam agora -46,1% de desvalorização até junho de 2026 (era -45,6% em maio). Modelos elétricos de 2022 acumulam -50,5% (era -49,3%).\n\nComparativo por ano modelo até junho/2026:\n- 2023: Elétricos -46,1% | Híbridos -26,1% | Combustão -19,6%\n- 2022: Elétricos -50,5% | Híbridos -19,3% | Combustão -13,2%\n- 2021: Híbridos -18,2% | Combustão -6,3%\n\nO recado estrutural continua: elétrico usado perde valor em ritmo aproximadamente 2,5x maior que combustão equivalente. Para uma análise dedicada com comparativo entre marcas chinesas e europeias, veja nosso post [Elétricos usados junho 2026](/ibv/eletricos-junho-2026).',
      },
      {
        type: 'image',
        src: '/images/ibv/junho-2026/desvalorizacao-2023.png',
        alt: 'Gráfico comparando desvalorização de elétricos (-46,1%), híbridos (-26,1%) e veículos a combustão (-19,6%) ano modelo 2023 até junho de 2026',
        caption: 'Desvalorização acumulada por tipo de propulsão, modelos ano 2023. Fonte: Banco BV.',
      },
      {
        type: 'highlight',
        heading: 'O que isso significa para você?',
        text: 'Se você tem um Renault Kwid, VW Fox ou Chevrolet Onix, o momento de venda continua favorável. Se você tem um Honda HR-V ou VW T-Cross, atenção: viraram pra queda depois de meses no positivo. Se você está em MG, BA ou PI, o ciclo local está no melhor momento do ano. Se está em MS ou RJ (que quase zeraram em junho), o momento é diferente do resto do país e vale esperar. Se você tem um elétrico usado, o cenário continua o mesmo: quanto antes vender, melhor.',
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
    slug: 'vencedores-perdedores-junho-2026',
    title: 'Vencedores e Perdedores de Junho 2026: Kwid emplaca 2º mês seguido e HR-V vira pra queda',
    seoTitle: 'IBV Junho 2026: Kwid Lidera de Novo e HR-V Vira Queda',
    metaDescription: 'Vencedores e perdedores de junho no IBV Auto: Kwid +3,52%, Fox +2,53% e Onix +0,94% sobem; HR-V -1,21% e T-Cross -1,12% caem. MG lidera (+1,64%).',
    publishedAt: '2026-07-16',
    source: 'Banco BV (IBV Auto)',
    referenceMonth: 'Junho 2026',
    ogTitle: 'Vencedores e perdedores de junho: Kwid emplaca 2 meses, HR-V vira.',
    ogHighlight: 'Junho',
    content: [
      {
        type: 'intro',
        text: 'O IBV Auto de junho fechou em +0,57% para o Brasil. Nos extremos: Renault Kwid subiu 3,52% e Honda HR-V perdeu 1,21%. Quase 5 pontos percentuais entre o topo e o fundo. Duas viradas notáveis em relação a maio: o VW Fox saltou de queda (-1,29% em abril) direto pra 2ª maior alta do mês, e o Honda HR-V passou de 2ª maior alta (+1,85% em maio) pra maior queda em junho.',
      },
      {
        type: 'image',
        src: '/images/ibv/junho-2026/modelos-alta-baixa.png',
        alt: 'Modelos com maior alta e maior queda no IBV Auto de junho de 2026: Renault Kwid +3,52%, VW Fox +2,53%, GM Onix +0,94% nas altas; Honda HR-V -1,21%, VW T-Cross -1,12%, Hyundai HB20 -0,44% nas baixas',
        caption: 'Modelos com maiores variações em junho de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Os modelos que mais valorizaram em junho',
        text: 'O Renault Kwid liderou pelo segundo mês consecutivo. Em maio foi +4,58%, em junho +3,52%. Somando dois meses, a valorização acumulada do Kwid passa de 8%. É o tipo de sinal que raramente acontece em ciclos normais de mercado e sugere pressão real de demanda no popular de entrada, e não apenas fator de estoque. Kwid seminovo virou destino de quem foi expulso do zero-km por escassez ou preço.\n\nO VW Fox subiu +2,53%. Movimento surpreendente porque o Fox foi um dos três modelos que MAIS caíram em abril (-1,29%). Foi descontinuado em 2021 e o padrão esperado era queda contínua. A alta forte de junho pode ser correção do exagero de queda anterior, e também reflexo do vácuo deixado por outros populares descontinuados que já saíram do estoque relevante do mercado. Para quem tem um Fox, momento de vender.\n\nO Chevrolet Onix voltou pra alta com +0,94% depois da queda pontual de -0,36% em maio. Antes disso, tinha 3 meses consecutivos no topo. A retomada em junho sugere que a queda de maio foi correção pontual, não mudança de tendência. Como o Onix é o carro mais vendido do Brasil, qualquer movimento sustentado impacta o IBV inteiro.',
      },
      {
        type: 'heading',
        heading: 'Os modelos que mais perderam em junho',
        text: 'A maior queda do mês veio de um lugar inesperado: o Honda HR-V com -1,21%. Em maio, o HR-V foi o SEGUNDO modelo que mais subiu do país (+1,85%). Em junho, virou o que mais caiu. Diferença de 3 pontos em um mês. Movimento típico de correção depois de alta forte, mas também pode indicar pressão específica no segmento de SUV médio premium: BYD Song Plus, Chery Tiggo 7 e a nova geração do Corolla Cross híbrido estão desafiando o HR-V em preço, tecnologia e economia.\n\nO VW T-Cross caiu -1,12%. É o terceiro mês seguido em que um SUV compacto da VW aparece nas maiores quedas (T-Cross agora, Nivus antes). Pressão competitiva no portfolio SUV da VW segue clara: Tracker renovado, Creta atualizada, HR-V versão híbrida e SUVs chineses (BYD Yuan Plus, GWM Ora, Caoa Chery) dividem o mesmo bolso do comprador.\n\nO Hyundai HB20 recuou -0,44%. Menor queda entre os três negativos, mas mais preocupante do ponto de vista estrutural: HB20 é dos populares mais vendidos, e queda no seu preço usado costuma anteceder queda mais ampla no segmento popular. Vale monitorar próximos meses.',
      },
      {
        type: 'heading',
        heading: 'Variação por região: Sudeste lidera e todos os 27 estados no positivo',
        text: 'A grande notícia regional de junho não é o líder. É a base: pela primeira vez em 2026, TODOS os 27 estados brasileiros registraram alta nos preços de usados. Em maio, o Norte tinha 5 estados no negativo. Em abril, o Centro-Oeste tinha 4. Em junho, ZERO estados no vermelho. Sinal de pressão de alta generalizada geograficamente.\n\nMinas Gerais liderou com +1,64%, maior variação individual. Junto no topo: Bahia (+1,42%), Piauí (+1,19%), Espírito Santo (+0,96%) e Pará (+0,88%). Padrão diverso: MG e ES no Sudeste, BA e PI no Nordeste, PA no Norte. Sem concentração regional.\n\nNa ponta menor, Mato Grosso do Sul mal escapou do zero (+0,09%). Amazonas (+0,19%), Pernambuco (+0,23%), Mato Grosso (+0,25%) e Rondônia (+0,33%) também ficaram bem abaixo da média nacional (+0,57%). Curiosidade: o Rio de Janeiro, apesar de estar na 2ª colocação no acumulado 12 meses (+7,20%), teve mês fraco (+0,15%). Sinal de que o ciclo de alta forte do RJ pode estar dando trégua.\n\nPara quem está comprando no MS, RJ, AM ou PE, o momento é o mais favorável em meses. Para quem está vendendo em MG, BA, PI ou ES, é o oposto: ciclo local no auge.',
      },
      {
        type: 'image',
        src: '/images/ibv/junho-2026/variacao-por-uf.png',
        alt: 'Gráfico de barras com variação mensal por estado em junho de 2026: Minas Gerais lidera com +1,64%, Mato Grosso do Sul fecha com +0,09%',
        caption: 'Variação mensal por estado (UF) em junho de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Líderes regionais em 12 meses: MG consolida liderança',
        text: 'No acumulado 12 meses até junho, MG ampliou vantagem:\n\n- Minas Gerais: +8,48%\n- Rio de Janeiro: +7,20%\n- Sergipe: +7,08%\n- Piauí: +7,06%\n- Bahia: +6,95%\n\nMG lidera com folga de mais de 1 ponto sobre o 2º colocado. Vantagem grande em métrica que costuma ficar apertada. Para vendedores mineiros, o ciclo dos últimos 12 meses foi excepcional.\n\nNa ponta menor: Mato Grosso (+4,34%), São Paulo (+5,27%), Santa Catarina (+5,38%). Nota importante: SP na penúltima posição parece contra-intuitivo, mas reflete o mercado paulista mais líquido, com maior oferta e concorrência entre revendedores puxando preços pra baixo. Compradores em SP se beneficiam disso.',
      },
      {
        type: 'image',
        src: '/images/ibv/junho-2026/mapa-brasil-acumulado.png',
        alt: 'Mapa do Brasil com variação acumulada em 12 meses por estado em junho de 2026 com destaque para MG (+8,48%) e RJ (+7,20%)',
        caption: 'Variação acumulada em 12 meses por estado. Fonte: Banco BV (IBV Auto), julho/2026.',
      },
      {
        type: 'highlight',
        heading: 'Como usar essa informação',
        text: 'Se você tem Kwid ou Fox, o momento de venda continua excepcional. Se tem Onix, a queda de maio foi ponto fora da curva e o padrão de valorização voltou. Se você tem Honda HR-V ou VW T-Cross, o cenário mudou: ambos entraram em queda depois de meses no positivo. Vale acelerar decisão. Se está em MG, BA ou PI vendendo, o ciclo local está no auge. Se está em MS, RJ, AM ou PE comprando, o momento é o mais favorável dos últimos meses. Para elétricos, veja nosso [post dedicado](/ibv/eletricos-junho-2026) com análise por marca.',
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
    slug: 'eletricos-junho-2026',
    title: 'Elétricos Usados Junho 2026: BYD, GWM e o Colapso Estrutural do Valor de Revenda',
    seoTitle: 'Elétricos Usados Junho 2026: BYD, GWM e o Valor de Revenda',
    metaDescription: 'Elétricos usados 2023 acumulam -46,1% até junho, 2,5 vezes a combustão. Desvalorização por marca: chinesas (BYD, GWM, JAC, Chery) contra europeias.',
    publishedAt: '2026-07-16',
    source: 'Banco BV (IBV Auto) + análise PlacaCompleta',
    referenceMonth: 'Junho 2026',
    ogTitle: 'Elétricos usados perdem 46% em 3 anos. O que está acontecendo.',
    ogHighlight: '-46,1%',
    content: [
      {
        type: 'intro',
        text: 'Este é o primeiro de uma série mensal dedicada exclusivamente ao mercado de veículos elétricos usados no Brasil. O motivo é simples: os dados do IBV Auto de junho de 2026 confirmam que a depreciação de elétricos segue em patamar estrutural, muito acima da média de combustão. Um elétrico 2023 comprado zero por R$ 250 mil vale hoje cerca de R$ 135 mil. Um combustão equivalente da mesma safra vale R$ 200 mil. O choque estrutural do segmento elétrico brasileiro merece uma leitura própria.',
      },
      {
        type: 'heading',
        heading: 'O panorama de junho: elétrico piorou, híbrido estável',
        text: 'A foto agregada do BV em junho de 2026 mostra:\n\n- Elétricos 2023: -46,1% (era -45,6% em maio)\n- Elétricos 2022: -50,5% (era -49,3%)\n- Híbridos 2023: -26,1% (estável)\n- Híbridos 2022: -19,3% (estável)\n- Combustão 2023: -19,6% (estável)\n- Combustão 2022: -13,2% (estável)\n\nDois padrões relevantes:\n\n1. **Elétricos continuam piorando.** Enquanto híbridos e combustão estabilizaram em 2026, elétricos seguem em curva de queda mês a mês. É a única categoria que ainda perde valor de forma incremental depois de 3 anos de uso.\n\n2. **A distância elétrico-combustão aumentou.** Em maio, um elétrico 2023 valia proporcionalmente 56% do combustão equivalente. Em junho, 55%. Diferença sutil no mês, mas o vetor é claro.',
      },
      {
        type: 'image',
        src: '/images/ibv/junho-2026/desvalorizacao-2023.png',
        alt: 'Gráfico comparando desvalorização de elétricos (-46,1%), híbridos (-26,1%) e veículos a combustão (-19,6%) ano modelo 2023 até junho de 2026',
        caption: 'Depreciação por propulsão, modelos 2023. A distância entre elétrico e combustão ampliou em 2026. Fonte: Banco BV.',
      },
      {
        type: 'heading',
        heading: 'Por que elétrico deprecia mais? Cinco fatores',
        text: '**1. Preço do zero cai rápido.** Enquanto o valor de um combustão novo se mantém, o elétrico novo perde preço todo trimestre. BYD Dolphin lançou em 2023 por R$ 149 mil. Em 2024 caiu pra R$ 129 mil. Em 2025, versão base pra R$ 119 mil. Quem comprou em 2023 já viu o novo custar 20% menos, então o seminovo do mesmo modelo obrigatoriamente vale menos.\n\n**2. Tecnologia evolui rápido.** Um elétrico 2023 tem geralmente 20% menos autonomia real e 30-40% mais tempo de recarga rápida que a versão 2026 do mesmo modelo. Comprador de usado enxerga essa diferença e desconta.\n\n**3. Bateria como incógnita.** A saúde da bateria (SoH) só é auditável por scanner especializado, e o preço de reposição pode chegar a R$ 80-120 mil dependendo do modelo. Comprador de usado precifica esse risco e desconta significativamente.\n\n**4. Marcas chinesas em disputa agressiva.** BYD, GWM e Chery estão em fase de conquista de mercado no Brasil. Preços baixos e lançamentos frequentes pressionam o valor da geração anterior.\n\n**5. Volume ainda pequeno no seminovo.** Poucos compradores no mercado secundário de elétrico significa preços puxados pra baixo pra fechar negócio, mesmo com veículo em bom estado.',
      },
      {
        type: 'heading',
        heading: 'Marcas chinesas: quem preserva mais valor',
        text: 'O IBV agrega elétricos sem separar por marca, mas o padrão observado no mercado de seminovos brasileiro em junho de 2026 permite uma leitura direcional. O ranking abaixo é qualitativo, baseado em cruzamento de anúncios de portais (Webmotors, OLX, Mercado Livre) com valor original de tabela:\n\n**Melhor retenção de valor (chinesas):**\n- **BYD Dolphin.** Modelo de entrada com volume relevante no seminovo. Preserva relativamente bem por causa da demanda constante em faixa acessível.\n- **BYD Song Plus / Yuan Plus.** SUVs médios da BYD com boa aceitação. Perda ainda alta (30-35%), mas menor que da média de elétricos.\n\n**Retenção mediana:**\n- **GWM Ora 03.** Elétrico compacto premium. Retém razoavelmente pelo posicionamento distintivo, mas volume baixo cria variância.\n- **Chery Tiggo 8 PHEV.** Híbrido plug-in, comportamento próximo ao de híbrido puro (melhor que elétrico puro).\n\n**Pior retenção:**\n- **JAC E-JS1 e iEV.** Modelos mais antigos, tecnologia defasada, redução da rede de assistência da JAC no Brasil. Depreciação acumulada frequentemente acima de 50%.\n- **BYD Tan (2022-2023).** SUV grande importado, preço original alto (R$ 500k+), impacto forte da queda de preço do novo. Perda proporcional entre as maiores do segmento.',
      },
      {
        type: 'image',
        src: '/images/ibv/junho-2026/desvalorizacao-2022.png',
        alt: 'Gráfico de desvalorização de elétricos, híbridos e combustão do ano modelo 2022 até junho de 2026, com elétricos em -50,5%',
        caption: 'Depreciação ano 2022: elétricos já perderam metade do valor em 4 anos. Fonte: Banco BV.',
      },
      {
        type: 'heading',
        heading: 'Marcas europeias premium: retenção acima da média',
        text: 'Elétricos premium europeus (Volvo, BMW, Audi) preservam valor melhor que a média chinesa, mas ainda depreciam bem acima de combustão equivalente. Fatores:\n\n**Volvo XC40 Recharge / EX40.** Marca com percepção premium consolidada, plataforma compartilhada com a versão a combustão (facilita revenda). Depreciação real observada em anúncios: 35-45% em 3 anos.\n\n**BMW iX3 / i4.** Volume pequeno mas nicho fiel. Bateria da BMW tem reputação boa. Depreciação 40-50%.\n\n**Porsche Taycan.** Volume ínfimo no Brasil. Ainda considerado premium-premium e retém melhor. Menor amostra pra generalizar.\n\nO padrão claro: quanto mais premium o posicionamento e mais estável a marca, maior a retenção. Mas nenhum elétrico no Brasil preserva valor como um combustão premium equivalente. Um Mercedes GLA 2023 combustão perdeu 25-30%. Um EQA 2023 elétrico perdeu 40-45%.',
      },
      {
        type: 'heading',
        heading: 'Comprando elétrico usado: janela cada vez melhor',
        text: 'A outra face da moeda da depreciação estrutural: para quem está comprando, é a melhor janela do mercado brasileiro de elétricos.\n\nUm BYD Dolphin 2023 vendido por R$ 90 mil hoje custou R$ 149 mil zero. Diferença de R$ 60 mil em pouco mais de 2 anos de uso. Se você faz 15 mil km por ano em cidade, o custo/km do usado é significativamente menor que financiar um zero mesmo levando em conta a menor autonomia.\n\nRecomendações práticas para comprar elétrico usado em 2026:\n\n1. **Auditar bateria antes de comprar.** SoH abaixo de 85% é sinal amarelo. Concessionárias autorizadas fazem esse teste (BYD, Volvo, GWM). Custo baixo, diagnóstico crítico.\n2. **Preferir modelos com plataforma compartilhada.** Volvo XC40 Recharge, Peugeot e-208 e outros que dividem plataforma com versão combustão tendem a ter peças e manutenção mais acessíveis.\n3. **Confirmar garantia da bateria.** Muitas marcas dão 8 anos de garantia na bateria. Se o veículo tem 2-3 anos, sobra bastante cobertura. Verificar transferência para segundo proprietário.\n4. **Rodar em condições reais.** Autonomia declarada NUNCA é a autonomia real. Faça test drive de pelo menos 40 km com ar condicionado ligado.\n5. **Consultar o valor FIPE atualizado pela placa.** O preço médio de mercado do modelo/ano específico ajuda a negociar. Use nossa [consulta gratuita](/) pra ter esse dado antes de fechar.',
      },
      {
        type: 'heading',
        heading: 'Vendendo elétrico usado: urgência mantida',
        text: 'Se você comprou um elétrico entre 2022 e 2024, o cenário continua sendo o mesmo desde o início do ano: quanto antes vender, melhor. Cada mês adicional de espera implica em nova queda de preço, provocada pela combinação de:\n\n- Lançamentos mensais de novos modelos elétricos mais baratos e com mais autonomia\n- Estratégia agressiva de precificação da BYD, GWM e Chery que arrasta a média de preço do segmento pra baixo\n- Envelhecimento natural da bateria que reduz o valor percebido\n- Redução de incentivos fiscais para importados que já rebaixou custo de aquisição do novo\n\nO ideal, se possível: negociar troca por outro elétrico novo. Nesse caso, o "prejuízo" na revenda é parcialmente absorvido pela vantagem do preço do zero atual e pela permanência no ecossistema (garantia, rede de recarga, familiaridade com o produto).',
      },
      {
        type: 'highlight',
        heading: 'O que esperar dos próximos meses',
        text: 'Nossa previsão pros próximos 90 dias: o patamar de -46% da safra 2023 deve estabilizar ou piorar marginalmente (chegar próximo a -48% até setembro). Motivo: continuidade dos lançamentos BYD (Han restyling, Dolphin Mini com preço abaixo de R$ 100k) e das promoções agressivas de fim de trimestre. Compradores devem esperar mais 60-90 dias antes de fechar negócio. Vendedores devem acelerar a decisão. Para uma leitura do mercado inteiro (não só elétricos), veja a [análise completa do IBV Auto de junho](/ibv/junho-2026).',
      },
      {
        type: 'cta',
        text: 'Quer saber o valor FIPE atualizado do seu carro pela placa?',
        ctaLabel: 'Consultar Placa Grátis',
        ctaTo: '/',
      },
    ],
  },
]

export function findIbvPost(slug: string): IbvPost | undefined {
  return ibvPosts.find(p => p.slug === slug)
}
