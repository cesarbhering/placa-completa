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
