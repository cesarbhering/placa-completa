// What a charge lookup at a Pix provider can tell. Whoever has to decide
// between "this is not ours" and "ask again later" needs "the provider has no
// such charge" apart from "the provider did not answer". checarPix and
// cobrancaPorCorrelacao answer null for both; the lookups typed here do not.

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

/** How a provider says, in the body of an error, that a charge was not found. */
const DIZ_QUE_NAO_ENCONTROU = /not\s+found|n[aã]o\s+encontrad/i

/** The words of an error answer: `error`, `message` and `errors[]` of its body. */
function palavrasDoErro(erro: any): string {
  const corpo = erro?.data ?? erro?.response?._data
  if (!corpo || typeof corpo !== 'object') return ''
  const lista = Array.isArray(corpo.errors) ? corpo.errors.map((e: any) => (typeof e === 'string' ? e : e?.message)) : []
  return [corpo.error, corpo.message, ...lista].filter((parte) => typeof parte === 'string').join(' ')
}

/**
 * Reads a lookup that failed.
 *
 * 404 is "not found". So is a 400 whose body says that the charge was not
 * found: 400 with an error message is the error the Woovi API documents for
 * "get one charge". The words are read from the body of the answer only.
 *
 * Everything else is no answer: any other 400, a refused credential (401,
 * 403), a rate limit (429), a provider error (5xx), a network error or a
 * timeout carry no information about the charge.
 */
export function consultaQueFalhou(erro: any): { situacao: 'nao_encontrada' } | { situacao: 'sem_resposta' } {
  const status = Number(erro?.statusCode ?? erro?.status ?? erro?.response?.status)
  if (status === 404) return { situacao: 'nao_encontrada' }
  if (status === 400 && DIZ_QUE_NAO_ENCONTROU.test(palavrasDoErro(erro))) return { situacao: 'nao_encontrada' }
  return { situacao: 'sem_resposta' }
}
