// Name of the vendor of the vehicle history source (second partner base:
// owners, previous use, insurance and auctions; Completa report only).
// This is the ONLY file of the code where the name appears. It names what is
// stored with the vendor name (fonte_cache.fonte, premium_custos.fonte) and
// the default API host. Everywhere else the source is "parceiro-historico",
// and on screen, e-mail and report JSON it is "base parceira".

/** vendor name */
const NOME = 'renacred'

export const FONTE_CACHE_HISTORICO = `${NOME}_e20`
export const FONTE_CUSTO_HISTORICO = `${NOME}_e20`
export const BASE_PADRAO_HISTORICO = `https://api.${NOME}.com.br`
/** For the tests that make sure the name never leaks into anything public. */
export const NOME_FORNECEDOR_HISTORICO_RE = new RegExp(NOME, 'i')

export interface CfgHistorico {
  /** NUXT_PARCEIRO_HISTORICO_LIGADO=on and the key set. */
  ligado: boolean
  chave: string
  /**
   * NUXT_PARCEIRO_HISTORICO_TETO_DIA (default 60): paid calls per day
   * (Brasilia), counting the calls in progress; an attempt with an error does
   * not count.
   */
  tetoDia: number
  base: string
}

/** Config from runtimeConfig (NUXT_PARCEIRO_HISTORICO_*). Everything empty by default: off. */
export function cfgHistorico(config: any): CfgHistorico {
  const v = (x: unknown) => String(x ?? '').trim()
  const chave = v(config?.parceiroHistoricoKey)
  const teto = v(config?.parceiroHistoricoTetoDia) === '' ? NaN : Number(v(config?.parceiroHistoricoTetoDia))
  return {
    ligado: ['1', 'on', 'true', 'sim'].includes(v(config?.parceiroHistoricoLigado).toLowerCase()) && !!chave,
    chave,
    tetoDia: Number.isFinite(teto) && teto >= 0 ? teto : 60,
    base: (v(config?.parceiroHistoricoUrl) || BASE_PADRAO_HISTORICO).replace(/\/+$/, ''),
  }
}
