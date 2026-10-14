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
  texto: string
  /** true = item puxado por algo que consta neste relatorio. */
  doRelatorio: boolean
}

export interface Checklist {
  vistoria: ItemChecklist[]
  transferencia: ItemChecklist[]
}

const reais = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const VISTORIA_GERAL = [
  'Confira se o número do chassi no documento é o mesmo gravado nos vidros, no assoalho e na etiqueta da coluna da porta.',
  'Confira o número do motor com o que consta no documento.',
  'Compare placa, cor e combustível do carro com o documento.',
  'Ligue o carro e veja se as luzes de alerta do painel apagam depois da partida.',
  'Compare a quilometragem do painel com o manual de revisões e as notas de serviço.',
  'Repare em diferença de tom na pintura, folgas desiguais entre portas e capô e parafusos com marca de ferramenta.',
  'Olhe embaixo dos tapetes e no porta-malas: umidade, barro ou ferrugem pedem mais atenção.',
  'Faça um test-drive: freio, direção, câmbio e ruídos na suspensão.',
  'Antes de pagar, leve a um mecânico de confiança ou faça uma vistoria cautelar.',
]

const TRANSFERENCIA_GERAL = [
  'Confirme que quem vende é o proprietário que consta no documento, ou tem procuração para isso.',
  'Peça o documento de transferência preenchido e assinado, com firma reconhecida ou assinatura digital, conforme o seu estado.',
  'Faça a vistoria de transferência numa empresa credenciada pelo DETRAN do seu estado.',
  'Transfira para o seu nome em até 30 dias da data da venda, para não pagar multa.',
  'Combine que o vendedor comunique a venda ao DETRAN.',
  'Guarde o recibo, o comprovante de pagamento e cópia dos documentos.',
]

export function montarChecklist(s: SinaisChecklist): Checklist {
  const vist: string[] = []
  const transf: string[] = []

  if (s.leilao === 'confirmado') vist.push('Consta passagem por leilão: peça uma vistoria cautelar com análise da estrutura (longarinas, colunas e assoalho).')
  else if (s.leilao === 'possivel') vist.push('Consta possível passagem por leilão: confira a estrutura com atenção e peça uma vistoria cautelar.')
  if (s.roubo) vist.push('Há registro de roubo ou furto no histórico: confira a gravação do chassi e do motor com mais cuidado e peça ao vendedor o boletim de ocorrência e a baixa.')
  if (s.recallPendente) vist.push('Consta recall pendente: peça o comprovante do atendimento ou agende o reparo, que é gratuito na concessionária.')
  if (s.kmCaiu) vist.push('Há leitura de hodômetro menor que uma anterior: compare o painel com o histórico de revisões e notas de serviço.')

  if (s.baixado) transf.push('Consta como baixado: um veículo baixado não volta a circular, confira a situação antes de qualquer negócio.')
  if (s.gravame) transf.push('Consta gravame (financiamento ou garantia): a transferência só sai depois da baixa. Peça a quitação e a baixa antes de pagar.')
  if (s.restricaoJudicial) transf.push('Consta restrição judicial: ela pode impedir a transferência. Peça ao vendedor o comprovante da retirada antes de fechar.')
  if ((s.debitosCentavos || 0) > 0) transf.push(`Há ${reais(s.debitosCentavos!)} a quitar no DETRAN: combine quem paga e quite antes da transferência.`)
  else if (s.licenciamentoAtrasado) transf.push('Consta licenciamento atrasado: ele precisa estar em dia para transferir.')

  const marca = (lista: string[], doRelatorio: boolean) => lista.map((texto) => ({ texto, doRelatorio }))
  return {
    vistoria: [...marca(vist, true), ...marca(VISTORIA_GERAL, false)],
    transferencia: [...marca(transf, true), ...marca(TRANSFERENCIA_GERAL, false)],
  }
}
