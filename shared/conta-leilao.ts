// Copy da "conta" nas paginas de leilao. O preco vem de PLANOS (nunca texto
// fixo). O percentual do exemplo e hipotetico e dito como tal: as fontes
// consultadas (blogs do setor) concordam que NAO existe desconto fixo para
// carro de leilao, entao a pagina nao afirma um numero de mercado.
import { PLANOS, precoBRL } from '~/shared/planos'

export const PRECO_COMPLETA = precoBRL(PLANOS.completa.valorCentavos)

export const CONTA_INDEX = {
  titulo: 'Quanto custa não conferir',
  paragrafos: [
    'Carro com passagem por leilão costuma valer menos que o mesmo carro sem histórico, e o mercado cobra esse desconto na hora de revender. Não existe percentual fixo: muda com o tipo de leilão e com o estado do carro.',
    `Faça a conta com um exemplo. Num carro de R$ 50 mil na tabela FIPE, se o histórico tirar 10% do valor, são R$ 5 mil. O Relatório Completo custa ${PRECO_COMPLETA}, menos de um centésimo disso. Se ele mostrar um registro de leilão, você negocia o preço para baixo ou desiste. Se não mostrar, você gastou ${PRECO_COMPLETA} para fechar com mais segurança.`,
  ],
}

export const CONTA_COMO_SABER = {
  titulo: 'Pague o que o carro vale, não o que a tabela diz',
  paragrafos: [
    'A tabela FIPE olha o carro sem histórico. Se ele passou por leilão, o preço justo tende a ser menor, e quem não sabe acaba pagando a diferença.',
    `Não há um percentual único, mas a conta é simples: num carro de R$ 50 mil, cada 10% de desconto que o histórico justificaria são R$ 5 mil. O Relatório Completo custa ${PRECO_COMPLETA} e mostra o registro de leilão, quando houver. Com ele na mão, você pede o desconto ou desiste. Sem ele, paga a tabela cheia por um carro que pode valer menos.`,
  ],
}
