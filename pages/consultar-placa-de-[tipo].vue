<script setup lang="ts">
import { vehicleTypes } from '~/data/vehicle-types'

const route = useRoute()
const slug = route.params.tipo as string
const data = vehicleTypes[slug]

if (!data) {
  throw createError({ statusCode: 404, message: 'Tipo de veículo não encontrado' })
}

function onCtaClick() {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: `consultar-placa-de-${slug}` })
  }
}

useHead({
  title: data.metaTitle,
  meta: [
    { name: 'description', content: data.metaDescription },
    { name: 'keywords', content: `consultar placa de ${data.name.toLowerCase()}, consulta placa ${data.name.toLowerCase()}, placa de ${data.name.toLowerCase()} grátis` },
    { property: 'og:title', content: data.title },
    { property: 'og:description', content: data.metaDescription },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: data.faqs.map(faq => ({
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
  <div class="desktop">
    <div class="win-window">
      <div class="win-window__titlebar">
        <span>{{ data.titlebar }}</span>
        <div class="win-window__titlebar-buttons">
          <span class="win-window__titlebar-btn">_</span>
          <span class="win-window__titlebar-btn">&square;</span>
          <span class="win-window__titlebar-btn">&times;</span>
        </div>
      </div>
      <div class="win-window__body">
        <h1 class="seo-title">{{ data.title }}</h1>

        <div class="seo-content">
          <p>{{ data.intro }}</p>

          <h2>Dados que você recebe na consulta de {{ data.name.toLowerCase() }}</h2>
          <ul>
            <li v-for="field in data.dataFields" :key="field">{{ field }}</li>
          </ul>

          <h2>Como consultar a placa de um {{ data.name.toLowerCase() }}?</h2>
          <ol>
            <li>Acesse a <NuxtLink to="/">página principal do PlacaCompleta</NuxtLink></li>
            <li>Digite a placa do {{ data.name.toLowerCase() }} (formato ABC1D23 ou ABC1234)</li>
            <li>Informe seu e-mail</li>
            <li>Clique em "Receber Dados no E-mail"</li>
            <li>Pronto! Em segundos os dados chegam no seu e-mail.</li>
          </ol>

          <h2>Para quem é essa consulta?</h2>
          <p>{{ data.audience }}</p>

          <h2>Marcas mais consultadas</h2>
          <ul>
            <li v-for="brand in data.brands" :key="brand">{{ brand }}</li>
          </ul>

          <div class="text-center mt-md mb-md">
            <NuxtLink to="/" class="win-btn win-btn--primary" @click="onCtaClick">
              Consultar {{ data.name }} Agora
            </NuxtLink>
          </div>

          <h2>Perguntas frequentes</h2>
          <div v-for="faq in data.faqs" :key="faq.question" class="faq-item">
            <h3>{{ faq.question }}</h3>
            <p>{{ faq.answer }}</p>
          </div>
        </div>

        <div class="text-center mt-md">
          <NuxtLink to="/" class="win-btn win-btn--primary" @click="onCtaClick">
            Consultar Placa Grátis
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

  h3 {
    font-family: $font-display;
    font-size: 1.0625rem;
    color: $smart-blue;
    margin-bottom: $space-xs;
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

.faq-item {
  @include win-border-sunken;
  background: $win-white;
  padding: $space-sm $space-md;
  margin-bottom: $space-sm;
}
</style>
