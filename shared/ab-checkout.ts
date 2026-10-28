// ---------------------------------------------------------------------------
// Teste A/B da tela de confirmacao do checkout (aprovado pelo Cesar em
// 27/out/2026). Em 14 dias, 452 abriram o checkout, 158 geraram Pix e 139
// fecharam na confirmacao sem pagar: quase toda desistencia e na etapa
// `confirm` do PremiumInlineCheckout.
//
// A = confirmacao como esta hoje. B = confirmacao enxuta: previa do que o
// relatorio desbloqueia, linha de risco acima do preco, cupom atras de um link
// e o e-mail pedido na tela do QR (enquanto a pessoa espera).
//
// Mesmo lugar do ab_bloco (sessionStorage): a variante vale pra UMA visita.
// No app (Capacitor) e sempre A e nada e gravado: la o e-mail e obrigatorio
// antes da compra, entao a variante B nao existe e o app nao entra na conta.
// ---------------------------------------------------------------------------

export type VarianteAbCheckout = 'A' | 'B'

/** Chave em sessionStorage, ao lado de pc_ab_bloco. */
export const AB_CHECKOUT_KEY = 'pc_ab_checkout'

/** Marca que o app injeta no user-agent (mesma de composables/useAppMode.ts). */
const MARCADOR_APP = 'PlacaCompletaApp'

export function varianteCheckoutValida(v: unknown): v is VarianteAbCheckout {
  return v === 'A' || v === 'B'
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
 * Rodando dentro do app novo? Versao sem composable de useAppMode, pra poder
 * ser chamada do analytics (escopo de modulo) e de teste unitario.
 */
export function rodandoNoApp(): boolean {
  try {
    const w = (globalThis as any).window
    if (!w) return false
    const nativo = w.Capacitor
    if (typeof nativo?.isNativePlatform === 'function' && nativo.isNativePlatform()) return true
    return String(w.navigator?.userAgent || '').includes(MARCADOR_APP)
  } catch {
    return false
  }
}

/**
 * Le a variante ja sorteada NESTA visita, sem sortear. No app devolve null:
 * evento do app nunca sai carimbado, pra nao misturar com o A do site.
 */
export function varianteCheckoutAtual(): VarianteAbCheckout | null {
  if (rodandoNoApp()) return null
  try {
    const v = storage()?.getItem(AB_CHECKOUT_KEY)
    return varianteCheckoutValida(v) ? v : null
  } catch {
    return null
  }
}

/**
 * Sorteia 50/50 UMA vez por visita e guarda; chamadas seguintes devolvem a
 * mesma. `app` = true devolve A sem gravar nada. `rnd` injetavel pro teste.
 * Sem sessionStorage (modo privado) sorteia do mesmo jeito: so nao persiste.
 */
export function decidirVarianteCheckout(opts: { app?: boolean; rnd?: () => number } = {}): VarianteAbCheckout {
  if (opts.app || rodandoNoApp()) return 'A'
  const guardada = varianteCheckoutAtual()
  if (guardada) return guardada
  const v: VarianteAbCheckout = (opts.rnd ?? Math.random)() < 0.5 ? 'A' : 'B'
  try { storage()?.setItem(AB_CHECKOUT_KEY, v) } catch { /* modo privado */ }
  return v
}

/** So pra teste. */
export function _limparVarianteAbCheckout() {
  try { (storage() as any)?.removeItem?.(AB_CHECKOUT_KEY) } catch { /* idem */ }
}

/**
 * O que a previa da variante B promete desbloquear. So vale pra Completa: a
 * Basica nao tem nenhum destes itens, entao com plano basica a tela fica A.
 * Nunca afirmar que o problema existe; nenhuma fonte citada alem da base de
 * leiloes.
 */
export const DESBLOQUEIA_B: readonly string[] = [
  'Indício de leilão (base de mais de 1 milhão de veículos leiloados)',
  'Sinistro, monta ou sucata',
  'Roubo e furto',
  'Gravame e restrições',
  'Multas e débitos',
]

/** Linha de risco acima do botao na variante B (copy do Cesar, 27/out). */
export const RISCO_B_PARTES = ['Um carro que passou por leilão vale ', 'até 30% menos', ' na revenda. Saber antes custa'] as const
export const RISCO_B = RISCO_B_PARTES.join('')

export function linhaRiscoB(preco: string): string {
  return `${RISCO_B} ${preco}.`
}

/** Linha abaixo do botao do Pix na variante B. */
export const GARANTIA_B = 'Estorno automático se não acharmos o veículo · relatório em até 5 min'
