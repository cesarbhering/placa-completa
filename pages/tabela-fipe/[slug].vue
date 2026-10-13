<script setup lang="ts">
import { BASE_LEILAO_TEXTO } from '~/shared/base-leilao'
import { tituloModelo, descricaoModelo, tituloMarca, descricaoMarca } from '~/shared/fipe-seo'
import { fipeBrands, findBrandModel } from '~/data/fipe-brands'
import { enriquecimentoDe } from '~/shared/fipe-enriquecimento'
import { MODELOS_LEILAO } from '~/shared/leilao-modelos'
import { getModelSeoIntro } from '~/data/fipe-model-intros'
import { brl, faixaGeral, fraseAno, rotuloAno, sujeitoModelo, type ValorAno } from '~/shared/fipe-por-ano'
import fipePricesData from '~/data/fipe-prices.json'
import seguroModelosData from '~/data/seguro-modelos.json'

const route = useRoute()
const slug = route.params.slug as string

// Check if it's a brand page or brand-model page
const brand = fipeBrands[slug]
const brandModel = !brand ? findBrandModel(slug) : null

if (!brand && !brandModel) {
  throw createError({ statusCode: 404, message: 'Página não encontrada' })
}

const isBrandPage = !!brand
// Conteudo proprio desta pagina: bloco de leilao do modelo, paragrafo de
// geracao e FAQ. Existe pra 23 das paginas de modelo, e o resto segue como
// estava (ver shared/fipe-enriquecimento.ts).
const enriq = computed(() => (isBrandPage ? undefined : enriquecimentoDe(slug)))
// Quando ha uma pagina dedicada de leilao daquele modelo, o link aponta pra
// ela; quando nao ha, aponta pro guia. Casa pelo nome curto, que e como o
// pSEO de leilao chama o modelo.
const slugLeilaoDedicado = computed(() => {
  const nome = enriq.value?.nomeCurto?.toLowerCase()
  if (!nome) return null
  return MODELOS_LEILAO.find((m) => m.nome.toLowerCase() === nome)?.slug || null
})
const pageData = isBrandPage ? brand : brandModel!.brand
const model = brandModel?.model

const _now = new Date()
const currentYear = _now.getFullYear()

// Load FIPE prices from pre-fetched static JSON
const fipeData = !isBrandPage ? (fipePricesData as Record<string, any>)[slug] || null : null

const seguroData = !isBrandPage ? (seguroModelosData as Record<string, any>)[slug] || null : null
const REGIAO_LABEL: Record<string, string> = { '11': 'Grande São Paulo', '18': 'Grande Rio', '16': 'Grande BH', '07': 'Grande Curitiba' }
function brlSeguro(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

const priceTable = computed(() => fipeData?.priceTable || [])
const historyChart = computed(() => fipeData?.historyChart || [])
const referenceLabel = computed(() => fipeData?.referenceLabel || '')
const fipeModelName = computed(() => fipeData?.modelName || '')
// Valor por ano-modelo juntando as versoes do modelo (shared/fipe-por-ano.ts).
// So mostra quando ha mais de um ano: com um ano so, a tabela da versao ja diz tudo.
const porAno = computed<ValorAno[]>(() => (fipeData?.porAno?.length > 1 ? fipeData.porAno : []))
const sujeito = model ? sujeitoModelo(pageData.name, model.name, pageData.type, model.genero) : ''
// Faixa da frase de abertura: com valor por ano, vai do ano mais barato ao mais
// caro entre todas as versoes; sem, fica a faixa da versao principal.
const faixaAbertura = computed(() => {
  const g = faixaGeral(porAno.value)
  if (g) return { min: brl(g.min), max: brl(g.max) }
  const t = priceTable.value
  return t.length ? { min: t[t.length - 1]?.priceFormatted, max: t[0]?.priceFormatted } : null
})
const frasesPorAno = computed(() => porAno.value.map((v) => ({ ano: v.ano, frase: fraseAno(sujeito, v, fipeData?.referencia || null) })))

// Conteudo unico SEO por modelo (resolve "Rastreada, nao indexada")
const modelSeoIntro = !isBrandPage || (isBrandPage && getModelSeoIntro(slug))
  ? getModelSeoIntro(slug)
  : null

function relatedLabel(relSlug: string): string {
  const found = findBrandModel(relSlug)
  if (found) return `${found.brand.name} ${found.model.name}`
  const b = fipeBrands[relSlug]
  return b ? b.name : relSlug
}

// Chart helpers
const chartMaxPrice = computed(() => {
  if (!historyChart.value.length) return 0
  return Math.max(...historyChart.value.map((p: any) => p.price))
})
const chartMinPrice = computed(() => {
  if (!historyChart.value.length) return 0
  return Math.min(...historyChart.value.map((p: any) => p.price))
})

function formatPrice(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function barHeight(price: number): number {
  const range = chartMaxPrice.value - chartMinPrice.value
  if (range === 0) return 80
  return 20 + ((price - chartMinPrice.value) / range) * 80
}

function onCtaClick() {
  if (import.meta.client && window.gtag) {
    const page = isBrandPage ? `tabela-fipe-${slug}` : `tabela-fipe-${slug}`
    window.gtag('event', 'cta_click', { source_page: page })
  }
}

if (isBrandPage) {
  // Brand hub page
  useHead({
    title: tituloMarca(pageData.name, currentYear),
    titleTemplate: '%s',
    meta: [
      { name: 'description', content: descricaoMarca(pageData.name, pageData.models.map(m => m.name), currentYear) },
      { name: 'keywords', content: `tabela fipe ${pageData.name.toLowerCase()}, valor fipe ${pageData.name.toLowerCase()}, preço ${pageData.name.toLowerCase()}, fipe ${pageData.name.toLowerCase()} ${currentYear}` },
      { property: 'og:title', content: tituloMarca(pageData.name, currentYear) },
      { property: 'og:description', content: `Veja os valores FIPE atualizados de todos os modelos ${pageData.name}.` },
    ],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tabela FIPE', item: 'https://placacompleta.com.br/tabela-fipe' },
            { '@type': 'ListItem', position: 2, name: pageData.name },
          ],
        }),
      },
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: `Qual o valor FIPE de um ${pageData.name}?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `Os valores FIPE dos veículos ${pageData.name} variam conforme o modelo e ano. Consulte a placa no PlacaCompleta para receber o valor FIPE exato do veículo no seu e-mail.`,
              },
            },
            {
              '@type': 'Question',
              name: `Como consultar a FIPE de um ${pageData.name} pela placa?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `Acesse placacompleta.com.br, digite a placa do ${pageData.name}, informe seu e-mail e receba o valor FIPE atualizado junto com todos os dados do veículo. Grátis e em segundos.`,
              },
            },
          ],
        }),
      },
    ],
  })
} else {
  // Brand + Model page
  const schemaScripts: any[] = [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          ...(seguroData ? [{
            '@type': 'Question',
            name: `Quanto custa o seguro do ${pageData.name} ${model!.name}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Com base em dados oficiais da SUSEP corrigidos pelo IPCA, o seguro do ${pageData.name} ${model!.name} ${seguroData.ano} custa entre ${brlSeguro(seguroData.faixa.min)} e ${brlSeguro(seguroData.faixa.max)} por ano, conforme a região do país.`,
            },
          }] : []),
          {
            '@type': 'Question',
            name: `Quanto custa um ${pageData.name} ${model!.name} na Tabela FIPE?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `O valor FIPE do ${pageData.name} ${model!.name} varia conforme o ano e versão. Para saber o valor exato, consulte a placa do veículo no PlacaCompleta e receba o preço FIPE atualizado no seu e-mail.`,
            },
          },
          // Perguntas proprias do modelo (leilao), quando existirem: e o
          // unico trecho de FAQ que difere de uma pagina pra outra.
          ...(enriquecimentoDe(slug)?.faq || []).map((q) => ({
            '@type': 'Question',
            name: q.pergunta,
            acceptedAnswer: { '@type': 'Answer', text: q.resposta },
          })),
          {
            '@type': 'Question',
            name: `Como saber o valor FIPE de um ${pageData.name} ${model!.name} usado?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `A forma mais precisa é consultar pela placa. Acesse placacompleta.com.br, informe a placa e seu e-mail, e receba o valor FIPE exato para o ano e versão específica do veículo.`,
            },
          },
          {
            '@type': 'Question',
            name: `O ${pageData.name} ${model!.name} é um bom carro para comprar?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Antes de comprar, é importante verificar os dados completos do veículo. Use o PlacaCompleta para consultar a placa e receber informações como situação, restrições, ano real, cor e valor FIPE no e-mail.`,
            },
          },
        ],
      }),
    },
  ]

  // Add BreadcrumbList schema
  schemaScripts.push({
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Tabela FIPE', item: 'https://placacompleta.com.br/tabela-fipe' },
        { '@type': 'ListItem', position: 2, name: pageData.name, item: `https://placacompleta.com.br/tabela-fipe/${pageData.slug}` },
        { '@type': 'ListItem', position: 3, name: model!.name },
      ],
    }),
  })

  // Add Product schema if we have FIPE price data
  if (priceTable.value.length > 0) {
    const lowestPrice = Math.min(...priceTable.value.map((p: any) => p.price))
    const highestPrice = Math.max(...priceTable.value.map((p: any) => p.price))
    schemaScripts.push({
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: `${pageData.name} ${model!.name}`,
        brand: {
          '@type': 'Brand',
          name: pageData.name,
        },
        description: `Valor na Tabela FIPE do ${pageData.name} ${model!.name}. Preços atualizados para todos os anos.`,
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'BRL',
          lowPrice: lowestPrice,
          highPrice: highestPrice,
          offerCount: priceTable.value.length,
        },
      }),
    })
  }

  // Schema Vehicle: SO EMITE quando temos priceTable, porque o Google exige
  // offers | review | aggregateRating para validar Vehicle como rich result.
  // Sem offers, o schema era detectado como invalido pelo Rich Results Test.
  if (priceTable.value.length > 0) {
    schemaScripts.push({
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Vehicle',
        name: `${pageData.name} ${model!.name}`,
        brand: { '@type': 'Brand', name: pageData.name },
        model: model!.name,
        vehicleConfiguration: pageData.type === 'motos' ? 'Motocicleta' : 'Automóvel',
        bodyType: pageData.type === 'motos' ? 'Motorcycle' : undefined,
        manufacturer: { '@type': 'Organization', name: pageData.name },
        url: `https://placacompleta.com.br/tabela-fipe/${slug}`,
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'BRL',
          lowPrice: Math.min(...priceTable.value.map((p: any) => p.price)),
          highPrice: Math.max(...priceTable.value.map((p: any) => p.price)),
          offerCount: priceTable.value.length,
        },
      }),
    })
  }

  useHead({
    title: tituloModelo(pageData.name, model!.name, priceTable.value, currentYear),
    titleTemplate: '%s',
    meta: [
      { name: 'description', content: descricaoModelo(pageData.name, model!.name, priceTable.value) },
      { name: 'keywords', content: `tabela fipe ${pageData.name.toLowerCase()} ${model!.name.toLowerCase()}, valor fipe ${model!.name.toLowerCase()}, preço ${pageData.name.toLowerCase()} ${model!.name.toLowerCase()}, fipe ${model!.name.toLowerCase()} ${currentYear}` },
      { property: 'og:title', content: tituloModelo(pageData.name, model!.name, priceTable.value, currentYear) },
      { property: 'og:description', content: `Veja o valor FIPE atualizado do ${pageData.name} ${model!.name} para todos os anos.` },
    ],
    script: schemaScripts,
  })
}
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
        <!-- BRAND HUB PAGE -->
        <template v-if="isBrandPage">
          <h1 class="pc-h1">Tabela FIPE {{ pageData.name }}</h1>

          <div class="pc-prose">
            <p>{{ pageData.description }}</p>

            <!-- Per-brand unique SEO copy quando disponivel -->
            <section v-if="modelSeoIntro" class="model-intro">
              <p v-for="(paragraph, i) in modelSeoIntro.intro.split('\n\n')" :key="i">
                {{ paragraph }}
              </p>
            </section>

            <div class="pc-cta">
              <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick">
                Consultar {{ pageData.name }} pela Placa
              </NuxtLink>
            </div>

            <h2>Modelos {{ pageData.name }}</h2>
            <p>Selecione o modelo para ver mais detalhes:</p>
            <div class="model-grid">
              <NuxtLink
                v-for="m in pageData.models"
                :key="m.slug"
                :to="`/tabela-fipe/${pageData.slug}-${m.slug}`"
                class="model-card"
              >
                <span class="model-card__name">{{ m.name }}</span>
              </NuxtLink>
            </div>

            <h2>Como consultar um {{ pageData.name }} pela placa?</h2>
            <ol>
              <li>Acesse a <NuxtLink to="/">página principal do PlacaCompleta</NuxtLink></li>
              <li>Digite a placa do {{ pageData.name }}</li>
              <li>Informe seu e-mail</li>
              <li>Receba marca, modelo, ano, valor FIPE e situação no e-mail</li>
            </ol>

            <h2>Dados retornados na consulta</h2>
            <ul>
              <li>Modelo e versão exata</li>
              <li>Ano de fabricação e ano modelo</li>
              <li>Cor do veículo</li>
              <li><strong>Valor atualizado na Tabela FIPE</strong></li>
              <li>Município e estado de registro</li>
              <li>Situação do veículo (em circulação, baixado)</li>
              <li>Chassi, combustível e mais</li>
            </ul>
            <p>
              Já tem a placa em mãos? Veja também débitos, indicadores de roubo/furto e
              registro de leilão, e o histórico completo no
              <NuxtLink to="/">relatório completo por placa</NuxtLink>.
            </p>

            <nav class="pc-breadcrumb">
              <NuxtLink to="/tabela-fipe">Tabela FIPE</NuxtLink>
              <span> &rsaquo; </span>
              <strong>{{ pageData.name }}</strong>
            </nav>
          </div>
        </template>

        <!-- BRAND + MODEL PAGE -->
        <template v-else>
          <h1 class="pc-h1">Tabela FIPE {{ pageData.name }} {{ model!.name }}</h1>

          <div class="pc-prose">
            <!-- Self-contained answer: lead with the actual price range when available -->
            <p v-if="priceTable.length > 0">
              O <strong>{{ pageData.name }} {{ model!.name }}</strong> na Tabela FIPE de
              {{ priceTable[0]?.referenceMonth }}/{{ priceTable[0]?.referenceYear }} vale entre
              <strong>{{ faixaAbertura?.min }}</strong> e
              <strong>{{ faixaAbertura?.max }}</strong>, dependendo do ano de fabricação
              e versão. A Tabela FIPE (Fundação Instituto de Pesquisas Econômicas) é atualizada
              mensalmente e serve de referência oficial para compra, venda, financiamento e seguro
              de veículos no Brasil. Para o valor exato do seu {{ model!.name }} específico,
              consulte pela placa abaixo.
            </p>
            <p v-else>
              Consulte o valor atualizado do <strong>{{ pageData.name }} {{ model!.name }}</strong>
              na Tabela FIPE. Para saber o preço exato para o ano e versão específica do seu veículo,
              consulte pela placa no PlacaCompleta e receba todos os dados no e-mail.
            </p>

            <!-- Per-model unique SEO copy (resolve "Rastreada, nao indexada") -->
            <section v-if="modelSeoIntro" class="model-intro">
              <p v-for="(paragraph, i) in modelSeoIntro.intro.split('\n\n')" :key="i">
                {{ paragraph }}
              </p>
              <p v-if="modelSeoIntro.related && modelSeoIntro.related.length > 0" class="related-models">
                <strong>Veja também:</strong>
                <NuxtLink
                  v-for="(rel, i) in modelSeoIntro.related"
                  :key="rel"
                  :to="`/tabela-fipe/${rel}`"
                  class="related-link"
                >{{ relatedLabel(rel) }}<span v-if="i < modelSeoIntro.related.length - 1">, </span></NuxtLink>
              </p>
            </section>

            <div class="pc-cta">
              <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick">
                Consultar {{ model!.name }} pela Placa
              </NuxtLink>
            </div>

            <!-- FIPE PRICE TABLE -->
            <template v-if="priceTable.length > 0">
              <h2>Preços FIPE {{ pageData.name }} {{ model!.name }} por Ano</h2>
              <p v-if="fipeModelName" class="fipe-ref">
                Referência: {{ fipeModelName }}
              </p>
              <div class="fipe-table-wrapper">
                <table class="fipe-table">
                  <thead>
                    <tr>
                      <th>Ano/Versão</th>
                      <th>Preço FIPE</th>
                      <th>Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in priceTable" :key="row.fuel">
                      <td>{{ rotuloAno(row.fuel) }}</td>
                      <td class="price-cell">{{ row.priceFormatted }}</td>
                      <td class="variation-cell">
                        <template v-if="row.variation !== null">
                          <span :class="row.variation >= 0 ? 'variation-up' : 'variation-down'">
                            {{ row.variation >= 0 ? '+' : '' }}{{ row.variation }}%
                          </span>
                        </template>
                        <template v-else>
                          <span class="variation-neutral">-</span>
                        </template>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="table-footnote">
                Valores atualizados em {{ priceTable[0]?.referenceMonth }}/{{ priceTable[0]?.referenceYear }}.
                Variação em relação ao mês anterior.
              </p>

              <!-- VALOR POR ANO (todas as versoes do modelo): casa com a busca
                   "modelo + ano" sem rota nova; cada ano tem ancora propria. -->
              <template v-if="frasesPorAno.length">
                <h2 id="valor-por-ano">Valor do {{ pageData.name }} {{ model!.name }} por ano</h2>
                <p class="fipe-ref">
                  Menor e maior valor entre as versões de cada ano-modelo.
                </p>
                <div class="ano-lista">
                  <div v-for="item in frasesPorAno" :id="`ano-${item.ano}`" :key="item.ano" class="ano-item">
                    <h3>{{ model!.name }} {{ item.ano }}: valor na Tabela FIPE</h3>
                    <p>{{ item.frase }}</p>
                  </div>
                </div>
              </template>

              <!-- PRICE HISTORY CHART -->
              <template v-if="historyChart.length > 1">
                <h2>Histórico de Preço FIPE {{ model!.name }}</h2>
                <p>Evolução do preço para <strong>{{ referenceLabel }}</strong>:</p>
                <div class="chart-container">
                  <div class="chart-bars">
                    <div
                      v-for="(point, i) in historyChart"
                      :key="i"
                      class="chart-bar-col"
                    >
                      <span class="chart-bar-value">{{ formatPrice(point.price) }}</span>
                      <div
                        class="chart-bar"
                        :style="{ height: barHeight(point.price) + '%' }"
                      />
                      <span class="chart-bar-label">{{ point.label }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <div class="pc-cta">
                <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick">
                  Consultar {{ model!.name }} pela Placa
                </NuxtLink>
              </div>
            </template>

            <h2>Valor FIPE {{ pageData.name }} {{ model!.name }}</h2>
            <p>
              O valor FIPE do {{ pageData.name }} {{ model!.name }} varia conforme o ano de
              fabricação, versão (motor, câmbio, acabamento) e tipo de combustível. A Tabela FIPE
              é atualizada mensalmente pela Fundação Instituto de Pesquisas Econômicas e serve como
              referência para compra, venda e seguro de veículos.
            </p>

            <div class="info-box">
              <p>
                <strong>Dica:</strong> Para saber o valor FIPE exato de um {{ pageData.name }}
                {{ model!.name }} específico, consulte a placa do veículo. Assim você recebe o
                preço FIPE para o ano e versão exata.
              </p>
              <p>
                <NuxtLink to="/tabela-fipe-por-placa">Como funciona a consulta FIPE pela placa →</NuxtLink>
              </p>
            </div>

            <template v-if="seguroData">
              <h2>Seguro do {{ pageData.name }} {{ model!.name }}: valor médio</h2>
              <p>
                Com base em dados oficiais da SUSEP (apólices reais) corrigidos pelo IPCA, o seguro
                do {{ pageData.name }} {{ model!.name }} {{ seguroData.ano }} custa entre
                <strong>{{ brlSeguro(seguroData.faixa.min) }} e {{ brlSeguro(seguroData.faixa.max) }} por ano</strong>,
                dependendo da região do país<template v-if="seguroData.pctFipe">, cerca de
                <strong>{{ seguroData.pctFipe }}% do valor FIPE</strong> do veículo</template>:
              </p>
              <div class="table-scroll">
                <table class="seguro-table">
                  <thead>
                    <tr><th>Região</th><th>Seguro médio/ano</th><th>Franquia média</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="(v, cod) in seguroData.regioes" :key="cod">
                      <td>{{ REGIAO_LABEL[cod] || cod }}</td>
                      <td><strong>{{ brlSeguro(v.premio) }}</strong></td>
                      <td>{{ brlSeguro(v.franquia) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="metodologia-seguro">
                Estimativa estatística; não substitui cotação real.
                <NuxtLink to="/cotacao">Peça uma cotação real gratuita →</NuxtLink>
              </p>
            </template>

            <h2>Como saber o valor FIPE do meu {{ model!.name }}?</h2>
            <ol>
              <li>Acesse <NuxtLink to="/">placacompleta.com.br</NuxtLink></li>
              <li>Digite a placa do {{ model!.name }}</li>
              <li>Informe seu e-mail</li>
              <li>Receba o valor FIPE exato + todos os dados no e-mail</li>
            </ol>

            <h2>Sobre o {{ pageData.name }} {{ model!.name }}</h2>
            <!-- O texto proprio do modelo (geracao, motorizacao, ano mais
                 frequente na nossa base) substitui o paragrafo generico, que
                 era a mesma frase com o nome trocado em toda pagina de
                 modelo. Sem enriquecimento, o generico segue valendo. -->
            <p v-if="enriq?.paragrafoUnico">{{ enriq.paragrafoUnico }}</p>
            <p v-else>
              O {{ model!.name }} é um dos modelos da {{ pageData.name }} disponíveis no
              mercado brasileiro. Ao consultar a placa, você recebe não apenas o valor FIPE,
              mas também informações como cor, município de registro, situação, chassi e combustível.
            </p>

            <!-- Historico de leilao: o dado que so nos temos, e o unico bloco
                 que muda de verdade de um modelo pro outro. -->
            <template v-if="enriq?.leilao">
              <h2>Histórico de leilão do {{ enriq.nomeCurto }}</h2>
              <p>{{ enriq.leilao.dado }}</p>
              <p v-if="enriq.leilao.categoria">{{ enriq.leilao.categoria }}</p>
              <p>
                Antes de comprar um {{ enriq.nomeCurto }} usado, consulte a placa do carro
                específico: a consulta cruza com nossa base de {{ BASE_LEILAO_TEXTO }} e retorna um indício de passagem quando existe registro compatível. Veja
                também o <NuxtLink to="/carro-de-leilao">guia de carro de leilão</NuxtLink><template v-if="slugLeilaoDedicado"> e a
                <NuxtLink :to="`/carro-de-leilao/${slugLeilaoDedicado}`">análise dedicada do {{ enriq.nomeCurto }}</NuxtLink></template>.
              </p>
            </template>

            <template v-if="enriq?.faq?.length">
              <h2>Perguntas frequentes sobre o {{ enriq.nomeCurto }}</h2>
              <div v-for="q in enriq.faq" :key="q.pergunta" class="pc-faq__item">
                <h3>{{ q.pergunta }}</h3>
                <p>{{ q.resposta }}</p>
              </div>
            </template>

            <h2>Outros modelos {{ pageData.name }}</h2>
            <div class="model-grid">
              <NuxtLink
                v-for="m in pageData.models.filter(m => m.slug !== model!.slug).slice(0, 8)"
                :key="m.slug"
                :to="`/tabela-fipe/${pageData.slug}-${m.slug}`"
                class="model-card"
              >
                <span class="model-card__name">{{ m.name }}</span>
              </NuxtLink>
            </div>

            <nav class="pc-breadcrumb">
              <NuxtLink to="/tabela-fipe">Tabela FIPE</NuxtLink>
              <span> &rsaquo; </span>
              <NuxtLink :to="`/tabela-fipe/${pageData.slug}`">{{ pageData.name }}</NuxtLink>
              <span> &rsaquo; </span>
              <strong>{{ model!.name }}</strong>
            </nav>
          </div>
        </template>

      <div class="pc-cta">
        <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick">
          Consultar Placa Grátis
        </NuxtLink>
      </div>
    </main>
  </div>
</template>


<style lang="scss" scoped>
// Tabela FIPE (marca / modelo) no design novo (tokens --pc-*). Conteudo, dados
// dinamicos e schema ficam intactos; muda so o visual. Cards/tabelas com
// hairline no lugar dos bevels win-*; grafico de barras no azul do acento.

.model-intro {
  margin: 20px 0;
  p { margin: 0 0 12px; line-height: 1.6; color: var(--pc-charcoal); }
  p:last-child { margin-bottom: 0; }
}

.related-models {
  font-size: 0.9375rem;
  color: var(--pc-charcoal);
  strong { color: var(--pc-ink); font-weight: 600; }
}
.related-link {
  color: var(--pc-blue);
  text-decoration: none;
  border-bottom: 1px solid rgba(31, 111, 235, 0.35);
  &:hover { border-bottom-color: var(--pc-blue); }
}

// grade de modelos
.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  margin: 12px 0 20px;
}
.model-card {
  display: block;
  padding: 12px 14px;
  border: 1px solid var(--pc-hairline);
  border-radius: 12px;
  background: var(--pc-canvas);
  text-decoration: none;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover { border-color: var(--pc-blue); background: var(--pc-cloud); }
  &__name { color: var(--pc-ink); font-weight: 600; font-size: 0.9375rem; }
}

.fipe-ref { font-size: 0.85rem; color: var(--pc-graphite); margin: 0 0 10px; }

// tabelas: hairline, cabecalho cloud, rolagem horizontal propria
.fipe-table-wrapper,
.table-scroll {
  overflow-x: auto;
  margin-bottom: 12px;
  border: 1px solid var(--pc-hairline);
  border-radius: 12px;
}

.fipe-table,
.seguro-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9375rem;
  min-width: 340px;

  th {
    background: var(--pc-cloud);
    color: var(--pc-graphite);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-align: left;
    padding: 10px 14px;
    border-bottom: 1px solid var(--pc-hairline);
  }
  td {
    padding: 10px 14px;
    border-bottom: 1px solid var(--pc-hairline);
    color: var(--pc-charcoal);
    strong { color: var(--pc-ink); font-weight: 600; }
  }
  tr:last-child td { border-bottom: 0; }
}

.price-cell { font-weight: 600; color: var(--pc-ink); }
.variation-cell { white-space: nowrap; }
.variation-up { color: var(--pc-green); font-weight: 600; }
.variation-down { color: var(--pc-red); font-weight: 600; }
.variation-neutral { color: var(--pc-steel); }

.table-footnote,
.metodologia-seguro {
  font-size: 0.8125rem;
  color: var(--pc-graphite);
  margin: 8px 0 20px;

  a { color: var(--pc-blue); text-decoration: none; border-bottom: 1px solid rgba(31, 111, 235, 0.35); }
}

// grafico de barras: barras no azul do acento, topo arredondado, hairline
.chart-container {
  border: 1px solid var(--pc-hairline);
  border-radius: 12px;
  padding: 16px 12px 12px;
  margin: 12px 0 20px;
  overflow-x: auto;
}
.chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 200px;
  min-width: min-content;
}
.chart-bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex: 1 0 44px;
  height: 100%;
}
.chart-bar-value {
  font-size: 0.6875rem;
  color: var(--pc-ink);
  font-weight: 600;
  white-space: nowrap;
}
.chart-bar {
  width: 100%;
  max-width: 40px;
  background: var(--pc-blue);
  border-radius: 4px 4px 0 0;
  min-height: 4px;
}
.chart-bar-label {
  font-size: 0.6875rem;
  color: var(--pc-graphite);
  white-space: nowrap;
}

// valor por ano: lista compacta, um bloco por ano-modelo
.ano-lista {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  margin: 12px 0 20px;
}
.ano-item {
  border: 1px solid var(--pc-hairline);
  border-radius: 12px;
  padding: 12px 14px;
  h3 { margin: 0 0 4px; font-size: 0.9375rem; color: var(--pc-ink); }
  p { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--pc-charcoal); }
}

// callout de dica
.info-box {
  background: var(--pc-cloud);
  border: 1px solid var(--pc-hairline);
  border-left: 3px solid var(--pc-blue);
  border-radius: 12px;
  padding: 16px 18px;
  margin: 20px 0;

  p { margin: 0 0 10px; color: var(--pc-charcoal); }
  p:last-child { margin-bottom: 0; }
  a { color: var(--pc-blue); text-decoration: none; border-bottom: 1px solid rgba(31, 111, 235, 0.35); }
  strong { color: var(--pc-ink); font-weight: 600; }
}
</style>
