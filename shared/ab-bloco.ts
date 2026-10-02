// ---------------------------------------------------------------------------
// Teste A/B do bloco bloqueado da consulta gratis (21/set/2026).
//
// A = a tela como ela esta hoje. B = copy que fala do veiculo ESPECIFICO
// (marca/modelo/ano, valor FIPE) e troca a promessa generica por "da pra
// confiar neste carro?". B so vale quando NAO ha sinal de leilao positivo:
// com registro encontrado a tela ja fala do achado e mexer nela seria testar
// duas coisas ao mesmo tempo.
//
// Regras de copy que nao mudam: nunca citar a fonte dos dados, nunca afirmar
// que o problema existe (so "pode ter", "indicador", "indicio").
// ---------------------------------------------------------------------------

// RODADA 3 (02/out/2026, decisao do Cesar): A venceu a rodada 2 (A x B).
// Agora A x A2: A2 = layout A com o card de oferta logo abaixo do card de
// dados, ANTES da ancora FIPE. Quem tinha 'B' guardado na sessao e
// re-sorteado entre A e A2 (B deixou de ser valido). Todo evento sai com
// extra.ab_rodada = AB_RODADA, que a funil_diario usa pra fase 'rodada3'.
export type VarianteAbBloco = 'A' | 'A2'
export const AB_RODADA = '3'

/** Chave em sessionStorage: a variante vale pra UMA visita, nao e cookie. */
export const AB_BLOCO_KEY = 'pc_ab_bloco'

export function varianteValida(v: unknown): v is VarianteAbBloco {
  return v === 'A' || v === 'A2'
}

type Storage = { getItem(k: string): string | null; setItem(k: string, v: string): void }

function storage(): Storage | null {
  try {
    return (globalThis as any).sessionStorage ?? null
  } catch {
    return null
  }
}

/**
 * Le a variante ja sorteada NESTA visita, sem sortear nada. Serve pro
 * analytics carimbar `extra.ab_bloco` em todo evento do funil sem decidir
 * variante por acidente num evento que acontece antes do bloco existir.
 */
export function varianteAtual(): VarianteAbBloco | null {
  try {
    const v = storage()?.getItem(AB_BLOCO_KEY)
    return varianteValida(v) ? v : null
  } catch {
    return null
  }
}

/**
 * Decide a variante UMA vez por visita e guarda. `desligado` e o kill switch
 * (NUXT_PUBLIC_AB_BLOCO=off): todo mundo vira A e nada e gravado, entao
 * desligar no meio do teste nao deixa metade da base carimbada.
 *
 * `rnd` injetavel pro teste: sorteio 50/50 nao se testa com Math.random solto.
 */
export function decidirVariante(opts: { desligado?: boolean; rnd?: () => number } = {}): VarianteAbBloco {
  if (opts.desligado) return 'A'
  const guardada = varianteAtual()
  if (guardada) return guardada
  const escolhida: VarianteAbBloco = (opts.rnd ?? Math.random)() < 0.5 ? 'A' : 'A2'
  try { storage()?.setItem(AB_BLOCO_KEY, escolhida) } catch { /* modo privado */ }
  return escolhida
}

/** So pra teste. */
export function _limparVarianteAbBloco() {
  try { (storage() as any)?.removeItem?.(AB_BLOCO_KEY) } catch { /* idem */ }
}

/**
 * "R$ 113.297,00" -> "113.297". Os centavos do FIPE sao ruido numa frase que
 * quer soar como o preco do anuncio. Devolve null quando nao da pra extrair
 * numero nenhum, e ai a frase do preco some inteira em vez de sair quebrada.
 */
export function fipeSemCentavos(valor?: string | null): string | null {
  if (typeof valor !== 'string') return null
  const m = valor.match(/([\d][\d.\s]*)(?:,\d+)?/)
  const bruto = m?.[1]?.replace(/\s/g, '').replace(/\.$/, '')
  if (!bruto || !/\d/.test(bruto)) return null
  return bruto
}

/** Titulo padrao (o de hoje), usado quando falta marca, modelo ou ano. */
export const TITULO_PADRAO = 'Indicador de roubo, registro de leilão ou dívida escondida?'

export interface TituloB { intro: string }

/**
 * Titulo da variante B. Precisa dos TRES campos: "Este Fiat  2015" sairia
 * pior do que o titulo generico. Faltando qualquer um, cai no de hoje.
 */
export function tituloVarianteB(marca?: string | null, modelo?: string | null, ano?: string | number | null): string {
  const partes = [marca, modelo, ano].map(p => (p === null || p === undefined ? '' : String(p).trim()))
  if (partes.some(p => !p || p === '-')) return TITULO_PADRAO
  return `Este ${partes.join(' ')} pode ter restrição, gravame ou dívida.`
}

/**
 * Sub da variante B. Sem FIPE, a oracao do preco some e a frase comeca no
 * beneficio: prometer "antes de pagar R$ -" seria pior que nao prometer nada.
 */
export function subVarianteB(fipe: string | null, verificacoes: number): string {
  const lista = `restrição, indicador de roubo e furto, indício de leilão no documento, gravame, bloqueio judicial e mais ${verificacoes} verificações`
  const inicio = fipe
    ? `Antes de pagar R$ ${fipe} por ele, veja se pode confiar: `
    : 'Veja se pode confiar neste carro: '
  return `${inicio}${lista}. Sai em até 5 minutos.`
}

/** Linha abaixo do botao na variante B. No app nao existe Pix. */
export function garantiaVarianteB(preco: string, semPix = false): string {
  const meios = semPix ? [preco] : [preco, 'Pix']
  return [...meios, 'em até 5 minutos', 'estorno se o veículo não for encontrado'].join(' · ')
}
