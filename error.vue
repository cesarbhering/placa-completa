<script setup lang="ts">
const props = defineProps({
  error: {
    type: Object,
    required: true,
  },
})

useHead({
  title: 'Página não encontrada — PlacaCompleta',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

function goHome() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="error-desktop">
    <div class="error-window win-window" role="alertdialog" aria-labelledby="error-title">
      <div class="win-window__titlebar">
        <span id="error-title">PlacaCompleta — Página não encontrada</span>
        <div class="win-window__titlebar-buttons">
          <span class="win-window__titlebar-btn">_</span>
          <span class="win-window__titlebar-btn">&square;</span>
          <span class="win-window__titlebar-btn">&times;</span>
        </div>
      </div>

      <div class="win-window__body">
        <div class="error-hero">
          <span class="error-code">404</span>
          <span class="error-label">Página não encontrada</span>
        </div>

        <hr class="win-separator" />

        <div class="error-body">
          <p class="error-message">
            O endereço solicitado não existe ou foi removido.
          </p>
          <p class="error-hint">
            Verifique se a URL está correta ou volte ao início para consultar uma placa.
          </p>
        </div>

        <div class="error-actions">
          <button class="win-btn win-btn--primary" @click="goHome">
            Ir para o início
          </button>
        </div>
      </div>

      <div class="win-statusbar error-statusbar">
        <span class="statusbar-dot" />
        Código: {{ error?.statusCode || 404 }}
        <span class="statusbar-sep">|</span>
        placacompleta.com.br
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '~/assets/scss/variables' as *;

.error-desktop {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $space-md;
}

.error-window {
  width: 400px;
  max-width: 95vw;
}

// Hero: the big 404
.error-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $space-lg 0 $space-md;
  gap: $space-xs;
}

.error-code {
  font-family: $font-display;
  font-size: 6rem;
  line-height: 1;
  color: $navy-electric;
  letter-spacing: 8px;
  display: block;
}

.error-label {
  font-family: $font-display;
  font-size: 1.25rem;
  color: $graphite;
  letter-spacing: 1px;
  display: block;
}

// Body text
.error-body {
  padding: $space-md 0;
  text-align: center;
}

.error-message {
  font-family: $font-body;
  font-size: 0.875rem;
  color: $graphite;
  margin-bottom: $space-sm;
}

.error-hint {
  font-family: $font-body;
  font-size: 0.8125rem;
  color: $win-darker;
  line-height: 1.6;
}

// CTA
.error-actions {
  display: flex;
  justify-content: center;
  padding: $space-sm 0 $space-md;
}

// Status bar
.error-statusbar {
  display: flex;
  align-items: center;
  gap: $space-xs;
  font-size: 0.6875rem;
}

.statusbar-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $win-dark;
  flex-shrink: 0;
}

.statusbar-sep {
  margin: 0 $space-xs;
  opacity: 0.4;
}
</style>
