<script setup lang="ts">
import { states } from '~/data/states'

const route = useRoute()
const slug = route.params.estado as string
const data = states[slug]

if (!data) {
  throw createError({ statusCode: 404, message: 'Estado não encontrado' })
}

function onCtaClick() {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: `consultar-placa-${data.uf.toLowerCase()}` })
  }
}

useHead({
  title: `Consultar Placa ${data.uf} Grátis — Marca, Modelo, Ano e FIPE`,
  meta: [
    { name: 'description', content: `Consulte qualquer placa registrada em ${data.name} (${data.uf}). Veja marca, modelo, ano, cor, situação e valor FIPE do veículo. Resultado grátis em segundos.` },
    { name: 'keywords', content: `consultar placa ${data.uf}, consulta placa ${data.name.toLowerCase()}, consultar veículo ${data.name.toLowerCase()}, placa ${data.uf} grátis` },
    { property: 'og:title', content: `Consultar Placa ${data.uf} Grátis — Dados do Veículo` },
    { property: 'og:description', content: `Consulte qualquer placa registrada em ${data.name} e veja marca, modelo, ano, situação e valor FIPE. Grátis e rápido.` },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Consultar Placa', item: 'https://placacompleta.com.br' },
          { '@type': 'ListItem', position: 2, name: `${data.name} (${data.uf})` },
        ],
      }),
    },
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
  <div class="desktop pseo-page">
    <main>
      <div class="win-window">
      <div class="win-window__titlebar">
        <span>Consulta Placa {{ data.uf }}</span>
        <div class="win-window__titlebar-buttons">
          <span class="win-window__titlebar-btn">_</span>
          <span class="win-window__titlebar-btn">&square;</span>
          <span class="win-window__titlebar-btn">&times;</span>
        </div>
      </div>
      <div class="win-window__body">
        <h1 class="seo-title">Consultar Placa de Veículo em {{ data.name }}</h1>

        <div class="seo-content">
          <p>
            Consulte gratuitamente a placa de qualquer veículo registrado em
            <strong>{{ data.name }} ({{ data.uf }})</strong> e receba os dados completos no
            seu e-mail em segundos. {{ data.context }}
          </p>

          <div class="text-center mt-md mb-md">
            <NuxtLink to="/" class="win-btn win-btn--primary" @click="onCtaClick">
              Consultar Placa de {{ data.uf }} Agora
            </NuxtLink>
          </div>

          <h2>Como consultar uma placa de {{ data.name }}?</h2>
          <ol>
            <li>Acesse a <NuxtLink to="/">página principal do PlacaCompleta</NuxtLink></li>
            <li>Digite a placa do veículo (formato ABC1D23 ou ABC1234)</li>
            <li>Informe seu e-mail</li>
            <li>Clique em "Receber Dados no E-mail"</li>
            <li>Em segundos você recebe marca, modelo, ano, FIPE, situação e mais.</li>
          </ol>

          <h2>Dados retornados na consulta</h2>
          <ul>
            <li>Marca e modelo completo</li>
            <li>Ano de fabricação e ano modelo</li>
            <li>Cor do veículo</li>
            <li>Valor atualizado na tabela FIPE</li>
            <li>Município de registro em {{ data.uf }}</li>
            <li>Situação (restrições, débitos)</li>
            <li>Chassi (parcial), combustível e tipo</li>
          </ul>

          <h2>Placas de {{ data.name }}</h2>
          <p>
            {{ data.plateRanges }}. Com a adoção da placa Mercosul, a identificação do estado
            passou a ser feita pelo município de registro do veículo, e não mais pelas letras iniciais.
          </p>

          <h2>IPVA {{ data.name }} {{ new Date().getFullYear() }}</h2>
          <p>{{ data.ipvaInfo }}</p>

          <h2>DETRAN-{{ data.uf }}</h2>
          <p>
            O DETRAN de {{ data.name }} fica na capital, {{ data.capital }}.
            Para serviços online como transferência, licenciamento e consulta de multas,
            acesse o site oficial:
            <a :href="data.detranSite" target="_blank" rel="noopener noreferrer">{{ data.detranSite }}</a>.
          </p>

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
