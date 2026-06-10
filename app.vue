<script setup lang="ts">
const isReady = ref(false)
const isPWA = ref(false)

// Detect PWA mode synchronously on client
if (import.meta.client) {
  isPWA.value = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true ||
                document.referrer.includes('android-app://')
}

// Wait for PWA Service Worker to be ready before showing app
// This prevents flicker during auto-update by keeping loading screen active
const pwaReady = useState('pwaReady', () => false)

if (!isPWA.value) {
  // Web: show app immediately, no loading screen
  isReady.value = true
} else {
  watch(pwaReady, (ready) => {
    if (ready) {
      // Small delay to ensure smooth transition and isPWA detection
      setTimeout(() => {
        isReady.value = true
      }, 100)
    }
  }, { immediate: true })
}
</script>

<template>
  <div>
    <!-- PWA Loading Screen (PWA only) -->
    <div v-if="isPWA && !isReady" class="pwa-loader">
      <PlacaCompletaIcon variant="inverted" class="pwa-loader__logo" />
    </div>

    <div v-show="isReady">
      <NuxtPage />
      <footer class="footer">
        <nav class="footer__nav" aria-label="Conteúdo do site">
          <NuxtLink to="/consultar-placa">Consultar por Estado</NuxtLink>
          <span class="footer__sep">|</span>
          <NuxtLink to="/tabela-fipe">Tabela FIPE</NuxtLink>
          <span class="footer__sep">|</span>
          <NuxtLink to="/tabela-fipe-por-placa">FIPE pela Placa</NuxtLink>
          <span class="footer__sep">|</span>
          <NuxtLink to="/como-consultar-placa">Como Consultar</NuxtLink>
          <span class="footer__sep">|</span>
          <NuxtLink to="/ibv">IBV Auto</NuxtLink>
        </nav>
        <p>&copy; {{ new Date().getFullYear() }} PlacaCompleta — Consulta veicular grátis e segura.</p>
        <p class="footer__email">contato[at]placacompleta.com.br</p>
        <nav class="footer__links">
          <NuxtLink to="/sobre">Sobre</NuxtLink>
          <span class="footer__sep">|</span>
          <NuxtLink to="/termos-de-uso">Termos de Uso</NuxtLink>
          <span class="footer__sep">|</span>
          <NuxtLink to="/politica-de-privacidade">Política de Privacidade</NuxtLink>
        </nav>
      </footer>
    </div>

  </div>
</template>

<style scoped>
.pwa-loader {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #001233 0%, #0466c8 100%);
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
