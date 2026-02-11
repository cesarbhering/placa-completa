<script setup lang="ts">
import { fipeBrands } from '~/data/fipe-brands'

function onCtaClick() {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: 'tabela-fipe-index' })
  }
}

const carBrands = Object.values(fipeBrands).filter(b => b.type === 'carros')
const motoBrands = Object.values(fipeBrands).filter(b => b.type === 'motos')

useHead({
  title: 'Tabela FIPE - Consulte o Valor de Qualquer Veículo | PlacaCompleta',
  meta: [
    { name: 'description', content: 'Consulte o valor na Tabela FIPE de carros, motos e caminhões. Preços atualizados de todas as marcas e modelos. Grátis e sem cadastro.' },
    { name: 'keywords', content: 'tabela fipe, valor fipe, preço fipe, tabela fipe carros, tabela fipe motos, consulta fipe grátis' },
    { property: 'og:title', content: 'Tabela FIPE - Valor de Qualquer Veículo' },
    { property: 'og:description', content: 'Consulte valores FIPE atualizados de carros e motos. Grátis e instantâneo.' },
  ],
})
</script>

<template>
  <div class="desktop">
    <main>
      <div class="win-window">
      <div class="win-window__titlebar">
        <span>Tabela FIPE</span>
        <div class="win-window__titlebar-buttons">
          <span class="win-window__titlebar-btn">_</span>
          <span class="win-window__titlebar-btn">&square;</span>
          <span class="win-window__titlebar-btn">&times;</span>
        </div>
      </div>
      <div class="win-window__body">
        <h1 class="seo-title">Tabela FIPE - Valor de Veículos</h1>

        <div class="seo-content">
          <p>
            Consulte o valor na <strong>Tabela FIPE</strong> de qualquer carro ou moto.
            Selecione a marca abaixo para ver os modelos e preços atualizados. Você também pode
            <NuxtLink to="/">consultar pela placa</NuxtLink> e receber o valor FIPE exato do
            veículo no seu e-mail.
          </p>

          <h2>Carros</h2>
          <div class="brand-grid">
            <NuxtLink
              v-for="brand in carBrands"
              :key="brand.slug"
              :to="`/tabela-fipe/${brand.slug}`"
              class="brand-card"
            >
              {{ brand.name }}
            </NuxtLink>
          </div>

          <h2>Motos</h2>
          <div class="brand-grid">
            <NuxtLink
              v-for="brand in motoBrands"
              :key="brand.slug"
              :to="`/tabela-fipe/${brand.slug}`"
              class="brand-card"
            >
              {{ brand.name }}
            </NuxtLink>
          </div>

          <div class="text-center mt-md">
            <NuxtLink to="/" class="win-btn win-btn--primary" @click="onCtaClick">
              Consultar Placa Grátis
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.seo-title {
  font-family: $font-display;
  font-size: 1.75rem;
  color: $navy-electric;
  text-align: center;
  margin-bottom: $space-md;
}

.seo-content {
  font-size: 0.8125rem;
  line-height: 1.6;
  color: $graphite;

  p { margin-bottom: $space-md; }

  h2 {
    font-family: $font-display;
    font-size: 1.25rem;
    color: $navy-electric;
    margin: $space-md 0 $space-sm;
  }

  a {
    color: $smart-blue;
    text-decoration: underline;
  }
}

.brand-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $space-xs;
  margin-bottom: $space-md;
}

.brand-card {
  @include win-border-raised;
  background: $win-bg;
  padding: $space-xs $space-sm;
  text-align: center;
  font-family: $font-display;
  font-size: 0.9375rem;
  color: $graphite;
  text-decoration: none;
  cursor: pointer;

  &:active {
    border-color: $win-darker $win-white $win-white $win-darker;
  }

  &:hover {
    background: $powder-blue;
  }
}
</style>
