<script setup lang="ts">
const isReady = ref(false)

onMounted(() => {
  // Wait for PWA detection and hydration to complete
  // This prevents flash when hiding/showing elements based on isPWA
  setTimeout(() => {
    isReady.value = true
  }, 200)
})
</script>

<template>
  <div>
    <!-- PWA Loading Screen -->
    <div v-if="!isReady" class="pwa-loader">
      <img src="/logo-nobg-200.png" alt="PlacaCompleta" class="pwa-loader__logo" />
    </div>

    <div v-show="isReady">
      <NuxtPage />
    </div>

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
.pwa-loader {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #090c9b 0%, #3066be 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.pwa-loader__logo {
  width: 120px;
  height: 120px;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(0.95);
  }
}
</style>
