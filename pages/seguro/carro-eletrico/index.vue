<script setup lang="ts">
import { escolherTitulo } from '~/shared/seo-titulo'
import { descricaoSeguroEletrico } from '~/shared/seo-meta'
import { states } from '~/data/states'
import seguroEletricos from '~/data/seguro-eletricos.json'

function brl(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

// Lista de UFs com dados, ordenada por nome do estado
const linhas = Object.values(states)
  .map(s => ({ ...s, dados: (seguroEletricos as Record<string, any>)[s.uf] || null }))
  .filter(s => s.dados?.mediaPremio)
  .sort((a, b) => a.name.localeCompare(b.name))

const mediaNacional = linhas.length
  ? Math.round(linhas.reduce((sum, l) => sum + l.dados.mediaPremio, 0) / linhas.length)
  : 0

useHead({
  title: escolherTitulo(['Seguro de Carro Elétrico: Preço Médio por Estado', 'Seguro de Carro Elétrico: Preço Médio por Estado do Brasil']),
  titleTemplate: '%s',
  meta: [
    {
      name: 'description',
      content: descricaoSeguroEletrico(mediaNacional),
    },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'PlacaCompleta', item: 'https://placacompleta.com.br' },
          { '@type': 'ListItem', position: 2, name: 'Seguro de Carro Elétrico', item: 'https://placacompleta.com.br/seguro/carro-eletrico' },
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
          <span>Seguro de Carro Elétrico por Estado</span>
          <div class="win-window__titlebar-buttons">
            <span class="win-window__titlebar-btn">_</span>
            <span class="win-window__titlebar-btn">□</span>
            <span class="win-window__titlebar-btn">×</span>
          </div>
        </div>
        <div class="win-window__body">
          <h1 class="seo-title">Seguro de Carro Elétrico: preço por estado</h1>

          <div class="seo-content">
            <p class="lead">
              O seguro de um carro elétrico no Brasil custa em média
              <strong>{{ brl(mediaNacional) }} por ano</strong>, mas o valor muda bastante de estado
              pra estado. A tabela abaixo usa <strong>dados oficiais da SUSEP</strong> (apólices
              reais de elétricos e híbridos como Nissan Leaf, Chevrolet Bolt, Renault Zoe e Toyota Prius), corrigidos pela
              inflação do seguro medida pelo IBGE. Clique no seu estado pra ver o detalhe por modelo.
            </p>

            <div class="table-scroll">
              <table class="seguro-table">
                <thead>
                  <tr><th>Estado</th><th>Seguro médio/ano</th><th>Região de referência</th></tr>
                </thead>
                <tbody>
                  <tr v-for="l in linhas" :key="l.slug">
                    <td><NuxtLink :to="`/seguro/carro-eletrico/${l.slug}`">{{ l.name }}</NuxtLink></td>
                    <td><strong>{{ brl(l.dados.mediaPremio) }}</strong></td>
                    <td>{{ l.dados.regiao.nome }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="metodologia">
              Estimativas com base em dados oficiais SUSEP, corrigidas pelo IPCA. Não substituem
              cotação real de seguradora.
            </p>

            <div class="text-center mt-md mb-md">
              <NuxtLink to="/cotacao" class="win-btn win-btn--primary">
                Pedir cotação real gratuita
              </NuxtLink>
            </div>

            <h2>Como saber o seguro médio do seu carro?</h2>
            <p>
              Consulte a placa no PlacaCompleta: você recebe por e-mail os dados do veículo, a tabela
              FIPE e a estimativa de seguro do seu modelo na sua região, grátis, em segundos.
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
.table-scroll { overflow-x: auto; }

.seguro-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;

  th, td {
    border: 1px solid $border-light;
    padding: 8px 10px;
    text-align: left;
  }

  th { background: $surface-alt; color: $graphite; }
  td strong { color: $navy-electric; }
  td a { color: $navy-electric; }
}

.metodologia {
  font-size: 0.75rem;
  color: $slate-grey;
  margin-top: 6px;
}
</style>
