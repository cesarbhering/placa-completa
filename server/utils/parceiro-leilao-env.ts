// Nome legado do fornecedor da base parceira de leiloes e sinistros.
// Este e o UNICO arquivo do codigo onde ele aparece. Serve so para o que nao
// da para renomear sem quebrar producao:
//  - envs antigas NUXT_<NOME>_*: fallback de runtime enquanto o ambiente nao
//    migra para NUXT_PARCEIRO_LEILAO_* (o nome novo sempre tem prioridade);
//  - chaves ja gravadas no banco (fonte_cache.fonte, premium_custos.fonte);
//  - host padrao da API.
// Em todo o resto do codigo o fornecedor e "parceiro-leilao".

/** nome legado */
const NOME_ANTIGO = 'avaliservice'

export const FONTE_CACHE_LEGADA = NOME_ANTIGO
export const FONTE_CUSTO_LEGADA = `${NOME_ANTIGO}_leilao_sinistro`
export const BASE_PADRAO_LEGADA = `https://api.${NOME_ANTIGO}.com.br`
/** Para os testes que garantem que o nome nao vaza em nada publico. */
export const NOME_FORNECEDOR_RE = new RegExp(NOME_ANTIGO, 'i')

type Env = Record<string, string | undefined>
type Campo = 'LIGADO' | 'USER' | 'PASS' | 'TETO_DIA' | 'URL'

/** Env legada NUXT_<NOME>_<campo> (nome legado), so como fallback. */
export function envLegadaParceiro(campo: Campo, env: Env = process.env): string {
  return String(env[`NUXT_${NOME_ANTIGO.toUpperCase()}_${campo}`] || '')
}

/** Config da base parceira: runtimeConfig (NUXT_PARCEIRO_LEILAO_*) e, se vazio, a env legada. */
export function configParceiroComLegado(config: any, env: Env = process.env) {
  const v = (novo: unknown, campo: Campo) => String(novo ?? '').trim() || envLegadaParceiro(campo, env)
  return {
    ligado: v(config?.parceiroLeilaoLigado, 'LIGADO'),
    usuario: v(config?.parceiroLeilaoUser, 'USER'),
    senha: v(config?.parceiroLeilaoPass, 'PASS'),
    tetoDia: v(config?.parceiroLeilaoTetoDia, 'TETO_DIA'),
    url: v(config?.parceiroLeilaoUrl, 'URL'),
  }
}
