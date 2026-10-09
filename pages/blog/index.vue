<script setup lang="ts">
import { escolherTitulo } from '~/shared/seo-titulo'
import { blogPosts } from '~/data/blog-posts'

useHead({
  title: escolherTitulo(['Blog do PlacaCompleta: Novidades e Bastidores do Produto']),
  titleTemplate: '%s',
  link: [{ rel: 'canonical', href: 'https://placacompleta.com.br/blog' }],
  meta: [
    { name: 'description', content: 'Novidades do PlacaCompleta: como checar um carro usado antes de comprar, nossa base de leilões e os bastidores de um produto construído com agentes de IA.' },
    { property: 'og:title', content: 'Blog do PlacaCompleta' },
    { property: 'og:description', content: 'Novidades e bastidores do PlacaCompleta, a consulta pela placa antes de comprar um usado.' },
    { property: 'og:type', content: 'website' },
    { property: 'og:image', content: `https://placacompleta.com.br${blogPosts[0]?.capa.og || '/og-image.png'}` },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'Blog do PlacaCompleta',
        url: 'https://placacompleta.com.br/blog',
        blogPost: blogPosts.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `https://placacompleta.com.br/blog/${p.slug}`, datePublished: p.publishedAt })),
      }),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'PlacaCompleta', item: 'https://placacompleta.com.br' },
          { '@type': 'ListItem', position: 2, name: 'Blog' },
        ],
      }),
    },
  ],
})

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${d} ${meses[m - 1]}. ${y}`
}
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">Blog do PlacaCompleta</h1>
      <div class="pc-prose">
        <p class="pc-lead">Novidades e bastidores do PlacaCompleta.</p>
        <div class="post-list">
          <NuxtLink v-for="post in blogPosts" :key="post.slug" :to="`/blog/${post.slug}`" class="post-card">
            <img :src="post.capa.og" :alt="post.capa.alt" width="1200" height="627" class="post-card__img" loading="lazy" decoding="async">
            <div class="post-card__corpo">
              <div class="post-card__meta">
                <span class="post-card__tag">{{ post.categoria }}</span>
                <span class="post-card__date">{{ formatDate(post.publishedAt) }}</span>
              </div>
              <h2 class="post-card__title">{{ post.title }}</h2>
              <p class="post-card__desc">{{ post.metaDescription }}</p>
            </div>
          </NuxtLink>
        </div>
        <div class="pc-cta">
          <NuxtLink to="/" class="pc-btn pc-btn--primary">Consultar placa</NuxtLink>
        </div>
        <nav class="pc-breadcrumb">
          <NuxtLink to="/">PlacaCompleta</NuxtLink>
          <span> &rsaquo; </span>
          <strong>Blog</strong>
        </nav>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.post-list { display: flex; flex-direction: column; gap: 16px; margin: 16px 0 24px; }
.pc-prose a.post-card {
  display: block;
  border: 1px solid var(--pc-hairline);
  border-radius: 16px;
  background: var(--pc-canvas);
  color: var(--pc-ink);
  text-decoration: none;
  overflow: hidden;
  transition: border-color 0.15s ease;
  &:hover { border-color: var(--pc-blue); }
}
.post-card {
  &__img { display: block; width: 100%; height: auto; }
  &__corpo { padding: 16px 18px; }
  &__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
  &__tag {
    font-size: 0.75rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--pc-canvas); background: var(--pc-slab); border-radius: 9999px; padding: 3px 10px;
  }
  &__date { font-size: 0.8125rem; color: var(--pc-graphite); }
  &__title { font-size: 1.125rem; font-weight: 600; line-height: 1.3; margin: 0 0 6px; color: var(--pc-ink); }
  &__desc { font-size: 0.9375rem; line-height: 1.5; margin: 0; color: var(--pc-charcoal); }
}
</style>
