// Artigos "O que e" (RENAVAM, gravame, RENAJUD, multas RENAINF). Pedido do
// Cesar (02/out). Regras: resposta direta no 1o paragrafo, numeros reais e
// AGREGADOS da nossa base (N >= 30 por percentual, sem PII), sem travessao,
// sem afirmar que o carro do leitor tem problema, multas so em aberto, sem
// nomear fornecedor de dados (fonte oficial: SENATRAN/DETRAN), sem valor de
// leilao.
//
// Levantamento: pedidos do relatorio pago ENTREGUES em producao, um por
// veiculo (placa distinta, o mais recente), entre 27/08 e 02/10/2026, com o
// bloco de restricoes do registro nacional presente: N = 139. Queries no PR.

export const LEVANTAMENTO = {
  n: 139,
  periodo: 'entre 27 de agosto e 2 de outubro de 2026',
  rotulo: 'levantamento PlacaCompleta com 139 consultas completas entre 27 de agosto e 2 de outubro de 2026',
}

export interface Bloco { h2: string; paragrafos?: string[]; lista?: string[] }
export interface Artigo {
  slug: string
  termo: string
  h1: string
  title: string
  description: string
  lead: string
  dado: { titulo: string; texto: string }
  blocos: Bloco[]
  faq: { pergunta: string; resposta: string }[]
  relacionados: string[]
  datePublished: string
}

const L = LEVANTAMENTO.rotulo

export const ARTIGOS: Artigo[] = [
  {
    slug: 'renavam',
    termo: 'RENAVAM',
    h1: 'O que é RENAVAM?',
    title: 'O que é RENAVAM e Para Que Serve o Código',
    description: 'RENAVAM é o registro nacional de veículos e o código de 11 dígitos de cada carro. Veja como funciona, onde achar e por que conferir antes de comprar um usado.',
    lead: 'RENAVAM é o Registro Nacional de Veículos Automotores, o cadastro oficial de todos os veículos do Brasil, mantido pela SENATRAN em conjunto com os DETRANs. O nome também designa o código RENAVAM, um número de 11 dígitos que o veículo recebe no primeiro registro e carrega pela vida inteira, mesmo quando muda de placa, de dono ou de estado.',
    dado: {
      titulo: 'O que a nossa base mostra',
      texto: `No ${L}, 19,4% dos veículos (27 de 139) tinham comunicação de venda ou intenção de venda registrada no cadastro nacional, e os carros consultados vinham de 22 UFs diferentes, com idade média de 15 anos. São registros que ficam no RENAVAM e não aparecem numa olhada rápida no documento.`,
    },
    blocos: [
      {
        h2: 'Como o RENAVAM funciona',
        paragrafos: [
          'Todo veículo fabricado ou importado no Brasil é cadastrado no RENAVAM antes de ser emplacado. A partir daí, cada evento importante da vida dele é registrado ali: transferências de propriedade, mudanças de característica, restrições financeiras e judiciais, comunicação de venda, roubo e furto, recall e baixa.',
          'Os DETRANs alimentam e consultam a mesma base nacional. É por isso que um carro registrado em um estado pode ser transferido para outro sem perder o histórico: o código RENAVAM continua o mesmo.',
        ],
      },
      {
        h2: 'Onde encontrar o código RENAVAM',
        lista: [
          'No CRLV (Certificado de Registro e Licenciamento do Veículo), impresso ou digital (CRLV-e).',
          'No aplicativo Carteira Digital de Trânsito, na ficha do veículo.',
          'Nos boletos e guias de IPVA e licenciamento do seu estado.',
        ],
      },
      {
        h2: 'Por que o RENAVAM importa na compra de um usado',
        paragrafos: [
          'O código RENAVAM é o que liga o carro que está na sua frente ao histórico oficial dele. Conferir se o número do documento bate com o cadastro, e se a placa e o chassi correspondem ao mesmo registro, é uma das primeiras defesas contra documento adulterado e veículo clonado.',
          'É também no cadastro nacional que ficam restrições que travam a transferência, como gravame de financiamento, bloqueio judicial (RENAJUD) e comunicação de venda pendente. Saber disso antes de pagar evita descobrir o problema só no DETRAN.',
        ],
      },
      {
        h2: 'Como consultar',
        paragrafos: [
          'Com a placa do veículo você faz a consulta básica na PlacaCompleta e vê marca, modelo, ano e cor. O relatório completo traz os dados do registro nacional, com indicadores de restrição, gravame, roubo e furto, RENAJUD e infrações, a partir da consulta oficial à SENATRAN.',
        ],
      },
    ],
    faq: [
      { pergunta: 'O RENAVAM muda quando o carro troca de dono?', resposta: 'Não. O código RENAVAM é atribuído uma vez, no primeiro registro, e acompanha o veículo por toda a vida, mesmo com troca de dono, de placa ou de estado.' },
      { pergunta: 'Quantos dígitos tem o RENAVAM?', resposta: 'O código RENAVAM atual tem 11 dígitos. Documentos antigos podem mostrar 9 dígitos; nesse caso, completa-se com zeros à esquerda.' },
      { pergunta: 'RENAVAM é a mesma coisa que chassi?', resposta: 'Não. O chassi (VIN) é gravado no veículo pela fábrica e identifica o carro fisicamente. O RENAVAM é o número do cadastro oficial. Os dois, junto com a placa, precisam apontar para o mesmo veículo.' },
      { pergunta: 'Dá para consultar um carro só pelo RENAVAM?', resposta: 'Os serviços do DETRAN usam placa e RENAVAM juntos. Na PlacaCompleta a consulta é feita pela placa, e o relatório completo traz os dados do registro nacional ligados a ela.' },
    ],
    relacionados: ['gravame', 'renajud', 'multas-renainf'],
    datePublished: '2026-10-02',
  },
  {
    slug: 'gravame',
    termo: 'Gravame',
    h1: 'O que é Gravame?',
    title: 'O que é Gravame de Veículo e Como Consultar',
    description: 'Gravame é o registro de que o veículo garante um financiamento. Entenda a alienação fiduciária, por que trava a transferência e como conferir antes da compra.',
    lead: 'Gravame é o registro, no cadastro do veículo, de que ele foi dado como garantia de um financiamento. Enquanto o gravame estiver ativo, o carro continua vinculado à instituição financeira e a transferência para outro dono fica bloqueada até a dívida ser quitada e a baixa ser feita.',
    dado: {
      titulo: 'O que a nossa base mostra',
      texto: `No ${L}, 20,9% dos veículos (29 de 139) tinham alienação fiduciária ativa registrada. Entre os carros com até 10 anos de fabricação, a proporção foi de 25,4% (15 de 59); entre os mais antigos, 17,5% (14 de 80).`,
    },
    blocos: [
      {
        h2: 'Como o gravame funciona',
        paragrafos: [
          'Quando alguém compra um carro financiado, a instituição financeira registra o gravame no sistema nacional, e o DETRAN lança essa restrição no cadastro do veículo. O comprador usa o carro normalmente, mas a propriedade plena só passa para ele depois de pagar a última parcela.',
          'Quitado o contrato, a própria instituição financeira solicita a baixa do gravame. Só depois disso o veículo fica livre para ser transferido sem pendência financeira.',
        ],
      },
      {
        h2: 'Tipos de gravame',
        lista: [
          'Alienação fiduciária: o modelo mais comum no financiamento de veículos. O carro fica em nome do comprador, mas como garantia da financeira até a quitação.',
          'Arrendamento mercantil (leasing): o veículo pertence à empresa arrendadora durante o contrato.',
          'Reserva de domínio: o vendedor mantém a propriedade até o pagamento integral. Hoje é raro.',
        ],
      },
      {
        h2: 'Por que o gravame importa na compra de um usado',
        paragrafos: [
          'Comprar um carro com gravame ativo sem um acordo formal de quitação significa pagar por um veículo que ainda serve de garantia para a dívida de outra pessoa. A transferência não sai no DETRAN, e se as parcelas atrasarem a financeira pode buscar o carro.',
          'Ter gravame não torna o negócio impossível: muitos carros são vendidos ainda financiados, com a quitação feita no ato da venda. O que importa é saber antes e negociar com segurança.',
        ],
      },
      {
        h2: 'Como consultar',
        paragrafos: [
          'O relatório completo da PlacaCompleta mostra se há gravame ou restrição financeira no registro nacional do veículo, junto com RENAJUD, roubo e furto e infrações. A consulta básica, pela placa, mostra marca, modelo, ano e cor.',
        ],
      },
    ],
    faq: [
      { pergunta: 'Posso comprar um carro com gravame?', resposta: 'Pode, desde que o gravame seja quitado e baixado. O caminho mais seguro é fazer a quitação junto com a venda, com a instituição financeira, e só concluir o pagamento ao vendedor depois da baixa.' },
      { pergunta: 'Quanto tempo leva para baixar o gravame?', resposta: 'Depois da quitação, a baixa é pedida pela própria instituição financeira e costuma sair em poucos dias úteis. Confira no cadastro do veículo antes de transferir.' },
      { pergunta: 'Gravame aparece no documento do carro?', resposta: 'O CRLV pode indicar a alienação fiduciária, mas o retrato atualizado está no cadastro nacional. Uma consulta pela placa mostra a situação no momento da compra.' },
      { pergunta: 'Gravame é a mesma coisa que dívida de IPVA?', resposta: 'Não. Gravame é o vínculo com um financiamento. Débitos de IPVA, licenciamento e multas são pendências diferentes, consultadas à parte.' },
    ],
    relacionados: ['intencao-de-gravame', 'renavam', 'renajud', 'multas-renainf'],
    datePublished: '2026-10-02',
  },
  {
    slug: 'intencao-de-gravame',
    termo: 'Intenção de gravame',
    h1: 'Consta intenção de gravame: o que é e o que fazer',
    title: 'Consta Intenção de Gravame: Significado e o Que Fazer',
    description: 'Viu "consta intenção de gravame" ou "restrição financeira consta gravame" numa consulta? Entenda o que significa e o que fazer antes de comprar o carro.',
    lead: 'Quando uma consulta mostra "consta intenção de gravame" ou "restrição financeira consta gravame", quer dizer que existe, no cadastro do veículo, um registro de uma instituição financeira ligado a um financiamento. Não é multa, não é dívida de imposto e não indica, por si só, roubo ou fraude: é um aviso de que o carro pode estar servindo de garantia para um contrato, e de que a transferência pode ficar travada até esse registro ser resolvido.',
    dado: {
      titulo: 'O que a nossa base mostra',
      texto: `No ${L}, 20,9% dos veículos (29 de 139) tinham alienação fiduciária ativa registrada, a forma mais comum de restrição financeira. Ver essa informação numa consulta é um achado comum entre carros usados, e o que muda tudo é saber antes de pagar.`,
    },
    blocos: [
      {
        h2: 'O que é intenção de gravame',
        paragrafos: [
          'Intenção de gravame é o registro que a instituição financeira faz no sistema de gravames quando um financiamento começa a ser contratado, antes de o gravame definitivo estar formalizado. Na prática, é um pré-registro que sinaliza: este veículo está sendo oferecido como garantia de uma operação de crédito.',
          'O nome e o detalhe do status mudam conforme o sistema que mostra a informação, mas a ideia é a mesma. Se a operação é concluída, o registro vira o gravame (a alienação fiduciária) do financiamento. Se a operação não segue adiante e o registro não é cancelado, ele pode continuar aparecendo.',
        ],
      },
      {
        h2: 'O que significa "restrição financeira consta gravame"',
        paragrafos: [
          'Restrição financeira é o grupo de registros ligados a crédito que podem limitar o que se faz com o veículo. O gravame é o principal deles: o vínculo entre o carro e a instituição financeira que o aceitou como garantia.',
          'Quando a consulta traz "consta gravame", o registro está ativo no cadastro naquele momento. Isso não diz se as parcelas estão em dia nem quanto falta pagar. Só a financeira, ou o contrato, responde isso.',
        ],
      },
      {
        h2: 'Por que isso aparece na consulta',
        lista: [
          'O carro está financiado e o contrato ainda está em andamento.',
          'O financiamento foi quitado, mas a baixa do gravame ainda não foi feita ou não foi concluída.',
          'Houve um pedido de financiamento (ou uma simulação formalizada) que não foi adiante, e o registro de intenção não foi cancelado.',
          'O veículo foi refinanciado ou trocou de instituição financeira, e o registro anterior não foi atualizado.',
          'O contrato é de leasing ou de reserva de domínio, em que a propriedade fica com outra parte até o fim do pagamento.',
        ],
      },
      {
        h2: 'O que fazer antes de comprar um carro com esse registro',
        lista: [
          'Peça ao vendedor o contrato de financiamento e, se ele diz que quitou, o comprovante de quitação e o documento de baixa.',
          'Confira a placa de novo no dia do pagamento, porque o registro pode mudar de um dia para o outro.',
          'Se o carro ainda está financiado, combine a quitação direto com a financeira, no ato da venda, e só pague o vendedor depois da baixa.',
          'Não pague sinal alto nem feche transferência com a promessa de que "depois ele baixa". Sem a baixa, a transferência pode não sair.',
          'Desconfie de pressa e de preço muito abaixo do mercado junto com um registro de restrição.',
          'Se ficou em dúvida, não feche. Há muito carro parecido sem essa pendência.',
        ],
      },
      {
        h2: 'Como pedir a baixa do gravame',
        paragrafos: [
          'Quem pede a baixa é a instituição financeira que registrou o gravame, e não o dono do carro nem o comprador. Se você é o dono e o financiamento foi quitado, siga estes passos.',
        ],
        lista: [
          'Peça à financeira a baixa do gravame e anote o número do protocolo.',
          'Guarde o comprovante de quitação e o contrato.',
          'Aguarde alguns dias úteis e consulte o cadastro do veículo para ver se o registro saiu.',
          'Se o registro era só uma intenção de um financiamento que você não fechou, peça à instituição que o cancele e guarde a resposta por escrito.',
          'Se a financeira não resolver, registre reclamação no canal de ouvidoria dela e, depois, no Procon e no Banco Central.',
        ],
      },
      {
        h2: 'Como conferir pela placa',
        paragrafos: [
          'A consulta básica da PlacaCompleta é grátis e mostra marca, modelo, ano e cor do carro. O relatório completo mostra se consta gravame ou restrição financeira no cadastro do veículo, junto com indicadores de roubo e furto, RENAJUD, leilão e infrações. É um indicador, não uma sentença: serve para você saber o que perguntar ao vendedor antes de pagar.',
        ],
      },
    ],
    faq: [
      { pergunta: 'Consta intenção de gravame: posso comprar o carro?', resposta: 'Pode, mas só com a situação esclarecida. Se o registro for de um financiamento ativo, a quitação e a baixa precisam acontecer antes ou junto com a venda. Se for uma intenção que não seguiu adiante, o dono precisa pedir o cancelamento à financeira.' },
      { pergunta: 'Intenção de gravame é a mesma coisa que gravame?', resposta: 'Não exatamente. A intenção é o pré-registro feito pela financeira quando o financiamento começa. O gravame é o vínculo já formalizado com o contrato. Ambos podem travar a transferência.' },
      { pergunta: 'Quem dá baixa na restrição financeira?', resposta: 'A instituição financeira que registrou. O dono pede, com comprovante de quitação, e a financeira envia a baixa ao sistema. O comprador não consegue baixar sozinho.' },
      { pergunta: 'Consta gravame quer dizer que o carro é roubado ou fraudado?', resposta: 'Não. Gravame é registro de financiamento, algo comum e legal. Roubo e furto, leilão e débitos são outros registros, consultados à parte.' },
      { pergunta: 'O gravame some sozinho depois de pagar o financiamento?', resposta: 'Não. Depois da quitação, a financeira precisa solicitar a baixa. Se isso não for feito, o registro continua aparecendo, e por isso vale cobrar o protocolo.' },
    ],
    relacionados: ['gravame', 'renavam', 'renajud'],
    datePublished: '2026-10-20',
  },
  {
    slug: 'renajud',
    termo: 'RENAJUD',
    h1: 'O que é RENAJUD?',
    title: 'O que é RENAJUD: Restrição Judicial',
    description: 'RENAJUD é o sistema pelo qual juízes bloqueiam veículos no cadastro nacional. Veja os tipos de restrição, o que cada uma impede e como conferir antes da compra.',
    lead: 'RENAJUD é o sistema que liga o Poder Judiciário ao cadastro nacional de veículos (RENAVAM). Por ele, um juiz registra online restrições sobre um veículo, como bloqueio de transferência, de licenciamento ou de circulação, normalmente para garantir o pagamento de uma dívida discutida em processo.',
    dado: {
      titulo: 'O que a nossa base mostra',
      texto: `No ${L}, 3,6% dos veículos (5 de 139) tinham restrição RENAJUD ativa. É pouco, mas é o tipo de pendência que não se resolve com o vendedor nem no DETRAN: só a Justiça retira.`,
    },
    blocos: [
      {
        h2: 'Como o RENAJUD funciona',
        paragrafos: [
          'O RENAJUD nasceu de um acordo entre o Conselho Nacional de Justiça e o órgão máximo de trânsito para substituir os antigos ofícios em papel. O juiz consulta o veículo, registra a restrição e ela passa a valer no cadastro nacional, visível para os DETRANs de todo o país.',
          'A restrição fica ativa até que o próprio juízo determine a retirada, por exemplo depois do pagamento da dívida ou do fim do processo.',
        ],
      },
      {
        h2: 'Tipos de restrição RENAJUD',
        lista: [
          'Transferência: impede registrar a venda para outro dono.',
          'Licenciamento: impede a transferência e também o licenciamento anual.',
          'Circulação (restrição total): impede transferência, licenciamento e o uso do veículo, que pode ser recolhido.',
          'Registro de penhora: informa que o veículo foi penhorado num processo.',
        ],
      },
      {
        h2: 'Por que o RENAJUD importa na compra de um usado',
        paragrafos: [
          'Um carro com restrição RENAJUD pode estar vinculado a um processo em que o dono atual é devedor. Quem compra nessas condições corre o risco de não conseguir transferir, ou até de perder o veículo por decisão judicial.',
          'Diferente de uma multa ou de um débito de IPVA, a restrição judicial não é resolvida pagando uma guia no DETRAN: depende de uma ordem do juiz que a determinou.',
        ],
      },
      {
        h2: 'Como consultar',
        paragrafos: [
          'O relatório completo da PlacaCompleta traz o indicador de restrição RENAJUD do registro nacional do veículo, junto com gravame, roubo e furto e infrações. A consulta básica, pela placa, mostra marca, modelo, ano e cor.',
        ],
      },
    ],
    faq: [
      { pergunta: 'Como tirar uma restrição RENAJUD?', resposta: 'Só o juízo que determinou a restrição pode retirá-la. O interessado precisa pedir no processo, normalmente comprovando o pagamento da dívida ou outra razão para o desbloqueio.' },
      { pergunta: 'Posso comprar um carro com RENAJUD?', resposta: 'É arriscado. Dependendo do tipo de restrição, a transferência não sai e o veículo pode ser recolhido. O recomendado é só fechar negócio depois que a restrição for retirada.' },
      { pergunta: 'RENAJUD aparece no documento do carro?', resposta: 'Não necessariamente. A restrição fica no cadastro nacional e pode ter sido registrada depois da emissão do documento. Por isso vale consultar pela placa antes da compra.' },
      { pergunta: 'RENAJUD é a mesma coisa que gravame?', resposta: 'Não. Gravame é o vínculo com um financiamento. RENAJUD é uma restrição determinada pela Justiça. Um carro pode ter um, outro, os dois ou nenhum.' },
    ],
    relacionados: ['gravame', 'renavam', 'multas-renainf'],
    datePublished: '2026-10-02',
  },
  {
    slug: 'multas-renainf',
    termo: 'Multas RENAINF',
    h1: 'O que são multas RENAINF?',
    title: 'O que São Multas RENAINF e Como Consultar',
    description: 'Multa RENAINF é a infração no Registro Nacional de Infrações de Trânsito, em geral de outro estado. Entenda como funciona e por que conferir antes de comprar.',
    lead: 'Multas RENAINF são infrações de trânsito registradas no RENAINF, o Registro Nacional de Infrações de Trânsito. Esse sistema nacional junta as autuações de todos os órgãos, e é por ele que uma multa aplicada em um estado chega ao cadastro de um veículo registrado em outro.',
    dado: {
      titulo: 'O que a nossa base mostra',
      texto: `No ${L}, 23,0% dos veículos (32 de 139) tinham indicador de infração no RENAINF. Nos carros com até 10 anos, foram 25,4% (15 de 59). No relatório completo, as infrações em aberto são detalhadas pelo DETRAN em 20 UFs.`,
    },
    blocos: [
      {
        h2: 'Como o RENAINF funciona',
        paragrafos: [
          'Cada órgão autuador (DETRAN, polícias rodoviárias, prefeituras) registra as próprias infrações. O RENAINF, gerido pela SENATRAN, integra esses registros numa base nacional e permite que o estado de registro do veículo cobre multas aplicadas em outros estados.',
          'Por isso o indicador RENAINF é especialmente importante para quem compra carro de outro estado ou carro que roda muito em estrada: as infrações interestaduais aparecem ali.',
        ],
      },
      {
        h2: 'Por que as multas importam na compra de um usado',
        paragrafos: [
          'Multas em aberto ficam vinculadas ao veículo e impedem o licenciamento e a transferência enquanto não forem pagas (Código de Trânsito Brasileiro, artigos 128 e 131). Na prática, quem compra sem saber herda a pendência para conseguir regularizar o carro.',
          'Saber o valor das infrações em aberto antes de fechar negócio permite negociar o abatimento no preço ou exigir a quitação pelo vendedor.',
        ],
      },
      {
        h2: 'Como consultar',
        paragrafos: [
          'O relatório completo da PlacaCompleta traz o indicador de infração RENAINF do registro nacional e, para veículos registrados em 20 UFs (SP, SC, MG, BA, RS, GO, PR, DF, CE, PA, AM, PE, ES, MA, AC, AL, PI, RR, RO e RN), detalha as infrações em aberto direto do DETRAN, com data, local, órgão autuador e valor. A consulta básica, pela placa, mostra marca, modelo, ano e cor.',
        ],
      },
    ],
    faq: [
      { pergunta: 'Multa RENAINF é diferente de multa comum?', resposta: 'É a mesma infração de trânsito. O nome indica que ela está registrada no sistema nacional, o que permite a cobrança mesmo quando o órgão autuador é de outro estado.' },
      { pergunta: 'Multa em aberto impede a transferência do carro?', resposta: 'Sim. Enquanto houver multa vencida vinculada ao veículo, o licenciamento e a transferência ficam bloqueados (CTB, artigos 128 e 131).' },
      { pergunta: 'A multa passa para o novo dono?', resposta: 'A multa fica vinculada ao veículo. Para licenciar ou transferir, o débito precisa ser pago, por isso vale combinar com o vendedor antes da compra quem paga.' },
      { pergunta: 'Onde ver as infrações em aberto de um carro?', resposta: 'No DETRAN do estado de registro e no relatório completo da PlacaCompleta, que detalha as infrações em aberto pelo DETRAN em 20 UFs e traz o indicador RENAINF para todo o país.' },
    ],
    relacionados: ['renavam', 'gravame', 'renajud'],
    datePublished: '2026-10-02',
  },
]

export const artigoPorSlug = (slug: string) => ARTIGOS.find((a) => a.slug === slug) || null
