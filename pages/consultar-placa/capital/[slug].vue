<script setup lang="ts">
import { capitals } from '~/data/capitals'
import { states } from '~/data/states'

const route = useRoute()
const slug = route.params.slug as string
const capital = capitals[slug]

if (!capital) {
  throw createError({ statusCode: 404, message: 'Capital não encontrada' })
}

const state = states[capital.stateSlug]

const currentYear = new Date().getFullYear()

function onCtaClick() {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: `consultar-placa-capital-${slug}` })
  }
}

useHead({
  title: `Consultar Placa ${capital.name} (${state.uf}) Grátis: Marca, Modelo, Ano e FIPE`,
  meta: [
    { name: 'description', content: `Consulte qualquer placa de veículo em ${capital.name} - ${state.uf}. Veja marca, modelo, ano, cor, situação e valor FIPE. Resultado grátis em segundos.` },
    { name: 'keywords', content: `consultar placa ${capital.name.toLowerCase()}, consulta placa ${capital.name.toLowerCase()}, consultar veículo ${capital.name.toLowerCase()}, placa ${state.uf} grátis` },
    { property: 'og:title', content: `Consultar Placa em ${capital.name}: Dados do Veículo Grátis` },
    { property: 'og:description', content: `Consulte qualquer placa de veículo em ${capital.name} (${state.uf}) e veja marca, modelo, ano, situação e valor FIPE. Grátis e rápido.` },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Consultar Placa', item: 'https://placacompleta.com.br' },
          { '@type': 'ListItem', position: 2, name: `${state.name} (${state.uf})`, item: `https://placacompleta.com.br/consultar-placa/${state.slug}` },
          { '@type': 'ListItem', position: 3, name: capital.name },
        ],
      }),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: capital.faqs.map(faq => ({
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
      <h1 class="pc-h1">Consultar Placa de Veículo em {{ capital.name }} - {{ state.uf }}</h1>

      <div class="pc-prose">
        <p>
            Consulte gratuitamente a placa de qualquer veículo registrado em
            <strong>{{ capital.name }}</strong>, capital de
            <NuxtLink :to="`/consultar-placa/${state.slug}`">{{ state.name }} ({{ state.uf }})</NuxtLink>.
            {{ capital.context }}
          </p>

          <div class="pc-cta">
            <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick">
              Consultar Placa em {{ capital.name }} Agora
            </NuxtLink>
          </div>

          <h2>Como consultar uma placa em {{ capital.name }}?</h2>
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
            <li>Município de registro</li>
            <li>Situação do veículo (em circulação, baixado)</li>
            <li>Chassi (parcial), combustível e tipo</li>
          </ul>
          <p>
            Precisa de mais? O <NuxtLink to="/">relatório completo</NuxtLink> traz débitos,
            indicadores de roubo/furto e registro de leilão, e o histórico completo do veículo.
          </p>

          <h2>Principais regiões de {{ capital.name }}</h2>
          <p>
            A frota de {{ capital.name }} se distribui por bairros como
            {{ capital.neighborhoods }}. Independente da região de registro,
            qualquer placa de {{ state.uf }} pode ser consultada pelo PlacaCompleta.
          </p>

          <h2>DETRAN-{{ state.uf }} em {{ capital.name }}</h2>
          <p>
            O DETRAN de {{ state.name }} tem sede em {{ state.capital }}.
            Para serviços online, como transferência, licenciamento e consulta de multas,
            acesse:
            <a :href="state.detranSite" target="_blank" rel="noopener noreferrer">{{ state.detranSite }}</a>.
          </p>

          <h2>IPVA {{ capital.name }} {{ currentYear }}</h2>
          <p>{{ state.ipvaInfo }}</p>

          <h2>Tabela FIPE pela placa em {{ capital.name }}</h2>
          <p>
            Além dos dados básicos, a consulta retorna o valor atualizado na
            <NuxtLink to="/tabela-fipe-por-placa">tabela FIPE pela placa</NuxtLink>,
            útil para compra, venda, financiamento ou seguro de veículos em {{ capital.name }}.
            Para conferir também multas, indicadores de roubo/furto e registro de leilão, e o histórico
            completo do veículo, veja o
            <NuxtLink to="/">relatório completo</NuxtLink>.
          </p>

          <h2>Perguntas frequentes sobre placas em {{ capital.name }}</h2>
          <div v-for="faq in capital.faqs" :key="faq.question" class="pc-faq__item">
            <h3>{{ faq.question }}</h3>
            <p>{{ faq.answer }}</p>
          </div>

          <nav class="pc-breadcrumb">
            <NuxtLink to="/">Início</NuxtLink>
            <span> &rsaquo; </span>
            <NuxtLink :to="`/consultar-placa/${state.slug}`">{{ state.name }}</NuxtLink>
            <span> &rsaquo; </span>
            <strong>{{ capital.name }}</strong>
          </nav>
        </div>

      <div class="pc-cta">
        <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick">
          Consultar Placa Grátis
        </NuxtLink>
      </div>
    </main>
  </div>
</template>

