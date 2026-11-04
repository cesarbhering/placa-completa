import { BASE_LEILAO_TEXTO } from './base-leilao'
// Cluster /consultar/{tema} (pedido do Cesar, 04/nov/2026): landing simples
// por verificacao (gravame, leilao, recall, multas, roubo e furto, FIPE), com
// um card de placa que leva pra consulta normal da home (/placa/<PLACA>).
// Regras: sem travessao; "gratis"/"gratuita" nunca em title, description, og
// nem JSON-LD (o FAQ vira JSON-LD, entao tambem fica fora das respostas); sem
// nomear fornecedor; sem valor de arremate; nunca afirmar que o carro do
// leitor tem problema. Copy em aberto (Cesar, 04/nov): sem preco, sem matriz
// de planos; so o tema e o caminho placa > previa > relatorio completo.

export interface TemaConsultar {
  slug: string
  /** Rotulo curto (links, breadcrumb, indice). */
  termo: string
  /** Uma linha para o indice /consultar. */
  resumo: string
  h1: string
  /** Variantes de title, da preferida pra mais curta (escolherTitulo). */
  titulos: string[]
  description: string
  lead: string
  mostra: { paragrafo: string; lista: string[] }
  /** Terceiro passo de "Como consultar pela placa". */
  passo3: string
  faq: { pergunta: string; resposta: string }[]
}

const NO_COMPLETO = 'No relatório completo. Digite a placa, veja a prévia na hora e siga para a Consulta Completa.'

export const TEMAS_CONSULTAR: TemaConsultar[] = [
  {
    slug: 'gravame',
    termo: 'Gravame',
    resumo: 'Financiamento ou alienação fiduciária ainda registrada no veículo.',
    h1: 'Como saber se um carro tem gravame pela placa',
    titulos: ['Consultar Gravame pela Placa: Veja se o Carro Está Alienado', 'Consultar Gravame pela Placa do Veículo', 'Consultar Gravame pela Placa'],
    description: 'Veja pela placa se o carro tem gravame ou alienação fiduciária registrada antes de pagar. Saiba o que a verificação mostra e o que fazer se aparecer.',
    lead: 'Gravame é a marca que o banco coloca no registro do veículo enquanto o financiamento não é quitado. Carro com gravame ativo não pode ser transferido, então vale checar pela placa antes de pagar.',
    mostra: {
      paragrafo: 'A verificação cruza a placa com o registro nacional do veículo e diz se existe gravame ou alienação fiduciária registrada, e de que tipo.',
      lista: ['Se há gravame ativo no registro', 'Tipo de restrição financeira (alienação fiduciária, arrendamento, reserva de domínio)', 'Restrições judiciais e administrativas que também travam a transferência'],
    },
    passo3: 'Se aparecer gravame, exija a baixa do gravame pelo banco antes de pagar qualquer valor.',
    faq: [
      { pergunta: 'O que é gravame?', resposta: 'É o registro de que o veículo está dado em garantia de um financiamento ou consórcio. Ele fica no registro do carro até o banco informar a quitação.' },
      { pergunta: 'Posso comprar um carro com gravame?', resposta: 'Pode negociar, mas a transferência só sai depois da baixa. O caminho seguro é quitar o saldo junto com o vendedor e só pagar o restante com a baixa registrada.' },
      { pergunta: 'Quanto tempo leva a baixa do gravame?', resposta: 'Depois da quitação, o banco costuma informar a baixa em poucos dias úteis. Confirme consultando a placa de novo antes de concluir o negócio.' },
      { pergunta: 'Gravame é a mesma coisa que alienação fiduciária?', resposta: 'Alienação fiduciária é o tipo mais comum de gravame. Existem outros, como arrendamento mercantil e reserva de domínio.' },
      { pergunta: 'Onde vejo o gravame na PlacaCompleta?', resposta: NO_COMPLETO },
    ],
  },
  {
    slug: 'leilao',
    termo: 'Leilão',
    resumo: 'Passagem por leilão no histórico e registro no documento.',
    h1: 'Como saber se um carro foi de leilão pela placa',
    titulos: ['Consultar Leilão pela Placa: Veja se o Carro Foi de Leilão', 'Consulta de Leilão pela Placa do Veículo', 'Consulta de Leilão pela Placa'],
    description: `Veja pela placa se o carro tem passagem por leilão. A verificação cruza o registro do veículo com ${BASE_LEILAO_TEXTO}.`,
    lead: 'Carro que passou por leilão costuma valer menos e pode ter seguro mais difícil. Muitas vezes o vendedor não conta, por isso vale checar o histórico pela placa antes de fechar.',
    mostra: {
      paragrafo: `A verificação busca o registro de leilão no documento do veículo e cruza o carro com a nossa base de ${BASE_LEILAO_TEXTO}.`,
      lista: ['Registro de leilão no documento do veículo', 'Passagens por leilão encontradas na nossa base, com data e categoria quando disponíveis', 'Sinais que pedem uma vistoria mais cuidadosa'],
    },
    passo3: 'Se aparecer leilão, leve o carro a uma vistoria cautelar e use o histórico para renegociar o preço.',
    faq: [
      { pergunta: 'Por que carro de leilão vale menos?', resposta: 'Porque parte deles vem de sinistro, recuperação de roubo ou frota. O mercado desconta esse histórico, e algumas seguradoras recusam ou encarecem a apólice.' },
      { pergunta: 'Todo carro de leilão tem problema?', resposta: 'Não. Há carros de frota e de financeira em bom estado. O histórico serve para você saber o que está comprando e pagar o preço justo.' },
      { pergunta: 'A consulta mostra o valor pago no leilão?', resposta: 'Não. Mostramos se há passagem por leilão e as informações do registro, sem valores de arremate.' },
      { pergunta: 'Se não aparecer nada, o carro nunca foi a leilão?', resposta: 'Significa que não encontramos registro no documento nem na nossa base. Nenhuma base cobre todos os leilões do país, então a vistoria continua recomendada.' },
      { pergunta: 'Onde vejo o histórico de leilão na PlacaCompleta?', resposta: NO_COMPLETO },
    ],
  },
  {
    slug: 'recall',
    termo: 'Recall',
    resumo: 'Campanhas de recall do fabricante ainda pendentes para o veículo.',
    h1: 'Como saber se um carro tem recall pendente pela placa',
    titulos: ['Consultar Recall pela Placa: Veja se Há Recall Pendente', 'Consultar Recall pela Placa do Veículo', 'Consultar Recall pela Placa'],
    description: 'Veja pela placa se o carro tem recall pendente de fabricante. Saiba o que a verificação mostra e como agendar o reparo na rede autorizada.',
    lead: 'Recall é o chamado do fabricante para corrigir um defeito que pode afetar a segurança. Quando ele fica pendente, o problema continua no carro. Pela placa dá para saber antes de comprar.',
    mostra: {
      paragrafo: 'A verificação consulta as campanhas de recall registradas para o veículo e mostra as que ainda constam como pendentes.',
      lista: ['Se há recall pendente registrado para o veículo', 'Descrição da campanha, quando disponível', 'Base para pedir o reparo na rede autorizada'],
    },
    passo3: 'Se aparecer recall pendente, agende o reparo na rede autorizada da marca antes ou logo depois da compra.',
    faq: [
      { pergunta: 'Posso comprar um carro com recall pendente?', resposta: 'Pode. O defeito continua no carro até o reparo ser feito, então agende o atendimento na rede autorizada logo depois da compra.' },
      { pergunta: 'Quem paga o reparo do recall?', resposta: 'O fabricante. O reparo de recall é feito sem custo para o dono na rede autorizada, mesmo em carro usado e fora da garantia.' },
      { pergunta: 'Como sei se o recall já foi feito?', resposta: 'Quando a concessionária registra o atendimento, a campanha deixa de constar como pendente. Se tiver dúvida, peça o comprovante ao vendedor.' },
      { pergunta: 'Recall vence?', resposta: 'Não. O fabricante continua obrigado a fazer o reparo, mesmo anos depois do chamado.' },
      { pergunta: 'Onde vejo o recall na PlacaCompleta?', resposta: NO_COMPLETO },
    ],
  },
  {
    slug: 'multas',
    termo: 'Multas',
    resumo: 'Indicador de infrações e, em 20 estados, as infrações em aberto.',
    h1: 'Como consultar multas de um carro pela placa',
    titulos: ['Consultar Multas pela Placa: Infrações do Veículo', 'Consultar Multas pela Placa do Veículo', 'Consultar Multas pela Placa'],
    description: 'Veja pela placa se o veículo tem indicador de infrações e, em 20 estados, as infrações em aberto direto do DETRAN. Saiba o que entra na negociação.',
    lead: 'Multa em aberto acompanha o carro, não o dono antigo, e precisa estar paga para licenciar. Antes de comprar, vale saber pela placa se há infrações registradas.',
    mostra: {
      paragrafo: 'A verificação mostra o indicador de infrações no RENAINF, a base nacional de multas, e, em 20 estados, as infrações em aberto direto do DETRAN.',
      lista: ['Indicador de infrações registradas no RENAINF', 'Infrações em aberto direto do DETRAN, em 20 estados', 'Comunicação de venda, quando houver'],
    },
    passo3: 'Se aparecerem infrações, some os débitos à negociação e combine quem paga antes da transferência.',
    faq: [
      { pergunta: 'A multa fica com o carro ou com o dono?', resposta: 'A pontuação vai para o condutor, mas o valor fica vinculado ao veículo. Sem pagar, o carro não é licenciado.' },
      { pergunta: 'A consulta mostra o valor exato de cada multa?', resposta: 'Não prometemos valor exato. Mostramos o indicador de infrações e, nos 20 estados em que consultamos o DETRAN, as infrações em aberto. Confirme os valores no DETRAN antes de pagar.' },
      { pergunta: 'A consulta mostra IPVA e licenciamento?', resposta: 'Não em todos os estados. Para IPVA e licenciamento, confira no site do DETRAN ou da Secretaria da Fazenda do estado do veículo.' },
      { pergunta: 'Quem paga as multas na compra de um usado?', resposta: 'É negociação entre as partes. O mais comum é o vendedor quitar antes ou o valor ser descontado do preço.' },
      { pergunta: 'Onde vejo as multas na PlacaCompleta?', resposta: NO_COMPLETO },
    ],
  },
  {
    slug: 'roubo-furto',
    termo: 'Roubo e furto',
    resumo: 'Indicador de roubo ou furto registrado para o veículo.',
    h1: 'Como saber se um carro é roubado pela placa',
    titulos: ['Consultar Roubo e Furto pela Placa: Veja o Histórico do Carro', 'Consultar Roubo e Furto pela Placa do Veículo', 'Consultar Roubo e Furto pela Placa'],
    description: 'Veja pela placa se existe indicador de roubo ou furto registrado para o veículo antes de fechar negócio. Saiba o que fazer se aparecer.',
    lead: 'Comprar um carro com registro de roubo ou furto pode significar perder o carro e o dinheiro. Pela placa dá para saber se existe indicador registrado antes de fechar.',
    mostra: {
      paragrafo: 'A verificação cruza a placa com o registro nacional do veículo e mostra se existe indicador de roubo ou furto, ativo ou já recuperado.',
      lista: ['Indicador de roubo ou furto no registro', 'Restrições judiciais (RENAJUD) e administrativas', 'Dados do registro para conferir com o documento e o chassi'],
    },
    passo3: 'Se aparecer indicador de roubo ou furto, não feche negócio e procure a polícia.',
    faq: [
      { pergunta: 'Carro recuperado de roubo pode ser vendido?', resposta: 'Pode, depois de regularizado. O registro de recuperação costuma ficar no histórico e pesa no preço e no seguro.' },
      { pergunta: 'Placa limpa garante que o carro não é clonado?', resposta: 'Não. Num clone, a placa é de outro carro. Por isso confira se marca, modelo, cor e chassi do relatório batem com o carro na sua frente.' },
      { pergunta: 'O que fazer se aparecer indicador de roubo?', resposta: 'Não pague nada e procure a polícia. Não confronte o vendedor.' },
      { pergunta: 'O que é RENAJUD?', resposta: 'É o sistema que a Justiça usa para bloquear veículos. Um bloqueio judicial pode impedir a transferência ou até a circulação.' },
      { pergunta: 'Onde vejo roubo e furto na PlacaCompleta?', resposta: NO_COMPLETO },
    ],
  },
  {
    slug: 'fipe',
    termo: 'Valor FIPE',
    resumo: 'Valor de referência do modelo, histórico e custo de manter.',
    h1: 'Como consultar o valor FIPE de um carro pela placa',
    titulos: ['Consultar Valor FIPE pela Placa: Preço de Referência', 'Consultar Valor FIPE pela Placa do Veículo', 'Valor FIPE pela Placa'],
    description: 'Veja o valor FIPE do carro pela placa, sem procurar marca, modelo e versão. Saiba também como ver o histórico de preço e o custo de manter.',
    lead: 'A tabela FIPE é a referência de preço médio de veículos no Brasil. Pela placa você vê o valor do modelo certo, sem precisar descobrir a versão sozinho.',
    mostra: {
      paragrafo: 'A consulta pela placa identifica o veículo e mostra o valor FIPE na hora. No relatório completo, você vê também como esse valor evoluiu e quanto custa manter o carro.',
      lista: ['Valor FIPE do modelo, já na prévia', 'Histórico de preço e depreciação', 'Seguro estimado e custo em 5 anos'],
    },
    passo3: 'Use o valor FIPE e o histórico de preço como base para negociar.',
    faq: [
      { pergunta: 'O valor FIPE é o preço que devo pagar?', resposta: 'É uma referência de preço médio. Estado de conservação, quilometragem e histórico do carro podem puxar o preço para cima ou para baixo.' },
      { pergunta: 'Por que consultar a FIPE pela placa?', resposta: 'Porque a placa identifica o modelo e o ano exatos. Assim você não confunde versões com preços diferentes.' },
      { pergunta: 'Com que frequência a FIPE muda?', resposta: 'A tabela é atualizada todo mês.' },
      { pergunta: 'O que mais entra no custo de um carro?', resposta: 'Seguro, IPVA, combustível e manutenção. No relatório completo mostramos o seguro estimado e o custo em 5 anos.' },
      { pergunta: 'Onde vejo o histórico e o custo em 5 anos?', resposta: NO_COMPLETO },
    ],
  },
]

export function temaConsultar(slug: string): TemaConsultar | undefined {
  return TEMAS_CONSULTAR.find((t) => t.slug === slug)
}

export const ROTA_CONSULTAR = '/consultar'
export const rotaDoTema = (t: TemaConsultar) => `${ROTA_CONSULTAR}/${t.slug}`

/** Indice /consultar. */
export const INDICE_CONSULTAR = {
  h1: 'Verificações pela placa',
  titulos: ['Verificações pela Placa: Gravame, Leilão, Recall e Multas', 'Verificações Veiculares pela Placa', 'Verificações pela Placa'],
  description: 'Escolha o que verificar pela placa antes de comprar um usado: gravame, leilão, recall, multas, roubo e furto e valor FIPE.',
  lead: 'Cada verificação responde uma pergunta antes da compra. Todas começam pelo mesmo lugar: a placa.',
}
