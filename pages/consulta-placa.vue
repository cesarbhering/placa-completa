<script setup lang="ts">
function onCtaClick() {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: 'consulta-placa' })
  }
}

useHead({
  title: 'Consulta de Placa Veicular Grátis Online',
  meta: [
    { name: 'description', content: 'Faça a consulta de placa veicular grátis e receba por e-mail marca, modelo, ano, cor, tabela FIPE, município e situação do veículo. Sem cadastro.' },
    { name: 'keywords', content: 'consulta de placa, consulta placa veicular, consultar placa online, consulta veicular grátis, pesquisar placa de carro' },
    { property: 'og:title', content: 'Consulta de Placa Veicular Grátis Online' },
    { property: 'og:description', content: 'Consulte qualquer placa veicular e receba os dados completos no seu e-mail. Grátis e instantâneo.' },
  ],
})
</script>

<template>
  <div class="desktop">
    <main>
      <div class="win-window">
      <div class="win-window__titlebar">
        <span>Consulta de Placa</span>
        <div class="win-window__titlebar-buttons">
          <span class="win-window__titlebar-btn">_</span>
          <span class="win-window__titlebar-btn">□</span>
          <span class="win-window__titlebar-btn">×</span>
        </div>
      </div>
      <div class="win-window__body">
        <h1 class="seo-title">Consulta de Placa Veicular Grátis</h1>

        <div class="seo-content">
          <p>
            Com o <strong>Placa Completa</strong>, você faz a consulta de placa veicular de forma
            rápida, segura e totalmente grátis. Basta informar a placa do veículo e seu e-mail
            para receber todas as informações disponíveis.
          </p>

          <h2>Que dados eu recebo na consulta?</h2>
          <ul>
            <li><strong>Marca e modelo</strong> do veículo</li>
            <li><strong>Ano de fabricação</strong> e ano modelo</li>
            <li><strong>Cor</strong> do veículo</li>
            <li><strong>Valor na tabela FIPE</strong></li>
            <li><strong>Município</strong> e estado de registro</li>
            <li><strong>Situação</strong> (restrições, débitos)</li>
            <li><strong>Chassi</strong> (parcial)</li>
            <li><strong>Combustível</strong>, tipo e espécie</li>
          </ul>

          <h2>Como consultar?</h2>
          <ol>
            <li>Acesse a <NuxtLink to="/">página principal</NuxtLink></li>
            <li>Digite seu e-mail</li>
            <li>Informe a placa do veículo</li>
            <li>Clique em "Consultar Placa"</li>
            <li>Pronto! Os dados chegam no seu e-mail em segundos.</li>
          </ol>
        </div>

        <div class="text-center mt-md">
          <NuxtLink to="/" class="win-btn win-btn--primary" @click="onCtaClick">
            Consultar Agora
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

  ul, ol {
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
