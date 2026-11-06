<script setup lang="ts">
import { escolherTitulo } from '~/shared/seo-titulo'
// Pagina do cluster de compra (shared/cluster-compra.ts). Uma por rota, com
// Article + FAQPage + Breadcrumb, CTA pro relatorio completo e a lista honesta
// do que ele traz e do que nao traz.
import { paginaCompra, PAGINAS_COMPRA } from '~/shared/cluster-compra'
import { ARTIGOS } from '~/shared/artigos-o-que-e'
import { PLANOS, precoDePromocao } from '~/shared/planos'
import { paginaCompraEn } from '~/shared/cluster-compra-en'


const props = defineProps<{ rota: string }>()
// English twin when the visitor is on /en and the page has one
// (shared/cluster-compra-en.ts); otherwise the PT page, untouched.
const { t, emIngles, rota } = useIdioma()
const p = (emIngles.value && paginaCompraEn(props.rota)) || paginaCompra(props.rota)!
const BASE = 'https://placacompleta.com.br'
const CANONICO = `${BASE}${rota(p.rota)}`
const preco = `R$ ${(PLANOS.completa.valorCentavos / 100).toFixed(2).replace('.', ',')}`
const temPromo = !!precoDePromocao('completa')
const outras = PAGINAS_COMPRA.filter((x) => x.rota !== p.rota)

function onCtaClick(origem: string) {
  if (import.meta.client && (window as any).gtag) (window as any).gtag('event', 'cta_click', { source_page: p.rota.slice(1), origem })
}

useHead({
  title: escolherTitulo([p.title]),
  titleTemplate: '%s',
  meta: [
    { name: 'description', content: p.description },
    { property: 'og:title', content: p.h1 },
    { property: 'og:description', content: p.description },
    { property: 'og:type', content: 'article' },
  ],
  link: [{ rel: 'canonical', href: CANONICO }],
  script: [
    { type: 'application/ld+json', innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: p.h1, description: p.description, datePublished: p.datePublished, dateModified: p.datePublished, inLanguage: emIngles.value ? 'en' : 'pt-BR', mainEntityOfPage: CANONICO, author: { '@type': 'Organization', name: 'PlacaCompleta', url: BASE }, publisher: { '@type': 'Organization', name: 'PlacaCompleta', url: BASE, logo: { '@type': 'ImageObject', url: `${BASE}/logo-horizontal-600.png` } } }) },
    { type: 'application/ld+json', innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faq.map((q) => ({ '@type': 'Question', name: q.pergunta, acceptedAnswer: { '@type': 'Answer', text: q.resposta } })) }) },
    { type: 'application/ld+json', innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: t('comum.inicio'), item: BASE }, { '@type': 'ListItem', position: 2, name: p.termo, item: CANONICO }] }) },
  ],
})
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">{{ p.h1 }}</h1>
      <div class="pc-prose">
        <p class="pc-lead">{{ p.lead }}</p>

        <template v-for="s in p.secoes" :key="s.h2">
          <h2>{{ s.h2 }}</h2>
          <p v-for="(t, i) in s.paragrafos || []" :key="i">{{ t }}</p>
          <ul v-if="s.lista"><li v-for="(li, i) in s.lista" :key="i">{{ li }}</li></ul>
        </template>

        <div class="pc-callout">
          <p>
            <strong>{{ t('compra.relatorioCompleto') }}</strong> <PrecoPromo v-if="temPromo" inline /><strong v-else>{{ preco }}</strong>. {{ t('compra.pagamento') }}
          </p>
        </div>
        <div class="pc-cta">
          <NuxtLink :to="rota('/')" class="pc-btn pc-btn--primary" @click="onCtaClick('meio')">{{ t('compra.cta') }}</NuxtLink>
        </div>

        <h2>{{ t('compra.faqH2') }}</h2>
        <div v-for="q in p.faq" :key="q.pergunta" class="pc-faq__item">
          <h3>{{ q.pergunta }}</h3>
          <p>{{ q.resposta }}</p>
        </div>

        <!-- The related pages are PT only: the English twin skips this list. -->
        <h2 v-if="!emIngles">Veja também</h2>
        <ul v-if="!emIngles">
          <li v-for="o in outras" :key="o.rota"><NuxtLink :to="o.rota">{{ o.h1 }}</NuxtLink></li>
          <li><NuxtLink to="/carro-de-leilao">Carro de leilão: como descobrir antes de comprar</NuxtLink></li>
          <li v-for="a in ARTIGOS" :key="a.slug"><NuxtLink :to="`/o-que-e/${a.slug}`">{{ a.h1 }}</NuxtLink></li>
        </ul>

        <nav class="pc-breadcrumb">
          <NuxtLink :to="rota('/')">{{ t('comum.inicio') }}</NuxtLink>
          <span> &rsaquo; </span>
          <strong>{{ p.termo }}</strong>
        </nav>
      </div>
    </main>
  </div>
</template>
