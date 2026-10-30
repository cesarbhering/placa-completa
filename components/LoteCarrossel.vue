<script setup lang="ts">
// Carrossel das fotos e videos do lote de leilao (Cesar, 27/out/2026). Antes
// eram ate 4 fotos soltas; a leiloes-api passou a guardar TODAS as fotos e os
// videos do lote. Swipe nativo no celular (scroll-snap), setas no desktop,
// contador "3/18". So carrega a midia atual e as vizinhas; video com
// preload="none". Na impressao vira grade com as 4 primeiras fotos.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { MidiaLote } from '~/shared/foto-lote'

const props = defineProps<{ midias: MidiaLote[] }>()

const trilho = ref<HTMLElement | null>(null)
const atual = ref(0)
const imprimindo = ref(false)
const total = computed(() => props.midias.length)
// Ja carregadas ficam carregadas (voltar nao recarrega).
const carregadas = ref(new Set<number>([0, 1]))

function marcarVizinhas(i: number) {
  const s = new Set(carregadas.value)
  for (const k of [i - 1, i, i + 1]) if (k >= 0 && k < total.value) s.add(k)
  carregadas.value = s
}
function deveCarregar(i: number, tipo: MidiaLote['tipo']): boolean {
  // Na impressao, as 4 primeiras fotos.
  if (imprimindo.value && tipo === 'foto' && i < 4) return true
  return carregadas.value.has(i)
}

function aoRolar() {
  const el = trilho.value
  if (!el || !el.clientWidth) return
  const i = Math.round(el.scrollLeft / el.clientWidth)
  if (i !== atual.value) { atual.value = Math.max(0, Math.min(total.value - 1, i)); marcarVizinhas(atual.value) }
}
function ir(delta: number) {
  const el = trilho.value
  if (!el) return
  const i = Math.max(0, Math.min(total.value - 1, atual.value + delta))
  el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  atual.value = i
  marcarVizinhas(i)
}
function tecla(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') { e.preventDefault(); ir(1) }
  if (e.key === 'ArrowLeft') { e.preventDefault(); ir(-1) }
}
const antesImprimir = () => { imprimindo.value = true }
const depoisImprimir = () => { imprimindo.value = false }
onMounted(() => {
  window.addEventListener('beforeprint', antesImprimir)
  window.addEventListener('afterprint', depoisImprimir)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeprint', antesImprimir)
  window.removeEventListener('afterprint', depoisImprimir)
})
</script>

<template>
  <div v-if="total" class="lc" :class="{ 'lc--um': total === 1 }">
    <div
      ref="trilho"
      class="lc__trilho"
      tabindex="0"
      role="region"
      aria-roledescription="carrossel"
      aria-label="Fotos e vídeos do lote"
      @scroll.passive="aoRolar"
      @keydown="tecla"
    >
      <div
        v-for="(m, i) in midias"
        :key="i"
        class="lc__slide"
        :class="[`lc__slide--${m.tipo}`, { 'lc__slide--extra': i >= 4 || m.tipo !== 'foto' }]"
        role="group"
        aria-roledescription="slide"
        :aria-label="`${i + 1} de ${total}`"
      >
        <template v-if="m.tipo === 'foto'">
          <a v-if="deveCarregar(i, m.tipo)" :href="m.src" target="_blank" rel="noopener noreferrer" class="lc__link">
            <img :src="m.src" :alt="m.alt" class="lc__img" decoding="async">
          </a>
          <span v-else class="lc__vazio" aria-hidden="true" />
        </template>
        <video v-else-if="m.tipo === 'video'" :src="deveCarregar(i, m.tipo) ? m.src : undefined" controls preload="none" playsinline class="lc__video" :aria-label="m.alt" />
        <iframe
          v-else-if="m.tipo === 'embed' && deveCarregar(i, m.tipo)"
          :src="m.src"
          :title="m.alt"
          class="lc__embed"
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen"
          referrerpolicy="strict-origin-when-cross-origin"
        />
        <a v-else-if="m.tipo === 'link'" :href="m.src" target="_blank" rel="noopener noreferrer nofollow" class="lc__grande">
          <span class="lc__play" aria-hidden="true">▶</span>
          Vídeo do lote grande demais para abrir aqui. Assistir no site da leiloeira.
        </a>
        <span v-else class="lc__vazio" aria-hidden="true" />
      </div>
    </div>
    <template v-if="total > 1">
      <button type="button" class="lc__seta lc__seta--esq" :disabled="atual === 0" aria-label="Anterior" @click="ir(-1)">‹</button>
      <button type="button" class="lc__seta lc__seta--dir" :disabled="atual >= total - 1" aria-label="Próxima" @click="ir(1)">›</button>
      <span class="lc__cont" aria-live="polite">{{ atual + 1 }}/{{ total }}</span>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.lc {
  position: relative;
  margin: 10px 0 8px;
  border-radius: 8px;
  overflow: hidden;
  background: #f1f2f4;
}
.lc__trilho {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  &::-webkit-scrollbar { display: none; }
  &:focus-visible { outline: 2px solid #1a1a1a; outline-offset: -2px; }
}
.lc__slide {
  flex: 0 0 100%;
  scroll-snap-align: start;
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e9ebee;
}
.lc__link { display: block; width: 100%; height: 100%; }
.lc__img, .lc__video, .lc__embed { width: 100%; height: 100%; object-fit: cover; display: block; border: 0; }
.lc__video { object-fit: contain; background: #000; }
.lc__vazio { width: 100%; height: 100%; }
.lc__grande {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 16px; text-align: center; font-size: 14px; line-height: 1.4;
  color: #1a1a1a; text-decoration: underline;
}
.lc__play { font-size: 28px; text-decoration: none; }
.lc__seta {
  position: absolute; top: 50%; transform: translateY(-50%);
  width: 36px; height: 36px; border-radius: 50%; border: 0;
  background: rgba(255, 255, 255, 0.92); color: #1a1a1a;
  font-size: 24px; line-height: 1; cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  display: none;
  &:disabled { opacity: 0.35; cursor: default; }
  &--esq { left: 8px; }
  &--dir { right: 8px; }
}
// Setas so com mouse em tela larga (desktop); no celular e swipe.
@media (hover: hover) and (pointer: fine) and (min-width: 641px) {
  .lc__seta { display: flex; align-items: center; justify-content: center; }
}
.lc__cont {
  position: absolute; right: 8px; bottom: 8px;
  padding: 2px 8px; border-radius: 10px;
  background: rgba(0, 0, 0, 0.62); color: #fff;
  font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;
}

// Papel: grade 2x2 com as 4 primeiras fotos; video e o resto ficam de fora.
@media print {
  .lc { background: none; overflow: visible; }
  .lc__trilho { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; overflow: visible; }
  .lc__slide { aspect-ratio: auto; background: none; }
  .lc__slide--extra { display: none; }
  .lc__img { height: 52mm; object-fit: cover; }
  .lc__seta, .lc__cont { display: none !important; }
}
</style>
