<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'default' | 'brutalist' | 'fintech' | 'inverted'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
})

const colors = computed(() => {
  switch (props.variant) {
    case 'brutalist':
      return { primary: '#000000', accent: '#00FFA3' }
    case 'fintech':
      return { primary: '#0B1F3A', accent: '#2BD9C3' }
    case 'inverted':
      return { primary: '#ffffff', accent: '#00FFA3' }
    default:
      return { primary: '#0B1F3A', accent: '#00D1B2' }
  }
})
</script>

<template>
  <svg
    class="placa-logo"
    viewBox="0 0 304 120"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="PlacaCompleta"
  >
    <rect x="24" y="40" width="80" height="48" rx="2" :fill="colors.primary" />
    <rect x="24" y="40" width="8" height="48" :fill="colors.accent" />

    <rect x="40" y="60" width="8" height="8" fill="#fff" />
    <rect x="56" y="60" width="8" height="8" fill="#fff" />
    <rect x="72" y="60" width="8" height="8" fill="#fff" />

    <path d="M16 32 H36 V28 H12 V52 H16 Z" :fill="colors.primary" />
    <path d="M112 32 H92 V28 H116 V52 H112 Z" :fill="colors.primary" />
    <path d="M16 96 H36 V100 H12 V76 H16 Z" :fill="colors.primary" />
    <path d="M112 96 H92 V100 H116 V76 H112 Z" :fill="colors.primary" />

    <text
      x="140"
      y="70"
      font-family="'Trebuchet MS', Tahoma, 'Segoe UI', sans-serif"
      font-size="36"
      font-weight="700"
      :fill="colors.primary"
    >PLACA</text>
    <text
      x="140"
      y="100"
      font-family="'Trebuchet MS', Tahoma, 'Segoe UI', sans-serif"
      font-size="32"
      font-weight="400"
      :fill="colors.primary"
    >COMPLETA</text>
  </svg>
</template>

<style scoped>
.placa-logo {
  display: block;
  width: 100%;
  height: auto;
}
</style>
