<script setup lang="ts">
import { ibvPosts } from '~/data/ibv-posts'

// Post mais recente do IBV (pra destacar no hub de estudos)
const ultimoIbv = [...ibvPosts]
  .filter(p => p.slug !== 'seguro-mais-caro-brasil-2026')
  .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))[0]

useHead({
  title: 'Estudos e Dados do Mercado Automotivo | PlacaCompleta',
  meta: [
    {
      name: 'description',
      content: 'Estudos do PlacaCompleta sobre o mercado de veículos no Brasil: seguro por região (dados SUSEP), análise do IBV Auto do Banco BV e preços da Tabela FIPE. Fontes oficiais, metodologia aberta.',
    },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Estudos e Dados do Mercado Automotivo',
        description: 'Estudos do PlacaCompleta sobre seguro, valorização e preços de veículos no Brasil, com base em fontes oficiais.',
        url: 'https://placacompleta.com.br/estudos',
        publisher: {
          '@type': 'Organization',
          name: 'PlacaCompleta',
          url: 'https://placacompleta.com.br',
        },
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
          <span>Estudos e Dados</span>
          <div class="win-window__titlebar-buttons">
            <span class="win-window__titlebar-btn">_</span>
            <span class="win-window__titlebar-btn">□</span>
            <span class="win-window__titlebar-btn">×</span>
          </div>
        </div>
        <div class="win-window__body">
          <h1 class="seo-title">Estudos e Dados do Mercado Automotivo</h1>

          <div class="seo-content">
            <p class="lead">
              O PlacaCompleta compila e analisa dados oficiais para ajudar brasileiros a
              entender o mercado de veículos: quanto custa segurar um carro em cada região,
              como os preços de usados se movem e qual o valor de mercado de cada modelo.
              Todos os estudos usam <strong>fontes públicas</strong> com metodologia aberta.
              <strong>Imprensa e pesquisadores</strong> podem citar livremente, indicando a
              fonte (PlacaCompleta) e, quando aplicável, a fonte primária dos dados.
            </p>

            <h2>Seguro de veículos por região</h2>
            <p>
              Estimativas de prêmio de seguro auto a partir da base oficial de apólices da
              <strong>SUSEP</strong> (Superintendência de Seguros Privados), corrigidas pela
              inflação do seguro de veículo medida pelo <strong>IBGE</strong> (subitem do IPCA)
              e segmentadas pelas 41 regiões de tarifação usadas pelas seguradoras.
            </p>
            <ul class="estudos-list">
              <li>
                <NuxtLink to="/ibv/seguro-mais-caro-brasil-2026">
                  As 5 regiões com seguro de carro mais caro do Brasil (e as 5 mais baratas)
                </NuxtLink>
                — ranking das 41 regiões de tarifação. Fonte: SUSEP + IPCA/IBGE.
              </li>
              <li>
                <NuxtLink to="/seguro/carro-eletrico">
                  Seguro de carro elétrico por estado
                </NuxtLink>
                — preço médio em cada UF, por modelo. Fonte: SUSEP + IPCA/IBGE.
              </li>
            </ul>

            <h2>IBV Auto — valorização de usados (análise)</h2>
            <p>
              O <strong>IBV (Índice BV Auto) é um índice do Banco BV</strong> que mede a
              variação mensal dos preços de veículos usados no Brasil. O PlacaCompleta
              <strong>não produz o índice</strong>: nós analisamos e comentamos os dados
              publicados pelo Banco BV a cada divulgação, destacando os modelos e regiões
              que mais valorizaram ou desvalorizaram. A fonte primária é sempre o
              <strong>Banco BV</strong>.
            </p>
            <ul class="estudos-list">
              <li v-if="ultimoIbv">
                <NuxtLink :to="`/ibv/${ultimoIbv.slug}`">{{ ultimoIbv.title }}</NuxtLink>
                — análise mais recente.
              </li>
              <li>
                <NuxtLink to="/ibv">Todas as análises do IBV Auto</NuxtLink>
                — histórico mensal. Fonte dos dados: Banco BV (IBV Auto).
              </li>
            </ul>

            <h2>Tabela FIPE — valor de mercado</h2>
            <p>
              Preços da <strong>Tabela FIPE</strong> (Fundação Instituto de Pesquisas
              Econômicas) por modelo e ano, com histórico de variação. A FIPE é a referência
              nacional de valor de mercado, atualizada mensalmente.
            </p>
            <ul class="estudos-list">
              <li>
                <NuxtLink to="/tabela-fipe">Tabela FIPE por marca e modelo</NuxtLink>
                — preços e histórico. Fonte: FIPE.
              </li>
              <li>
                <NuxtLink to="/tabela-fipe-por-placa">Como consultar a FIPE pela placa</NuxtLink>
              </li>
            </ul>

            <h2>Sobre a metodologia e citação</h2>
            <p>
              Nossos números são estimativas estatísticas com base em dados oficiais — não
              substituem cotação de seguradora nem a consulta oficial de cada órgão. Para
              citar em reportagens ou trabalhos, use <strong>“PlacaCompleta
              (placacompleta.com.br)”</strong> e, quando aplicável, a fonte primária: SUSEP
              e IBGE (seguro), Banco BV (IBV Auto) ou FIPE (valor de mercado). Dúvidas ou
              pedidos de dados: <strong>contato[at]placacompleta.com.br</strong>.
            </p>

            <div class="text-center mt-md mb-md">
              <NuxtLink to="/" class="win-btn win-btn--primary">Consultar placa grátis</NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.estudos-list {
  margin: 0 0 $space-md;
  padding-left: 1.2rem;
  line-height: 1.7;

  li {
    margin-bottom: $space-xs;
  }

  a {
    color: $navy-electric;
    font-weight: 600;
  }
}
</style>
