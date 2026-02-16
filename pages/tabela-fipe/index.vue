<script setup lang="ts">
import { fipeBrands } from '~/data/fipe-brands'

function onCtaClick() {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: 'tabela-fipe-index' })
  }
}

const carBrands = Object.values(fipeBrands).filter(b => b.type === 'carros')
const motoBrands = Object.values(fipeBrands).filter(b => b.type === 'motos')

const faqs = [
  {
    question: 'Como descobrir o valor FIPE de um veículo pela placa?',
    answer: 'Basta acessar o Placa Completa, informar a placa do veículo e seu e-mail. Em segundos você recebe o valor atualizado na tabela FIPE, junto com marca, modelo, ano e outros dados.',
  },
  {
    question: 'A consulta veicular por placa é grátis?',
    answer: 'Sim! A consulta é totalmente grátis e sem limite de buscas. Não é necessário criar conta ou fazer cadastro.',
  },
  {
    question: 'O valor FIPE é atualizado?',
    answer: 'Sim. Os valores exibidos são baseados na tabela FIPE vigente, que é atualizada mensalmente pela Fundação Instituto de Pesquisas Econômicas.',
  },
  {
    question: 'Posso consultar a placa de qualquer veículo?',
    answer: 'Sim. Você pode consultar placas de carros, motos, caminhões, ônibus e vans registrados no Brasil, tanto no formato antigo (ABC1234) quanto no Mercosul (ABC1D23).',
  },
  {
    question: 'Qual a diferença entre valor FIPE e valor de mercado?',
    answer: 'O valor FIPE é uma referência média de preços praticados no mercado brasileiro, calculada pela Fundação Instituto de Pesquisas Econômicas. O valor de mercado pode variar conforme estado de conservação, quilometragem, região e demanda.',
  },
]

useHead({
  title: 'Tabela FIPE — Consulta Veicular por Placa Grátis',
  meta: [
    { name: 'description', content: 'Consulte o valor na Tabela FIPE de carros, motos e caminhões pela placa. Consulta veicular grátis com preços atualizados de todas as marcas e modelos.' },
    { name: 'keywords', content: 'tabela fipe, valor fipe, preço fipe, tabela fipe carros, tabela fipe motos, consulta fipe grátis, consulta veicular placa, consulta veicular grátis, valor veículo por placa' },
    { property: 'og:title', content: 'Tabela FIPE — Consulta Veicular por Placa Grátis' },
    { property: 'og:description', content: 'Consulte valores FIPE atualizados de carros e motos pela placa. Grátis e instantâneo.' },
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
  <div class="desktop pseo-page">
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

          <h2>O que é a Tabela FIPE?</h2>
          <p>
            A <strong>Tabela FIPE</strong> (Fundação Instituto de Pesquisas Econômicas) é a referência
            mais utilizada no Brasil para determinar o valor médio de veículos. Atualizada mensalmente,
            ela serve como base para negociações de compra e venda, cálculo de seguros, financiamentos
            e até para definir o valor do IPVA. Os preços refletem a média praticada no mercado
            nacional para cada marca, modelo e ano de fabricação.
          </p>

          <h2>Como consultar o valor FIPE pela placa?</h2>
          <ol>
            <li>Acesse a <NuxtLink to="/">página principal do Placa Completa</NuxtLink></li>
            <li>Digite seu e-mail</li>
            <li>Informe a placa do veículo (formato antigo ou Mercosul)</li>
            <li>Clique em "Consultar Placa"</li>
            <li>Receba no seu e-mail o valor FIPE atualizado, junto com marca, modelo, ano e outros dados</li>
          </ol>

          <h2>Perguntas Frequentes</h2>
          <div v-for="faq in faqs" :key="faq.question" class="faq-item">
            <h3>{{ faq.question }}</h3>
            <p>{{ faq.answer }}</p>
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

  ol {
    padding-left: $space-lg;
    margin-bottom: $space-md;
  }

  li { margin-bottom: $space-xs; }

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

.faq-item {
  margin-bottom: $space-md;
  padding: $space-sm;
  @include win-border-sunken;
  background: $win-white;

  h3 {
    font-family: $font-display;
    font-size: 1rem;
    color: $navy-electric;
    margin-bottom: $space-xs;
  }

  p {
    margin-bottom: 0;
    font-size: 0.8125rem;
  }
}
</style>
