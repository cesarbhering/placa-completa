<script setup lang="ts">
function onCtaClick() {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: 'consulta-gratis' })
  }
}

const faqs = [
  {
    question: 'A consulta de placa é realmente grátis?',
    answer: 'Sim! O Placa Completa oferece consulta veicular totalmente gratuita. Você não precisa pagar nada para consultar qualquer placa de veículo e receber os dados no seu e-mail.',
  },
  {
    question: 'Preciso criar conta para consultar?',
    answer: 'Não. Basta informar seu e-mail e a placa do veículo. Não é necessário criar conta, cadastro ou login. O resultado é enviado direto para o e-mail informado.',
  },
  {
    question: 'Quantas consultas posso fazer de graça?',
    answer: 'Você pode realizar quantas consultas quiser, sem limite. Cada consulta retorna os dados básicos do veículo gratuitamente.',
  },
  {
    question: 'Quais dados recebo na consulta grátis?',
    answer: 'Você recebe marca, modelo, ano de fabricação, ano modelo, cor, valor na tabela FIPE, município de registro, situação do veículo, chassi parcial, tipo de combustível e espécie.',
  },
  {
    question: 'É seguro consultar minha placa?',
    answer: 'Sim. O Placa Completa utiliza conexão segura (HTTPS) e não armazena dados sensíveis. Seu e-mail é usado apenas para enviar o resultado da consulta.',
  },
]

useHead({
  title: 'Consultar Placa Grátis: Dados do Veículo',
  meta: [
    { name: 'description', content: 'Consulte qualquer placa de veículo grátis e receba os dados por e-mail: marca, modelo, ano, FIPE, situação e mais. Sem cadastro, resultado em segundos.' },
    { name: 'keywords', content: 'consultar placa grátis, consulta placa grátis, consulta veicular grátis, pesquisa placa grátis, consultar placa de carro grátis' },
    { property: 'og:title', content: 'Consultar Placa: os dados do veículo na hora' },
    { property: 'og:description', content: 'Digite a placa e veja marca, modelo, ano, cor, situação e valor FIPE na própria tela, sem cadastro.' },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      }),
    },
  ],
})
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">Consultar Placa Grátis</h1>

      <div class="pc-prose">
        <p>
            No <strong>Placa Completa</strong> você consulta qualquer placa de veículo de forma
            totalmente grátis, sem cadastro e com resultado em segundos. Basta informar a placa
            e seu e-mail para receber todos os dados disponíveis do veículo.
          </p>

          <h2>Por que é grátis?</h2>
          <p>
            Acreditamos que informações básicas sobre veículos devem ser acessíveis a todos.
            O Placa Completa é mantido para ajudar compradores, vendedores e qualquer pessoa
            que precise verificar dados de um veículo, sem barreiras e sem custos escondidos.
          </p>

          <h2>O que está incluído na consulta grátis?</h2>
          <ul>
            <li><strong>Marca e modelo</strong> do veículo</li>
            <li><strong>Ano de fabricação</strong> e ano modelo</li>
            <li><strong>Cor</strong> do veículo</li>
            <li><strong>Valor na tabela FIPE</strong> atualizado</li>
            <li><strong>Município</strong> e estado de registro</li>
            <li><strong>Situação</strong> do veículo (em circulação, baixado)</li>
            <li><strong>Chassi</strong> (parcial)</li>
            <li><strong>Combustível</strong>, tipo e espécie</li>
          </ul>
          <p>
            Quer débitos, indicadores de roubo/furto e registro de leilão, e o histórico completo do
            veículo? Isso está no <NuxtLink to="/">relatório completo</NuxtLink>.
          </p>

          <h2>Como consultar?</h2>
          <ol>
            <li>Acesse a <NuxtLink to="/">página principal</NuxtLink></li>
            <li>Digite seu e-mail</li>
            <li>Informe a placa do veículo (antiga ou Mercosul)</li>
            <li>Clique em "Consultar Placa"</li>
            <li>Pronto! Os dados chegam no seu e-mail em segundos.</li>
          </ol>

        <h2>Perguntas Frequentes</h2>
        <div v-for="faq in faqs" :key="faq.question" class="pc-faq__item">
          <h3>{{ faq.question }}</h3>
          <p>{{ faq.answer }}</p>
        </div>
      </div>

      <div class="pc-cta">
        <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick">
          Consultar Placa Grátis
        </NuxtLink>
      </div>
    </main>
  </div>
</template>
