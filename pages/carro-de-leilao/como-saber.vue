<script setup lang="ts">
import { escolherTitulo } from '~/shared/seo-titulo'
import { BASE_LEILAO_TEXTO } from '~/shared/base-leilao'
// Guia "Como saber se o carro e de leilao" (plano SEO 02/out, item #7). Rota
// estatica: tem prioridade sobre /carro-de-leilao/[slug]. Conteudo e regras em
// shared/guia-como-saber-leilao.ts.
import { PASSOS, SINAIS, FAQ_COMO_SABER, LEVANTAMENTO_SINAL } from '~/shared/guia-como-saber-leilao'

const BASE = 'https://placacompleta.com.br'
const CANONICO = `${BASE}/carro-de-leilao/como-saber`
const H1 = 'Como saber se o carro é de leilão'
const DESC = 'Três caminhos para saber se um carro passou por leilão: documento e histórico, sinais no próprio carro e consulta da placa numa base de leilões. Passo a passo.'

function onCtaClick(origem: string) {
  if (import.meta.client && (window as any).gtag) (window as any).gtag('event', 'cta_click', { source_page: 'carro-de-leilao-como-saber', origem })
}

useHead({
  title: escolherTitulo(['Como Saber se o Carro é de Leilão: Passo a Passo', 'Como Saber se o Carro é de Leilão pela Placa']),
  titleTemplate: '%s',
  meta: [
    { name: 'description', content: DESC },
    { property: 'og:title', content: H1 },
    { property: 'og:description', content: DESC },
    { property: 'og:type', content: 'article' },
  ],
  link: [{ rel: 'canonical', href: CANONICO }],
  script: [
    { type: 'application/ld+json', innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@type': 'HowTo', name: H1, description: DESC, inLanguage: 'pt-BR', step: PASSOS.map((p, i) => ({ '@type': 'HowToStep', position: i + 1, name: p.nome, text: p.texto })) }) },
    { type: 'application/ld+json', innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ_COMO_SABER.map((q) => ({ '@type': 'Question', name: q.pergunta, acceptedAnswer: { '@type': 'Answer', text: q.resposta } })) }) },
    { type: 'application/ld+json', innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Início', item: BASE }, { '@type': 'ListItem', position: 2, name: 'Carro de leilão', item: `${BASE}/carro-de-leilao` }, { '@type': 'ListItem', position: 3, name: 'Como saber', item: CANONICO }] }) },
  ],
})
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">Como saber se o carro é de leilão</h1>
      <div class="pc-prose">
        <p class="pc-lead">
          Há três caminhos para saber se um carro já passou por leilão: pedir o documento e o
          histórico ao vendedor, procurar sinais no próprio carro (chassi, etiquetas, reparos) e
          consultar a placa ou o chassi numa base de leilões. Os dois primeiros levantam suspeita;
          o terceiro é o que mostra o registro que não está no carro nem no documento.
        </p>

        <h2>Passo a passo</h2>
        <div v-for="(p, i) in PASSOS" :key="p.nome" class="pc-step">
          <div class="pc-step__number">{{ i + 1 }}</div>
          <div class="pc-step__text"><strong>{{ p.nome }}</strong><br>{{ p.texto }}</div>
        </div>

        <div class="pc-cta">
          <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick('meio')">Consultar placa agora</NuxtLink>
        </div>

        <h2>Sinais no carro que pedem atenção</h2>
        <ul><li v-for="s in SINAIS" :key="s">{{ s }}</li></ul>
        <p>
          Nenhum desses sinais prova sozinho que o carro foi de leilão: um reparo pode ter outra origem,
          e muitos carros de leilão estão em ótimo estado. Eles servem para saber o que perguntar e o que
          conferir antes de pagar.
        </p>

        <h2>O que a nossa base mostra</h2>
        <div class="pc-callout">
          <p>
            Nossa base reúne <strong>{{ BASE_LEILAO_TEXTO }}</strong>, montada a partir de
            editais de DETRANs e catálogos de leiloeiras. Nas consultas feitas na PlacaCompleta
            {{ LEVANTAMENTO_SINAL.periodo }}, {{ LEVANTAMENTO_SINAL.pct }} das placas com o sinal de leilão
            respondido ({{ LEVANTAMENTO_SINAL.positivos }} de {{ LEVANTAMENTO_SINAL.n.toLocaleString('pt-BR') }})
            tinham registro compatível na base.
          </p>
        </div>

        <h2>Por que isso importa na compra</h2>
        <ul>
          <li><strong>Seguro:</strong> algumas seguradoras recusam carro de leilão ou mudam as condições da apólice.</li>
          <li><strong>Revenda:</strong> a passagem por leilão costuma pesar no preço quando você for vender.</li>
          <li><strong>Preço abaixo da FIPE:</strong> um valor muito baixo pode ter explicação no histórico do carro.</li>
          <li><strong>Financiamento:</strong> veja se há <NuxtLink to="/o-que-e/gravame">gravame</NuxtLink> ou <NuxtLink to="/o-que-e/renajud">bloqueio judicial (RENAJUD)</NuxtLink> antes de pagar.</li>
        </ul>

        <h2>Como a consulta ajuda</h2>
        <p>
          A consulta pela placa na PlacaCompleta mostra marca, modelo, ano e o sinal de leilão quando há
          registro compatível na base. O relatório completo traz o detalhe de cada registro (data, origem e
          condição do veículo informada no edital ou no catálogo) e, junto, roubo e furto, gravame,
          RENAJUD, recall e infrações. Ele não substitui a vistoria do carro: quem avalia o estado físico é
          a vistoria cautelar.
        </p>
        <div class="pc-cta">
          <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick('final')">Consultar placa agora</NuxtLink>
        </div>

        <h2>Perguntas frequentes</h2>
        <div v-for="q in FAQ_COMO_SABER" :key="q.pergunta" class="pc-faq__item">
          <h3>{{ q.pergunta }}</h3>
          <p>{{ q.resposta }}</p>
        </div>

        <h2>Veja também</h2>
        <ul>
          <li><NuxtLink to="/carro-de-leilao">Carro de leilão: o que significa e como descobrir antes de comprar</NuxtLink></li>
          <li><NuxtLink to="/o-que-e/gravame">O que é gravame?</NuxtLink></li>
          <li><NuxtLink to="/o-que-e/renajud">O que é RENAJUD?</NuxtLink></li>
        </ul>

        <nav class="pc-breadcrumb">
          <NuxtLink to="/">Início</NuxtLink>
          <span> &rsaquo; </span>
          <NuxtLink to="/carro-de-leilao">Carro de leilão</NuxtLink>
          <span> &rsaquo; </span>
          <strong>Como saber</strong>
        </nav>
      </div>
    </main>
  </div>
</template>
