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
    slug: 'abril-2026',
    title: 'IBV Auto Abril 2026: Preços de Usados Sobem 0,27% — Desaceleração Marca o Fim do Trimestre',
    metaDescription: 'IBV Auto de abril desacelerou para +0,27% (ante +0,71% em março). Celta, Palio e Onix puxaram as altas. Norte cresceu +1,35%; Centro-Oeste registrou queda. Veja a análise completa.',
    publishedAt: '2026-05-12',
    source: 'Banco BV (IBV Auto)',
    referenceMonth: 'Abril 2026',
    content: [
      {
        type: 'intro',
        text: 'O Índice BV Auto (IBV) de abril de 2026 mostra uma desaceleração nítida da inflação de carros usados no Brasil: alta de apenas 0,27% sobre março, bem abaixo do +0,71% do mês anterior. Para quem acompanha o mercado, o dado sugere que o ciclo de aceleração de preços observado no primeiro trimestre (média de +0,72%) está perdendo força. No acumulado de 12 meses, os preços subiram 6,99% — também um leve recuo em relação aos 7,33% do fechamento de março.',
      },
      {
        type: 'heading',
        heading: 'O que mudou em abril',
        text: 'Em março, o IBV foi puxado por modelos premium e populares ao mesmo tempo — Hilux SW4 com +5,17%, Corolla com +1,03% e Onix com +0,94%. Em abril, o padrão se inverte: a alta foi puxada por modelos mais antigos, populares e descontinuados. O Chevrolet Celta e o Fiat Palio aparecem entre os modelos com maior contribuição para a alta, ao lado do Onix — que segue entre os destaques pelo terceiro mês consecutivo.\n\nO movimento de Celta e Palio é típico de mercado pressionado: são carros descontinuados há anos (Celta em 2016, Palio em 2017), mas mantêm volume relevante no mercado de usados. Quando os preços dos populares novos sobem (caso do Onix em 2026), os compradores migram para usados mais antigos como alternativa — e isso valoriza temporariamente carros que tradicionalmente desvalorizam mais rápido.',
      },
      {
        type: 'heading',
        heading: 'Variação por região: Norte na ponta, Centro-Oeste em queda',
        text: 'O Norte registrou a maior inflação de veículos usados em abril, com alta de +1,35% e praticamente todos os estados da região marcando variação acima de 1%. É um movimento expressivo, considerando que historicamente o Norte tem menos volume e maior volatilidade nos preços.\n\nNa contramão, o Centro-Oeste foi o destaque negativo. Mato Grosso do Sul caiu -0,57% e Mato Grosso recuou -0,48% — entre as poucas quedas estaduais em abril. No total, 22 dos 27 estados ainda registraram alta no mês, mostrando que o cenário geral segue de alta, apenas com menor intensidade.\n\nNo acumulado de 12 meses, a liderança regional segue clara: Minas Gerais (+8,52%) e Rio de Janeiro (+8,16%) lideram, seguidos pelo Amazonas (+7,43%). Na ponta menor, Mato Grosso (+4,50%), Espírito Santo (+4,85%) e Santa Catarina (+5,17%) — todos ainda em alta, mas em ritmo bem mais lento.',
      },
      {
        type: 'heading',
        heading: 'Elétricos continuam desvalorizando rápido',
        text: 'O dado mais relevante para compradores de carros elétricos: a depreciação dos modelos elétricos seguiu acelerando em abril. Modelos elétricos lançados em 2023 acumulam desvalorização de -45,6% até abril de 2026 (era -44,6% até março — piorou em 1 ponto percentual em um único mês). Modelos elétricos de 2022 já perderam -49,0% do valor original.\n\nComparativo do ano modelo 2023:\n- Elétricos: -45,6%\n- Híbridos: -25,2%\n- Combustão: -19,3%\n\nA diferença é estrutural: a entrada constante de modelos elétricos novos no Brasil — com tecnologia superior e preços mais agressivos — pressiona o valor de revenda dos modelos antigos. Se você comprou um elétrico 2023 por R$ 250 mil, vale algo perto de R$ 135 mil hoje.\n\nPara quem está comprando, o lado bom: é a melhor janela dos últimos anos para entrar em um elétrico usado com desconto significativo. Para quem tem um elétrico para vender, o sinal é claro — esperar não vai ajudar.',
      },
      {
        type: 'highlight',
        heading: 'O que isso significa para você?',
        text: 'Se você está vendendo um carro popular (Onix, Celta, Palio), abril ainda foi um bom mês, mas o ritmo de alta diminuiu — se for vender, não há ganho esperando muito mais. Se está no Centro-Oeste e quer comprar, espere mais um mês: os preços recuaram e podem continuar pressionados localmente. Para elétricos usados, abril confirmou: comprar tem desconto cada vez maior, vender tem urgência cada vez maior.',
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
    title: 'Vencedores de Abril 2026: Celta, Palio e Onix Lideram Altas no IBV Auto',
    metaDescription: 'Em abril o IBV Auto desacelerou para +0,27%, mas Celta, Palio e Onix puxaram o índice. Norte +1,35% lidera regiões; Centro-Oeste cai. Análise dos modelos que mais se valorizaram.',
    publishedAt: '2026-05-12',
    source: 'Banco BV (IBV Auto)',
    referenceMonth: 'Abril 2026',
    content: [
      {
        type: 'intro',
        text: 'O IBV Auto de abril de 2026 fechou em +0,27% para o Brasil — uma desaceleração significativa frente a +0,71% de março. Mas o detalhe importante não está na média: os modelos que puxaram a alta de abril são radicalmente diferentes dos de março. Em vez de SUVs premium e sedãs intermediários (Hilux SW4, Corolla), os destaques do mês foram populares mais antigos: Celta, Palio e Onix. Esta inversão diz algo sobre o ciclo do mercado.',
      },
      {
        type: 'heading',
        heading: 'Os modelos que mais valorizaram em abril',
        text: 'O Chevrolet Celta foi um dos três modelos com maior contribuição positiva para o IBV de abril. O Celta foi descontinuado em 2016 — já são quase 10 anos sem produção. Ainda assim, o estoque de usados é gigantesco (foram mais de 1,7 milhão de unidades vendidas no Brasil) e a demanda persiste porque o Celta é um dos carros mais baratos do mercado nacional de usados. Quando o preço do zero-km sobe (que é o caso do Onix em 2026), o Celta vira alternativa para quem não consegue chegar nos populares novos. O movimento de abril confirma essa pressão.\n\nO Fiat Palio também entrou no top de altas — outro modelo descontinuado (em 2017) que mantém volume relevante no mercado brasileiro. O Palio foi por décadas o segundo carro mais vendido do Brasil. Como o Celta, ele cumpre o papel de "alternativa barata" quando o segmento popular novo fica inacessível. A alta de abril é sintoma de mercado pressionado por baixo, não por cima.\n\nO Chevrolet Onix aparece entre os destaques pelo terceiro mês consecutivo. Isso é importante de notar: o Onix é o carro mais vendido do Brasil, o que significa que qualquer movimento sustentado de preço dele tem impacto desproporcional no IBV. Três meses consecutivos de alta indicam que a pressão sobre os populares não foi um pico — é tendência. Para quem está com um Onix usado e pensando em vender, o cenário ainda é favorável, mas com o ritmo desacelerando.',
      },
      {
        type: 'heading',
        heading: 'O que une os três',
        text: 'O padrão é claro: os três modelos que mais subiram em abril são populares ou ex-populares, todos com estoque alto no mercado de usados, todos abaixo de R$ 50 mil em versões médias. É o oposto do padrão de março, quando os destaques eram modelos premium e médios (Hilux SW4, Corolla). Essa rotação sugere que o consumidor brasileiro está se movendo para baixo na escala de preço — comprando menos do que comprava em março.\n\nA desaceleração do índice (de +0,71% para +0,27%) é consistente com essa leitura: o mercado segue em alta, mas perdeu fôlego no topo da pirâmide.',
      },
      {
        type: 'heading',
        heading: 'Os perdedores: Centro-Oeste em queda',
        text: 'O relatório de abril do banco BV não destacou modelos específicos em queda, mas a pressão negativa apareceu na geografia. O Centro-Oeste foi a região que mais perdeu valor em abril:\n\n- Mato Grosso do Sul: -0,57%\n- Mato Grosso: -0,48%\n\nEssas quedas são especialmente notáveis porque MT é também o estado com menor inflação acumulada em 12 meses (+4,50%), seguido por ES (+4,85%) e SC (+5,17%). É um sinal regional de mercado mais frio — possivelmente ligado à dinâmica do agronegócio, principal motor econômico do Centro-Oeste, que enfrentou pressão de margens no início de 2026.\n\nPara quem está comprando carro no Centro-Oeste, abril foi um bom mês. Para quem está vendendo lá, especialmente em MT/MS, espere o ciclo virar antes de listar.',
      },
      {
        type: 'heading',
        heading: 'Líderes regionais em 12 meses',
        text: 'No acumulado de 12 meses até abril, a hierarquia regional consolidou:\n\n- Minas Gerais: +8,52%\n- Rio de Janeiro: +8,16%\n- Amazonas: +7,43%\n\nMG e RJ vinham na liderança desde março (+7,75% cada) e abriram distância em abril. Para vendedores, são os dois estados onde o ciclo de valorização foi mais favorável nos últimos 12 meses. Para compradores, é onde o ágio de mercado está mais alto.',
      },
      {
        type: 'highlight',
        heading: 'Como usar essa informação',
        text: 'Se você tem um Celta, Palio ou Onix e pensa em vender: abril foi favorável, mas o ritmo desacelerou — vale acelerar a decisão. Se você está em MG ou RJ vendendo, o ciclo acumulado segue favorável. Se você está em MT/MS comprando, esta é a janela. Se você tem um elétrico usado, a queda de valor segue acelerando — vender quanto antes é a melhor estratégia.',
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
]

export function findIbvPost(slug: string): IbvPost | undefined {
  return ibvPosts.find(p => p.slug === slug)
}
