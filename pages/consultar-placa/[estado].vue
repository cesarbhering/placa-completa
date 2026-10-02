<script setup lang="ts">
import { tituloEstado, descricaoEstado } from '~/shared/estado-seo'
import { states } from '~/data/states'
import { capitalSlugByStateSlug } from '~/data/capitals'
import { getStateSeoIntro } from '~/data/state-seo-intros'
import seguroEstadosData from '~/data/seguro-estados.json'
import { REGIONAL } from '~/shared/enriquecimento-regional'
import { ESTADO_DETRAN } from '~/shared/estado-detran'
import seguroEletricosData from '~/data/seguro-eletricos.json'

// Seguro medio do estado (cesta de populares; compilado da base SUSEP)
// e disponibilidade da pagina de eletricos pro internal linking

const route = useRoute()
const slug = route.params.estado as string
const data = states[slug]

const seguroUf = (seguroEstadosData as any).estados?.[data?.uf] || null
const blocoLeilao = computed(() => (data?.uf ? REGIONAL[data.uf] : undefined))
const detranUf = computed(() => (data?.uf ? ESTADO_DETRAN[data.uf] : undefined))
const temEletrico = Boolean(data && (seguroEletricosData as Record<string, any>)[data.uf]?.mediaPremio)
function brlSeguro(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

if (!data) {
  throw createError({ statusCode: 404, message: 'Estado não encontrado' })
}

const capitalSlug = capitalSlugByStateSlug[slug]
const seoIntro = getStateSeoIntro(slug)

function onCtaClick() {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: `consultar-placa-${data.uf.toLowerCase()}` })
  }
}

useHead({
  title: tituloEstado(data.uf, data.name),
  meta: [
    { name: 'description', content: descricaoEstado(data.uf, data.name) },
    { name: 'keywords', content: `consulta placa detran ${data.uf.toLowerCase()}, consultar placa ${data.uf}, consulta placa ${data.name.toLowerCase()}, consultar veículo ${data.name.toLowerCase()}, consulta placa ${data.uf} leilão` },
    { property: 'og:title', content: tituloEstado(data.uf, data.name) },
    { property: 'og:description', content: `Consulte qualquer placa registrada em ${data.name} e veja marca, modelo, ano, situação e valor FIPE na hora.` },
  ],
  link: [
    { rel: 'canonical', href: `https://placacompleta.com.br/consultar-placa/${slug}` },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Consultar Placa', item: 'https://placacompleta.com.br' },
          { '@type': 'ListItem', position: 2, name: `${data.name} (${data.uf})` },
        ],
      }),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: data.faqs.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      }),
    },
    {
      // GovernmentService schema apontando pro DETRAN local
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'GovernmentService',
        name: `DETRAN ${data.uf}`,
        serviceType: 'Consulta veicular',
        serviceArea: { '@type': 'State', name: data.name },
        provider: { '@type': 'GovernmentOrganization', name: `DETRAN ${data.uf}`, url: data.detranSite },
        availableChannel: { '@type': 'ServiceChannel', serviceUrl: data.detranSite },
      }),
    },
  ],
})
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">Consultar Placa de Veículo em {{ data.name }}</h1>

      <div class="pc-prose">
        <p>
            Consulte gratuitamente a placa de qualquer veículo registrado em
            <strong>{{ data.name }} ({{ data.uf }})</strong> e receba os dados completos no
            seu e-mail em segundos. {{ data.context }}
          </p>

          <!-- Conteudo SEO extendido por estado (resolve "Rastreada, nao indexada") -->
          <section v-if="seoIntro" class="pc-callout">
            <p v-for="(p, i) in seoIntro.extendedIntro.split('\n\n')" :key="`intro-${i}`">
              {{ p }}
            </p>
          </section>

          <div class="pc-cta">
            <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick">
              Consultar Placa de {{ data.uf }} Agora
            </NuxtLink>
          </div>

          <h2>Como consultar uma placa de {{ data.name }}?</h2>
          <ol>
            <li>Acesse a <NuxtLink to="/">página principal do PlacaCompleta</NuxtLink></li>
            <li>Digite a placa do veículo (formato ABC1D23 ou ABC1234)</li>
            <li>Informe seu e-mail</li>
            <li>Clique em "Receber Dados no E-mail"</li>
            <li>Em segundos você recebe marca, modelo, ano, FIPE, situação e mais.</li>
          </ol>

          <h2>Dados retornados na consulta</h2>
          <ul>
            <li>Marca e modelo completo</li>
            <li>Ano de fabricação e ano modelo</li>
            <li>Cor do veículo</li>
            <li>Valor atualizado na tabela FIPE</li>
            <li>Município de registro em {{ data.uf }}</li>
            <li>Situação do veículo (em circulação, baixado)</li>
            <li>Chassi (parcial), combustível e tipo</li>
          </ul>
          <p>
            Precisa de mais? O <NuxtLink to="/">relatório completo</NuxtLink> traz débitos,
            indicadores de roubo/furto e registro de leilão, e o histórico completo do veículo.
          </p>

          <h2>Placas de {{ data.name }}</h2>
          <p>
            {{ data.plateRanges }}. Com a adoção da placa Mercosul, a identificação do estado
            passou a ser feita pelo município de registro do veículo, e não mais pelas letras iniciais.
          </p>

          <h2>IPVA {{ data.name }} {{ new Date().getFullYear() }}</h2>
          <p>{{ data.ipvaInfo }}</p>

          <!-- Bloco de leilao do estado: hoje so PR e CE, que sao as duas
               UFs com levantamento pronto. Estado sem bloco segue como estava,
               em vez de ganhar um texto generico igual ao das outras. -->
          <template v-if="blocoLeilao">
            <h2>{{ blocoLeilao.titulo }}</h2>
            <p>{{ blocoLeilao.texto }}</p>
            <p>
              Veja também o <NuxtLink to="/carro-de-leilao">guia de carro de leilão</NuxtLink>,
              com os tipos de leilão que existem e o que cada um significa na hora de negociar.
            </p>
            <div v-for="q in blocoLeilao.faq" :key="q.pergunta" class="pc-faq__item">
              <h3>{{ q.pergunta }}</h3>
              <p>{{ q.resposta }}</p>
            </div>
          </template>

          <template v-if="detranUf">
            <h2>O que você resolve no {{ detranUf.orgao }}</h2>
            <ul>
              <li v-for="sv in detranUf.servicos" :key="sv">{{ sv }}</li>
            </ul>
            <p>
              Site oficial:
              <a :href="data.detranSite" target="_blank" rel="noopener noreferrer">{{ data.detranSite }}</a>.
              O PlacaCompleta não é o {{ detranUf.orgao }} nem órgão público: os serviços acima
              são feitos no site oficial. Aqui você consulta a placa e vê o histórico do veículo
              antes de comprar.
            </p>

            <h2>O que a nossa base mostra em {{ data.name }}</h2>
            <div class="pc-callout">
              <p v-for="d in detranUf.dados" :key="d.texto">{{ d.texto }}</p>
            </div>
          </template>
          <template v-else>
            <h2>DETRAN-{{ data.uf }}</h2>
            <p>
              O DETRAN de {{ data.name }} fica na capital, {{ data.capital }}.
              Para serviços online como transferência, licenciamento e consulta de multas,
              acesse o site oficial:
              <a :href="data.detranSite" target="_blank" rel="noopener noreferrer">{{ data.detranSite }}</a>.
            </p>
          </template>
          <p v-if="seoIntro">{{ seoIntro.detranInfo }}</p>

          <template v-if="seoIntro">
            <h2>Dicas para comprar veículo em {{ data.name }}</h2>
            <p>{{ seoIntro.tipsBuying }}</p>
          </template>

          <template v-if="capitalSlug">
            <h2>Consultar placa em {{ data.capital }}</h2>
            <p>
              A maior parte da frota de {{ data.name }} está registrada em {{ data.capital }}.
              Veja a
              <NuxtLink :to="`/consultar-placa/capital/${capitalSlug}`">página dedicada para consulta de placas em {{ data.capital }}</NuxtLink>,
              com informações específicas sobre DETRAN, IPVA e principais bairros da capital.
            </p>
          </template>

          <template v-if="seguroUf?.mediaPopulares">
            <h2>Seguro de carro em {{ data.name }}</h2>
            <p>
              Com base em dados oficiais da SUSEP corrigidos pelo IPCA, o seguro dos carros
              populares mais vendidos (Onix, HB20, Gol, Strada e Corolla) custa em média
              <strong>{{ brlSeguro(seguroUf.mediaPopulares) }} por ano</strong> em
              {{ data.name }} (região {{ seguroUf.regiao.nome }}). O valor exato depende do
              modelo, do ano e do perfil do condutor.
              <NuxtLink to="/cotacao">Peça uma cotação real gratuita →</NuxtLink>
            </p>
            <p v-if="temEletrico">
              Tem ou pensa em ter um elétrico? Veja o
              <NuxtLink :to="`/seguro/carro-eletrico/${slug}`">seguro médio de carro elétrico em {{ data.name }}</NuxtLink>.
            </p>
          </template>

          <EntendaOsTermos />

          <h2>Perguntas frequentes</h2>
          <div v-for="faq in data.faqs" :key="faq.question" class="pc-faq__item">
            <h3>{{ faq.question }}</h3>
            <p>{{ faq.answer }}</p>
          </div>
        </div>

      <div class="pc-cta">
        <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick">
          Consultar Placa Grátis
        </NuxtLink>
      </div>
    </main>
  </div>
</template>

