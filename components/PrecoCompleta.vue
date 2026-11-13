<script setup lang="ts">
import { computed } from 'vue'
import { usePrecoCompleta } from '~/composables/usePrecoCompleta'
// Completa price for consumer pages (price A/B test): see usePrecoCompleta.
// `dobra` = this spot is in the first fold: with the test on, the number is
// kept invisible (space reserved) until mount, in both arms.
// `espaco` = separator after "R$". Default is the non-breaking space precoBRL
// produces; pages that always wrote "R$ 44,90" with a plain space pass ' ', so
// the HTML stays identical with the test off.
const props = withDefaults(defineProps<{ dobra?: boolean; espaco?: string }>(), { dobra: false, espaco: ' ' })
const { texto: brl, visivel } = usePrecoCompleta()
const texto = computed(() => brl.value.replace(/^R\$[\s ]?/, `R$${props.espaco}`))
</script>

<template>
  <span v-if="props.dobra && !visivel" style="visibility: hidden">{{ texto }}</span>
  <template v-else>{{ texto }}</template>
</template>
