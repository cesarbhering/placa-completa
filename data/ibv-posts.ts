export interface IbvPost {
  slug: string
  title: string
  metaDescription: string
  publishedAt: string // ISO date string
  source: string
  referenceMonth: string // e.g. "Março 2026"
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
    slug: 'vencedores-perdedores-marco-2026',
    title: 'Vencedores e Perdedores de Março 2026: os Estados que Mais Valorizaram (e Desvalorizaram) Carros Usados',
    metaDescription: 'PE +1,43%, RS +1,23%, SE +1,23%, SP +0,97% lideraram em março. TO e GO caíram. Análise completa com dados do IBV Auto por estado, região e tendência de 6 meses.',
    publishedAt: '2026-04-07',
    source: 'Banco BV (IBV Auto)',
    referenceMonth: 'Março 2026',
    content: [
      {
        type: 'intro',
        text: 'Em março de 2026, o IBV Auto registrou alta de 0,71% no Brasil — mas a média esconde uma enorme dispersão entre estados. Pernambuco valorizou 1,43% no mês, enquanto Tocantins recuou 0,38%. São mercados do mesmo país com dinâmicas completamente diferentes. Aqui destrinchamos os dados estado a estado, com contexto de tendência e acumulado, usando o dataset completo do Banco BV.',
      },
      {
        type: 'heading',
        heading: 'Os 4 estados que mais valorizaram em março',
        text: 'Pernambuco (PE) liderou com +1,43% no mês — o maior salto entre todos os 27 estados. No acumulado de 12 meses, PE chega a +8,02%, a maior valorização do país, acima da média nacional de 7,33%. O estado já havia registrado +1,72% em janeiro, sinalizando um mercado persistentemente aquecido. O índice de nível do PE (179,1) é um dos mais baixos do Brasil, o que sugere um mercado que ainda tem espaço para se valorizar em relação às médias históricas.\n\nRio Grande do Sul (RS) e Sergipe (SE) empataram tecnicamente em +1,23%. O RS chama atenção pelo índice de nível mais alto do grupo (186,9 — já bastante valorizado) e por uma trajetória de recuperação clara: em outubro de 2025 havia caído -0,46%, e desde então acumula cinco meses consecutivos de alta. Sergipe segue padrão oposto: mercado menor, mais volátil, com dezembro quase estável (+0,04%) e aceleração forte em janeiro e março.\n\nSão Paulo (SP) fechou em +0,97%. O dado impressiona pelo contexto: SP havia caído -1,17% em dezembro de 2025 — a maior queda entre todos os estados naquele mês — e se recuperou nos três meses seguintes. Sendo o maior mercado do país em volume, SP carrega peso desproporcional no índice nacional. No acumulado anual, SP está em +5,83%, abaixo da média brasileira, mas o mês de março foi o terceiro mais forte de sua série recente.',
      },
      {
        type: 'image',
        src: '/images/ibv/marco-2026/variacao-por-uf.png',
        alt: 'Gráfico de barras: variação mensal por estado em março de 2026. PE lidera com +1,43%, TO fecha com -0,38%',
        caption: 'Variação mensal por estado — março de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Os 4 estados que mais perderam (ou ficaram para trás)',
        text: 'Tocantins (TO) recuou -0,38%, o maior recuo entre todos os estados em março. É uma reversão abrupta: TO havia registrado +0,95% em janeiro e +0,55% em fevereiro. O índice de nível do estado (186,7) é um dos mais elevados do Brasil, o que pode indicar que o mercado local estava precificando acima do equilíbrio e agora corrige.\n\nGoiás (GO) caiu -0,35%. Diferente de TO, GO vinha com sequência positiva consistente nos seis meses anteriores (entre +0,26% e +0,95% ao mês), o que torna a queda de março uma quebra de tendência mais relevante. No acumulado de 12 meses, GO ainda está em +6,22% — em linha com a média nacional.\n\nAmapá (AP) e Roraima (RR) registraram quedas pequenas (-0,09% e -0,06%, respectivamente), mas merecem atenção porque ambos vinham de fevereiro forte: AP em +0,99% e RR em +1,01%. Os dois estados ficam no Norte e têm mercados muito menores em volume, mas a reversão simultânea depois de um mês aquecido sugere volatilidade estrutural da região — não necessariamente uma tendência de baixa.',
      },
      {
        type: 'image',
        src: '/images/ibv/marco-2026/variacao-por-uf-acumulado.png',
        alt: 'Gráfico de barras: variação acumulada em 12 meses por estado. PE lidera com +8,02%, SC fecha com +4,34%',
        caption: 'Variação acumulada em 12 meses por estado — março de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'O padrão regional que os dados revelam',
        text: 'Março foi um mês de divergência regional clara. O Norte registrou apenas +0,10% — pior desempenho entre as cinco regiões, puxado para baixo por TO, AP e RR. Em fevereiro, o Norte havia sido o segundo melhor (+0,73%). O Centro-Oeste também desacelerou forte: de +0,77% em fevereiro para +0,22% em março, reflexo da queda em GO.\n\nNo sentido oposto, o Nordeste acelerou de +0,31% (fevereiro) para +0,72% (março), liderado por PE, SE e MA (+0,97%). O Sudeste foi de +0,39% para +0,78%, impulsionado por SP e MG. O Sul manteve ritmo: de +0,53% para +0,59%, com RS puxando.\n\nO padrão que emerge: mercados do Nordeste e Sudeste estão com demanda aquecida e sustentada. Mercados do Norte e Centro-Oeste tiveram pico em janeiro–fevereiro e mostram sinais de acomodação.',
      },
      {
        type: 'image',
        src: '/images/ibv/marco-2026/mapa-brasil-acumulado.png',
        alt: 'Mapa do Brasil com variação acumulada em 12 meses por estado, cores mais escuras indicam maior valorização',
        caption: 'Acumulado de 12 meses por estado — Nordeste e Sudeste lideram. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'heading',
        heading: 'Modelos: quem subiu e quem caiu no mês',
        text: 'Nos veículos, a Toyota Hilux SW4 foi o grande destaque positivo do mês, com alta de +5,17% — um salto que isoladamente já puxaria qualquer índice. O Toyota Corolla (+1,03%) e o GM Onix (+0,94%) completam o pódio das altas, sendo que o Onix aparece em alta pelo segundo mês consecutivo, sinalizando pressão contínua no segmento de populares.\n\nNa ponta negativa, o Ford Fiesta recuou -3,56% — o maior recuo entre os modelos destacados. O Honda HR-V caiu -0,76% e o VW Gol -0,66%. O Gol em queda é relevante: modelo de saída para compradores de primeiro carro, sua desvalorização sugere que a base da pirâmide de preços ainda está sob pressão.',
      },
      {
        type: 'image',
        src: '/images/ibv/marco-2026/modelos-alta-baixa.png',
        alt: 'Destaques de modelos: Hilux SW4 +5,17%, Corolla +1,03%, Onix +0,94% nas altas; Fiesta -3,56%, HR-V -0,76%, Gol -0,66% nas baixas',
        caption: 'Modelos com maiores variações em março de 2026. Fonte: Banco BV (IBV Auto).',
      },
      {
        type: 'highlight',
        heading: 'O que isso significa na prática?',
        text: 'Se você está em PE, RS, SE ou SP e pensa em vender seu carro, março foi um bom mês — e a tendência de curto prazo segue favorável nessas praças. Se você está em GO ou TO e quer comprar, o recuo de março pode ser uma janela de negociação. Para quem está de olho em populares como Onix, o mercado segue pressionado para cima. Para quem considera um Gol ou HR-V, a leve queda em março abre margem.',
      },
      {
        type: 'cta',
        text: 'Consulte a placa e veja quanto vale o seu carro hoje, no seu estado.',
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
]

export function findIbvPost(slug: string): IbvPost | undefined {
  return ibvPosts.find(p => p.slug === slug)
}
