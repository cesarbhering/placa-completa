<script setup lang="ts">
import { GENERICAS } from '~/shared/enriquecimento-regional'
import { vehicleTypes } from '~/data/vehicle-types'

const route = useRoute()
const slug = route.params.tipo as string
const data = vehicleTypes[slug]
// So a van tem bloco proprio por enquanto: e a que estava sem indexar. As
// outras seguem como estao, em vez de ganharem um texto igual entre si.
const blocoPagina = computed(() => GENERICAS[`/consultar-placa-de-${slug}`])

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
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">{{ data.title }}</h1>

      <div class="pc-prose">
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

        <template v-if="blocoPagina">
          <h2>{{ blocoPagina.titulo }}</h2>
          <p>{{ blocoPagina.texto }}</p>
          <div v-for="q in blocoPagina.faq" :key="q.pergunta" class="pc-faq__item">
            <h3>{{ q.pergunta }}</h3>
            <p>{{ q.resposta }}</p>
          </div>
        </template>

        <h2>Para quem é essa consulta?</h2>
        <p>{{ data.audience }}</p>

        <h2>Marcas mais consultadas</h2>
        <ul>
          <li v-for="brand in data.brands" :key="brand">{{ brand }}</li>
        </ul>

        <div class="pc-cta">
          <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick">
            Consultar {{ data.name }} Agora
          </NuxtLink>
        </div>

        <h2>Perguntas frequentes</h2>
        <div v-for="faq in data.faqs" :key="faq.question" class="pc-faq__item">
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
