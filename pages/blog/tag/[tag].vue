<script setup lang="ts">
import { escolherTitulo } from '~/shared/seo-titulo'
import { postsDoBlog, tagPorSlug, tagsComPost } from '~/data/blog-indice'

// /blog/tag/<tag> (16/out/2026). /ibv agora cai aqui (301 para ibv-auto).
const route = useRoute()
const tag = tagPorSlug(route.params.tag as string)
if (!tag || !tagsComPost.includes(tag)) throw createError({ statusCode: 404, message: 'Tag não encontrada' })
const posts = postsDoBlog.filter((p) => p.tag.slug === tag.slug)
const URL_BASE = 'https://placacompleta.com.br'
const url = `${URL_BASE}/blog/tag/${tag.slug}`
const imagemOg = posts.find((p) => p.imagem)?.imagem?.src

useHead({
  title: escolherTitulo(tag.titulos),
  titleTemplate: '%s',
  link: [{ rel: 'canonical', href: url }],
  meta: [
    { name: 'description', content: tag.description },
    { property: 'og:title', content: `${tag.nome} no blog do PlacaCompleta` },
    { property: 'og:description', content: tag.description },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: url },
    { property: 'og:image', content: `${URL_BASE}${imagemOg || '/og-image.png'}` },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${tag.nome} no blog do PlacaCompleta`,
        url,
        hasPart: posts.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${URL_BASE}/blog/${p.slug}`, datePublished: p.publishedAt })),
      }),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'PlacaCompleta', item: URL_BASE },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${URL_BASE}/blog` },
          { '@type': 'ListItem', position: 3, name: tag.nome },
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
      <h1 class="pc-h1">{{ tag!.nome }}</h1>
      <div class="pc-prose">
        <p class="pc-lead">{{ tag!.lead }}</p>
        <nav class="tags" aria-label="Tags do blog">
          <NuxtLink to="/blog" class="tags__chip">Todos os posts</NuxtLink>
          <NuxtLink v-for="t in tagsComPost" :key="t.slug" :to="`/blog/tag/${t.slug}`" class="tags__chip" :class="{ 'tags__chip--ativa': t.slug === tag!.slug }">{{ t.nome }}</NuxtLink>
        </nav>
        <div class="post-list">
          <NuxtLink v-for="post in posts" :key="post.slug" :to="`/blog/${post.slug}`" class="post-card">
            <img v-if="post.imagem" :src="post.imagem.src" :alt="post.imagem.alt" width="1200" height="627" class="post-card__img" loading="lazy" decoding="async">
            <div class="post-card__corpo">
              <div class="post-card__meta">
                <span class="post-card__tag">{{ post.tag.nome }}</span>
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
          <NuxtLink to="/blog">Blog</NuxtLink>
          <span> &rsaquo; </span>
          <strong>{{ tag!.nome }}</strong>
        </nav>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 8px; }
.pc-prose a.tags__chip {
  font-size: 0.8125rem; font-weight: 600; color: var(--pc-ink); text-decoration: none;
  border: 1px solid var(--pc-hairline); border-radius: 9999px; padding: 6px 14px; background: var(--pc-canvas);
  &:hover { border-color: var(--pc-blue); color: var(--pc-blue); }
}
.pc-prose a.tags__chip--ativa { background: var(--pc-ink); color: var(--pc-on-slab); border-color: var(--pc-ink); }
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
