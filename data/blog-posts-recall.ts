import type { BlogPost } from './blog-posts'

// Posts de recall (20/out/2026). Regras de copy: nunca dizer que o carro do
// leitor "tem" recall pendente (so "consta" / "verifique se ja foi atendido"),
// sem travessao, sem citar a fonte de dados do registro. Fontes publicas das
// montadoras e da imprensa vao como link no fim do post.

export const postRecallVwFreio: BlogPost = {
  slug: 'recall-volkswagen-freio-de-estacionamento',
  title: 'Recall da Volkswagen: freio de estacionamento de Polo, Tera, Nivus, T-Cross e Virtus',
  seoTitles: [
    'Recall VW 2026: freio de estacionamento (Polo, Nivus)',
    'Recall VW: freio de estacionamento do Polo e Nivus',
    'Recall VW 2026: freio de mão de Polo, Tera e Nivus',
  ],
  metaDescription: 'A Volkswagen convocou 150.290 carros por falha na alavanca do freio de estacionamento. Veja os modelos, o risco e como saber se o seu consta no recall.',
  publishedAt: '2026-10-20',
  categoria: 'Recall',
  capa: {
    src: '/images/blog/recall-volkswagen-freio-estacionamento.png',
    og: '/images/blog/recall-volkswagen-freio-estacionamento-1200.png',
    alt: 'Recall Volkswagen: freio de estacionamento. Polo, Tera, Nivus, T-Cross e Virtus. Veja se consta para a sua placa.',
    largura: 1600,
    altura: 836,
  },
  content: [
    {
      type: 'intro',
      text: 'A Volkswagen convocou **150.290 veículos no Brasil** por um problema na alavanca do freio de estacionamento (o freio de mão). Segundo a montadora, a trava interna do mecanismo pode ceder, e o motorista pode achar que o freio está acionado quando não está.',
    },
    {
      type: 'heading',
      heading: 'Quais modelos entram no recall',
      text: 'A campanha envolve carros fabricados entre **maio e outubro de 2025**, nos anos-modelo 2025 e 2026:\n\n- Polo Track (2025 e 2026)\n- Polo (2026)\n- Tera (2025 e 2026)\n- Nivus (2025 e 2026)\n- T-Cross (2026)\n- Virtus (2025 e 2026)\n\nNem todo carro desses modelos e anos está na campanha. Quem decide é o número do chassi, por isso a conferência precisa ser feita carro a carro.',
    },
    {
      type: 'heading',
      heading: 'Qual é o defeito e o risco',
      text: 'Em linguagem simples: a peça que mantém a alavanca travada pode ceder com o uso. O carro estacionado pode então se deslocar sozinho, principalmente em **ladeiras e superfícies inclinadas**. A montadora reconhece risco de acidente, com danos materiais e lesões a ocupantes e a terceiros.',
    },
    {
      type: 'heading',
      heading: 'O que o dono deve fazer',
      text: '1. Confira se o chassi do seu carro consta na campanha, pelo site de recall da Volkswagen ou pelo telefone 0800 019 8866.\n2. Se constar, agende o atendimento em uma concessionária da rede. É gratuito e leva cerca de duas horas.\n3. Na concessionária, a alavanca é inspecionada e, se o defeito for confirmado, substituída.\n\nEnquanto isso, vale o cuidado básico: em ladeira, deixe o carro engatado (marcha ou P) e com as rodas esterçadas em direção ao meio-fio.',
    },
    {
      type: 'heading',
      heading: 'Vai comprar um desses carros usados?',
      text: 'Os modelos da campanha são recentes e já aparecem no mercado de seminovos. Antes de fechar negócio, **veja se consta recall para a placa** e pergunte ao vendedor se o atendimento já foi feito. O aviso na consulta indica que o carro consta em campanha, não que o reparo esteja pendente: a confirmação do atendimento é sempre com a montadora.',
    },
    {
      type: 'cta',
      text: 'Veja se consta recall para a sua placa. A consulta é grátis.',
      ctaLabel: 'Consultar placa grátis',
      ctaTo: '/',
    },
    {
      type: 'faq',
      heading: 'Perguntas frequentes',
      faq: [
        { q: 'Como saber se o meu Polo, Nivus, Tera, T-Cross ou Virtus está no recall?', a: 'Pelo número do chassi, no site de recall da Volkswagen ou no 0800 019 8866. Você também pode consultar a placa no PlacaCompleta para ver se o carro consta em campanha de recall.' },
        { q: 'O reparo do recall é gratuito?', a: 'Sim. A inspeção e, se necessário, a troca da alavanca são gratuitas em toda a rede autorizada, com agendamento.' },
        { q: 'Posso continuar usando o carro?', a: 'A orientação é agendar o atendimento o quanto antes. Até lá, ao estacionar em subidas ou descidas, deixe a marcha engatada e as rodas voltadas para o meio-fio.' },
      ],
    },
    {
      type: 'heading',
      heading: 'Fontes',
      text: '- [Olhar Digital: Volkswagen faz recall de mais de 150 mil veículos no Brasil](https://olhardigital.com.br/2026/07/21/carros-e-tecnologia/volkswagen-faz-recall-de-mais-de-150-mil-veiculos-no-brasil/)\n- [Poder360: Volkswagen faz recall de 150.290 carros por falha no freio de mão](https://www.poder360.com.br/poder-economia/volkswagen-faz-recall-de-150-290-carros-por-falha-no-freio-de-mao/)\n- Canal oficial: Volkswagen do Brasil, 0800 019 8866.',
    },
  ],
}

export const postRecallVolvoEx30: BlogPost = {
  slug: 'recall-volvo-ex30-bateria',
  title: 'Recall do Volvo EX30: risco na bateria e o que o dono deve fazer',
  seoTitles: [
    'Recall Volvo EX30: bateria e o que o dono deve fazer',
    'Recall Volvo EX30 2026: problema na bateria',
    'Recall do Volvo EX30: bateria e limite de 70%',
  ],
  metaDescription: 'A Volvo convocou cerca de 5.600 EX30 no Brasil por falha nas células da bateria de alta tensão. Entenda o risco, o limite de carga de 70% e como conferir o seu.',
  publishedAt: '2026-10-20',
  categoria: 'Recall',
  capa: {
    src: '/images/blog/recall-volvo-ex30-bateria.png',
    og: '/images/blog/recall-volvo-ex30-bateria-1200.png',
    alt: 'Recall Volvo EX30: bateria. Single Motor 2024 e 2025. Veja se consta para a sua placa.',
    largura: 1600,
    altura: 836,
  },
  content: [
    {
      type: 'intro',
      text: 'A Volvo do Brasil convocou cerca de **5.600 unidades do EX30** por uma falha de fabricação nas células da bateria de alta tensão. O defeito pode causar curto-circuito interno nos módulos, com superaquecimento e, em casos extremos, risco de incêndio.',
    },
    {
      type: 'heading',
      heading: 'Quais carros constam na campanha',
      text: '- **Modelo:** Volvo EX30, versão Single Motor Extended Range.\n- **Anos-modelo:** 2024 e 2025.\n- **Fabricação:** de setembro de 2024 a outubro de 2025.\n\nO recall mundial é maior (acima de 40 mil unidades), mas no Brasil a campanha se aplica a esse grupo de cerca de 5.600 carros. Como a faixa de chassis não é sequencial, só a conferência pelo chassi confirma se um carro específico consta.',
    },
    {
      type: 'heading',
      heading: 'O defeito em linguagem simples',
      text: 'Algumas células da bateria saíram da fábrica com uma falha. Em situações raras, isso pode gerar curto-circuito dentro do módulo e aquecer a bateria demais. A Volvo informa que uma fração muito pequena dos carros no mundo apresentou o problema e que não há relatos de ferimentos, mas trata o caso como risco de segurança.',
    },
    {
      type: 'heading',
      heading: 'O que o dono deve fazer',
      text: '1. Confira se o chassi consta na campanha, pela Central de Atendimento Volvo: 0800 878 1176.\n2. **Limite a carga da bateria a 70%.** É a medida preventiva indicada pela montadora até o reparo definitivo, e pode ser feita na concessionária (cerca de uma hora, sem custo) ou seguindo as orientações da marca.\n3. Agende o reparo definitivo, que prevê a troca dos módulos de bateria afetados e a atualização do software de gerenciamento de energia. O serviço é gratuito.\n\nA Volvo informou também que a campanha teve cronograma ajustado ao longo de 2026. Por isso, confirme data e disponibilidade direto com a marca.',
    },
    {
      type: 'heading',
      heading: 'Vai comprar um EX30 usado?',
      text: 'Elétricos seminovos estão mais comuns no mercado. Antes de fechar negócio, **veja se consta recall para a placa** e peça ao vendedor o comprovante de que o reparo foi feito. Lembre que a consulta indica se o carro consta em campanha, não se o atendimento foi concluído: essa confirmação é com a Volvo.',
    },
    {
      type: 'cta',
      text: 'Veja se consta recall para a sua placa. A consulta é grátis.',
      ctaLabel: 'Consultar placa grátis',
      ctaTo: '/',
    },
    {
      type: 'faq',
      heading: 'Perguntas frequentes',
      faq: [
        { q: 'Meu EX30 2026 está no recall?', a: 'Segundo a imprensa especializada, nenhum EX30 modelo 2026 vendido no Brasil está na campanha. Mesmo assim, confirme pelo chassi na Central de Atendimento Volvo.' },
        { q: 'Por que limitar a carga a 70%?', a: 'É a medida preventiva indicada pela Volvo enquanto o reparo definitivo não é feito. A marca informa que o uso nessa condição é seguro.' },
        { q: 'O reparo custa alguma coisa?', a: 'Não. A limitação de carga e a troca dos módulos de bateria são gratuitas na rede Volvo, com agendamento.' },
      ],
    },
    {
      type: 'heading',
      heading: 'Fontes',
      text: '- [Canal VE: Volvo anuncia recall do elétrico EX30](https://canalve.com.br/volvo-anuncia-recall-eletrico-ex30/)\n- [Autopapo: Volvo inicia recall definitivo para troca de baterias do EX30 no Brasil](https://autopapo.com.br/curta/volvo-inicia-recall-definitivo-para-troca-de-baterias-do-ex30-no-brasil/)\n- Canal oficial: Central de Atendimento Volvo, 0800 878 1176.',
    },
  ],
}

export const postRecallExterior: BlogPost = {
  slug: 'recall-china-malasia-vale-para-o-brasil',
  title: 'Recall na China e na Malásia: vale para o Brasil? Omoda 5 e BYD',
  seoTitles: [
    'Recall Omoda 5 e BYD: vale para o Brasil?',
    'Recall no exterior: Omoda 5 e BYD valem no Brasil?',
    'Recall Omoda 5 e BYD na China e Malásia: e no Brasil?',
  ],
  metaDescription: 'Recalls do Omoda 5 na Malásia e da BYD na China chegaram ao noticiário. Veja o que dizem as marcas, que não há chamado no Brasil e o que o dono pode conferir.',
  publishedAt: '2026-10-20',
  categoria: 'Recall',
  capa: {
    src: '/images/blog/recall-china-malasia-vale-para-o-brasil.png',
    og: '/images/blog/recall-china-malasia-vale-para-o-brasil-1200.png',
    alt: 'Recall no exterior: Omoda 5 e BYD. Não há chamado no Brasil. O que conferir.',
    largura: 1600,
    altura: 836,
  },
  content: [
    {
      type: 'intro',
      text: 'Nas últimas semanas, notícias de recall do **Omoda 5 na Malásia** e da **BYD na China** ganharam força nas buscas. A dúvida de quem tem ou pensa em comprar um desses carros é direta: isso vale para o Brasil? **Até a data deste post, não encontramos chamado de recall dessas marcas no Brasil para esses casos.** Veja o que cada caso diz e como conferir.',
    },
    {
      type: 'heading',
      heading: 'Omoda 5: o caso da Malásia',
      text: 'Em outubro de 2026, o órgão de trânsito da Malásia (JPJ) emitiu um comunicado sobre unidades do Omoda 5 montadas no país, por possível desprendimento de peça da suspensão traseira (solda dos braços da suspensão), e a Chery suspendeu as vendas por lá.\n\nA Omoda & Jaecoo Brasil afirma que o carro vendido aqui, o **Omoda 5 HEV**, tem configuração diferente: suspensão traseira independente multilink e conjunto híbrido distinto. A marca também diz que não há confirmação da causa do caso malaio nem relação com o mercado brasileiro.\n\nEm fevereiro de 2026 houve ainda um chamado no Reino Unido, por possível afrouxamento da porca do cubo de roda em Omoda 5 e E5. Também é outro mercado e outro chamado.',
    },
    {
      type: 'heading',
      heading: 'BYD: o caso da China',
      text: 'Em 25 de setembro de 2026, a BYD anunciou recall de cerca de 183 mil carros na China (modelos Qin e Tang, fabricados entre 2014 e 2022), por um lote de batentes do pedal de freio que pode rachar ou se soltar e fazer as luzes de freio acenderem sozinhas.\n\nSegundo a BYD, o recall não impacta veículos vendidos fora do mercado chinês, e a BYD Brasil informou que os carros vendidos no país não estão incluídos nos recalls anunciados na China.\n\nAtenção a sites que prometem recall da BYD no Brasil sem citar a Senacon ou a própria marca: confirme sempre em fonte oficial.',
    },
    {
      type: 'heading',
      heading: 'Por que um recall lá fora pode virar um recall aqui',
      text: 'Recall depende do modelo, da fábrica, do lote e da versão. Quando um defeito aparece em outro país, a montadora avalia se o mesmo componente existe nos carros vendidos no Brasil. Se existir, ela é obrigada a comunicar o chamado às autoridades brasileiras. Se não existir, não há campanha aqui. Por isso o noticiário de fora não é, sozinho, um aviso para o dono brasileiro.',
    },
    {
      type: 'heading',
      heading: 'O que o dono pode conferir',
      text: '1. **Placa ou chassi:** veja se o carro consta em campanha de recall. É grátis no PlacaCompleta.\n2. **Site e central da marca:** peça confirmação do chassi à Omoda & Jaecoo Brasil ou à BYD Brasil.\n3. **Senacon:** a Secretaria Nacional do Consumidor recebe todos os chamados de recall no país e mantém a lista oficial.\n4. **Carta e contato da concessionária:** se houver campanha, a marca avisa o dono por carta, e-mail ou telefone.\n\nSe aparecer um chamado no Brasil, a consulta de placa passa a indicar que o carro consta na campanha. Aí vale verificar com a marca se o atendimento já foi feito.',
    },
    {
      type: 'cta',
      text: 'Veja se consta recall para a sua placa. A consulta é grátis.',
      ctaLabel: 'Consultar placa grátis',
      ctaTo: '/',
    },
    {
      type: 'faq',
      heading: 'Perguntas frequentes',
      faq: [
        { q: 'O Omoda 5 vendido no Brasil tem recall por causa da Malásia?', a: 'Não encontramos chamado de recall do Omoda 5 no Brasil por esse caso. A Omoda & Jaecoo Brasil diz que o modelo vendido aqui tem suspensão traseira multilink e conjunto híbrido diferentes. Confirme o seu chassi com a marca.' },
        { q: 'Os carros da BYD vendidos no Brasil estão no recall chinês?', a: 'Segundo a BYD, o recall anunciado na China não impacta veículos vendidos fora daquele mercado, e a BYD Brasil informou que os carros do país não estão incluídos.' },
        { q: 'Como saber se um recall novo chegou ao Brasil?', a: 'Consulte a placa no PlacaCompleta, a central da marca ou a lista da Senacon. Quando houver chamado, o carro passa a constar como em campanha.' },
      ],
    },
    {
      type: 'heading',
      heading: 'Fontes',
      text: '- [Autoindústria: Omoda 5 tem novo recall na Malásia](https://www.autoindustria.com.br/2026/10/13/omoda-5-tem-novo-recall-na-malasia-por-desprendimento-da-suspensao-traseira/) (inclui a posição da Omoda & Jaecoo Brasil)\n- [Auto+ TV: Omoda 5 e as vendas suspensas na Malásia](https://www.automaistv.com.br/novidades/omoda-5-eixo-traseiro-vendas-suspensas-malasia/)\n- [Vrum: BYD faz recall de 183 mil carros na China](https://www.vrum.com.br/aceleradas/2026/09/7508411-byd-faz-recall-de-183-mil-carros-por-falha-inusitada-nos-freios.html)\n- [Tribuna PR: BYD diz que recall é só na China](https://www.tribunapr.com.br/noticias/automoveis/byd-fala-que-recall-dos-veiculos-dolphin-e-yuan-plus-e-so-na-china/)\n- Canais oficiais: Omoda & Jaecoo Brasil, BYD Brasil e Senacon (Ministério da Justiça).',
    },
  ],
}
