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
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">Consulta de Placa Veicular Grátis</h1>

      <div class="pc-prose">
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

      <div class="pc-cta">
        <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick">
          Consultar Agora
        </NuxtLink>
      </div>
    </main>
  </div>
</template>
