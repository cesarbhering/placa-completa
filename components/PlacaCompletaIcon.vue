<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'default' | 'inverted'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
})

const colors = computed(() => {
  switch (props.variant) {
    case 'inverted':
      return { primary: '#ffffff', accent: '#00FFA3' }
    default:
      return { primary: '#000000', accent: '#00FFA3' }
  }
})
</script>

<template>
  <svg
    class="placa-icon"
    viewBox="0 0 128 128"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="PlacaCompleta"
  >
    <rect x="24" y="40" width="80" height="48" :fill="colors.primary" />
    <rect x="24" y="40" width="10" height="48" :fill="colors.accent" />

    <rect x="42" y="60" width="6" height="6" fill="#fff" />
    <rect x="56" y="60" width="6" height="6" fill="#fff" />
    <rect x="70" y="60" width="6" height="6" fill="#fff" />

    <path d="M12 28 H40 V24 H8 V56 H12 Z" :fill="colors.primary" />
    <path d="M116 28 H88 V24 H120 V56 H116 Z" :fill="colors.primary" />
    <path d="M12 100 H40 V104 H8 V72 H12 Z" :fill="colors.primary" />
    <path d="M116 100 H88 V104 H120 V72 H116 Z" :fill="colors.primary" />
  </svg>
</template>

<style scoped>
.placa-icon {
  display: block;
  width: 100%;
  height: auto;
}
</style>
