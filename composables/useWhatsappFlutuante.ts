import { toValue, type MaybeRefOrGetter, type Ref } from 'vue'

// Estado do botao flutuante de WhatsApp (components/WhatsappFlutuante.vue).
// Quem precisa da tela livre (checkout, modal, Pix) registra uma condicao; a
// barra fixa de compra do celular informa a propria altura e o botao sobe.

const OCULTOS = 'pc-wa-ocultos'
const ACIMA = 'pc-wa-acima'
let seq = 0

export function useWhatsappEstado() {
  return {
    ocultos: useState<Record<string, boolean>>(OCULTOS, () => ({})),
    acimaPx: useState<number>(ACIMA, () => 0),
  }
}

/** Esconde o botao enquanto `cond` for verdadeira (e solta ao desmontar). */
export function useWhatsappOculto(cond: MaybeRefOrGetter<boolean>) {
  const { ocultos } = useWhatsappEstado()
  if (!import.meta.client) return
  const id = `w${++seq}`
  watch(() => !!toValue(cond), (v) => { ocultos.value = { ...ocultos.value, [id]: v } }, { immediate: true })
  onBeforeUnmount(() => {
    const m = { ...ocultos.value }
    delete m[id]
    ocultos.value = m
  })
}

/** Sobe o botao acima de um elemento fixo no rodape (altura 0 quando escondido por CSS). */
export function useWhatsappAcimaDe(el: Ref<HTMLElement | null | undefined>) {
  const { acimaPx } = useWhatsappEstado()
  if (!import.meta.client) return
  let ro: ResizeObserver | null = null
  const medir = () => { acimaPx.value = el.value ? Math.round(el.value.getBoundingClientRect().height) : 0 }
  watch(el, (novo) => {
    ro?.disconnect(); ro = null
    if (novo && typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(medir); ro.observe(novo) }
    medir()
  }, { immediate: true, flush: 'post' })
  onBeforeUnmount(() => { ro?.disconnect(); acimaPx.value = 0 })
}
