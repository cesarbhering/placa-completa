<script setup lang="ts">
// Indice do cluster /consultar: lista as verificacoes de shared/consultar-temas.ts.
import { escolherTitulo } from '~/shared/seo-titulo'
import { TEMAS_CONSULTAR, rotaDoTema, ROTA_CONSULTAR, INDICE_CONSULTAR as I } from '~/shared/consultar-temas'

const BASE = 'https://placacompleta.com.br'
const CANONICO = `${BASE}${ROTA_CONSULTAR}`

useHead({
  title: escolherTitulo(I.titulos),
  titleTemplate: '%s',
  meta: [
    { name: 'description', content: I.description },
    { property: 'og:title', content: I.h1 },
    { property: 'og:description', content: I.description },
    { property: 'og:url', content: CANONICO },
  ],
  link: [{ rel: 'canonical', href: CANONICO }],
  script: [
    { type: 'application/ld+json', innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Início', item: BASE }, { '@type': 'ListItem', position: 2, name: I.h1, item: CANONICO }] }) },
  ],
})
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">{{ I.h1 }}</h1>
      <div class="pc-prose">
        <p class="pc-lead">{{ I.lead }}</p>

        <ConsultarPlacaCard origem="consultar" />

        <h2>Escolha o que verificar</h2>
        <div v-for="t in TEMAS_CONSULTAR" :key="t.slug" class="pc-panel">
          <p><NuxtLink :to="rotaDoTema(t)"><strong>{{ t.termo }}</strong></NuxtLink></p>
          <p>{{ t.resumo }}</p>
        </div>

        <nav class="pc-breadcrumb">
          <NuxtLink to="/">Início</NuxtLink>
          <span> &rsaquo; </span>
          <strong>{{ I.h1 }}</strong>
        </nav>
      </div>
    </main>
  </div>
</template>
