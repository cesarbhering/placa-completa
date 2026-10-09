<script setup lang="ts">
import { escolherTitulo } from '~/shared/seo-titulo'
// Indice dos artigos "O que e". Conteudo em shared/artigos-o-que-e.ts.
import { ARTIGOS } from '~/shared/artigos-o-que-e'

const BASE = 'https://placacompleta.com.br'
const CANONICO = `${BASE}/o-que-e`

useHead({
  title: escolherTitulo(['O que é RENAVAM, Gravame, RENAJUD e RENAINF']),
  titleTemplate: '%s',
  meta: [
    { name: 'description', content: 'Guias diretos sobre os termos do documento e do histórico de um veículo: RENAVAM, gravame, RENAJUD e multas RENAINF, com números reais de consultas.' },
    { property: 'og:title', content: 'O que é: termos do histórico do veículo' },
  ],
  link: [{ rel: 'canonical', href: CANONICO }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'O que é', item: CANONICO },
        ],
      }),
    },
  ],
})
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">O que é: os termos do histórico de um veículo</h1>
      <div class="pc-prose">
        <p class="pc-lead">
          RENAVAM, gravame, RENAJUD e RENAINF aparecem em todo documento e em toda consulta de veículo,
          mas quase ninguém explica o que cada um significa na hora de comprar um usado. Cada guia
          responde direto, mostra como funciona e traz números reais das consultas feitas na PlacaCompleta.
        </p>
        <div v-for="a in ARTIGOS" :key="a.slug" class="pc-faq__item">
          <h2><NuxtLink :to="`/o-que-e/${a.slug}`">{{ a.h1 }}</NuxtLink></h2>
          <p>{{ a.lead }}</p>
        </div>
        <div class="pc-cta">
          <NuxtLink to="/" class="pc-btn pc-btn--primary">Consultar placa agora</NuxtLink>
        </div>
        <nav class="pc-breadcrumb">
          <NuxtLink to="/">Início</NuxtLink>
          <span> &rsaquo; </span>
          <strong>O que é</strong>
        </nav>
      </div>
    </main>
  </div>
</template>
