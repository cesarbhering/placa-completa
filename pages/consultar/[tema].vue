<script setup lang="ts">
// Landing por verificacao: conteudo em shared/consultar-temas.ts.
import { escolherTitulo } from '~/shared/seo-titulo'
import { temaConsultar, TEMAS_CONSULTAR, rotaDoTema, ROTA_CONSULTAR, INDICE_CONSULTAR } from '~/shared/consultar-temas'

const route = useRoute()
const t = temaConsultar(String(route.params.tema || ''))
if (!t) throw createError({ statusCode: 404, statusMessage: 'Página não encontrada', fatal: true })

const BASE = 'https://placacompleta.com.br'
const CANONICO = `${BASE}${rotaDoTema(t)}`
const outros = TEMAS_CONSULTAR.filter((x) => x.slug !== t.slug)

useHead({
  title: escolherTitulo(t.titulos),
  titleTemplate: '%s',
  meta: [
    { name: 'description', content: t.description },
    { property: 'og:title', content: t.h1 },
    { property: 'og:description', content: t.description },
    { property: 'og:type', content: 'article' },
    { property: 'og:url', content: CANONICO },
  ],
  link: [{ rel: 'canonical', href: CANONICO }],
  script: [
    { type: 'application/ld+json', innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.faq.map((q) => ({ '@type': 'Question', name: q.pergunta, acceptedAnswer: { '@type': 'Answer', text: q.resposta } })) }) },
    { type: 'application/ld+json', innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Início', item: BASE }, { '@type': 'ListItem', position: 2, name: INDICE_CONSULTAR.h1, item: `${BASE}${ROTA_CONSULTAR}` }, { '@type': 'ListItem', position: 3, name: t.termo, item: CANONICO }] }) },
  ],
})
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">{{ t.h1 }}</h1>
      <div class="pc-prose">
        <p class="pc-lead">{{ t.lead }}</p>

        <ConsultarPlacaCard :origem="`consultar-${t.slug}`" />

        <h2>O que esta verificação mostra</h2>
        <p>{{ t.mostra.paragrafo }}</p>
        <ul><li v-for="(li, i) in t.mostra.lista" :key="i">{{ li }}</li></ul>

        <h2>Como consultar pela placa</h2>
        <div class="pc-step">
          <span class="pc-step__number">1</span>
          <p class="pc-step__text"><strong>Digite a placa</strong> no formato antigo (ABC1234) ou Mercosul (ABC1D23).</p>
        </div>
        <div class="pc-step">
          <span class="pc-step__number">2</span>
          <p class="pc-step__text"><strong>Veja a prévia na hora</strong> e siga para o relatório completo.</p>
        </div>
        <div class="pc-step">
          <span class="pc-step__number">3</span>
          <p class="pc-step__text">{{ t.passo3 }}</p>
        </div>

        <h2>Perguntas frequentes</h2>
        <div v-for="q in t.faq" :key="q.pergunta" class="pc-faq__item">
          <h3>{{ q.pergunta }}</h3>
          <p>{{ q.resposta }}</p>
        </div>

        <h2>Outras verificações pela placa</h2>
        <ul>
          <li v-for="o in outros" :key="o.slug"><NuxtLink :to="rotaDoTema(o)">{{ o.h1 }}</NuxtLink></li>
          <li v-if="t.slug === 'fipe'"><NuxtLink to="/tabela-fipe-por-placa">Tabela FIPE por placa</NuxtLink></li>
        </ul>
        <p><NuxtLink :to="ROTA_CONSULTAR">Ver todas as verificações pela placa</NuxtLink></p>

        <nav class="pc-breadcrumb">
          <NuxtLink to="/">Início</NuxtLink>
          <span> &rsaquo; </span>
          <NuxtLink :to="ROTA_CONSULTAR">{{ INDICE_CONSULTAR.h1 }}</NuxtLink>
          <span> &rsaquo; </span>
          <strong>{{ t.termo }}</strong>
        </nav>
      </div>
    </main>
  </div>
</template>
