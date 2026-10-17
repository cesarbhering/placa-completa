// Checklist de vistoria e de transferencia (Relatorio 2.0, item 5; Cesar 14/out).
//
// Duas listas pra pessoa levar na hora de ver o carro e de fechar o negocio. Os
// itens gerais aparecem sempre; os que o PROPRIO relatorio acendeu (leilao,
// roubo, recall, km, gravame, debitos...) vem primeiro e marcados.
// Copy: orienta o que conferir, nunca afirma defeito. Sem travessao e sem
// citar orgao federal.

export interface SinaisChecklist {
  leilao?: 'confirmado' | 'possivel' | null
  roubo?: boolean
  recallPendente?: boolean
  kmCaiu?: boolean
  gravame?: boolean
  restricaoJudicial?: boolean
  /** Total a quitar no DETRAN (multas, IPVA, licenciamento), em centavos. */
  debitosCentavos?: number | null
  licenciamentoAtrasado?: boolean
  baixado?: boolean
}

export interface ItemChecklist {
  /** Id estavel (chave do estado marcado). */
  id: string
  texto: string
  /** true = item puxado por algo que consta neste relatorio. */
  doRelatorio: boolean
}

export interface Checklist {
  vistoria: ItemChecklist[]
  transferencia: ItemChecklist[]
}

const reais = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Cada item tem um ID ESTAVEL (16/out/2026, checklist reativo): o estado
// marcado fica em premium_checklist por (pedido, item_id). Texto e ordem podem
// mudar a vontade; o id nao. Item novo = id novo; nunca reaproveitar um id.
const VISTORIA_GERAL: [string, string][] = [
  ['v-chassi', 'Confira se o número do chassi no documento é o mesmo gravado nos vidros, no assoalho e na etiqueta da coluna da porta.'],
  ['v-motor', 'Confira o número do motor com o que consta no documento.'],
  ['v-placa-cor', 'Compare placa, cor e combustível do carro com o documento.'],
  ['v-painel', 'Ligue o carro e veja se as luzes de alerta do painel apagam depois da partida.'],
  ['v-km-revisoes', 'Compare a quilometragem do painel com o manual de revisões e as notas de serviço.'],
  ['v-pintura', 'Repare em diferença de tom na pintura, folgas desiguais entre portas e capô e parafusos com marca de ferramenta.'],
  ['v-umidade', 'Olhe embaixo dos tapetes e no porta-malas: umidade, barro ou ferrugem pedem mais atenção.'],
  ['v-test-drive', 'Faça um test-drive: freio, direção, câmbio e ruídos na suspensão.'],
  ['v-mecanico', 'Antes de pagar, leve a um mecânico de confiança ou faça uma vistoria cautelar.'],
]

const TRANSFERENCIA_GERAL: [string, string][] = [
  ['t-proprietario', 'Confirme que quem vende é o proprietário que consta no documento, ou tem procuração para isso.'],
  ['t-documento', 'Peça o documento de transferência preenchido e assinado, com firma reconhecida ou assinatura digital, conforme o seu estado.'],
  ['t-vistoria', 'Faça a vistoria de transferência numa empresa credenciada pelo DETRAN do seu estado.'],
  ['t-prazo-30-dias', 'Transfira para o seu nome em até 30 dias da data da venda, para não pagar multa.'],
  ['t-comunicacao-venda', 'Combine que o vendedor comunique a venda ao DETRAN.'],
  ['t-comprovantes', 'Guarde o recibo, o comprovante de pagamento e cópia dos documentos.'],
]

/** Ids dos itens puxados pelo relatorio (o texto pode variar, o id nao). */
export const IDS_DO_RELATORIO = [
  'r-leilao', 'r-roubo', 'r-recall', 'r-km', 'r-baixado', 'r-gravame', 'r-judicial', 'r-debitos', 'r-licenciamento',
] as const

/** Todo id que pode existir: o servidor so aceita marcar um destes. */
export const IDS_CHECKLIST: readonly string[] = [...IDS_DO_RELATORIO, ...VISTORIA_GERAL.map(([id]) => id), ...TRANSFERENCIA_GERAL.map(([id]) => id)]

export function idChecklistValido(id: unknown): id is string {
  return typeof id === 'string' && IDS_CHECKLIST.includes(id)
}

export function montarChecklist(s: SinaisChecklist): Checklist {
  const vist: [string, string][] = []
  const transf: [string, string][] = []

  if (s.leilao === 'confirmado') vist.push(['r-leilao', 'Consta passagem por leilão: peça uma vistoria cautelar com análise da estrutura (longarinas, colunas e assoalho).'])
  else if (s.leilao === 'possivel') vist.push(['r-leilao', 'Consta possível passagem por leilão: confira a estrutura com atenção e peça uma vistoria cautelar.'])
  if (s.roubo) vist.push(['r-roubo', 'Há registro de roubo ou furto no histórico: confira a gravação do chassi e do motor com mais cuidado e peça ao vendedor o boletim de ocorrência e a baixa.'])
  if (s.recallPendente) vist.push(['r-recall', 'Consta recall pendente: peça o comprovante do atendimento ou agende o reparo, que é gratuito na concessionária.'])
  if (s.kmCaiu) vist.push(['r-km', 'Há leitura de hodômetro menor que uma anterior: compare o painel com o histórico de revisões e notas de serviço.'])

  if (s.baixado) transf.push(['r-baixado', 'Consta como baixado: um veículo baixado não volta a circular, confira a situação antes de qualquer negócio.'])
  if (s.gravame) transf.push(['r-gravame', 'Consta gravame (financiamento ou garantia): a transferência só sai depois da baixa. Peça a quitação e a baixa antes de pagar.'])
  if (s.restricaoJudicial) transf.push(['r-judicial', 'Consta restrição judicial: ela pode impedir a transferência. Peça ao vendedor o comprovante da retirada antes de fechar.'])
  if ((s.debitosCentavos || 0) > 0) transf.push(['r-debitos', `Há ${reais(s.debitosCentavos!)} a quitar no DETRAN: combine quem paga e quite antes da transferência.`])
  else if (s.licenciamentoAtrasado) transf.push(['r-licenciamento', 'Consta licenciamento atrasado: ele precisa estar em dia para transferir.'])

  const marca = (lista: [string, string][], doRelatorio: boolean) => lista.map(([id, texto]) => ({ id, texto, doRelatorio }))
  return {
    vistoria: [...marca(vist, true), ...marca(VISTORIA_GERAL, false)],
    transferencia: [...marca(transf, true), ...marca(TRANSFERENCIA_GERAL, false)],
  }
}
