import { PLANOS } from './planos'

/**
 * Offer card under the result of /tabela-fipe-por-placa (Cesar 14/11/2026): whoever lands on this page
 * wants the FIPE price, so the card offers the basic plan, which is cheaper than the full report.
 * Every listed item names the plan features it relies on (RECURSOS in shared/planos.ts), so the card
 * never promises what the basic plan does not deliver (the test checks it).
 */
export const OFERTA_FIPE_POR_PLACA = {
  plano: 'basica' as const,
  titulo: 'Vai negociar este carro?',
  texto: 'A consulta básica mostra como o valor FIPE dele mudou ao longo do tempo, o seguro estimado e a ficha técnica completa, em até 5 minutos.',
  botao: 'Ver a consulta básica',
  itens: [
    { texto: 'Histórico do valor FIPE', recursos: ['FIPE com histórico de depreciação'] },
    { texto: 'Seguro estimado e custo em 5 anos', recursos: ['Seguro estimado e custo em 5 anos'] },
    { texto: 'Ficha técnica completa', recursos: ['Ficha técnica: espécie, tipo, categoria', 'Potência, cilindrada, eixos e lotação'] },
    { texto: 'Chassi, motor e Renavam', recursos: ['Chassi completo', 'Número do motor', 'Renavam completo'] },
    { texto: 'Situação cadastral', recursos: ['Situação cadastral (em circulação / baixado)'] },
    { texto: 'Recall pendente', recursos: ['Recall pendente'] },
  ],
}

/** Price shown on the card button ("R$ 29,90"), from the single price source of the plans. */
export function precoOfertaFipePorPlaca(): string {
  return 'R$ ' + (PLANOS[OFERTA_FIPE_POR_PLACA.plano].valorCentavos / 100).toFixed(2).replace('.', ',')
}
