<script setup lang="ts">
// Aviso "Seu relatorio ficou pronto" do app: compra do Google Play que ficou
// pendente na loja e foi concluida pelo servidor sem o app estar na tela de
// compra (composables/useRecuperacaoPlay.ts). Mora no app.vue pra valer em
// qualquer rota; fora do app (site, TWA antigo) nao faz nada.
const { isCapacitor } = useAppMode()
const { aviso, iniciar } = useRecuperacaoPlay()

onMounted(() => { if (isCapacitor.value) iniciar() })

function ver() {
  const t = aviso.value?.token
  aviso.value = null
  if (t) navigateTo(`/premium/${t}`)
}
</script>

<template>
  <Transition name="arp">
    <div v-if="isCapacitor && aviso" class="arp" role="status" aria-live="polite">
      <div class="arp__txt">
        <strong>Seu relatório ficou pronto</strong>
        <span>Placa {{ aviso.placa }}. Ele também fica em Suas consultas.</span>
      </div>
      <button type="button" class="arp__btn" @click="ver">Ver relatório</button>
      <button type="button" class="arp__x" aria-label="Fechar aviso" @click="aviso = null">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      </button>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.arp {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  z-index: 1200;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 520px;
  margin: 0 auto;
  padding: 14px 12px 14px 16px;
  background: #0b1f3a;
  color: #fff;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  font-family: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
.arp__txt {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  line-height: 1.35;
  strong { font-size: 15px; }
  span { opacity: 0.85; }
}
.arp__btn {
  flex-shrink: 0;
  padding: 10px 14px;
  border: 0;
  border-radius: 4px;
  background: #1f6feb;
  color: #fff;
  font: inherit;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
}
.arp__x {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  padding: 6px;
  border: 0;
  background: transparent;
  color: #fff;
  opacity: 0.7;
  cursor: pointer;
  svg { width: 100%; height: 100%; }
}
.arp-enter-active,
.arp-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.arp-enter-from,
.arp-leave-to { opacity: 0; transform: translateY(12px); }
@media (prefers-reduced-motion: reduce) {
  .arp-enter-active,
  .arp-leave-active { transition: none; }
}
</style>
