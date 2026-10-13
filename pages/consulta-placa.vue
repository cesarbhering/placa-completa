<script setup lang="ts">
import { ABERTURA_CONSULTA } from '~/shared/frases-abertura'
import { escolherTitulo } from '~/shared/seo-titulo'
import { DESCRICOES } from '~/shared/seo-meta'
import { GENERICAS } from '~/shared/enriquecimento-regional'

// Bloco proprio desta pagina. Ela e quase a home em intencao, entao sem algo
// que so ela diga o Google trata as duas como a mesma coisa e guarda uma so.
const blocoPagina = GENERICAS['/consulta-placa']
function onCtaClick() {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: 'consulta-placa' })
  }
}

useHead({
  title: escolherTitulo(['Consulta de Placa Veicular Online: Leilão, Roubo e Débitos', 'Consulta de Placa Veicular: Leilão e Roubo']),
  titleTemplate: '%s',
  meta: [
    { name: 'description', content: DESCRICOES.consultaPlaca },
    { name: 'keywords', content: 'consulta de placa, consulta placa veicular, consultar placa online, consulta veicular completa, consulta de placa com leilão, pesquisar placa de carro' },
    { property: 'og:title', content: 'Consulta de Placa Veicular Online' },
    { property: 'og:description', content: 'Consulte qualquer placa e veja os dados do veículo na hora, na própria tela.' },
  ],
})
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">Consulta de Placa Veicular Grátis</h1>

      <div class="pc-prose">
        <!-- Frase de abertura citavel (plano GEO 13/out, secao 2.5). -->
        <p>{{ ABERTURA_CONSULTA }}</p>

        <template v-if="blocoPagina">
          <h2>{{ blocoPagina.titulo }}</h2>
          <p>{{ blocoPagina.texto }}</p>
          <div v-for="q in blocoPagina.faq" :key="q.pergunta" class="pc-faq__item">
            <h3>{{ q.pergunta }}</h3>
            <p>{{ q.resposta }}</p>
          </div>
        </template>

        <h2>Que dados eu recebo na consulta?</h2>
        <ul>
          <li><strong>Marca e modelo</strong> do veículo</li>
          <li><strong>Ano de fabricação</strong> e ano modelo</li>
          <li><strong>Cor</strong> do veículo</li>
          <li><strong>Valor na tabela FIPE</strong></li>
          <li><strong>Município</strong> e estado de registro</li>
          <li><strong>Situação</strong> do veículo (em circulação, baixado)</li>
          <li><strong>Chassi</strong> (parcial)</li>
          <li><strong>Combustível</strong>, tipo e espécie</li>
        </ul>
        <p>
          Precisa de mais detalhes, como débitos, indicadores de roubo/furto e registro de leilão, e
          histórico completo? Veja o <NuxtLink to="/">relatório completo</NuxtLink>.
        </p>

        <h2>Como consultar?</h2>
        <ol>
          <li>Acesse a <NuxtLink to="/">página principal</NuxtLink></li>
          <li>Digite seu e-mail</li>
          <li>Informe a placa do veículo</li>
          <li>Clique em "Consultar Placa"</li>
          <li>Pronto! Os dados chegam no seu e-mail em segundos.</li>
        </ol>
      </div>

      <div class="pc-cta">
        <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick">
          Consultar Agora
        </NuxtLink>
      </div>
    </main>
  </div>
</template>
