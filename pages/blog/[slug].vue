<script setup lang="ts">
import { escolherTitulo } from '~/shared/seo-titulo'
import { findBlogPost, type BlogPost } from '~/data/blog-posts'
import { findIbvPost } from '~/data/ibv-posts'
import { tagPorSlug, TAGS_BLOG } from '~/data/blog-indice'
import { renderRichText } from '~/shared/rich-text'

// /blog/<slug>: post do blog ou, desde 16/out/2026, post do IBV Auto (que
// vivia em /ibv/<slug>; os antigos tem 301 no nuxt.config.ts).
const route = useRoute()
const slug = route.params.slug as string
const postBlog = findBlogPost(slug)
const ibv = postBlog ? undefined : findIbvPost(slug)
if (!postBlog && !ibv) throw createError({ statusCode: 404, message: 'Post não encontrado' })
// No ramo do blog, `post` existe; no do IBV o componente cuida de tudo.
const post = (postBlog || {}) as BlogPost
const tag = postBlog ? TAGS_BLOG.find((t) => t.nome.toLowerCase() === postBlog.categoria.toLowerCase()) : tagPorSlug('ibv-auto')

const URL_BASE = 'https://placacompleta.com.br'
const faqItens = (post.content || []).filter((s) => s.type === 'faq').flatMap((s) => s.faq || [])
const url = `${URL_BASE}/blog/${post.slug}`
const og = postBlog ? `${URL_BASE}${post.capa.og}` : ''

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${d} de ${meses[m - 1]} de ${y}`
}

if (postBlog) useHead({
  title: escolherTitulo(post.seoTitles?.length ? post.seoTitles : [post.title]),
  titleTemplate: '%s',
  link: [{ rel: 'canonical', href: url }],
  meta: [
    { name: 'description', content: post.metaDescription },
    { property: 'og:title', content: post.title },
    { property: 'og:description', content: post.metaDescription },
    { property: 'og:type', content: 'article' },
    { property: 'og:url', content: url },
    { property: 'og:image', content: og },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '627' },
    { property: 'og:image:alt', content: post.capa.alt },
    { property: 'article:published_time', content: post.publishedAt },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: post.title },
    { name: 'twitter:description', content: post.metaDescription },
    { name: 'twitter:image', content: og },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.metaDescription,
        image: [og],
        datePublished: post.publishedAt,
        dateModified: post.publishedAt,
        author: { '@type': 'Organization', name: 'PlacaCompleta', url: URL_BASE },
        publisher: {
          '@type': 'Organization',
          name: 'PlacaCompleta',
          url: URL_BASE,
          logo: { '@type': 'ImageObject', url: `${URL_BASE}/logo-horizontal-600.png` },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      }),
    },
    ...(faqItens.length
      ? [{
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqItens.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
          }),
        }]
      : []),
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'PlacaCompleta', item: URL_BASE },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${URL_BASE}/blog` },
          ...(tag ? [{ '@type': 'ListItem', position: 3, name: tag.nome, item: `${URL_BASE}/blog/tag/${tag.slug}` }] : []),
          { '@type': 'ListItem', position: tag ? 4 : 3, name: post.title },
        ],
      }),
    },
  ],
})
</script>

<template>
  <BlogIbvArtigo v-if="ibv" :post="ibv" />
  <div v-else class="pc-page">
    <main class="pc-container">
      <article class="blog-post">
        <header class="post-header">
          <NuxtLink v-if="tag" :to="`/blog/tag/${tag.slug}`" class="post-header__badge">{{ post.categoria }}</NuxtLink>
          <div v-else class="post-header__badge">{{ post.categoria }}</div>
          <h1 class="pc-h1 post-header__title">{{ post.title }}</h1>
          <div class="post-header__meta">Publicado em {{ formatDate(post.publishedAt) }}</div>
        </header>

        <figure class="capa">
          <img :src="post.capa.src" :alt="post.capa.alt" :width="post.capa.largura" :height="post.capa.altura" class="capa__img" decoding="async" fetchpriority="high">
        </figure>

        <template v-for="(s, i) in post.content" :key="i">
          <div v-if="s.type === 'intro'" class="intro-text rich-text" v-html="renderRichText(s.text!)" />
          <template v-else-if="s.type === 'heading'">
            <h2 v-if="s.heading">{{ s.heading }}</h2>
            <div class="rich-text" v-html="renderRichText(s.text!)" />
          </template>
          <template v-else-if="s.type === 'table'">
            <div class="tabela-wrap" role="region" tabindex="0" :aria-label="s.caption">
              <table class="tabela">
                <thead><tr><th v-for="(c, ci) in s.columns" :key="ci" scope="col">{{ c }}</th></tr></thead>
                <tbody><tr v-for="(row, ri) in s.rows" :key="ri"><td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td></tr></tbody>
              </table>
            </div>
            <p v-if="s.caption" class="tabela-nota">{{ s.caption }}</p>
          </template>
          <template v-else-if="s.type === 'faq'">
            <h2 v-if="s.heading">{{ s.heading }}</h2>
            <div v-for="(f, fi) in s.faq" :key="fi" class="faq-item">
              <h3>{{ f.q }}</h3>
              <p>{{ f.a }}</p>
            </div>
          </template>
          <div v-else-if="s.type === 'cta'" class="cta-block">
            <p>{{ s.text }}</p>
            <p><NuxtLink :to="s.ctaTo!" class="pc-btn pc-btn--primary">{{ s.ctaLabel }}</NuxtLink></p>
          </div>
        </template>

        <nav class="pc-breadcrumb">
          <NuxtLink to="/">PlacaCompleta</NuxtLink>
          <span> &rsaquo; </span>
          <NuxtLink to="/blog">Blog</NuxtLink>
          <template v-if="tag">
            <span> &rsaquo; </span>
            <NuxtLink :to="`/blog/tag/${tag.slug}`">{{ tag.nome }}</NuxtLink>
          </template>
        </nav>
      </article>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.post-header {
  margin-bottom: 20px;
  text-align: center;
  &__badge {
    display: inline-block;
    font-family: var(--pc-font);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: var(--pc-ink);
    color: var(--pc-on-slab);
    padding: 6px 12px;
    border-radius: 8px;
    margin-bottom: 14px;
    text-decoration: none;
  }
  a#{&}__badge:hover { background: var(--pc-blue); }
  &__title { margin-bottom: 10px; }
  &__meta { font-family: var(--pc-font); font-size: 0.8125rem; color: var(--pc-graphite); }
}
.capa { margin: 0 0 28px; }
.capa__img { display: block; width: 100%; height: auto; border-radius: 14px; border: 1px solid var(--pc-hairline); }
.blog-post {
  font-family: var(--pc-font);
  color: var(--pc-charcoal);
  max-width: 760px;
  margin: 0 auto;
  h2 { font-size: 1.375rem; font-weight: 600; line-height: 1.25; color: var(--pc-ink); margin: 32px 0 12px; }
}
.intro-text {
  font-size: 1.0625rem;
  line-height: 1.55;
  border-left: 3px solid var(--pc-blue);
  padding-left: 16px;
  margin-bottom: 28px;
}
.cta-block {
  margin-top: 32px;
  text-align: center;
  padding: 24px;
  border: 1px solid var(--pc-hairline);
  border-radius: 16px;
  background: var(--pc-canvas);
  p { margin: 0 0 16px; }
  p:last-child { margin-bottom: 0; }
}
.tabela-wrap { overflow-x: auto; margin: 8px 0 6px; border: 1px solid var(--pc-hairline); border-radius: 12px; -webkit-overflow-scrolling: touch; }
.tabela { width: 100%; border-collapse: collapse; font-size: 0.8125rem; min-width: 640px; }
.tabela th, .tabela td { padding: 8px 8px; text-align: right; border-bottom: 1px solid var(--pc-hairline); white-space: nowrap; }
.tabela th:first-child, .tabela td:first-child { text-align: left; white-space: normal; min-width: 150px; padding-left: 12px; }
.tabela th { white-space: normal; line-height: 1.25; vertical-align: bottom; }
.tabela th { background: var(--pc-canvas); color: var(--pc-ink); font-weight: 600; font-size: 0.8125rem; }
.tabela tbody tr:last-child td { border-bottom: 0; }
.tabela-nota { font-size: 0.8125rem; color: var(--pc-graphite); line-height: 1.45; margin: 0 0 20px; }
.faq-item { margin: 0 0 18px; h3 { font-size: 1.0625rem; font-weight: 600; color: var(--pc-ink); margin: 0 0 6px; } p { margin: 0; line-height: 1.6; } }
.rich-text :deep(p) { margin: 0 0 16px; line-height: 1.6; }
.rich-text :deep(p:last-child) { margin-bottom: 0; }
.rich-text :deep(ul), .rich-text :deep(ol) { margin: 0 0 16px; padding-left: 22px; }
.rich-text :deep(li) { margin-bottom: 6px; line-height: 1.55; }
.rich-text :deep(strong) { font-weight: 600; color: var(--pc-ink); }
.rich-text :deep(a) { color: var(--pc-blue); text-decoration: none; border-bottom: 1px solid rgba(31, 111, 235, 0.35); }
</style>
