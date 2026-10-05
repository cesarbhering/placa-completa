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
  RESTRICAO_JUDICIAL: 'Há um bloqueio determinado pela Justiça sobre o veículo. Enquanto ele estiver ativo, a transferência fica impedida, e a liberação depende do processo que originou a ordem.',
  RESTRICAO_RENAJUD: 'Há um bloqueio determinado pela Justiça e registrado eletronicamente no cadastro do veículo. Enquanto ele estiver ativo, a transferência fica impedida.',
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
