<script setup lang="ts">
// Renders a text that mentions the Completa table price, with the price
// coming from <PrecoCompleta> (price A/B test). Without the price in the text
// it renders the text as is.
import { computed } from 'vue'
import { partesComPreco } from '~/composables/usePrecoCompleta'
import PrecoCompleta from './PrecoCompleta.vue'

const props = withDefaults(defineProps<{ texto: string; dobra?: boolean }>(), { dobra: false })
const partes = computed(() => partesComPreco(props.texto))
</script>

<template>
  <template v-for="(p, i) in partes" :key="i">
    <PrecoCompleta v-if="typeof p !== 'string'" :dobra="props.dobra" :espaco="p.espaco" />
    <template v-else>{{ p }}</template>
  </template>
</template>
