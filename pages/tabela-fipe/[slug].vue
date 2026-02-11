<script setup lang="ts">
import { fipeBrands, findBrandModel } from '~/data/fipe-brands'

const route = useRoute()
const slug = route.params.slug as string

// Check if it's a brand page or brand-model page
const brand = fipeBrands[slug]
const brandModel = !brand ? findBrandModel(slug) : null

if (!brand && !brandModel) {
  throw createError({ statusCode: 404, message: 'Página não encontrada' })
}

const isBrandPage = !!brand
const pageData = isBrandPage ? brand : brandModel!.brand
const model = brandModel?.model

function onCtaClick() {
  if (import.meta.client && window.gtag) {
    const page = isBrandPage ? `tabela-fipe-${slug}` : `tabela-fipe-${slug}`
    window.gtag('event', 'cta_click', { source_page: page })
  }
}

if (isBrandPage) {
  // Brand hub page
  useHead({
    title: `Tabela FIPE ${pageData.name} ${new Date().getFullYear()} - Todos os Modelos | PlacaCompleta`,
    meta: [
      { name: 'description', content: `Consulte a Tabela FIPE ${pageData.name} atualizada. Veja preços de todos os modelos: ${pageData.models.slice(0, 5).map(m => m.name).join(', ')} e mais. Grátis.` },
      { name: 'keywords', content: `tabela fipe ${pageData.name.toLowerCase()}, valor fipe ${pageData.name.toLowerCase()}, preço ${pageData.name.toLowerCase()}, fipe ${pageData.name.toLowerCase()} ${new Date().getFullYear()}` },
      { property: 'og:title', content: `Tabela FIPE ${pageData.name} - Preços Atualizados` },
      { property: 'og:description', content: `Veja os valores FIPE atualizados de todos os modelos ${pageData.name}.` },
    ],
    script: [
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
  useHead({
    title: `Tabela FIPE ${pageData.name} ${model!.name} ${new Date().getFullYear()} - Valor Atualizado | PlacaCompleta`,
    meta: [
      { name: 'description', content: `Consulte o valor na Tabela FIPE do ${pageData.name} ${model!.name}. Preço atualizado para todos os anos. Consulte pela placa e receba o valor exato no e-mail.` },
      { name: 'keywords', content: `tabela fipe ${pageData.name.toLowerCase()} ${model!.name.toLowerCase()}, valor fipe ${model!.name.toLowerCase()}, preço ${pageData.name.toLowerCase()} ${model!.name.toLowerCase()}, fipe ${model!.name.toLowerCase()} ${new Date().getFullYear()}` },
      { property: 'og:title', content: `Tabela FIPE ${pageData.name} ${model!.name} - Preço Atualizado` },
      { property: 'og:description', content: `Veja o valor FIPE atualizado do ${pageData.name} ${model!.name} para todos os anos.` },
    ],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: `Quanto custa um ${pageData.name} ${model!.name} na Tabela FIPE?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `O valor FIPE do ${pageData.name} ${model!.name} varia conforme o ano e versão. Para saber o valor exato, consulte a placa do veículo no PlacaCompleta e receba o preço FIPE atualizado no seu e-mail.`,
              },
            },
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
    ],
  })
}
</script>

<template>
  <div class="desktop">
    <div class="win-window">
      <div class="win-window__titlebar">
        <span>{{ isBrandPage ? `FIPE ${pageData.name}` : `FIPE ${pageData.name} ${model!.name}` }}</span>
        <div class="win-window__titlebar-buttons">
          <span class="win-window__titlebar-btn">_</span>
          <span class="win-window__titlebar-btn">&square;</span>
          <span class="win-window__titlebar-btn">&times;</span>
        </div>
      </div>
      <div class="win-window__body">
        <!-- BRAND HUB PAGE -->
        <template v-if="isBrandPage">
          <h1 class="seo-title">Tabela FIPE {{ pageData.name }}</h1>

          <div class="seo-content">
            <p>{{ pageData.description }}</p>

            <div class="text-center mt-md mb-md">
              <NuxtLink to="/" class="win-btn win-btn--primary" @click="onCtaClick">
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
              <li>Situação (restrições, débitos)</li>
              <li>Chassi, combustível e mais</li>
            </ul>

            <nav class="breadcrumb">
              <NuxtLink to="/tabela-fipe">Tabela FIPE</NuxtLink>
              <span> &rsaquo; </span>
              <strong>{{ pageData.name }}</strong>
            </nav>
          </div>
        </template>

        <!-- BRAND + MODEL PAGE -->
        <template v-else>
          <h1 class="seo-title">Tabela FIPE {{ pageData.name }} {{ model!.name }}</h1>

          <div class="seo-content">
            <p>
              Consulte o valor atualizado do <strong>{{ pageData.name }} {{ model!.name }}</strong>
              na Tabela FIPE. Para saber o preço exato para o ano e versão específica do seu veículo,
              consulte pela placa no PlacaCompleta e receba todos os dados no e-mail.
            </p>

            <div class="text-center mt-md mb-md">
              <NuxtLink to="/" class="win-btn win-btn--primary" @click="onCtaClick">
                Consultar {{ model!.name }} pela Placa
              </NuxtLink>
            </div>

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
            </div>

            <h2>Como saber o valor FIPE do meu {{ model!.name }}?</h2>
            <ol>
              <li>Acesse <NuxtLink to="/">placacompleta.com.br</NuxtLink></li>
              <li>Digite a placa do {{ model!.name }}</li>
              <li>Informe seu e-mail</li>
              <li>Receba o valor FIPE exato + todos os dados no e-mail</li>
            </ol>

            <h2>Sobre o {{ pageData.name }} {{ model!.name }}</h2>
            <p>
              O {{ model!.name }} é um dos modelos da {{ pageData.name }} disponíveis no
              mercado brasileiro. Ao consultar a placa, você recebe não apenas o valor FIPE,
              mas também informações como cor, município de registro, situação, chassi e combustível.
            </p>

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

            <nav class="breadcrumb">
              <NuxtLink to="/tabela-fipe">Tabela FIPE</NuxtLink>
              <span> &rsaquo; </span>
              <NuxtLink :to="`/tabela-fipe/${pageData.slug}`">{{ pageData.name }}</NuxtLink>
              <span> &rsaquo; </span>
              <strong>{{ model!.name }}</strong>
            </nav>
          </div>
        </template>

        <div class="text-center mt-md">
          <NuxtLink to="/" class="win-btn win-btn--primary" @click="onCtaClick">
            Consultar Placa Grátis
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.seo-title {
  font-family: $font-display;
  font-size: 1.75rem;
  color: $navy-electric;
  text-align: center;
  margin-bottom: $space-md;
}

.seo-content {
  font-size: 0.8125rem;
  line-height: 1.6;
  color: $graphite;

  p { margin-bottom: $space-md; }

  h2 {
    font-family: $font-display;
    font-size: 1.25rem;
    color: $navy-electric;
    margin: $space-md 0 $space-sm;
  }

  ul, ol {
    padding-left: $space-lg;
    margin-bottom: $space-md;
  }

  li { margin-bottom: $space-xs; }

  a {
    color: $smart-blue;
    text-decoration: underline;
  }
}

.model-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $space-xs;
  margin-bottom: $space-md;
}

.model-card {
  @include win-border-raised;
  background: $win-bg;
  padding: $space-xs $space-sm;
  text-align: center;
  text-decoration: none;
  cursor: pointer;

  &:active {
    border-color: $win-darker $win-white $win-white $win-darker;
  }

  &:hover {
    background: $powder-blue;
  }

  &__name {
    font-family: $font-display;
    font-size: 0.9375rem;
    color: $graphite;
  }
}

.info-box {
  @include win-border-sunken;
  background: $powder-blue;
  padding: $space-sm $space-md;
  margin: $space-sm 0;

  p {
    margin-bottom: 0;
  }
}

.breadcrumb {
  font-size: 0.75rem;
  margin-top: $space-lg;
  padding-top: $space-sm;
  border-top: 1px solid $win-dark;

  a {
    color: $smart-blue;
    text-decoration: underline;
  }

  span {
    color: $win-dark;
    margin: 0 2px;
  }
}
</style>
