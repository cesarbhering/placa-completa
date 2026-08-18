<script setup lang="ts">
// Header de navegacao da home (web / nao-PWA). Estilo .toolbar do mockup v2.0:
// barra navy arredondada, logo a esquerda + nav ancora a direita.
// Os alvos das ancoras (#como-funciona, #o-que-inclui, #duvidas) vivem em
// pages/index.vue. Scroll suave herda do html{scroll-behavior:smooth} global.
const links = [
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#o-que-inclui', label: 'O que inclui' },
  { href: '#duvidas', label: 'Dúvidas' },
]
</script>

<template>
  <header class="home-header">
    <a href="#top" class="home-header__brand" aria-label="PlacaCompleta, ir para o topo">
      <PlacaCompletaLogo variant="inverted" class="home-header__logo" />
      <small class="home-header__tag">· consulta veicular</small>
    </a>
    <nav class="home-header__nav" aria-label="Navegação principal">
      <a
        v-for="link in links"
        :key="link.href"
        :href="link.href"
        class="home-header__link"
      >{{ link.label }}</a>
    </nav>
  </header>
</template>

<style lang="scss" scoped>
// Hexes do mockup hardcoded (escopo local, nao mexe nos tokens globais).
.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #002855; // navy
  color: #fff;
  border-radius: 7px;
  padding: 10px 16px;
  box-shadow: 0 10px 30px rgba(0, 40, 85, 0.14);
  margin-bottom: 4px;

  &__brand {
    display: flex;
    align-items: center;
    gap: 9px;
    text-decoration: none;
    min-width: 0;

    &:focus-visible {
      outline: 2px solid #0466c8;
      outline-offset: 3px;
      border-radius: 4px;
    }
  }

  &__logo {
    height: 24px;
    width: auto;
    // O componente base tem width:100%; aqui restringimos pra caber na barra.
    :deep(.placa-logo) {
      height: 24px;
      width: auto;
    }
  }

  &__tag {
    font-weight: 600;
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.75);
    white-space: nowrap;
  }

  &__nav {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  &__link {
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.8125rem;
    text-decoration: none;
    white-space: nowrap;
    padding: 4px 2px;
    border-radius: 4px;
    transition: color 0.15s ease;

    &:hover {
      color: #fff;
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 2px solid #0466c8;
      outline-offset: 2px;
    }
  }
}

@media (max-width: 520px) {
  .home-header {
    padding: 9px 12px;
    gap: 10px;

    &__tag {
      display: none;
    }

    &__nav {
      gap: 12px;
    }

    &__link {
      font-size: 0.75rem;
    }
  }
}
</style>
