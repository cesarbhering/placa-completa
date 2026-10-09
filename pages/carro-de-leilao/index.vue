<script setup lang="ts">
import { escolherTitulo } from '~/shared/seo-titulo'
import { DESCRICOES } from '~/shared/seo-meta'
import { BASE_LEILAO_TEXTO } from '~/shared/base-leilao'
// Pagina guia de "carro de leilao". Copy final do seo, aprovada pelo Cesar
// (placa-completa-marketing/seo/planos-conteudo/carro-de-leilao-copy-final.md).
//
// Regras de copy que valem aqui e nas 19 paginas de modelo que vem depois:
// nunca afirmar que um veiculo especifico passou por leilao (e sempre indicio
// ou registro compativel), nunca prometer certeza, e nunca nomear a fonte dos
// dados do relatorio.
import { PERGUNTAS_LEILAO } from '~/shared/faq-leilao'
import { MODELOS_POR_VOLUME } from '~/shared/leilao-modelos'

const CANONICO = 'https://placacompleta.com.br/carro-de-leilao'

function onCtaClick(origem: string) {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: 'carro-de-leilao', origem })
  }
}

useHead({
  title: escolherTitulo(['Carro de Leilão: Como Descobrir Antes de Comprar', 'Carro de Leilão: Como Saber Antes de Comprar']),
  titleTemplate: '%s',
  meta: [
    {
      name: 'description',
      content: DESCRICOES.carroDeLeilao,
    },
    { property: 'og:title', content: 'Carro de leilão: como descobrir antes de comprar' },
    {
      property: 'og:description',
      content: 'O que significa passagem por leilão, os quatro tipos que existem e como descobrir pela placa.',
    },
  ],
  link: [{ rel: 'canonical', href: CANONICO }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: PERGUNTAS_LEILAO.map((q) => ({
          '@type': 'Question',
          name: q.pergunta,
          acceptedAnswer: { '@type': 'Answer', text: q.resposta },
        })),
      }),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://placacompleta.com.br' },
          { '@type': 'ListItem', position: 2, name: 'Carro de leilão', item: CANONICO },
        ],
      }),
    },
  ],
})

const TIPOS = [
  {
    titulo: 'Leilão de recuperação de crédito',
    texto: 'Financeira retomou por inadimplência. Geralmente carro conservado, risco menor.',
  },
  {
    titulo: 'Leilão judicial',
    texto: 'Originado de processo, penhora ou disputa. Risco variável, depende do motivo específico.',
  },
  {
    titulo: 'Leilão de remoção',
    texto: 'Carro apreendido ou removido de circulação e não retirado a tempo pelo dono. Risco variável, atenção ao tempo parado.',
  },
  {
    titulo: 'Leilão de sucata ou recuperável',
    texto: 'Veículo classificado assim depois de um sinistro grave. Maior risco, exige inspeção técnica antes de qualquer negociação.',
  },
]

const SINAIS = [
  'Documentação com muitas transferências de proprietário num intervalo curto de tempo',
  'Diferença de tonalidade de pintura entre peças, principalmente no capô, para-lamas ou porta-malas',
  'Frestas ou encaixes irregulares entre peças da carroceria',
  'Cheiro de umidade ou manchas dentro do carro, mesmo sem chuva recente',
  'Preço bem abaixo da média de mercado pra aquele modelo e ano, sem uma explicação clara do vendedor',
]
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">Carro de leilão: o que significa e como descobrir antes de comprar</h1>

      <div class="pc-prose">
        <p class="pc-lead">
          Carro de leilão é qualquer veículo que, em algum momento da vida, foi vendido em leilão
          público, seja por recuperação de financiamento, decisão judicial, remoção de trânsito não
          retirada pelo dono ou classificação de sucata depois de um sinistro grave. Isso não aparece
          de forma automática no documento que o vendedor mostra pra você, e é exatamente por isso que
          descobrir essa informação antes de fechar negócio muda o preço que você deveria pagar.
        </p>

        <h2>O que significa um carro ter passagem por leilão</h2>
        <p>
          Ter passado por leilão não é, sozinho, motivo pra descartar um carro. Existem origens bem
          diferentes, e cada uma pesa de um jeito na hora de negociar:
        </p>
        <ul>
          <li>
            Um carro <strong>recuperado de financiamento</strong> (o dono não pagou e a financeira
            retomou o bem) pode estar em estado perfeito, às vezes até melhor que a média do mercado,
            porque muitas vezes rodou pouco.
          </li>
          <li>
            Um carro de <strong>decisão judicial</strong> (penhora, disputa de herança, processo)
            também costuma estar mecanicamente normal, só muda de dono por uma questão jurídica, não
            física.
          </li>
          <li>
            Um carro <strong>removido e não retirado</strong> (ficou num pátio de trânsito e o dono
            não reclamou) é mais imprevisível: o tempo parado, exposto, pode ter causado desgaste que
            não aparece à primeira vista.
          </li>
          <li>
            Um carro classificado como <strong>sucata ou recuperável</strong> depois de um sinistro
            grave é o caso que exige mais cuidado: envolveu perda considerável, e mesmo depois de
            recuperado, pode ter comprometimento estrutural que não é visível numa inspeção rápida.
          </li>
        </ul>
        <p>
          O problema nunca é ter sido de leilão. O problema é comprar sem saber, e pagar o preço de um
          carro sem passagem nenhuma por um carro que teve.
        </p>

        <h2>O leilão que não aparece no documento</h2>
        <p>
          O CRLV do carro (o documento que o vendedor te mostra) traz o histórico de propriedade, mas
          não traz, de forma explícita, se aquele veículo já foi arrematado em leilão. Se o carro já
          trocou de estado, de dono, ou se o leilão aconteceu há alguns anos, é fácil a informação se
          perder no meio do caminho, mesmo sem ninguém estar escondendo nada de propósito. É por isso
          que uma consulta específica de histórico do veículo é diferente de simplesmente olhar o
          documento em mãos: ela cruza a placa ou o chassi com registros de leilões que não aparecem
          ali.
        </p>
        <div class="pc-callout">
          <p>
            Nossa base reúne <strong>{{ BASE_LEILAO_TEXTO }}</strong>,
            coletados de fontes públicas em todo o Brasil, cobrindo carros de diversas décadas até
            modelos bem recentes.
          </p>
        </div>

        <h2>Tipos de leilão de veículo</h2>
        <p>
          Resumo rápido pra você reconhecer o termo quando aparecer numa consulta ou numa conversa com
          o vendedor:
        </p>
        <div v-for="(t, i) in TIPOS" :key="t.titulo" class="pc-step">
          <div class="pc-step__number">{{ i + 1 }}</div>
          <div class="pc-step__text">
            <strong>{{ t.titulo }}</strong><br>
            {{ t.texto }}
          </div>
        </div>

        <h2>Como descobrir se um carro específico já foi de leilão</h2>
        <p>
          O jeito prático de descobrir é consultar a placa (ou o chassi) do carro específico que você
          está de olho. A consulta cruza os dados do veículo com registros de leilão e retorna um
          indício de passagem quando existe um registro compatível na nossa base, isso é diferente de
          afirmar com certeza absoluta o que aconteceu com aquele carro, mas já é uma informação que o
          documento sozinho não entrega.
        </p>
        <div class="pc-cta">
          <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick('meio')">
            Consultar placa agora
          </NuxtLink>
        </div>

        <h2>Sinais de alerta que ajudam mesmo sem consulta</h2>
        <p>
          Além da consulta, alguns sinais no próprio carro ou na conversa com o vendedor ajudam a
          formar uma suspeita:
        </p>
        <ul>
          <li v-for="s in SINAIS" :key="s">{{ s }}</li>
        </ul>
        <p>
          Nenhum desses sinais prova nada sozinho, mas somados a uma consulta de histórico, formam uma
          decisão bem mais segura do que confiar só no que o vendedor conta.
          Veja o passo a passo completo em
          <NuxtLink to="/carro-de-leilao/como-saber">como saber se o carro é de leilão</NuxtLink>.
        </p>

        <h2>Perguntas frequentes</h2>
        <div v-for="q in PERGUNTAS_LEILAO" :key="q.pergunta" class="pc-faq__item">
          <h3>{{ q.pergunta }}</h3>
          <p>{{ q.resposta }}</p>
        </div>

        <h2>Modelos mais leiloados</h2>
        <p>
          Os modelos com mais registros na nossa base, do mais frequente pro menos. Aparecer no topo
          desta lista não quer dizer que o modelo seja pior: quer dizer que ele é popular, e carro
          popular aparece mais em tudo, inclusive em leilão.
        </p>
        <ul class="pc-modelos">
          <li v-for="mo in MODELOS_POR_VOLUME" :key="mo.slug">
            <NuxtLink :to="`/carro-de-leilao/${mo.slug}`">{{ mo.nome }} de leilão</NuxtLink>
          </li>
        </ul>

        <h2>Onde mais o histórico ajuda</h2>
        <ul>
          <li><NuxtLink to="/">Consulta de placa grátis</NuxtLink>, com marca, modelo, ano e cor</li>
          <li>
            <NuxtLink to="/tabela-fipe-por-placa">Tabela FIPE pela placa</NuxtLink>, pra comparar o
            que estão pedindo com o valor de referência
          </li>
          <li>
            <NuxtLink to="/como-consultar-placa">Como consultar uma placa</NuxtLink>, o passo a passo
          </li>
        </ul>

        <div class="pc-callout">
          <p>
            <strong>Antes de fechar negócio, consulte a placa do carro que você está de olho.</strong>
            A consulta básica é gratuita e mostra marca, modelo, ano e cor. O relatório completo cruza
            com nossa base de {{ BASE_LEILAO_TEXTO }} e traz o indicador de passagem,
            junto com restrição, indicador de roubo e furto e gravame.
          </p>
        </div>
        <div class="pc-cta">
          <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick('final')">
            Consultar placa grátis
          </NuxtLink>
        </div>

        <nav class="pc-breadcrumb">
          <NuxtLink to="/">Início</NuxtLink>
          <span> &rsaquo; </span>
          <strong>Carro de leilão</strong>
        </nav>
      </div>
    </main>
  </div>
</template>

<style scoped>
.pc-modelos {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px 16px;
}
</style>
