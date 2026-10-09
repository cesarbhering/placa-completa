// Copy das restricoes do relatorio pago: cada tipoRestricao ganha uma
// explicacao propria e conclusiva. Fica aqui (shared) em vez de dentro da
// pagina pra poder ser testado sem montar o componente.
//
// O rotulo diz O QUE consta; a explicacao diz O QUE ISSO SIGNIFICA pra quem
// esta comprando. Sem ela, "Reserva de domínio" e jargao.
export const EXPLICA_RESTRICAO: Record<string, string> = {
  ROUBO_FURTO: 'Consta registro ativo de roubo ou furto. A transferência fica bloqueada e o veículo pode ser apreendido em fiscalização. Não conclua o negócio antes de esclarecer a situação.',
  ALIENACAO_FIDUCIARIA: 'O veículo está financiado e é a garantia do contrato: a instituição financeira consta como credora até a quitação. A transferência depende de quitar o contrato e baixar o gravame.',
  ARRENDAMENTO_MERCANTIL: 'O veículo está em contrato de leasing: quem o usa não é o proprietário até o fim do contrato.',
  RESERVA_DE_DOMINIO: 'O vendedor original mantém a propriedade até o pagamento integral do contrato de compra.',
  PENHOR: 'O veículo foi dado como garantia de uma dívida e não pode ser transferido enquanto ela existir.',
  BUSCA_E_APREENSAO: 'Existe ordem para recolher o veículo, normalmente por financiamento não pago. Risco alto: o carro pode ser apreendido do novo dono.',
  BAIXA: 'O registro deste veículo foi baixado de forma definitiva: ele deixa de ter existência legal, não pode ser licenciado, transferido ou circular em vias públicas. A baixa é irreversível.',
  BAIXADO: 'O registro deste veículo foi baixado de forma definitiva: ele deixa de ter existência legal, não pode ser licenciado, transferido ou circular em vias públicas. A baixa é irreversível.',
  RECUPERADO_SINISTRO: 'Este veículo sofreu um sinistro de grande monta (como colisão grave, enchente ou incêndio) e foi recuperado. A informação fica registrada de forma permanente, reduz o valor de mercado e pode dificultar seguro e revenda.',
  SINISTRO: 'Consta registro de sinistro no histórico do veículo. Isso costuma reduzir o valor de mercado e pesa na avaliação de seguro e revenda. Vale exigir laudo de vistoria antes de fechar negócio.',
  // RENAJUD (e as variantes): o card usa RENAJUD_EXPLICACAO, em blocos; este
  // texto e o resumo pra quem so consome a string.
  RENAJUD: 'Consta uma restrição judicial registrada pelo RENAJUD, o sistema que liga os tribunais ao cadastro nacional de veículos. Ela costuma vir de um processo contra o dono, como uma cobrança ou execução de dívida. O dado da consulta não informa qual tipo de restrição foi registrado nem o processo de origem.',
  RESTRICAO_JUDICIAL: 'Consta uma restrição judicial registrada pelo RENAJUD, o sistema que liga os tribunais ao cadastro nacional de veículos. Ela costuma vir de um processo contra o dono, como uma cobrança ou execução de dívida. O dado da consulta não informa qual tipo de restrição foi registrado nem o processo de origem.',
  RESTRICAO_RENAJUD: 'Consta uma restrição judicial registrada pelo RENAJUD, o sistema que liga os tribunais ao cadastro nacional de veículos. Ela costuma vir de um processo contra o dono, como uma cobrança ou execução de dívida. O dado da consulta não informa qual tipo de restrição foi registrado nem o processo de origem.',
  RESTRICAO_ADMINISTRATIVA: 'Há um bloqueio administrativo registrado por órgão competente. Enquanto ativo, pode impedir licenciamento e transferência. Recomendamos verificar a origem da restrição antes de qualquer negociação.',
  GRAVAME: 'O veículo está financiado e a instituição financeira consta como credora até a quitação. A transferência depende de quitar o contrato e baixar o gravame.',
  LEILAO: 'Consta registro de passagem por leilão no documento do veículo. Isso costuma indicar recuperação de sinistro ou apreensão, reduz o valor de mercado e pede uma vistoria cuidadosa.',
  RESTRICAO_TRIBUTARIA: 'O veículo tem pendência ou benefício fiscal que limita a transferência, como isenção de impostos com prazo de carência.',
  RESTRICAO_BENEFICIO_TRIBUTARIO: 'O veículo foi comprado com isenção ou redução de imposto e tem prazo de carência. Transferir antes do prazo exige quitar o imposto ou obter autorização fiscal.',
  COMUNICACAO_DE_VENDA: 'O dono anterior informou a venda ao órgão de trânsito. Falta o novo dono concluir a transferência.',
  PENDENCIA_DE_EMISSAO_CRV: 'O documento de transferência (CRV) ainda não foi emitido. Sem ele a venda não se conclui.',
  PENDENCIA_EMISSAO_CRV: 'O documento de transferência (CRV) ainda não foi emitido. Sem ele a venda não se conclui.',
  RENAINF: 'Constam multas em aberto registradas contra o veículo, dentro e fora do estado. Elas acompanham o carro, não o motorista.',
  RFB: 'Restrição da Receita Federal, comum em veículo com pendência de importação ou de regime fiscal.',
}

export const EXPLICA_RESTRICAO_GENERICA =
  'Uma restrição registrada condiciona ou impede a transferência do veículo. Esclareça com o vendedor antes de fechar negócio.'

/**
 * Explicacao de uma restricao pelo tipo cru que a consulta devolve
 * (tipoRestricao). Casa exato, depois por prefixo (variantes com sufixo de
 * sistema). Tipo sem copy propria cai no texto generico e e reportado pelo
 * callback `aoNaoEncontrar`, pra ampliarmos o dicionario.
 */
export function explicaRestricao(bruto: string, aoNaoEncontrar?: (chave: string) => void): string {
  const chave = String(bruto || '').toUpperCase().replace(/[\s-]+/g, '_')
  if (EXPLICA_RESTRICAO[chave]) return EXPLICA_RESTRICAO[chave]
  // Variantes com sufixo de sistema ("_FILE_VEICULOS" etc): casa pelo prefixo,
  // do mais longo pro mais curto, pra RESTRICAO_ADMINISTRATIVA_FILE_VEICULOS
  // nao ser capturada por uma chave mais generica antes da especifica.
  const pref = Object.keys(EXPLICA_RESTRICAO)
    .sort((a, b) => b.length - a.length)
    .find((k) => chave.startsWith(k))
  if (pref) return EXPLICA_RESTRICAO[pref]
  aoNaoEncontrar?.(chave)
  return EXPLICA_RESTRICAO_GENERICA
}

// RENAJUD (texto aprovado pelo Cesar em 09/out). A consulta devolve "RENAJUD"
// puro em restricoesItens, que nao casava com nenhuma chave e caia no texto
// generico. O card explica o que e, os tipos possiveis (sem afirmar qual), quem
// retira e o que o comprador confere.
export function ehRenajud(bruto: unknown): boolean {
  const c = String(bruto ?? '').toUpperCase().replace(/[\s-]+/g, '_')
  return /^(RESTRICAO_)?RENAJUD|^RESTRICAO_JUDICIAL/.test(c)
}

export const RENAJUD_EXPLICACAO = {
  titulo: 'Restrição RENAJUD: ordem de um juiz no cadastro do veículo',
  texto: EXPLICA_RESTRICAO.RENAJUD,
  tiposTitulo: 'Tipos possíveis:',
  tipos: [
    { nome: 'Transferência', efeito: 'o veículo não pode passar para outro nome.' },
    { nome: 'Licenciamento', efeito: 'além da transferência, impede o licenciamento anual.' },
    { nome: 'Circulação', efeito: 'além das duas anteriores, o veículo não pode rodar e pode ser recolhido.' },
    { nome: 'Penhora', efeito: 'o veículo é garantia de uma dívida no processo e pode ir a leilão judicial; quem compra assume esse risco.' },
  ],
  destaque: 'Só o juiz que determinou a restrição pode retirá-la. Nem o vendedor nem o DETRAN conseguem baixá-la.',
  conferirTitulo: 'O que conferir:',
  conferir: [
    'Peça ao vendedor o número do processo e uma certidão atualizada do processo.',
    'Consulte o processo no site do tribunal indicado e veja se já há ordem de retirada.',
    'Só feche negócio depois que a restrição sair do cadastro. Uma nova consulta pela placa confirma.',
  ],
} as const

// Estoque RENAVE (texto aprovado pelo Cesar em 05/out): nao e restricao no
// sentido de bloqueio, e o carro registrado no estoque de uma revenda. A copy
// generica ("condiciona ou impede a transferencia") assustava sem motivo, entao
// esse tipo ganha explicacao propria, mais longa, com o que conferir.
export function ehEstoqueRenave(bruto: unknown): boolean {
  return /RENAVE/.test(String(bruto ?? '').toUpperCase())
}

export const RENAVE_EXPLICACAO = {
  titulo: 'Estoque RENAVE: o veículo está no estoque de uma loja',
  texto: 'O RENAVE (Registro Nacional de Veículos em Estoque) é o sistema da SENATRAN em que lojas de veículos usados e concessionárias registram os carros que compram para revender. Essa anotação indica que o veículo foi comprado por uma revenda e está registrado no estoque dela.',
  destaque: 'Não é multa, débito, roubo nem bloqueio judicial.',
  conferirTitulo: 'O que conferir:',
  conferir: [
    'Se você está comprando de uma loja: é o esperado. A própria loja faz a transferência para o seu nome pelo RENAVE, no momento da venda. Peça o comprovante da transferência.',
    'Se quem está vendendo é uma pessoa física: atenção. Um veículo no estoque de uma revenda só sai dele pela própria loja. Confirme com a loja que ela vendeu o carro para essa pessoa antes de pagar qualquer valor.',
  ],
} as const

/** Parecer do topo quando a UNICA restricao e o estoque RENAVE. */
export const PARECER_SO_RENAVE = {
  titulo: 'Atenção: o veículo consta no estoque de uma revenda (RENAVE).',
  texto: 'Veja na seção de Restrições o que conferir antes de fechar negócio.',
} as const

// Itens de restricao que NAO sao restricao (06/out): "CNPJ_DA
// INSTITUICAO_FINANCEIRA" chega em restricoesItens junto da alienacao
// fiduciaria, mas e o ROTULO do campo do CNPJ do credor do gravame, vindo sem
// valor (QUC6E49, SIE3J28, SVB9F43). Cru na tela parecia uma restricao a mais.
const ITENS_NAO_RESTRICAO = [/^CNPJ_DA_INSTITUICAO_FINANCEIRA$/, /^CNPJ_INSTITUICAO_FINANCEIRA$/]

export function ehItemDeRestricao(bruto: unknown): boolean {
  const chave = String(bruto ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_').replace(/_+/g, '_')
  if (!chave) return false
  return !ITENS_NAO_RESTRICAO.some((re) => re.test(chave))
}

/** restricoesItens sem os itens que nao sao restricao. Nao-array passa direto. */
export function filtrarItensRestricao<T>(itens: T): T {
  return (Array.isArray(itens) ? itens.filter(ehItemDeRestricao) : itens) as T
}

// Itens INFORMATIVOS (08/out): aparecem na secao de Restricoes com titulo e
// texto proprios, mas NAO sao restricao que impede a venda. Nao acendem
// "Outras restrições", nao entram no veredito nem no "so RENAVE". Primeiro
// caso: PRINCIPAL_CONDUTOR, que caia no texto generico ("condiciona ou impede
// a transferencia"), errado para esse cadastro. Texto aprovado pelo Cesar.
const ITENS_INFORMATIVOS: [RegExp, { titulo: string; texto: string }][] = [
  [/^PRINCIPAL_CONDUTOR/, {
    titulo: 'Principal condutor',
    texto: 'O veículo tem um condutor principal cadastrado no DETRAN. Esse cadastro indica quem recebe automaticamente os pontos das multas do veículo e é comum em carros de empresas e locadoras. Não impede a transferência. Ao comprar, confirme com o vendedor se o cadastro será retirado, para as multas futuras não ficarem associadas a outra pessoa.',
  }],
]

function chaveItem(bruto: unknown): string {
  return String(bruto ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_').replace(/_+/g, '_')
}

/** Copy do item informativo (titulo + texto), ou null se for restricao de verdade. */
export function itemInformativo(bruto: unknown): { titulo: string; texto: string } | null {
  const chave = chaveItem(bruto)
  const achou = ITENS_INFORMATIVOS.find(([re]) => re.test(chave))
  return achou ? achou[1] : null
}

/** Itens que de fato restringem (sem os informativos). Nao-array passa direto. */
export function itensQueRestringem<T>(itens: T): T {
  return (Array.isArray(itens) ? itens.filter((i) => !itemInformativo(i)) : itens) as T
}
