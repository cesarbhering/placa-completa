<script setup lang="ts">
import { findIbvPost } from '~/data/ibv-posts'

const route = useRoute()
const slug = route.params.slug as string
const post = findIbvPost(slug)

if (!post) {
  throw createError({ statusCode: 404, message: 'Relatório não encontrado' })
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${day} de ${months[month - 1]} de ${year}`
}

// --- Lightweight markdown renderer ---
// Suporta apenas o subset usado nos posts: **negrito**, [texto](url), e listas
// prefixadas com "- " ou "1. ". Conteúdo vem de arquivos versionados no repo,
// não de entrada de usuário, mas escapo HTML por segurança e uso whitelist.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(s: string): string {
  let out = escapeHtml(s)
  // [text](url) -> <a>
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, text, url) => {
      const isExternal = /^https?:\/\//.test(url) && !url.startsWith('https://placacompleta.com.br')
      const attrs = isExternal
        ? ' target="_blank" rel="noopener noreferrer"'
        : ''
      return `<a href="${url}"${attrs}>${text}</a>`
    }
  )
  // **bold** -> <strong>
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  return out
}

/**
 * Converte texto multiline em blocos HTML. Blocos são separados por `\n\n`.
 * Um bloco cujas linhas começam todas com "- " vira <ul>; começando com
 * "N. " vira <ol>; caso contrário vira <p>. Cada linha passa por renderInline.
 */
function renderRichText(text: string): string {
  if (!text) return ''
  const blocks = text.split(/\n\n+/)
  const html: string[] = []
  for (const block of blocks) {
    const lines = block.split('\n').filter(l => l.trim() !== '')
    if (lines.length === 0) continue
    const isBulletList = lines.every(l => /^-\s+/.test(l))
    const isNumberedList = lines.every(l => /^\d+\.\s+/.test(l))
    if (isBulletList) {
      const items = lines.map(l => `<li>${renderInline(l.replace(/^-\s+/, ''))}</li>`).join('')
      html.push(`<ul>${items}</ul>`)
    } else if (isNumberedList) {
      const items = lines.map(l => `<li>${renderInline(l.replace(/^\d+\.\s+/, ''))}</li>`).join('')
      html.push(`<ol>${items}</ol>`)
    } else {
      // Preserva quebras de linha simples dentro do parágrafo com <br>
      const inner = lines.map(renderInline).join('<br>')
      html.push(`<p>${inner}</p>`)
    }
  }
  return html.join('')
}

useHead({
  title: post.title,
  meta: [
    { name: 'description', content: post.metaDescription },
    { property: 'og:title', content: post.title },
    { property: 'og:description', content: post.metaDescription },
    { property: 'og:type', content: 'article' },
    { property: 'og:image', content: 'https://placacompleta.com.br/og-image.png' },
    { property: 'article:published_time', content: post.publishedAt },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: post.title },
    { name: 'twitter:description', content: post.metaDescription },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.metaDescription,
        datePublished: post.publishedAt,
        dateModified: post.publishedAt,
        author: {
          '@type': 'Organization',
          name: 'PlacaCompleta',
          url: 'https://placacompleta.com.br',
        },
        publisher: {
          '@type': 'Organization',
          name: 'PlacaCompleta',
          url: 'https://placacompleta.com.br',
          logo: {
            '@type': 'ImageObject',
            url: 'https://placacompleta.com.br/logo-horizontal-600.png',
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `https://placacompleta.com.br/ibv/${post.slug}`,
        },
        about: {
          '@type': 'Thing',
          name: 'Índice BV Auto',
          description: 'Índice mensal de inflação de automóveis usados no Brasil, publicado pelo banco BV.',
        },
      }),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'PlacaCompleta', item: 'https://placacompleta.com.br' },
          { '@type': 'ListItem', position: 2, name: 'IBV Auto', item: 'https://placacompleta.com.br/ibv' },
          { '@type': 'ListItem', position: 3, name: post.referenceMonth },
        ],
      }),
    },
  ],
})
</script>

<template>
  <div class="desktop content-page">
    <main>
      <div class="win-window">
        <div class="win-window__titlebar">
          <span>IBV Auto — {{ post.referenceMonth }}</span>
          <div class="win-window__titlebar-buttons">
            <span class="win-window__titlebar-btn">_</span>
            <span class="win-window__titlebar-btn">&square;</span>
            <span class="win-window__titlebar-btn">&times;</span>
          </div>
        </div>
        <div class="win-window__body">
          <div class="post-header">
            <div class="post-header__badge">IBV Auto · {{ post.referenceMonth }}</div>
            <h1 class="seo-title">{{ post.title }}</h1>
            <div class="post-header__meta">
              <span>Publicado em {{ formatDate(post.publishedAt) }}</span>
              <span class="meta-sep">·</span>
              <span>Fonte: {{ post.source }}</span>
            </div>
          </div>

          <div class="seo-content">
            <template v-for="(section, i) in post.content" :key="i">
              <!-- intro -->
              <div
                v-if="section.type === 'intro'"
                class="intro-text rich-text"
                v-html="renderRichText(section.text!)"
              />

              <!-- heading section -->
              <template v-else-if="section.type === 'heading'">
                <h2>{{ section.heading }}</h2>
                <div class="rich-text" v-html="renderRichText(section.text!)" />
              </template>

              <!-- highlight box -->
              <template v-else-if="section.type === 'highlight'">
                <div class="highlight-box">
                  <h2 class="highlight-box__heading">{{ section.heading }}</h2>
                  <div class="rich-text" v-html="renderRichText(section.text!)" />
                </div>
              </template>

              <!-- image -->
              <template v-else-if="section.type === 'image'">
                <figure class="chart-figure">
                  <img
                    :src="section.src"
                    :alt="section.alt"
                    class="chart-img"
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption v-if="section.caption" class="chart-caption">
                    {{ section.caption }}
                  </figcaption>
                </figure>
              </template>

              <!-- cta -->
              <template v-else-if="section.type === 'cta'">
                <div class="cta-block">
                  <p>{{ section.text }}</p>
                  <p>
                    <NuxtLink :to="section.ctaTo!" class="win-btn win-btn--primary">
                      {{ section.ctaLabel }}
                    </NuxtLink>
                  </p>
                  <p class="cta-alt-links">
                    Ou veja os valores atualizados na
                    <NuxtLink to="/tabela-fipe-por-placa">Tabela FIPE por Placa</NuxtLink>.
                  </p>
                </div>
              </template>
            </template>

            <nav class="breadcrumb">
              <NuxtLink to="/">PlacaCompleta</NuxtLink>
              <span> &rsaquo; </span>
              <NuxtLink to="/ibv">IBV Auto</NuxtLink>
              <span> &rsaquo; </span>
              <strong>{{ post.referenceMonth }}</strong>
            </nav>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.post-header {
  margin-bottom: $space-lg;
  text-align: center;

  &__badge {
    display: inline-block;
    font-family: $font-display;
    font-size: 1rem;
    background: $navy-electric;
    color: $win-white;
    padding: 2px $space-md;
    margin-bottom: $space-sm;
    letter-spacing: 1px;
  }

  &__meta {
    font-family: $font-mono;
    font-size: 0.75rem;
    color: $win-dark;
    margin-top: $space-sm;
  }
}

.meta-sep {
  margin: 0 $space-xs;
}

.intro-text {
  font-size: 1.0625rem;
  font-weight: 500;
  color: $graphite;
  border-left: 4px solid $navy-electric;
  padding-left: $space-md;
  margin-bottom: $space-lg;
}

.highlight-box {
  @include win-border-sunken;
  background: $powder-blue;
  padding: $space-md;
  margin: $space-lg 0;

  &__heading {
    font-family: $font-display;
    font-size: 1.25rem;
    color: $navy-electric;
    margin-bottom: $space-sm;
    margin-top: 0;
  }

  p { margin-bottom: 0; }
}

.cta-block {
  margin-top: $space-xl;
  text-align: center;
  padding: $space-lg;
  @include win-border-raised;
  background: $win-white;

  p { margin-bottom: $space-md; }
}

.cta-alt-links {
  font-size: 0.875rem;
  color: $graphite;

  a {
    color: $smart-blue;
    text-decoration: underline;
  }
}

.chart-figure {
  margin: $space-lg 0;
  @include win-border-sunken;
  background: $win-white;
  padding: $space-sm;
}

.chart-img {
  display: block;
  width: 100%;
  height: auto;
}

.chart-caption {
  font-family: $font-mono;
  font-size: 0.6875rem;
  color: $win-dark;
  margin-top: $space-xs;
  text-align: center;
}

.breadcrumb {
  font-size: 0.75rem;
  margin-top: $space-xl;
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

.rich-text p {
  margin: 0 0 $space-md 0;
}

.rich-text p:last-child {
  margin-bottom: 0;
}

.rich-text ul,
.rich-text ol {
  margin: 0 0 $space-md $space-md;
  padding-left: $space-md;
}

.rich-text li {
  margin-bottom: $space-xs;
  line-height: 1.55;
}

.rich-text strong {
  font-weight: 700;
  color: $win-dark;
}

.rich-text a {
  color: $navy-electric;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.rich-text a:hover {
  color: $smart-blue;
}
</style>
