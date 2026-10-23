// Tamanho da base de leilao, num lugar so (proxima atualizacao = 1 linha).
//
// Contagem de 07/10/2026 01h: 2.336.917 REGISTROS de leilao, 1.876.811
// veiculos distintos. Decisao do Cesar: "mais de 2 milhoes de registros de
// leilao". NUNCA em veiculos: veiculos distintos sao menos.
export const BASE_LEILAO_QTD = 'mais de 2 milhões'
export const BASE_LEILAO_TEXTO = `${BASE_LEILAO_QTD} de registros de leilão`
/** Inicio de frase/titulo: "Mais de 2 milhões de registros de leilão". */
export const BASE_LEILAO_TEXTO_INICIO = BASE_LEILAO_TEXTO.charAt(0).toUpperCase() + BASE_LEILAO_TEXTO.slice(1)

/**
 * Promessa do cartao da Completa (Cesar, 20/out/2026): a nossa base mais a base
 * parceira premium (consultada quando a nossa nao acha nada). Nunca o nome da
 * fonte parceira.
 */
export const BASE_LEILAO_DUAS_BASES = `duas bases cruzadas: a nossa, com ${BASE_LEILAO_QTD} de registros, e uma base parceira premium`
