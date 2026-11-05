<script setup lang="ts">
// Card com mini formulario de placa das paginas /consultar/{tema}. Nao
// consulta nada aqui: leva pra /placa/<PLACA>, que e a home rodando a
// consulta normal com a placa da URL (ver placaDaRota em pages/index.vue).
const props = defineProps<{ origem: string; titulo?: string }>()
const { validatePlaca } = useFormValidation()
const placa = ref('')
const erro = ref('')

function onInput(e: Event) {
  placa.value = (e.target as HTMLInputElement).value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7)
  erro.value = ''
}

async function consultar() {
  if (!validatePlaca(placa.value)) { erro.value = 'Placa inválida. Use o formato ABC1D23 ou ABC1234.'; return }
  if (import.meta.client && (window as any).gtag) (window as any).gtag('event', 'cta_click', { source_page: props.origem, origem: 'consultar_card' })
  await navigateTo(`/placa/${placa.value}`)
}
</script>

<template>
  <section class="cpc" aria-label="Consultar pela placa">
    <p v-if="titulo" class="cpc__titulo">{{ titulo }}</p>
    <form class="cpc__form" novalidate @submit.prevent="consultar">
      <label :for="`cpc-placa-${origem}`" class="cpc__label">Placa do veículo</label>
      <input
        :id="`cpc-placa-${origem}`"
        :value="placa"
        name="placa"
        type="text"
        inputmode="text"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        maxlength="8"
        placeholder="ABC1D23"
        class="cpc__input"
        @input="onInput"
      >
      <button type="submit" class="pc-btn pc-btn--primary cpc__btn">Consultar placa</button>
      <p v-if="erro" class="cpc__erro" role="alert">{{ erro }}</p>
      <p class="cpc__nota">Marca, modelo, ano e FIPE na hora, sem cadastro.</p>
    </form>
  </section>
</template>

<style scoped>
.cpc { background: var(--pc-canvas); border: 1px solid var(--pc-hairline); border-radius: 12px; padding: 20px; margin: 24px 0 32px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); }
.cpc__titulo { margin: 0 0 12px; font-weight: 600; color: var(--pc-ink); }
.cpc__form { display: flex; flex-direction: column; gap: 10px; }
.cpc__label { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--pc-graphite); }
.cpc__input { width: 100%; height: 52px; padding: 0 14px; border: 1px solid var(--pc-steel); border-radius: 8px; font: inherit; font-size: 1.375rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; text-align: center; color: var(--pc-ink); box-sizing: border-box; }
.cpc__input:focus { outline: 2px solid var(--pc-blue); outline-offset: 1px; }
.cpc__btn { width: 100%; min-height: 48px; }
.cpc__erro { margin: 0; font-size: 0.875rem; color: #b42318; }
.cpc__nota { margin: 0; font-size: 0.8125rem; color: var(--pc-graphite); text-align: center; }
</style>
