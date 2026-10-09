<script setup lang="ts">
import { tituloSeguroEletricoEstado } from '~/shared/seo-meta'
import { descricaoSeguroEletricoEstado } from '~/shared/seo-meta'
import { states } from '~/data/states'
import seguroEletricos from '~/data/seguro-eletricos.json'
import seguroEstados from '~/data/seguro-estados.json'

const route = useRoute()
const slug = route.params.estado as string
const state = states[slug]

if (!state) {
  throw createError({ statusCode: 404, message: 'Página não encontrada' })
}

const dados = (seguroEletricos as Record<string, any>)[state.uf] || null
const estadoInfo = (seguroEstados as any).estados?.[state.uf] || null

if (!dados || !dados.modelos?.length) {
  throw createError({ statusCode: 404, message: 'Página não encontrada' })
}

const anoRef = dados.modelos[0]?.ano || 2024
const mediaEletrico = dados.mediaPremio
const mediaPopular = estadoInfo?.mediaPopulares || null

function brl(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

const faqs = [
  {
    question: `Quanto custa o seguro de um carro elétrico em ${state.name}?`,
    answer: `Com base em dados oficiais da SUSEP corrigidos pelo IPCA, o seguro de carros elétricos em ${state.name} (região ${dados.regiao.nome}) custa em média ${brl(mediaEletrico)} por ano, variando conforme o modelo, o perfil do condutor e a cobertura contratada.`,
  },
  {
    question: 'Seguro de carro elétrico é mais caro que o de carro comum?',
    answer: mediaPopular
      ? `Em ${state.name}, a média dos elétricos da nossa cesta é ${brl(mediaEletrico)}/ano, contra ${brl(mediaPopular)}/ano da cesta de populares a combustão (Onix, HB20, Gol, Strada e Corolla). A diferença vem principalmente do valor segurado mais alto e do custo de reposição da bateria.`
      : 'Em geral o prêmio absoluto é maior porque o valor segurado é maior, mas em percentual do valor do carro o seguro de elétrico costuma ser competitivo, já que o perfil do condutor tende a ter menor sinistralidade.',
  },
  {
    question: 'Como pedir uma cotação real de seguro?',
    answer: 'A estimativa desta página é uma média estatística. Para um valor exato pro seu perfil, peça uma cotação gratuita em placacompleta.com.br/cotacao ou consulte sua placa e receba a estimativa do seu carro por e-mail.',
  },
]

useHead({
  title: tituloSeguroEletricoEstado(state.uf, state.name, anoRef + 2),
  titleTemplate: '%s',
  meta: [
    {
      name: 'description',
      content: descricaoSeguroEletricoEstado(state.name, mediaEletrico, state.uf),
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
          { '@type': 'ListItem', position: 3, name: state.name, item: `https://placacompleta.com.br/seguro/carro-eletrico/${slug}` },
        ],
      }),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(f => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
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
          <span>Seguro de Carro Elétrico - {{ state.name }}</span>
          <div class="win-window__titlebar-buttons">
            <span class="win-window__titlebar-btn">_</span>
            <span class="win-window__titlebar-btn">□</span>
            <span class="win-window__titlebar-btn">×</span>
          </div>
        </div>
        <div class="win-window__body">
          <h1 class="seo-title">Seguro de Carro Elétrico em {{ state.name }}</h1>

          <div class="seo-content">
            <p class="lead">
              O seguro de um carro elétrico em {{ state.name }} custa em média
              <strong>{{ brl(mediaEletrico) }} por ano</strong>, considerando os elétricos e
              híbridos com histórico de apólices na região {{ dados.regiao.nome }}. Os valores abaixo vêm de
              <strong>dados oficiais da SUSEP</strong> (base de apólices reais), corrigidos pela
              inflação do seguro de veículos medida pelo IBGE.
            </p>

            <h2>Preço do seguro por modelo (elétricos e híbridos) em {{ state.name }}</h2>
            <div class="table-scroll">
              <table class="seguro-table">
                <thead>
                  <tr><th>Modelo</th><th>Ano ref.</th><th>Seguro médio/ano</th><th>% do valor FIPE</th><th>Franquia média</th></tr>
                </thead>
                <tbody>
                  <tr v-for="m in dados.modelos" :key="m.slug">
                    <td>{{ m.nome }}</td>
                    <td>{{ m.ano }}</td>
                    <td><strong>{{ brl(m.premio) }}</strong></td>
                    <td>{{ m.pctFipe ? m.pctFipe + '%' : '-' }}</td>
                    <td>{{ brl(m.franquia) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="metodologia">
              Estimativas com base em dados oficiais SUSEP, corrigidas pelo IPCA (seguro voluntário
              de veículo). Não substituem cotação real de seguradora.
            </p>

            <div class="text-center mt-md mb-md">
              <NuxtLink to="/cotacao" class="win-btn win-btn--primary">
                Pedir cotação real gratuita
              </NuxtLink>
            </div>

            <h2 v-if="mediaPopular">Elétrico vs. carro popular em {{ state.name }}</h2>
            <p v-if="mediaPopular">
              Pra comparar: a média de seguro dos populares a combustão mais vendidos (Onix, HB20,
              Gol, Strada e Corolla) em {{ state.name }} é de <strong>{{ brl(mediaPopular) }}/ano</strong>,
              contra {{ brl(mediaEletrico) }}/ano dos elétricos. A diferença reflete principalmente o
              valor segurado mais alto dos elétricos e o custo de reposição de componentes como a
              bateria, não necessariamente um risco maior de sinistro.
            </p>

            <h2>Por que o seguro de carro elétrico é diferente?</h2>
            <p>
              Três fatores pesam no cálculo: o <strong>valor de mercado</strong> (elétricos ainda
              custam mais que equivalentes a combustão, o que eleva a importância segurada), o
              <strong>custo de reparo</strong> (bateria e eletrônica embarcada encarecem sinistros
              parciais) e o <strong>perfil do condutor</strong> (proprietários de elétricos têm, na
              média das seguradoras, menor frequência de sinistros, o que joga o prêmio pra baixo).
              O resultado líquido varia por modelo e região, por isso publicamos os números reais
              em vez de generalizações.
            </p>
            <p>
              Em {{ state.name }}, a região de tarifação {{ dados.regiao.nome }} é a referência
              usada pelas seguradoras pra precificar o risco local: densidade de tráfego, índice de
              roubo e custo médio de oficina da sua região entram na conta.
            </p>

            <h2>Descubra o seguro médio do seu carro</h2>
            <p>
              Consulte qualquer placa no PlacaCompleta e receba por e-mail os dados do veículo com a
              tabela FIPE e a <strong>estimativa de seguro do modelo na sua região</strong>, grátis.
            </p>
            <div class="text-center mt-md mb-md">
              <NuxtLink to="/" class="win-btn win-btn--primary">Consultar placa grátis</NuxtLink>
            </div>

            <h2>Perguntas frequentes</h2>
            <div v-for="f in faqs" :key="f.question" class="faq-item">
              <h3>{{ f.question }}</h3>
              <p>{{ f.answer }}</p>
            </div>

            <p class="outros-estados">
              <strong>Outros estados:</strong>
              <NuxtLink to="/seguro/carro-eletrico">ver todos</NuxtLink> ·
              <NuxtLink :to="`/consultar-placa/${slug}`">Consultar placa em {{ state.name }}</NuxtLink>
            </p>
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
}

.metodologia {
  font-size: 0.75rem;
  color: $slate-grey;
  margin-top: 6px;
}

.faq-item {
  margin-bottom: $space-sm;

  h3 { font-size: 1rem; color: $navy-electric; margin: 0 0 4px; }
  p { margin: 0; }
}

.outros-estados {
  margin-top: $space-md;
  font-size: 0.875rem;

  a { color: $navy-electric; }
}
</style>
