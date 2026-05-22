<script setup lang="ts">
import { ibvPosts } from '~/data/ibv-posts'

useHead({
  title: 'IBV Auto — Índice de Inflação de Carros Usados | PlacaCompleta',
  meta: [
    { name: 'description', content: 'Acompanhe o Índice BV Auto (IBV), referência mensal de inflação de automóveis usados no Brasil. Dados por modelo, estado e tipo de combustível.' },
    { property: 'og:title', content: 'IBV Auto — Índice de Preços de Carros Usados' },
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
  <div class="desktop content-page">
    <main>
      <div class="win-window">
        <div class="win-window__titlebar">
          <span>IBV Auto</span>
          <div class="win-window__titlebar-buttons">
            <span class="win-window__titlebar-btn">_</span>
            <span class="win-window__titlebar-btn">&square;</span>
            <span class="win-window__titlebar-btn">&times;</span>
          </div>
        </div>
        <div class="win-window__body">
          <h1 class="seo-title">IBV Auto — Índice de Preços de Carros Usados</h1>

          <div class="seo-content">
            <p>
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

            <div class="info-box">
              <p>
                <strong>Sobre o IBV Auto:</strong> O Índice BV Auto é calculado mensalmente pelo banco BV
                com base em milhões de anúncios e transações de veículos usados em todo o Brasil.
                É a principal referência do mercado para acompanhar a valorização ou desvalorização
                do seu veículo.
              </p>
            </div>

            <div class="text-center mt-md mb-md">
              <NuxtLink to="/" class="win-btn win-btn--primary">
                Consultar Valor do Meu Carro
              </NuxtLink>
            </div>

            <nav class="breadcrumb">
              <NuxtLink to="/">PlacaCompleta</NuxtLink>
              <span> &rsaquo; </span>
              <strong>IBV Auto</strong>
            </nav>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.post-list {
  display: flex;
  flex-direction: column;
  gap: $space-sm;
  margin-bottom: $space-lg;
}

.post-card {
  @include win-border-raised;
  display: block;
  background: $win-white;
  padding: $space-md;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: $powder-blue;
  }

  &:active {
    border-color: $win-darker $win-white $win-white $win-darker;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: $space-sm;
    margin-bottom: $space-xs;
  }

  &__month {
    font-family: $font-display;
    font-size: 1rem;
    background: $navy-electric;
    color: $win-white;
    padding: 2px $space-sm;
  }

  &__date {
    font-size: 0.75rem;
    color: $win-dark;
    font-family: $font-mono;
  }

  &__title {
    font-family: $font-display;
    font-size: 1.25rem;
    color: $navy-electric;
    margin-bottom: $space-xs;
    line-height: 1.3;
  }

  &__desc {
    font-family: $font-body;
    font-size: 0.875rem;
    color: $graphite;
    margin-bottom: $space-xs;
    line-height: 1.5;
  }

  &__read {
    font-family: $font-display;
    font-size: 1rem;
    color: $smart-blue;
  }
}

.info-box {
  @include win-border-sunken;
  background: $powder-blue;
  padding: $space-sm $space-md;
  margin: $space-md 0;

  p { margin-bottom: 0; }
}

.breadcrumb {
  font-size: 0.75rem;
  margin-top: $space-lg;
  padding-top: $space-sm;
  border-top: 1px solid $win-dark;

  a {
    color: $smart-blue;
    text-decoration: underline;
  }

  span {
    color: $win-dark;
    margin: 0 2px;
  }
}
</style>
