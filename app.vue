<script setup lang="ts">
// No artificial delay - let Nuxt handle hydration naturally
</script>

<template>
  <div>
    <NuxtPage />

    <!-- PWA Install Prompt (appears automatically on supported devices) -->
    <ClientOnly>
      <pwa-install
        name="PlacaCompleta"
        icon="/logo-nobg-200.png"
      />
    </ClientOnly>
  </div>
</template>

<style scoped>
/* Removed artificial loader - using Nuxt's native hydration */
</style>
