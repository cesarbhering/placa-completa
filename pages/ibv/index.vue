<script setup lang="ts">
import { escolherTitulo } from '~/shared/seo-titulo'
import { ibvPosts } from '~/data/ibv-posts'

useHead({
  title: escolherTitulo(['IBV Auto: Índice de Inflação de Carros Usados', 'IBV Auto: Inflação de Carros Usados']),
  titleTemplate: '%s',
  meta: [
    { name: 'description', content: 'Acompanhe o Índice BV Auto (IBV), referência mensal de inflação de automóveis usados no Brasil. Dados por modelo, estado e tipo de combustível.' },
    { property: 'og:title', content: 'IBV Auto: Índice de Preços de Carros Usados' },
    { property: 'og:description', content: 'Relatórios mensais do Índice BV Auto (IBV): inflação de automóveis usados no Brasil por modelo, estado e tipo de combustível.' },
    { property: 'og:type', content: 'website' },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'PlacaCompleta', item: 'https://placacompleta.com.br' },
          { '@type': 'ListItem', position: 2, name: 'IBV Auto' },
        ],
      }),
    },
  ],
})

function formatDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${day} ${months[month - 1]}. ${year}`
}
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">IBV Auto: Índice de Preços de Carros Usados</h1>

      <div class="pc-prose">
        <p class="pc-lead">
          O <strong>Índice BV Auto (IBV)</strong> é a referência mensal de inflação de automóveis
          usados no Brasil, publicado pelo banco BV. Acompanhe aqui os relatórios mensais com
          variação de preços por modelo, estado e tipo de combustível.
        </p>

        <h2>Relatórios mensais</h2>

        <div class="post-list">
          <NuxtLink
            v-for="post in ibvPosts"
            :key="post.slug"
            :to="`/ibv/${post.slug}`"
            class="post-card"
          >
            <div class="post-card__meta">
              <span class="post-card__month">{{ post.referenceMonth }}</span>
              <span class="post-card__date">Publicado em {{ formatDate(post.publishedAt) }}</span>
            </div>
            <h3 class="post-card__title">{{ post.title }}</h3>
            <p class="post-card__desc">{{ post.metaDescription }}</p>
            <span class="post-card__read">Ler relatório →</span>
          </NuxtLink>
        </div>

        <div class="pc-callout">
          <p>
            <strong>Sobre o IBV Auto:</strong> O Índice BV Auto é calculado mensalmente pelo banco BV
            com base em milhões de anúncios e transações de veículos usados em todo o Brasil.
            É a principal referência do mercado para acompanhar a valorização ou desvalorização
            do seu veículo.
          </p>
        </div>

        <div class="pc-cta">
          <NuxtLink to="/" class="pc-btn pc-btn--primary">
            Consultar Valor do Meu Carro
          </NuxtLink>
        </div>

        <nav class="pc-breadcrumb">
          <NuxtLink to="/">PlacaCompleta</NuxtLink>
          <span> &rsaquo; </span>
          <strong>IBV Auto</strong>
        </nav>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
// Design novo (tokens --pc-*, classes .pc-* de _content-v2.scss). So o visual
// mudou: texto, links, schema e head sao os mesmos do layout antigo.
.post-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 12px 0 24px;
}

// .pc-prose a pinta link de azul com sublinhado; o card inteiro e um link,
// entao zera isso aqui.
.pc-prose a.post-card {
  display: block;
  padding: 16px 18px;
  border: 1px solid var(--pc-hairline);
  border-radius: 16px;
  background: var(--pc-canvas);
  color: var(--pc-ink);
  text-decoration: none;
  border-bottom: 1px solid var(--pc-hairline);
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover { border-color: var(--pc-blue); background: var(--pc-cloud); }
}

.post-card {
  &__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__month {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--pc-canvas);
    background: var(--pc-slab);
    border-radius: 9999px;
    padding: 3px 10px;
  }

  &__date {
    font-size: 0.8125rem;
    color: var(--pc-graphite);
  }

  &__title {
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--pc-ink);
    margin: 0 0 6px;
  }

  &__desc {
    font-size: 0.9375rem;
    line-height: 1.55;
    color: var(--pc-charcoal);
    margin: 0 0 8px;
  }

  &__read {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--pc-blue);
  }
}
</style>
