<script setup lang="ts">
import { escolherTitulo } from '~/shared/seo-titulo'
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
  title: escolherTitulo([post.seoTitle, post.title]),
  titleTemplate: '%s',
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
  <div class="pc-page">
    <main class="pc-container">
      <div class="post-header">
        <div class="post-header__badge">IBV Auto · {{ post.referenceMonth }}</div>
        <h1 class="pc-h1 post-header__title">{{ post.title }}</h1>
        <div class="post-header__meta">
          <span>Publicado em {{ formatDate(post.publishedAt) }}</span>
          <span class="meta-sep">·</span>
          <span>Fonte: {{ post.source }}</span>
        </div>
      </div>

      <div class="ibv-post">
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
                    <NuxtLink :to="section.ctaTo!" class="pc-btn pc-btn--primary">
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

            <nav class="pc-breadcrumb">
              <NuxtLink to="/">PlacaCompleta</NuxtLink>
              <span> &rsaquo; </span>
              <NuxtLink to="/ibv">IBV Auto</NuxtLink>
              <span> &rsaquo; </span>
              <strong>{{ post.referenceMonth }}</strong>
        </nav>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
// Post editorial do IBV no design novo (tokens --pc-*). Os nomes de classe e o
// renderer de rich-text (v-html) ficam intactos; muda so o visual.
.post-header {
  margin-bottom: 28px;
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
  }

  &__title { margin-bottom: 12px; }

  &__meta {
    font-family: var(--pc-font);
    font-size: 0.8125rem;
    color: var(--pc-graphite);
    margin-top: 10px;
  }
}

.meta-sep { margin: 0 6px; color: var(--pc-steel); }

.ibv-post {
  font-family: var(--pc-font);
  color: var(--pc-charcoal);

  h2 {
    font-family: var(--pc-font);
    font-size: 1.375rem;
    font-weight: 600;
    line-height: 1.25;
    color: var(--pc-ink);
    margin: 32px 0 12px;
  }
}

.intro-text {
  font-size: 1.0625rem;
  line-height: 1.55;
  color: var(--pc-charcoal);
  border-left: 3px solid var(--pc-blue);
  padding-left: 16px;
  margin-bottom: 28px;
}

.highlight-box {
  background: var(--pc-cloud);
  border: 1px solid var(--pc-hairline);
  border-radius: 12px;
  padding: 18px 20px;
  margin: 24px 0;

  &__heading {
    font-family: var(--pc-font);
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--pc-ink);
    margin: 0 0 8px;
  }

  p { margin-bottom: 0; }
}

.cta-block {
  margin-top: 32px;
  text-align: center;
  padding: 24px;
  border: 1px solid var(--pc-hairline);
  border-radius: 16px;
  background: var(--pc-canvas);

  p { margin-bottom: 16px; }
  p:last-child { margin-bottom: 0; }
}

.cta-alt-links {
  font-size: 0.875rem;
  color: var(--pc-graphite);

  a { color: var(--pc-blue); text-decoration: none; border-bottom: 1px solid rgba(31, 111, 235, 0.35); }
  a:hover { border-bottom-color: var(--pc-blue); }
}

.chart-figure {
  margin: 24px 0;
  border: 1px solid var(--pc-hairline);
  border-radius: 12px;
  background: var(--pc-canvas);
  padding: 12px;
  overflow: hidden;
}

.chart-img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 8px;
}

.chart-caption {
  font-family: var(--pc-font);
  font-size: 0.75rem;
  color: var(--pc-graphite);
  margin-top: 8px;
  text-align: center;
}

// conteudo gerado (v-html) — prosa no design novo
.rich-text p { margin: 0 0 16px; line-height: 1.6; }
.rich-text p:last-child { margin-bottom: 0; }

.rich-text ul,
.rich-text ol {
  margin: 0 0 16px;
  padding-left: 22px;
}

.rich-text li { margin-bottom: 6px; line-height: 1.55; }

.rich-text strong { font-weight: 600; color: var(--pc-ink); }

.rich-text a {
  color: var(--pc-blue);
  text-decoration: none;
  border-bottom: 1px solid rgba(31, 111, 235, 0.35);
  text-underline-offset: 2px;
}
.rich-text a:hover { border-bottom-color: var(--pc-blue); }
</style>
