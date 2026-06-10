<script setup lang="ts">
import { states } from '~/data/states'
import { capitals } from '~/data/capitals'

const stateList = Object.values(states).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
const capitalList = Object.values(capitals).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

function onCtaClick() {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: 'consultar-placa-hub' })
  }
}

useHead({
  title: 'Consultar Placa por Estado — Todos os 27 Estados e Capitais',
  meta: [
    { name: 'description', content: 'Consulte a placa de qualquer veículo registrado no Brasil. Escolha o estado ou capital e veja marca, modelo, ano, FIPE e situação. Grátis e em segundos.' },
    { name: 'keywords', content: 'consultar placa por estado, consulta placa detran, consultar placa capital, consulta veicular por uf' },
    { property: 'og:title', content: 'Consultar Placa por Estado — Brasil Inteiro' },
    { property: 'og:description', content: 'Consulta veicular gratuita em todos os 27 estados e capitais do Brasil.' },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'PlacaCompleta', item: 'https://placacompleta.com.br' },
          { '@type': 'ListItem', position: 2, name: 'Consultar Placa por Estado' },
        ],
      }),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Consulta de placa por estado',
        numberOfItems: stateList.length,
        itemListElement: stateList.map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `Consultar Placa ${s.name} (${s.uf})`,
          url: `https://placacompleta.com.br/consultar-placa/${s.slug}`,
        })),
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
          <span>Consultar Placa por Estado</span>
          <div class="win-window__titlebar-buttons">
            <span class="win-window__titlebar-btn">_</span>
            <span class="win-window__titlebar-btn">&square;</span>
            <span class="win-window__titlebar-btn">&times;</span>
          </div>
        </div>
        <div class="win-window__body">
          <h1 class="seo-title">Consultar Placa de Veículo por Estado</h1>

          <div class="seo-content">
            <p>
              A consulta de placa no PlacaCompleta funciona para veículos registrados em
              <strong>qualquer estado do Brasil</strong>. Escolha abaixo o estado ou a capital
              para ver informações específicas — DETRAN local, regras de IPVA, séries de placa —
              ou <NuxtLink to="/">consulte direto pela placa</NuxtLink> e receba marca, modelo,
              ano, valor FIPE e situação em segundos.
            </p>

            <div class="text-center mt-md mb-md">
              <NuxtLink to="/" class="win-btn win-btn--primary" @click="onCtaClick">
                Consultar Placa Grátis
              </NuxtLink>
            </div>

            <h2>Estados</h2>
            <div class="hub-grid">
              <NuxtLink
                v-for="s in stateList"
                :key="s.slug"
                :to="`/consultar-placa/${s.slug}`"
                class="hub-card"
              >
                <span class="hub-card__uf">{{ s.uf }}</span>
                <span class="hub-card__name">{{ s.name }}</span>
              </NuxtLink>
            </div>

            <h2>Capitais</h2>
            <div class="hub-grid">
              <NuxtLink
                v-for="c in capitalList"
                :key="c.slug"
                :to="`/consultar-placa/capital/${c.slug}`"
                class="hub-card"
              >
                <span class="hub-card__name">{{ c.name }}</span>
              </NuxtLink>
            </div>

            <h2>Como funciona a consulta?</h2>
            <p>
              Os dados do veículo são públicos e mantidos pelo DETRAN de cada estado. Com a placa
              Mercosul, a identificação da UF passou a ser feita pelo município de registro.
              Independente do estado, a consulta no PlacaCompleta retorna os mesmos dados:
              marca, modelo, ano de fabricação e modelo, cor, município, situação, chassi parcial e
              <NuxtLink to="/tabela-fipe-por-placa">valor atualizado na Tabela FIPE</NuxtLink>.
            </p>

            <nav class="breadcrumb">
              <NuxtLink to="/">PlacaCompleta</NuxtLink>
              <span> &rsaquo; </span>
              <strong>Consultar Placa por Estado</strong>
            </nav>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.hub-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $space-sm;
  margin-bottom: $space-lg;

  @media (max-width: 520px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.hub-card {
  @include win-border-raised;
  background: $surface;
  padding: $space-sm;
  text-align: center;
  text-decoration: none !important;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    border-color: $smart-blue;
    background: $powder-blue;
  }

  &__uf {
    font-family: $font-mono;
    font-weight: 700;
    font-size: 0.8125rem;
    color: $smart-blue;
  }

  &__name {
    font-size: 0.8125rem;
    color: $twilight-indigo;
    line-height: 1.3;
  }
}
</style>
