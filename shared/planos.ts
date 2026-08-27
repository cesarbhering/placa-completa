// ============================================================
// Escada de planos da consulta veicular.
//
// O corte segue a logica que os concorrentes ja validaram e que a nossa
// propria copy anuncia: o barato responde "o que e o carro", o caro responde
// "da pra confiar nele".
//
// Este arquivo e a UNICA fonte de verdade: preco, rotulo, o que entra em cada
// plano, o gate de campos do relatorio e a lista do que fica bloqueado na tela
// de resultado. Server e front importam daqui, entao a tabela de comparacao
// nao tem como divergir do que a API cobra e libera.
// ============================================================

export type PlanoId = 'gratis' | 'basica' | 'completa'

export interface Plano {
  id: PlanoId
  nome: string
  chamada: string
  valorCentavos: number
  /**
   * Selo de destaque no card. So preencher com afirmacao verificavel: a regra
   * do .agents/product-marketing.md proibe prova inventada. Hoje a completa
   * carrega o selo porque foi o unico nivel pago que existiu ate agora, entao
   * "mais escolhido" e literalmente verdade. Se a basica virar maioria, o selo
   * muda de card aqui.
   */
  destaque?: string
}

export const PLANOS: Record<PlanoId, Plano> = {
  gratis: {
    id: 'gratis',
    nome: 'Consulta grátis',
    chamada: 'O retrato do veículo na tela, sem cadastro.',
    valorCentavos: 0,
  },
  basica: {
    id: 'basica',
    nome: 'Consulta básica',
    chamada: 'A ficha técnica completa, além do que a grátis mostra.',
    valorCentavos: 1990,
  },
  completa: {
    id: 'completa',
    nome: 'Relatório completo',
    chamada: 'Tudo da básica, mais o que decide a compra.',
    valorCentavos: 4490,
    destaque: 'Mais escolhido',
  },
}

/** Planos pagos, na ordem em que aparecem na tela. */
export const PLANOS_PAGOS: Plano[] = [PLANOS.basica, PLANOS.completa]

/**
 * Piso de preco pra cupom: mesmo com desconto, o pedido nunca pode custar
 * menos que isto. Cobre custo fixo (fee AbacatePay ~R$0,80; a completa ainda
 * soma a consulta SERPRO, ~R$5). SO cupons marcados `permiteGratis` furam
 * esse piso ate zero — todo o resto (percentual/fixo comum) fica sempre
 * travado aqui, mesmo que o valor calculado do desconto passe do preco cheio.
 */
export const PISO_CUPOM_CENTAVOS: Record<'basica' | 'completa', number> = {
  basica: 990,
  completa: 1490,
}

/**
 * Aplica um cupom (percentual ou fixo) sobre o preco de tabela do plano,
 * respeitando o piso — EXCETO quando `cupom.permiteGratis` e true, caso em
 * que o piso vira 0 (o relatorio pode sair de graca). Funcao pura, sem I/O —
 * usada tanto no endpoint de validar quanto no checkout, pra garantir que os
 * dois calculam o MESMO numero. Cupom fora do plano ou tipo invalido devolve
 * o preco cheio, sem erro (quem chama decide se isso e "cupom invalido").
 */
export function aplicarCupom(
  plano: 'basica' | 'completa',
  cupom: { tipo: 'percentual' | 'fixo'; valor: number; planos: string[]; permiteGratis?: boolean } | null | undefined,
): { precoBrutoCentavos: number; descontoCentavos: number; precoLiquidoCentavos: number } {
  const precoBrutoCentavos = PLANOS[plano].valorCentavos
  const piso = cupom?.permiteGratis ? 0 : PISO_CUPOM_CENTAVOS[plano]
  if (!cupom || !cupom.planos.includes(plano)) {
    return { precoBrutoCentavos, descontoCentavos: 0, precoLiquidoCentavos: precoBrutoCentavos }
  }
  const descontoBruto = cupom.tipo === 'percentual'
    ? Math.round(precoBrutoCentavos * (cupom.valor / 100))
    : Math.round(cupom.valor)
  const precoLiquidoCentavos = Math.max(piso, precoBrutoCentavos - descontoBruto)
  const descontoCentavos = precoBrutoCentavos - precoLiquidoCentavos
  return { precoBrutoCentavos, descontoCentavos, precoLiquidoCentavos }
}

// ------------------------------------------------------------
// Matriz de recursos.
//
// Cada card de preco lista TODOS os itens: com check quando o plano inclui,
// com X quando nao. Ler o que falta e o que faz a pessoa entender o degrau —
// esconder as linhas ausentes so deixa os cards incomparaveis.
// ------------------------------------------------------------

export interface Recurso {
  label: string
  planos: PlanoId[]
  /**
   * Nao renderizar a linha nos cards destes planos. Serve pra versao rebaixada
   * de um recurso ("Início do chassi") nao aparecer riscada em quem ja tem a
   * versao completa.
   */
  ocultarEm?: PlanoId[]
}

export const RECURSOS: Recurso[] = [
  // A gratis identifica o veiculo e para ai: e o suficiente pra pessoa saber
  // que achou o carro certo, e nada do que pesa na negociacao.
  { label: 'Marca, modelo, ano e cor',              planos: ['gratis', 'basica', 'completa'] },
  { label: 'Combustível e origem',                  planos: ['gratis', 'basica', 'completa'] },
  { label: 'Início do chassi',                      planos: ['gratis'], ocultarEm: ['basica', 'completa'] },
  { label: 'Chassi completo',                       planos: ['basica', 'completa'] },
  // O valor FIPE atual (so o numero) voltou pra gratis; a evolucao/historico
  // de depreciacao (a linha abaixo) segue exclusiva do pago.
  { label: 'Valor FIPE',                            planos: ['gratis', 'basica', 'completa'] },
  // logo abaixo do valor FIPE: e a evolucao do mesmo numero
  { label: 'FIPE com histórico de depreciação',     planos: ['basica', 'completa'] },
  { label: 'Seguro estimado e custo em 5 anos',     planos: ['basica', 'completa'] },
  { label: 'Situação cadastral (em circulação / baixado)', planos: ['basica', 'completa'] },
  { label: 'Ficha técnica: espécie, tipo, categoria', planos: ['basica', 'completa'] },
  { label: 'Potência, cilindrada, eixos e lotação', planos: ['basica', 'completa'] },
  { label: 'Município e UF de jurisdição',          planos: ['basica', 'completa'] },
  { label: 'Recall pendente',                       planos: ['basica', 'completa'] },
  { label: 'Renavam completo',                      planos: ['basica', 'completa'] },
  { label: 'Informações de importação (veículos importados)', planos: ['completa'] },
  { label: 'Origem de fabricação pelo chassi',                planos: ['completa'] },
  { label: 'Restrições nacionais e estaduais',      planos: ['completa'] },
  { label: 'Roubo e furto',                         planos: ['completa'] },
  { label: 'Passagem por leilão',                   planos: ['completa'] },
  { label: 'Gravame e alienação',                   planos: ['completa'] },
  { label: 'RENAJUD e restrições judiciais',        planos: ['completa'] },
  { label: 'Indicador de multas (RENAINF)',         planos: ['completa'] },
  { label: 'Comunicação de venda',                  planos: ['completa'] },
]

export function inclui(recurso: Recurso, plano: PlanoId): boolean {
  return recurso.planos.includes(plano)
}

/** So os rotulos que o plano entrega (usado no checkout inline). */
export function recursosDoPlano(plano: PlanoId): string[] {
  return RECURSOS.filter((r) => inclui(r, plano)).map((r) => r.label)
}

/**
 * O que a consulta gratis NAO entrega — alimenta o bloco bloqueado da tela de
 * resultado. Derivado da matriz de proposito: mover um item entre planos
 * atualiza a tela de resultado junto, sem lista paralela pra esquecer.
 */
export const RECURSOS_BLOQUEADOS: Recurso[] = RECURSOS.filter((r) => !inclui(r, 'gratis'))

// ------------------------------------------------------------
// Cards de comparacao "em heranca" (Opcao C, escolhida pelo Cesar): cada
// plano pago mostra SO o que ele ADICIONA ao anterior na escada, sem repetir
// o que ja apareceu no card de baixo — em vez da grade completa com X pra
// cada item que falta. Some o X/risco: a heranca substitui a comparacao por
// negacao.
// ------------------------------------------------------------

/** O plano "de baixo" na escada, cujo card o de cima herda e complementa. */
export const PLANO_ANTERIOR: Partial<Record<PlanoId, PlanoId>> = {
  basica: 'gratis',
  completa: 'basica',
}

/**
 * Recursos que ESTE plano tem e o anterior na escada nao — as "novidades" do
 * card. Pro plano sem anterior (gratis, a base da escada), devolve os
 * recursos que ele proprio tem (nao ha o que herdar). DERIVADO do proprio
 * RECURSOS: um item novo na matriz cai no card certo sozinho, sem lista
 * paralela pra manter sincronizada.
 */
export function recursosNovosNoPlano(plano: PlanoId): Recurso[] {
  const anterior = PLANO_ANTERIOR[plano]
  return RECURSOS.filter((r) => inclui(r, plano) && !(anterior && inclui(r, anterior)))
}

export function isPlanoPago(v: unknown): v is 'basica' | 'completa' {
  return v === 'basica' || v === 'completa'
}

/** "R$ 19,90" / "R$ 44,90" — sem os centavos quando forem zero. */
export function precoBRL(centavos: number): string {
  const semCentavos = centavos % 100 === 0
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: semCentavos ? 0 : 2,
  })
}

// ------------------------------------------------------------
// Gate de campos do relatorio.
//
// A basica recebe uma WHITELIST explicita — nunca uma blacklist. Se a API do
// SENATRAN passar a devolver um campo novo de risco, ele fica de fora por
// omissao em vez de vazar por esquecimento.
// ------------------------------------------------------------

/**
 * Achata a resposta da consulta num objeto unico.
 *
 * O que chega e um ARRAY de um elemento, com os indicadores aninhados em
 * `restricoes` e as restricoes detalhadas em `restricoes.items[].tipoRestricao`.
 * Sem normalizar, qualquer acesso por chave falha: era isso que fazia o
 * relatorio nao mostrar nada, e o gate da basica devolver objeto vazio.
 */
export function normalizarResposta(response: any): Record<string, any> {
  const raw = Array.isArray(response) ? (response[0] ?? {}) : (response ?? {})
  if (!raw || typeof raw !== 'object') return {}
  const { restricoes, ...resto } = raw as Record<string, any>
  const bloco = (restricoes && typeof restricoes === 'object') ? restricoes : {}

  // indicadores sobem pro topo; o resto de `restricoes` vira uma lista simples
  const indicadores = Object.fromEntries(
    Object.entries(bloco).filter(([k]) => k.startsWith('indicador')),
  )
  const itens = Array.isArray((bloco as any).items)
    ? (bloco as any).items.map((i: any) => i?.tipoRestricao).filter(Boolean)
    : []

  return { ...resto, ...indicadores, restricoesItens: itens }
}

export const CAMPOS_BASICA: readonly string[] = [
  // identificacao (nomes conferidos contra a resposta real da API)
  'placa', 'descricaoMarcaModelo', 'anoFabricacao', 'anoModelo', 'descricaoCor',
  // Chassi completo e Renavam completo entraram na basica por decisao de produto
  // (os cards de preco prometem). A whitelist e o unico lugar que decide isso de
  // fato; o Renavam segue tambem na completa (superset).
  'chassi', 'renavam',
  'descricaoEspecie', 'descricaoTipoVeiculo', 'descricaoCategoria', 'procedencia',
  'situacao', 'ufJurisdicao', 'municipio',
  'potencia', 'cilindrada', 'quantidadeDeEixos', 'lotacao',
  'pesoBruto', 'capacidadeMaximaDeCarga', 'capacidadeMaximaDeTracao',
  'codigoCombustivel', 'codigoTipoCarroceria',
  // seguranca (nao e risco de negociacao, entra como brinde da basica)
  'indicadorRecall',
]

/**
 * Devolve so o que o plano pagou. `completa` passa direto; `basica` filtra
 * pela whitelist. Qualquer outro valor devolve objeto vazio — falha fechada.
 */
export function filtrarPorPlano(
  response: any,
  plano: PlanoId | string | null | undefined,
): Record<string, any> {
  const flat = normalizarResposta(response)
  if (!Object.keys(flat).length) return {}
  if (plano === 'completa') return flat
  if (plano !== 'basica') return {}
  const out: Record<string, any> = {}
  for (const k of CAMPOS_BASICA) {
    if (flat[k] !== undefined) out[k] = flat[k]
  }
  return out
}

/**
 * Quantos campos com valor a completa entrega alem do que este plano ja tem.
 * Alimenta o upsell do relatorio basico.
 */
export function camposRestantes(
  response: any,
  plano: PlanoId | string | null | undefined,
): number {
  const flat = normalizarResposta(response)
  if (!Object.keys(flat).length) return 0
  const liberado = filtrarPorPlano(response, plano)
  return Object.keys(flat).filter((k) => {
    if (k in liberado) return false
    const val = flat[k]
    if (val === null || val === undefined || val === '') return false
    // Objeto e array nao sao "uma verificacao a mais": `importacao` vem com
    // quatro zeros e nao vira linha nenhuma no relatorio. Contar isso inflava
    // a promessa do upsell acima do que a completa realmente entrega.
    if (typeof val === 'object') return false
    return true
  }).length
}
