<script setup lang="ts">
// Fotos e videos do lote de leilao. 27/out/2026: carrossel com uma midia grande
// por vez. 05/nov/2026 (Cesar): grade de miniaturas; clicar abre a midia
// ampliada (lightbox) com setas, swipe, contador e Esc para fechar.
// A grade mostra ate MAX_MINIS; a ultima vira "+N" e abre o lightbox ali.
// Miniatura com loading="lazy"; o lightbox so carrega a midia atual e as
// vizinhas; video com preload="none". Na impressao, grade com as 4 primeiras fotos.
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { MidiaLote } from '~/shared/foto-lote'

const props = defineProps<{ midias: MidiaLote[] }>()

const MAX_MINIS = 8
const total = computed(() => props.midias.length)
const minis = computed(() => props.midias.slice(0, total.value > MAX_MINIS ? MAX_MINIS - 1 : MAX_MINIS))
const resto = computed(() => total.value - minis.value.length)

const aberto = ref(false)
const atual = ref(0)
const trilho = ref<HTMLElement | null>(null)
const carregadas = ref(new Set<number>())
let focoAntes: HTMLElement | null = null

function marcarVizinhas(i: number) {
  const s = new Set(carregadas.value)
  for (const k of [i - 1, i, i + 1]) if (k >= 0 && k < total.value) s.add(k)
  carregadas.value = s
}

async function abrir(i: number) {
  focoAntes = (document.activeElement as HTMLElement) || null
  atual.value = i
  marcarVizinhas(i)
  aberto.value = true
  await nextTick()
  const el = trilho.value
  if (el) { el.scrollLeft = i * el.clientWidth; el.focus() }
}
function fechar() {
  aberto.value = false
  nextTick(() => focoAntes?.focus?.())
}
function ir(delta: number) {
  const el = trilho.value
  if (!el) return
  const i = Math.max(0, Math.min(total.value - 1, atual.value + delta))
  el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  atual.value = i
  marcarVizinhas(i)
}
function aoRolar() {
  const el = trilho.value
  if (!el || !el.clientWidth) return
  const i = Math.round(el.scrollLeft / el.clientWidth)
  if (i !== atual.value) { atual.value = Math.max(0, Math.min(total.value - 1, i)); marcarVizinhas(atual.value) }
}
function tecla(e: KeyboardEvent) {
  if (!aberto.value) return
  if (e.key === 'Escape') { e.preventDefault(); fechar() }
  if (e.key === 'ArrowRight') { e.preventDefault(); ir(1) }
  if (e.key === 'ArrowLeft') { e.preventDefault(); ir(-1) }
}

// Trava o scroll da pagina com o lightbox aberto.
watch(aberto, (v) => {
  if (typeof document === 'undefined') return
  document.documentElement.style.overflow = v ? 'hidden' : ''
  if (v) window.addEventListener('keydown', tecla)
  else window.removeEventListener('keydown', tecla)
})
onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.documentElement.style.overflow = ''
  if (typeof window !== 'undefined') window.removeEventListener('keydown', tecla)
})

function rotuloMini(m: MidiaLote, i: number) {
  const tipo = m.tipo === 'foto' ? 'foto' : 'vídeo'
  return `Ampliar ${tipo} ${i + 1} de ${total.value}`
}
</script>

<template>
  <div v-if="total" class="lc">
    <ul class="lc__grade" :class="{ 'lc__grade--um': total === 1 }" aria-label="Fotos e vídeos do lote">
      <li v-for="(m, i) in minis" :key="i" class="lc__item" :class="{ 'lc__item--extra': i >= 4 || m.tipo !== 'foto' }">
        <button type="button" class="lc__mini" :aria-label="rotuloMini(m, i)" @click="abrir(i)">
          <img v-if="m.tipo === 'foto'" :src="m.src" :alt="m.alt" class="lc__mini-img" loading="lazy" decoding="async">
          <span v-else class="lc__mini-video" aria-hidden="true">▶</span>
        </button>
      </li>
      <li v-if="resto > 0" class="lc__item lc__item--extra">
        <button type="button" class="lc__mini lc__mini--mais" :aria-label="`Ver mais ${resto} fotos e vídeos`" @click="abrir(minis.length)">
          <img v-if="midias[minis.length]?.tipo === 'foto'" :src="midias[minis.length].src" alt="" class="lc__mini-img" loading="lazy" decoding="async">
          <span class="lc__mais">+{{ resto }}</span>
        </button>
      </li>
    </ul>

    <Teleport to="body">
      <div v-if="aberto" class="lc-lb" role="dialog" aria-modal="true" aria-label="Fotos e vídeos do lote ampliados" @click.self="fechar">
        <button type="button" class="lc-lb__fechar" aria-label="Fechar" @click="fechar">×</button>
        <div ref="trilho" class="lc-lb__trilho" tabindex="-1" @scroll.passive="aoRolar">
          <div v-for="(m, i) in midias" :key="i" class="lc-lb__slide" :aria-label="`${i + 1} de ${total}`" @click.self="fechar">
            <template v-if="carregadas.has(i)">
              <img v-if="m.tipo === 'foto'" :src="m.src" :alt="m.alt" class="lc-lb__img" decoding="async">
              <video v-else-if="m.tipo === 'video'" :src="m.src" controls preload="none" playsinline class="lc-lb__video" :aria-label="m.alt" />
              <iframe
                v-else-if="m.tipo === 'embed'"
                :src="m.src"
                :title="m.alt"
                class="lc-lb__embed"
                loading="lazy"
                allow="encrypted-media; picture-in-picture; fullscreen"
                referrerpolicy="strict-origin-when-cross-origin"
              />
              <a v-else-if="m.tipo === 'link'" :href="m.src" target="_blank" rel="noopener noreferrer nofollow" class="lc-lb__grande">
                <span class="lc-lb__play" aria-hidden="true">▶</span>
                Vídeo do lote grande demais para abrir aqui. Assistir no site da leiloeira.
              </a>
            </template>
          </div>
        </div>
        <template v-if="total > 1">
          <button type="button" class="lc-lb__seta lc-lb__seta--esq" :disabled="atual === 0" aria-label="Anterior" @click="ir(-1)">‹</button>
          <button type="button" class="lc-lb__seta lc-lb__seta--dir" :disabled="atual >= total - 1" aria-label="Próxima" @click="ir(1)">›</button>
        </template>
        <span class="lc-lb__cont" aria-live="polite">{{ atual + 1 }}/{{ total }}</span>
      </div>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.lc { margin: 10px 0 8px; }
.lc__grade {
  list-style: none; margin: 0; padding: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  max-width: 520px;
  @media (max-width: 480px) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  &--um { grid-template-columns: minmax(0, 200px); }
}
.lc__mini {
  position: relative;
  display: block; width: 100%; aspect-ratio: 4 / 3;
  padding: 0; border: 0; border-radius: 6px; overflow: hidden;
  background: #e9ebee; cursor: zoom-in;
  &:focus-visible { outline: 2px solid #1a1a1a; outline-offset: 2px; }
  &:hover .lc__mini-img { transform: scale(1.04); }
}
.lc__mini-img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.15s ease; }
.lc__mini-video {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%; background: #1a1a1a; color: #fff; font-size: 22px;
}
.lc__mini--mais .lc__mini-img { filter: brightness(0.45); }
.lc__mais {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 18px; font-weight: 700; background: rgba(0, 0, 0, 0.35);
}

// Lightbox (teleportado para o body: estilos com :global pelo scoped).
:global(.lc-lb) {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(10, 10, 12, 0.94);
  display: flex; align-items: center; justify-content: center;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
:global(.lc-lb__trilho) {
  display: flex; width: 100%; height: 100%;
  overflow-x: auto; scroll-snap-type: x mandatory;
  scrollbar-width: none; -webkit-overflow-scrolling: touch;
  outline: none;
}
:global(.lc-lb__trilho::-webkit-scrollbar) { display: none; }
:global(.lc-lb__slide) {
  flex: 0 0 100%; scroll-snap-align: start;
  display: flex; align-items: center; justify-content: center;
  padding: 56px 12px;
}
:global(.lc-lb__img), :global(.lc-lb__video) { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
:global(.lc-lb__embed) { width: min(100%, 960px); aspect-ratio: 16 / 9; border: 0; }
:global(.lc-lb__grande) {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  color: #fff; text-align: center; font-size: 15px; text-decoration: underline; max-width: 320px;
}
:global(.lc-lb__play) { font-size: 32px; text-decoration: none; }
:global(.lc-lb__fechar) {
  position: absolute; top: calc(env(safe-area-inset-top, 0px) + 10px); right: 12px; z-index: 2;
  width: 40px; height: 40px; border-radius: 50%; border: 0;
  background: rgba(255, 255, 255, 0.92); color: #1a1a1a; font-size: 26px; line-height: 1; cursor: pointer;
}
:global(.lc-lb__seta) {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 2;
  width: 44px; height: 44px; border-radius: 50%; border: 0;
  background: rgba(255, 255, 255, 0.92); color: #1a1a1a; font-size: 28px; line-height: 1; cursor: pointer;
  display: none;
}
:global(.lc-lb__seta:disabled) { opacity: 0.35; cursor: default; }
:global(.lc-lb__seta--esq) { left: 12px; }
:global(.lc-lb__seta--dir) { right: 12px; }
@media (hover: hover) and (pointer: fine) and (min-width: 641px) {
  :global(.lc-lb__seta) { display: flex; align-items: center; justify-content: center; }
}
:global(.lc-lb__cont) {
  position: absolute; left: 50%; transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
  padding: 3px 10px; border-radius: 10px;
  background: rgba(255, 255, 255, 0.16); color: #fff;
  font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums;
}

// Papel: grade 2x2 com as 4 primeiras fotos; o resto e o lightbox ficam de fora.
@media print {
  .lc__grade { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: none; }
  .lc__item--extra { display: none; }
  .lc__mini { aspect-ratio: auto; }
  .lc__mini-img { height: 52mm; }
  :global(.lc-lb) { display: none !important; }
}
</style>
