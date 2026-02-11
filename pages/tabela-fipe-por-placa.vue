<script setup lang="ts">
function onCtaClick() {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: 'tabela-fipe-por-placa' })
  }
}

useHead({
  title: 'Consultar Tabela FIPE por Placa Grátis - Valor do Veículo | Placa Completa',
  meta: [
    { name: 'description', content: 'Descubra o valor do veículo na tabela FIPE pela placa. Consulta grátis com valor FIPE atualizado enviado direto no seu e-mail. Ideal para compra e venda.' },
    { name: 'keywords', content: 'tabela FIPE por placa, valor FIPE pela placa, consultar FIPE grátis, preço veículo por placa, valor carro pela placa' },
    { property: 'og:title', content: 'Consultar Tabela FIPE por Placa Grátis' },
    { property: 'og:description', content: 'Descubra o valor na tabela FIPE de qualquer veículo pela placa. Grátis e instantâneo.' },
  ],
})
</script>

<template>
  <div class="desktop">
    <div class="win-window">
      <div class="win-window__titlebar">
        <span>Tabela FIPE por Placa</span>
        <div class="win-window__titlebar-buttons">
          <span class="win-window__titlebar-btn">_</span>
          <span class="win-window__titlebar-btn">□</span>
          <span class="win-window__titlebar-btn">×</span>
        </div>
      </div>
      <div class="win-window__body">
        <h1 class="seo-title">Consultar Tabela FIPE por Placa</h1>

        <div class="seo-content">
          <p>
            Quer saber quanto vale um veículo? Com o <strong>Placa Completa</strong>, você consulta
            o valor na <strong>tabela FIPE</strong> usando apenas a placa do veículo. O resultado
            é enviado direto no seu e-mail, junto com todos os outros dados do veículo.
          </p>

          <h2>O que é a tabela FIPE?</h2>
          <p>
            A <strong>tabela FIPE</strong> (Fundação Instituto de Pesquisas Econômicas) é a
            referência de preços de veículos mais usada no Brasil. Ela indica o preço médio de
            mercado de carros, motos e caminhões, e é atualizada mensalmente.
          </p>

          <h2>Dados incluídos na consulta FIPE</h2>
          <ul>
            <li><strong>Valor FIPE atualizado</strong> do veículo</li>
            <li><strong>Código FIPE</strong> do modelo</li>
            <li><strong>Mês de referência</strong> da avaliação</li>
            <li><strong>Modelo completo</strong> conforme FIPE</li>
          </ul>

          <h2>Para que serve a consulta FIPE por placa?</h2>
          <ul>
            <li><strong>Compra de veículo</strong> — saiba se o preço pedido está justo</li>
            <li><strong>Venda de veículo</strong> — defina um preço competitivo</li>
            <li><strong>Financiamento</strong> — bancos usam a FIPE como referência</li>
            <li><strong>Seguro</strong> — o valor FIPE influencia o prêmio do seguro</li>
            <li><strong>Lojistas</strong> — consultas rápidas para avaliação de estoque</li>
          </ul>
        </div>

        <div class="text-center mt-md">
          <NuxtLink to="/" class="win-btn win-btn--primary" @click="onCtaClick">
            Consultar FIPE Agora
          </NuxtLink>
        </div>

      </div>
    </div>
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

  ul {
    padding-left: $space-lg;
    margin-bottom: $space-md;
  }

  li { margin-bottom: $space-xs; }

  a {
    color: $smart-blue;
    text-decoration: underline;
  }
}
</style>
