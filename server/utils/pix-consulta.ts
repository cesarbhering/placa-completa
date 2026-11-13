// What a charge lookup at a Pix provider can tell. The older lookups return
// null both when the provider says the charge does not exist and when the
// provider could not be reached. Whoever has to decide between "this is not
// ours" and "ask again later" needs the two apart.

export type ConsultaPix<T> =
  /** The provider returned the charge. */
  | { situacao: 'encontrada'; cobranca: T }
  /** The provider answered: there is no such charge in our account. */
  | { situacao: 'nao_encontrada' }
  /**
   * The provider did not answer the question: network error, timeout, 401,
   * 403, 429, 5xx, or a successful answer that does not carry a charge in the
   * expected shape.
   */
  | { situacao: 'sem_resposta' }

/**
 * Reads a lookup that failed.
 *
 * 404 is "not found". So is 400: it is the only error the Woovi API documents
 * for "get one charge", and what it returns for an id it does not know.
 * Everything else is no answer: a refused credential (401, 403), a rate limit
 * (429), a provider error (5xx), a network error or a timeout carry no
 * information about the charge.
 */
export function consultaQueFalhou(erro: any): { situacao: 'nao_encontrada' } | { situacao: 'sem_resposta' } {
  const status = Number(erro?.statusCode ?? erro?.status ?? erro?.response?.status)
  return status === 404 || status === 400 ? { situacao: 'nao_encontrada' } : { situacao: 'sem_resposta' }
}
