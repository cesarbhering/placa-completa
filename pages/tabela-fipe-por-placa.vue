<script setup lang="ts">
function onCtaClick() {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: 'tabela-fipe-por-placa' })
  }
}

useHead({
  title: 'Tabela FIPE pela Placa — Descubra o Valor do Seu Veículo Grátis',
  meta: [
    { name: 'description', content: 'Descubra o valor na Tabela FIPE de qualquer veículo usando apenas a placa. Resultado com marca, modelo, ano e preço FIPE atualizado. Grátis e em segundos.' },
    { name: 'keywords', content: 'tabela FIPE por placa, valor FIPE pela placa, consultar FIPE grátis, preço veículo por placa, fipe pela placa, tabela fipe pela placa' },
    { property: 'og:title', content: 'Tabela FIPE pela Placa — Valor do Veículo Grátis' },
    { property: 'og:description', content: 'Descubra o valor FIPE de qualquer veículo pela placa. Resultado com marca, modelo, ano e preço FIPE. Grátis.' },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'Como consultar a Tabela FIPE pela placa do veículo',
        description: 'Descubra o valor FIPE de qualquer veículo usando apenas a placa. Grátis e em segundos.',
        step: [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Acesse o PlacaCompleta',
            text: 'Acesse placacompleta.com.br na página inicial.',
          },
          {
            '@type': 'HowToStep',
            position: 2,
            name: 'Digite a placa',
            text: 'Informe a placa do veículo no formato ABC1D23 (Mercosul) ou ABC1234 (antigo).',
          },
          {
            '@type': 'HowToStep',
            position: 3,
            name: 'Informe seu e-mail',
            text: 'Digite seu e-mail para receber os dados completos do veículo.',
          },
          {
            '@type': 'HowToStep',
            position: 4,
            name: 'Receba o resultado',
            text: 'Em segundos você recebe marca, modelo, ano, cor, situação e valor FIPE atualizado.',
          },
        ],
      }),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Como saber o valor FIPE pela placa do carro?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Acesse placacompleta.com.br, informe a placa do veículo e seu e-mail. Em segundos você recebe o valor FIPE atualizado junto com todos os dados do veículo.',
            },
          },
          {
            '@type': 'Question',
            name: 'É possível consultar a tabela FIPE gratuitamente pela placa?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Sim. O PlacaCompleta oferece consulta gratuita do valor FIPE pela placa. Basta digitar a placa e um e-mail válido para receber o resultado.',
            },
          },
          {
            '@type': 'Question',
            name: 'O que é a Tabela FIPE?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'A Tabela FIPE (Fundação Instituto de Pesquisas Econômicas) é a referência de preços de veículos mais usada no Brasil. Atualizada mensalmente, indica o preço médio de mercado de carros, motos e caminhões.',
            },
          },
          {
            '@type': 'Question',
            name: 'Para que serve a consulta FIPE por placa?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'A consulta FIPE pela placa é útil para compra e venda de veículos usados (para saber se o preço é justo), financiamentos, seguros e avaliação de estoque por lojistas.',
            },
          },
        ],
      }),
    },
  ],
})
</script>

<template>
  <div class="desktop pseo-page">
    <main>
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
