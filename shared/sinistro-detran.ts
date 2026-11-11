// Indicio de sinistro informado pelo DETRAN estadual (Cesar, 11/nov/2026).
//
// O cartao "Indício de sinistro" da grade so olhava a base parceira. Quando o
// DETRAN mandava sinistro nas restricoes (ex.: "SINISTRADO/RECUPERADO",
// "VEIC. DANO MEDIA MONTA"), o cartao ficava verde ou nem aparecia. Agora
// qualquer sinal de sinistro vindo do DETRAN deixa o cartao vermelho.
//
// Copy: nunca afirma mais do que a fonte diz ("indício de sinistro informado
// pelo órgão de trânsito"), sem nome de fornecedor, sem travessao.
// Falso positivo: trecho com negacao ("nada consta de sinistro", "sem
// sinistro", "sinistro: não") nao acende.

import { DICA_SINISTRO } from './fonte-parceira'
import { normalizarTexto, trechos, type RestricaoDetran, type VereditosRevisor } from './restricao-detran-classe'

/** Palavra que, no texto do DETRAN, aponta sinistro. "RECUPERADO" sozinho nao: pode ser de furto. */
const RE_SINISTRO = /\b(SINISTR\w*|(PEQUENA|MEDIA|GRANDE) MONTA|DMM|DGM|PERDA TOTAL)\b/
/** Negacao em qualquer ponto do trecho: o trecho inteiro fica de fora. */
const RE_NEGA = /\b(NAO|NADA|SEM|NENHUM\w*|INEXIST\w*|LIVRE DE|NEGATIV\w*|AUSENCIA)\b/
/** Valor afirmativo quando o tipo do item ja e sinistro ({ tipo: 'sinistro', texto: 'SIM' }). */
const RE_AFIRMA = /^(SIM|S|CONSTA|TRUE|1|POSITIVO|ATIVO|ATIVA)$/

export const TEXTO_SINISTRO_DETRAN = 'Indício de sinistro informado pelo órgão de trânsito.'
const DICA_SINISTRO_DETRAN = `${TEXTO_SINISTRO_DETRAN} A fonte não diz a gravidade nem se houve reparo. Peça uma vistoria cautelar e confira o documento do veículo antes de negociar.`
const ROTULO_DETRAN = 'indício de sinistro informado pelo órgão de trânsito'
const ROTULO_PARCEIRA = 'indício de sinistro em base parceira'

/** Este item do DETRAN traz sinal de sinistro? */
export function ehSinalSinistro(r: RestricaoDetran | null | undefined): boolean {
  const tipo = normalizarTexto(r?.tipo)
  const texto = normalizarTexto(r?.texto)
  if (/SINISTR/.test(tipo) && RE_AFIRMA.test(texto.replace(/[.\s]+$/, ''))) return true
  return trechos(String(r?.texto ?? '')).some((t) => {
    const n = normalizarTexto(t)
    return RE_SINISTRO.test(n) && !RE_NEGA.test(n)
  })
}

/**
 * Algum item de `multas.restricoes_detran` traz sinal de sinistro? Item que o
 * revisor ja julgou como "so nega" nao conta.
 */
export function sinistroPeloDetran(
  multas: { restricoes_detran?: RestricaoDetran[] | null } | null | undefined,
  vereditos: VereditosRevisor = {},
): boolean {
  const lista = multas?.restricoes_detran
  if (!Array.isArray(lista)) return false
  return lista.some((r) => {
    if (!ehSinalSinistro(r)) return false
    const chave = normalizarTexto(`${String(r?.tipo || '')}|${String(r?.texto || '').trim()}`)
    return vereditos[chave]?.classe !== 'nega'
  })
}

export interface CartaoSinistro {
  k: 'sinistroParceiro' | 'sinistroDetran'
  label: string
  sim: string
  nao: string
  risco: true
  dica: string
  ligado: boolean
  alerta: boolean
  rotuloVeredito: string
}

/**
 * Cartao "Indício de sinistro" da grade. Aparece quando a base parceira foi
 * consultada (verde ou vermelho, como antes) ou quando o DETRAN acusa
 * (sempre vermelho). null = nenhuma fonte de sinistro olhada.
 */
export function cartaoSinistro(o: { consultouParceira: boolean; parceiraIndicio: boolean; detran: boolean }): CartaoSinistro | null {
  const parceira = o.consultouParceira && o.parceiraIndicio
  if (!o.consultouParceira && !o.detran) return null
  const ligado = parceira || o.detran
  const rotuloVeredito = o.detran && parceira
    ? `${ROTULO_DETRAN} e em base parceira`
    : o.detran ? ROTULO_DETRAN : ROTULO_PARCEIRA
  const dica = o.detran
    ? (o.consultouParceira ? `${DICA_SINISTRO_DETRAN} ${DICA_SINISTRO}` : DICA_SINISTRO_DETRAN)
    : DICA_SINISTRO
  return {
    k: o.consultouParceira ? 'sinistroParceiro' : 'sinistroDetran',
    label: 'Indício de sinistro', sim: 'CONSTA', nao: 'NADA CONSTA', risco: true,
    dica, ligado, alerta: ligado, rotuloVeredito,
  }
}
