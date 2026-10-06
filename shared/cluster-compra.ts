// Cluster de compra (plano SEO 02/out, item #11): paginas pra quem esta perto
// de comprar um usado e busca "laudo cautelar" (14.800/mes), "historico
// veicular" (2.400), "consulta veicular completa" (1.900) e "consulta de
// leilao" (720). Todas levam ao relatorio completo, dizendo com honestidade o
// que ele traz e o que NAO traz: nao somos vistoria cautelar presencial.
// Regras: sem travessao, sem "gratis" no title, sem nomear fornecedor de
// dados (fonte oficial: SENATRAN/DETRAN), sem valor de leilao, sem afirmar
// que o carro do leitor tem problema.

export interface SecaoCompra { h2: string; paragrafos?: string[]; lista?: string[] }
export interface PaginaCompra {
  rota: string
  termo: string
  h1: string
  title: string
  description: string
  lead: string
  secoes: SecaoCompra[]
  faq: { pergunta: string; resposta: string }[]
  datePublished: string
}

/** O que o relatorio completo traz (espelha shared/planos.ts). */
export const COMPLETA_TRAZ = [
  'Dados do registro nacional do veículo (SENATRAN): ficha técnica, chassi e RENAVAM completos, situação cadastral, município e UF',
  'Indicador de roubo e furto',
  'Gravame e alienação fiduciária',
  'RENAJUD e restrições judiciais, administrativas e de RFB',
  'Indicador de infrações no RENAINF e, em 15 UFs, as infrações em aberto direto do DETRAN',
  'Recall pendente',
  'Registro de leilão no documento e histórico de leilão cruzado com nossa base de mais de 1 milhão de veículos leiloados',
  'Comunicação de venda',
  'Valor FIPE com histórico, seguro estimado e custo em 5 anos',
  'Origem de fabricação pelo chassi',
]

/** O que ele NAO traz (honestidade: nao e vistoria). */
export const COMPLETA_NAO_TRAZ = [
  'Vistoria física: ninguém olha o carro. Não verificamos pintura, estrutura, solda, motor nem gravação de chassi e vidros.',
  'Laudo cautelar com aprovação ou reprovação técnica, que só uma empresa de vistoria faz com o carro na frente.',
  'Quilometragem real nem histórico de manutenção em oficina.',
  'Garantia de que um sinistro sem registro oficial não aconteceu.',
]

const LEAD_COMPLETA = 'O relatório completo da PlacaCompleta reúne, pela placa, o que os registros oficiais e a nossa base de leilões dizem sobre o veículo, em até 5 minutos.'

export const PAGINAS_COMPRA: PaginaCompra[] = [
  {
    rota: '/laudo-cautelar',
    termo: 'Laudo cautelar',
    h1: 'Laudo cautelar: o que é e o que checar antes',
    title: 'Laudo Cautelar: O Que É e O Que Checar Antes da Vistoria',
    description: 'Laudo cautelar é a vistoria técnica de um usado antes da compra. Veja o que ele avalia, o que fica de fora e como checar o histórico do carro pela placa antes.',
    lead: 'Laudo cautelar é uma vistoria técnica feita por uma empresa especializada, com o carro presente, para checar se a identificação e a estrutura do veículo estão íntegras antes da compra. Ele confere chassi, motor, pintura e sinais de batida. O que ele não mostra é o histórico registrado do carro, como gravame, bloqueio judicial, roubo e leilão, e é aí que entra a consulta pela placa.',
    secoes: [
      { h2: 'O que o laudo cautelar avalia', lista: ['Gravação do chassi, do motor e dos vidros', 'Estrutura, longarinas e colunas, em busca de reparo de batida', 'Pintura e massa (espessura da tinta)', 'Sinais de enchente, incêndio ou remontagem', 'Conferência dos dados do documento com o veículo'] },
      { h2: 'O que a consulta pela placa traz e o laudo não', paragrafos: ['Muitas pendências não aparecem olhando o carro: um gravame de financiamento, um bloqueio judicial, um registro de roubo recuperado, um recall em aberto, uma passagem por leilão. Elas estão nos registros oficiais e em bases de leilão, e é isso que o relatório completo cruza pela placa.', LEAD_COMPLETA] },
      { h2: 'Qual fazer primeiro', paragrafos: ['O caminho mais barato é consultar a placa antes de marcar a vistoria. Se o histórico já mostra um problema, você economiza o laudo e o deslocamento. Se o histórico está limpo, o laudo cautelar confere o que só se vê com o carro na frente. Um não substitui o outro.'] },
    ],
    faq: [
      { pergunta: 'O relatório da PlacaCompleta substitui o laudo cautelar?', resposta: 'Não. O relatório é uma consulta de registros e bases de dados pela placa; o laudo cautelar é uma vistoria física do veículo. Eles se complementam.' },
      { pergunta: 'Quando fazer o laudo cautelar?', resposta: 'Antes de pagar, depois de ter consultado o histórico pela placa e negociado o preço. Muitas empresas de vistoria atendem com hora marcada.' },
      { pergunta: 'O laudo cautelar mostra se o carro foi de leilão?', resposta: 'Ele pode encontrar sinais físicos de reparo, mas o registro de leilão está em documentos e editais. A consulta pela placa cruza o veículo com essa base.' },
      { pergunta: 'Laudo cautelar é obrigatório?', resposta: 'Não para a compra entre particulares, mas é recomendado. A vistoria de transferência feita no DETRAN é outra coisa e tem outro objetivo.' },
    ],
    datePublished: '2026-10-02',
  },
  {
    rota: '/historico-veicular',
    termo: 'Histórico veicular',
    h1: 'Histórico veicular pela placa: o que dá para saber',
    title: 'Histórico Veicular pela Placa: O Que Dá Para Saber',
    description: 'Histórico veicular é o que está registrado sobre o carro: restrições, roubo, leilão, recall e infrações. Veja o que a placa revela antes da compra.',
    lead: 'Histórico veicular é o conjunto de registros oficiais e de mercado ligados a um veículo ao longo da vida dele: restrições financeiras e judiciais, ocorrências de roubo e furto, passagem por leilão, recall, infrações e a evolução do valor. Pela placa dá para reunir esse histórico antes de fechar negócio.',
    secoes: [
      { h2: 'O que entra no histórico de um veículo', lista: COMPLETA_TRAZ },
      { h2: 'O que o histórico não mostra', lista: COMPLETA_NAO_TRAZ },
      { h2: 'Como consultar', paragrafos: [LEAD_COMPLETA, 'A consulta básica, com marca, modelo, ano, cor e valor FIPE, aparece na hora. O restante fica no relatório completo.'] },
    ],
    faq: [
      { pergunta: 'Dá para ver os donos anteriores pelo histórico?', resposta: 'Não. Dados pessoais de proprietários são protegidos pela LGPD e não fazem parte da consulta.' },
      { pergunta: 'O histórico mostra se o carro foi batido?', resposta: 'Mostra o que foi registrado oficialmente, como recuperação de sinistro ou passagem por leilão. Batida sem registro só aparece numa vistoria física.' },
      { pergunta: 'O histórico é atualizado?', resposta: 'Os dados vêm da consulta oficial no momento em que o relatório é emitido.' },
    ],
    datePublished: '2026-10-02',
  },
  {
    rota: '/consulta-veicular-completa',
    termo: 'Consulta veicular completa',
    h1: 'Consulta veicular completa: o que vem no relatório',
    title: 'Consulta Veicular Completa: O Que Vem no Relatório',
    description: 'O que uma consulta veicular completa traz: roubo e furto, gravame, RENAJUD, leilão, recall, infrações e FIPE. Veja o que o relatório inclui e o que não inclui.',
    lead: 'Uma consulta veicular completa reúne, pela placa, os dados do registro nacional do veículo e as pendências que decidem uma compra: roubo e furto, gravame, bloqueio judicial, leilão, recall e infrações. É o passo entre ver o anúncio e marcar a visita.',
    secoes: [
      { h2: 'O que vem no relatório completo', lista: COMPLETA_TRAZ },
      { h2: 'O que não vem (e onde conseguir)', lista: COMPLETA_NAO_TRAZ },
      { h2: 'Consulta básica ou completa?', paragrafos: ['A consulta básica mostra a ficha do veículo e serve para confirmar que o anúncio bate com o carro. A completa é a que mostra as pendências que travam a transferência ou derrubam o preço. Para quem vai fechar negócio, é a completa que importa.', LEAD_COMPLETA] },
    ],
    faq: [
      { pergunta: 'Quanto tempo leva a consulta completa?', resposta: 'Em geral sai em até 5 minutos depois do pagamento, na tela e por e-mail se você informar um.' },
      { pergunta: 'A consulta completa vale para moto e caminhão?', resposta: 'Sim. A consulta é pela placa e vale para carros, motos, caminhões e outros veículos registrados no Brasil.' },
      { pergunta: 'De onde vêm os dados?', resposta: 'Do registro nacional de veículos (SENATRAN), dos DETRANs e da nossa base própria de leilões, montada a partir de editais e catálogos públicos.' },
    ],
    datePublished: '2026-10-02',
  },
  {
    rota: '/consulta-leilao-veiculo',
    termo: 'Consulta de leilão',
    h1: 'Consulta de leilão de veículo pela placa',
    title: 'Consulta de Leilão de Veículo pela Placa e Chassi',
    description: 'Como consultar se um veículo passou por leilão: registro no documento, editais de DETRAN e catálogos de leiloeiras. Veja o que a consulta pela placa encontra.',
    lead: 'A consulta de leilão cruza a placa e o chassi do veículo com registros de leilão: o indicador que consta no registro nacional e uma base própria montada a partir de editais de DETRANs e catálogos de leiloeiras. Ela diz se existe registro compatível e de que tipo, para você negociar sabendo.',
    secoes: [
      { h2: 'O que a consulta de leilão encontra', lista: ['Registro de leilão no documento do veículo (indicador do registro nacional)', 'Passagens em editais de leilão de DETRANs e em catálogos de leiloeiras, cruzadas por placa e chassi', 'Editais de notificação para leilão, quando o veículo foi listado em pátio', 'O nível de cada achado: confirmado (placa ou chassi completos iguais) ou provável (identificador parcial mais atributos do veículo)'] },
      { h2: 'O que ela não garante', paragrafos: ['Nenhuma base cobre todos os leilões já feitos no país. Um resultado sem registro quer dizer que não encontramos registro compatível, não que o carro nunca passou por leilão. E a consulta não avalia o estado físico do veículo: para isso existe a vistoria cautelar.'] },
      { h2: 'Como consultar', paragrafos: [LEAD_COMPLETA, 'Veja também o guia carro de leilão, com os tipos de leilão e o que cada um significa na hora de negociar.'] },
    ],
    faq: [
      { pergunta: 'Carro de leilão é sempre ruim?', resposta: 'Não. Carros retomados de financiamento, por exemplo, podem estar em ótimo estado. O que muda é o valor de revenda e a necessidade de uma vistoria mais cuidadosa.' },
      { pergunta: 'A consulta mostra o valor que o carro foi vendido no leilão?', resposta: 'Não. A consulta mostra se há registro compatível, a data e a origem do registro, sem valores de venda.' },
      { pergunta: 'Dá para consultar leilão pelo chassi?', resposta: 'O relatório completo usa o chassi do registro nacional junto com a placa para cruzar com a base de leilões.' },
    ],
    datePublished: '2026-10-02',
  },
]

export const paginaCompra = (rota: string) => PAGINAS_COMPRA.find((p) => p.rota === rota) || null
