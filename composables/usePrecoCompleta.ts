import { ref, computed, onMounted } from 'vue'
import { PLANOS, precoBRL } from '~/shared/planos'
import { abPrecoLigadoPorEnv, bracoAtual, precoDoPlano, type BracoPreco } from '~/shared/ab-preco'

/**
 * The ONE source of the Completa price shown on consumer pages (home, vehicle
 * type landings, purchase landings, FIPE by plate) during the price A/B test
 * (shared/ab-preco.ts).
 *
 * SSR and the first client render use arm A (table price), so hydration always
 * matches. On mount the visitor's arm takes over: B sees 39,90 from then on.
 * Sections below the fold switch before anyone scrolls to them.
 *
 * `visivel` is for prices in the FIRST FOLD: with the test on, the number stays
 * hidden (layout kept) until mount, in BOTH arms, so B never sees 44,90 turn
 * into 39,90 and both arms get the same treatment. Test off: always visible
 * and nothing changes in the HTML.
 *
 * Not for JSON-LD, meta, og, blog or /para-empresas: those stay at A.
 */
export function usePrecoCompleta() {
  const ligado = abPrecoLigadoPorEnv(useRuntimeConfig().public.abPreco)
  const braco = ref<BracoPreco | null>(null)
  const montado = ref(false)
  onMounted(() => {
    braco.value = bracoAtual()
    montado.value = true
  })
  const centavos = computed(() => precoDoPlano('completa', braco.value))
  const texto = computed(() => precoBRL(centavos.value))
  const visivel = computed(() => !ligado || montado.value)
  return { ligado, braco, montado, centavos, texto, visivel }
}

/**
 * Splits a text that mentions the table price of the Completa ("R$ 44,90", with
 * a regular or a non-breaking space) into pieces, so the price can be rendered
 * by <PrecoCompleta>. Pure. Price slots keep the separator the text used after
 * "R$", so the HTML with the test off is byte-identical to the original text.
 */
export interface SlotPreco { espaco: string }

export function partesComPreco(texto: string): (string | SlotPreco)[] {
  const t = String(texto ?? '')
  const reais = (PLANOS.completa.valorCentavos / 100).toFixed(2).replace('.', ',')
  const re = new RegExp(`R\\$([\\s\\u00a0]?)${reais.replace(/[.]/g, '\\.')}`, 'g')
  const out: (string | SlotPreco)[] = []
  let ultimo = 0
  for (const m of t.matchAll(re)) {
    out.push(t.slice(ultimo, m.index))
    out.push({ espaco: m[1] })
    ultimo = (m.index ?? 0) + m[0].length
  }
  out.push(t.slice(ultimo))
  return out
}
