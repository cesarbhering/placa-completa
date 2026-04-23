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
]

export function findIbvPost(slug: string): IbvPost | undefined {
  return ibvPosts.find(p => p.slug === slug)
}
