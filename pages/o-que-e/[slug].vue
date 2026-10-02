<script setup lang="ts">
// Artigos "O que e" (RENAVAM, gravame, RENAJUD, multas RENAINF). Conteudo e
// regras de copy em shared/artigos-o-que-e.ts.
import { ARTIGOS, artigoPorSlug, LEVANTAMENTO } from '~/shared/artigos-o-que-e'

const route = useRoute()
const artigo = artigoPorSlug(String(route.params.slug || ''))
if (!artigo) throw createError({ statusCode: 404, statusMessage: 'Artigo não encontrado', fatal: true })

const BASE = 'https://placacompleta.com.br'
const CANONICO = `${BASE}/o-que-e/${artigo.slug}`
const relacionados = artigo.relacionados.map((s) => ARTIGOS.find((a) => a.slug === s)!).filter(Boolean)
// Leilao de recuperacao de credito (gravame) e leilao judicial (RENAJUD) sao
// os casos em que o guia de carro de leilao ajuda.
const linkLeilao = artigo.slug === 'gravame' || artigo.slug === 'renajud'

function onCtaClick(origem: string) {
  if (import.meta.client && (window as any).gtag) {
    (window as any).gtag('event', 'cta_click', { source_page: `o-que-e/${artigo!.slug}`, origem })
  }
}

useHead({
  title: artigo.title,
  meta: [
    { name: 'description', content: artigo.description },
    { property: 'og:title', content: artigo.h1 },
    { property: 'og:description', content: artigo.description },
    { property: 'og:type', content: 'article' },
  ],
  link: [{ rel: 'canonical', href: CANONICO }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: artigo.h1,
        description: artigo.description,
        datePublished: artigo.datePublished,
        dateModified: artigo.datePublished,
        inLanguage: 'pt-BR',
        mainEntityOfPage: CANONICO,
        author: { '@type': 'Organization', name: 'PlacaCompleta', url: BASE },
        publisher: { '@type': 'Organization', name: 'PlacaCompleta', url: BASE, logo: { '@type': 'ImageObject', url: `${BASE}/logo-horizontal-600.png` } },
      }),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: artigo.faq.map((q) => ({ '@type': 'Question', name: q.pergunta, acceptedAnswer: { '@type': 'Answer', text: q.resposta } })),
      }),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'O que é', item: `${BASE}/o-que-e` },
          { '@type': 'ListItem', position: 3, name: artigo.termo, item: CANONICO },
        ],
      }),
    },
  ],
})
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">{{ artigo!.h1 }}</h1>

      <div class="pc-prose">
        <p class="pc-lead">{{ artigo!.lead }}</p>

        <div class="pc-callout">
          <p><strong>{{ artigo!.dado.titulo }}.</strong> {{ artigo!.dado.texto }}</p>
        </div>

        <template v-for="b in artigo!.blocos" :key="b.h2">
          <h2>{{ b.h2 }}</h2>
          <p v-for="(p, i) in b.paragrafos || []" :key="i">{{ p }}</p>
          <ul v-if="b.lista">
            <li v-for="(li, i) in b.lista" :key="i">{{ li }}</li>
          </ul>
        </template>

        <p v-if="linkLeilao">
          Veículos retomados por financiamento ou envolvidos em processo judicial também podem acabar em leilão.
          Veja o guia <NuxtLink to="/carro-de-leilao">carro de leilão: como descobrir antes de comprar</NuxtLink>.
        </p>

        <div class="pc-cta">
          <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick('meio')">
            Consultar placa agora
          </NuxtLink>
        </div>

        <h2>Perguntas frequentes</h2>
        <div v-for="q in artigo!.faq" :key="q.pergunta" class="pc-faq__item">
          <h3>{{ q.pergunta }}</h3>
          <p>{{ q.resposta }}</p>
        </div>

        <h2>Veja também</h2>
        <ul>
          <li v-for="r in relacionados" :key="r.slug">
            <NuxtLink :to="`/o-que-e/${r.slug}`">{{ r.h1 }}</NuxtLink>
          </li>
          <li><NuxtLink to="/carro-de-leilao">Carro de leilão: como descobrir antes de comprar</NuxtLink></li>
          <li><NuxtLink to="/como-consultar-placa">Como consultar uma placa</NuxtLink></li>
        </ul>

        <p class="pc-fonte">
          Fonte dos números: {{ LEVANTAMENTO.rotulo }}, um registro por veículo, só dados agregados.
          Os dados do registro nacional vêm da consulta oficial à SENATRAN e aos DETRANs.
        </p>

        <nav class="pc-breadcrumb">
          <NuxtLink to="/">Início</NuxtLink>
          <span> &rsaquo; </span>
          <NuxtLink to="/o-que-e">O que é</NuxtLink>
          <span> &rsaquo; </span>
          <strong>{{ artigo!.termo }}</strong>
        </nav>
      </div>
    </main>
  </div>
</template>

<style scoped>
.pc-fonte {
  font-size: 0.8125rem;
  color: var(--pc-graphite);
}
</style>
