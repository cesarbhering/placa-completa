<script setup lang="ts">
import { escolherTitulo } from '~/shared/seo-titulo'
import { H1_CARRO_ROUBADO, RESPOSTA_CARRO_ROUBADO, PASSOS_CARRO_ROUBADO, SE_FOR_ROUBADO, FAQ_CARRO_ROUBADO } from '~/shared/guia-carro-roubado'
// Guia informacional "como saber se o carro e roubado". O tema transacional
// ("consultar roubo e furto pela placa") fica em /consultar/roubo-furto.

const BASE = 'https://placacompleta.com.br'
const CANONICO = `${BASE}/como-saber-se-o-carro-e-roubado`
const DESC = 'Como saber se um carro é roubado antes de comprar: consulta da placa, documento, chassi e motor, sinais de placa clonada e o que fazer se for roubado.'

function onCtaClick(origem: string) {
  if (import.meta.client && (window as any).gtag) (window as any).gtag('event', 'cta_click', { source_page: 'como-saber-se-o-carro-e-roubado', origem })
}

useHead({
  title: escolherTitulo(['Como Saber se o Carro é Roubado: Passo a Passo pela Placa', 'Como Saber se o Carro é Roubado pela Placa']),
  titleTemplate: '%s',
  meta: [
    { name: 'description', content: DESC },
    { property: 'og:title', content: H1_CARRO_ROUBADO },
    { property: 'og:description', content: DESC },
    { property: 'og:type', content: 'article' },
  ],
  link: [{ rel: 'canonical', href: CANONICO }],
  script: [
    { type: 'application/ld+json', innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ_CARRO_ROUBADO.map((q) => ({ '@type': 'Question', name: q.pergunta, acceptedAnswer: { '@type': 'Answer', text: q.resposta } })) }) },
    { type: 'application/ld+json', innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Início', item: BASE }, { '@type': 'ListItem', position: 2, name: H1_CARRO_ROUBADO, item: CANONICO }] }) },
  ],
})
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">{{ H1_CARRO_ROUBADO }}</h1>
      <div class="pc-prose">
        <p class="pc-lead">{{ RESPOSTA_CARRO_ROUBADO }}</p>
        <OfertaCompletaTopo origem="como-saber-se-o-carro-e-roubado" foco="o indicador de roubo e furto" />

        <h2>Passo a passo</h2>
        <div v-for="(p, i) in PASSOS_CARRO_ROUBADO" :key="p.nome" class="pc-step">
          <div class="pc-step__number">{{ i + 1 }}</div>
          <div class="pc-step__text"><strong>{{ p.nome }}</strong><br>{{ p.texto }}</div>
        </div>

        <div class="pc-cta">
          <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick('meio')">Consultar placa grátis</NuxtLink>
        </div>

        <h2>O que o PlacaCompleta mostra sobre roubo e furto</h2>
        <div class="pc-callout">
          <p>
            A consulta grátis identifica o veículo pela placa: marca, modelo, ano, cor e parte do chassi,
            para você conferir se bate com o carro. O relatório completo traz o indicador de roubo e furto,
            junto de restrições, gravame, bloqueio judicial e registro de leilão. É um indicador, não uma
            sentença: ele ajuda a decidir, e a confirmação oficial é com o DETRAN e a polícia.
          </p>
        </div>

        <h2>O que fazer se o carro for roubado</h2>
        <ul><li v-for="s in SE_FOR_ROUBADO" :key="s">{{ s }}</li></ul>

        <div class="pc-cta">
          <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick('final')">Consultar placa grátis</NuxtLink>
        </div>

        <h2>Perguntas frequentes</h2>
        <div v-for="q in FAQ_CARRO_ROUBADO" :key="q.pergunta" class="pc-faq__item">
          <h3>{{ q.pergunta }}</h3>
          <p>{{ q.resposta }}</p>
        </div>

        <h2>Veja também</h2>
        <ul>
          <li><NuxtLink to="/consultar/roubo-furto">Consultar roubo e furto pela placa</NuxtLink></li>
          <li><NuxtLink to="/carro-de-leilao/como-saber">Como saber se o carro é de leilão</NuxtLink></li>
          <li><NuxtLink to="/o-que-e/renajud">O que é RENAJUD?</NuxtLink></li>
        </ul>

        <nav class="pc-breadcrumb">
          <NuxtLink to="/">Início</NuxtLink>
          <span> &rsaquo; </span>
          <strong>{{ H1_CARRO_ROUBADO }}</strong>
        </nav>
      </div>
    </main>
  </div>
</template>
