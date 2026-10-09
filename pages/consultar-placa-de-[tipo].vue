<script setup lang="ts">
import { tituloTipoVeiculo } from '~/shared/seo-meta'
import { GENERICAS } from '~/shared/enriquecimento-regional'
import { vehicleTypes } from '~/data/vehicle-types'
import { PLANOS } from '~/shared/planos'

const route = useRoute()
const slug = route.params.tipo as string
const data = vehicleTypes[slug]
// So a van tem bloco proprio por enquanto: e a que estava sem indexar. As
// outras seguem como estao, em vez de ganharem um texto igual entre si.
const blocoPagina = computed(() => GENERICAS[`/consultar-placa-de-${slug}`])

if (!data) {
  throw createError({ statusCode: 404, message: 'Tipo de veículo não encontrado' })
}
// Preco sempre de shared/planos.ts.
const precoCompleta = `R$ ${(PLANOS.completa.valorCentavos / 100).toFixed(2).replace('.', ',')}`
// "da moto", "da van", "do carro", "do caminhão", "do ônibus".
const doTipo = ['moto', 'van'].includes(slug) ? `da ${data.name.toLowerCase()}` : `do ${data.name.toLowerCase()}`

function onCtaClick() {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: `consultar-placa-de-${slug}` })
  }
}

useHead({
  title: tituloTipoVeiculo(data.metaTitle, data.name),
  titleTemplate: '%s',
  meta: [
    { name: 'description', content: data.metaDescription },
    { name: 'keywords', content: `consultar placa de ${data.name.toLowerCase()}, consulta placa ${data.name.toLowerCase()}, placa de ${data.name.toLowerCase()} leilão` },
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

        <h2>O que aparece na consulta grátis, na tela</h2>
        <ul>
          <li>Marca e modelo</li>
          <li>Ano de fabricação e ano-modelo</li>
          <li>Valor na Tabela FIPE</li>
          <li>Sinais de leilão ou recall, quando houver</li>
        </ul>

        <h2>O que o relatório completo checa</h2>
        <p>
          Pago uma vez, {{ precoCompleta }} no Pix ou no cartão, sem assinatura. Abre na
          tela e chega no seu e-mail.
        </p>
        <ul>
          <li v-for="field in data.dataFields" :key="field">{{ field }}</li>
        </ul>

        <h2>Como consultar a placa {{ doTipo }}?</h2>
        <ol>
          <li>Acesse a <NuxtLink to="/">página principal do PlacaCompleta</NuxtLink></li>
          <li>Digite a placa {{ doTipo }} (formato ABC1D23 ou ABC1234)</li>
          <li>Veja na tela marca, modelo, ano e valor FIPE, sem cadastro</li>
          <li>Se quiser checar leilão, roubo, gravame, multas e recall, peça o relatório completo</li>
          <li>Pague no Pix ou no cartão: o relatório abre na tela e uma cópia vai para o seu e-mail</li>
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
          Consultar Placa Agora
        </NuxtLink>
      </div>
    </main>
  </div>
</template>
