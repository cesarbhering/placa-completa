<script setup lang="ts">
// Uma pagina por modelo: /carro-de-leilao/gol, /uno, /palio... Dezenove no
// total, todas deste mesmo template, com os numeros vindo de
// shared/leilao-modelos.ts.
//
// As frases que citam numero sao COMPOSTAS aqui, e nao escritas no arquivo de
// dados, porque as duas regras de exibicao (amostra minima pra percentual e pra
// valor) precisam valer em todas as paginas ao mesmo tempo. Se o texto fosse
// escrito modelo a modelo, mudar a regra significaria revisar dezenove textos e
// esquecer um.
import { modeloPorSlug, MINIMO_DESFECHO, MINIMO_LOTES_VALOR, MODELOS_POR_VOLUME } from '~/shared/leilao-modelos'

const route = useRoute()
const modelo = modeloPorSlug(String(route.params.slug || ''))

// Slug desconhecido e 404 de verdade, nao pagina vazia: pagina fina com nome de
// modelo inventado na URL e exatamente o que o Google pune.
if (!modelo) {
  throw createError({ statusCode: 404, statusMessage: 'Página não encontrada', fatal: true })
}

const m = modelo!
const CANONICO = `https://placacompleta.com.br/carro-de-leilao/${m.slug}`
const nf = new Intl.NumberFormat('pt-BR')

/** Percentual so quando a amostra sustenta. Ver comentario em leilao-modelos.ts. */
const mostraPercentual = m.desfechoAmostra >= MINIMO_DESFECHO && m.pctSucata != null
const mostraValor = m.lotesComValor >= MINIMO_LOTES_VALOR && m.valorMedioReais != null

const paragrafoBase = mostraPercentual
  ? `Nossa base já registra ${nf.format(m.registros)} passagens de ${m.nomeCompleto} em leilão, entre os anos ${m.anoDe} e ${m.anoAte}. `
    + `Entre os registros com o desfecho informado (${nf.format(m.desfechoAmostra)} no total), ${m.pctSucata}% foram classificados como sucata ou inservível, `
    + `e ${m.pctRecuperavel}% como recuperável. Isso não significa que todo ${m.nome} de leilão está nesse estado: o percentual é sobre o total de registros `
    + `que já passaram por leilão, uma fração pequena da frota total de ${m.nome} rodando no país.`
  : `Nossa base já registra ${nf.format(m.registros)} passagens de ${m.nomeCompleto} em leilão, entre os anos ${m.anoDe} e ${m.anoAte}. `
    + `Como é um modelo mais recente, a quantidade de registros com desfecho detalhado (sucata, recuperável, conservado) ainda é pequena pra tirar uma `
    + `conclusão estatística confiável sobre o padrão predominante, por isso preferimos não destacar percentual aqui até a amostra crescer.`

const paragrafoValor = mostraValor
  ? `Quando há valor de arremate registrado (${nf.format(m.lotesComValor)} lotes), a média histórica de arremate na base é de `
    + `R$ ${nf.format(m.valorMedioReais!)}. Esse é o valor histórico de arremate na base, não é preço de mercado atual, e não deve ser usado como `
    + `estimativa de compra hoje.`
  : `A amostra de lotes com valor de arremate registrado pra esse modelo ainda é pequena (${nf.format(m.lotesComValor)}), então não exibimos um valor `
    + `médio até a base ter mais dados.`

// Os outros modelos, pra pessoa que caiu no Gol e na verdade quer o Uno.
const outros = MODELOS_POR_VOLUME.filter((o) => o.slug !== m.slug).slice(0, 8)

function onCtaClick(origem: string) {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: 'carro-de-leilao-modelo', modelo: m.slug, origem })
  }
}

useHead({
  title: m.title.replace(' | PlacaCompleta', ''),
  meta: [
    { name: 'description', content: m.description },
    { property: 'og:title', content: m.h1 },
    { property: 'og:description', content: m.description },
  ],
  link: [{ rel: 'canonical', href: CANONICO }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: m.faq.map((q) => ({
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
          { '@type': 'ListItem', position: 2, name: 'Carro de leilão', item: 'https://placacompleta.com.br/carro-de-leilao' },
          { '@type': 'ListItem', position: 3, name: `${m.nome} de leilão`, item: CANONICO },
        ],
      }),
    },
  ],
})
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">{{ m.h1 }}</h1>

      <div class="pc-prose">
        <p class="pc-lead">{{ m.intro }}</p>

        <h2>O que a nossa base mostra sobre o {{ m.nome }}</h2>
        <p>{{ paragrafoBase }}</p>
        <p>{{ paragrafoValor }}</p>

        <h2>Como descobrir se o seu {{ m.nome }} já foi de leilão</h2>
        <p>
          O jeito prático é consultar a placa (ou o chassi) do {{ m.nome }} específico que você está
          de olho. A consulta cruza os dados do veículo com os registros de leilão da nossa base e
          retorna um indício de passagem quando existe um registro compatível: isso é diferente de
          afirmar com certeza absoluta, mas é uma informação que o documento sozinho não entrega. Pra
          entender os tipos de leilão que existem (recuperação de crédito, judicial, remoção, sucata)
          e os sinais de alerta que ajudam mesmo sem consulta, veja o
          <NuxtLink to="/carro-de-leilao">guia completo de carro de leilão</NuxtLink>.
        </p>
        <div class="pc-cta">
          <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick('meio')">
            Consultar placa do meu {{ m.nome }}
          </NuxtLink>
        </div>

        <h2>Perguntas frequentes</h2>
        <div v-for="q in m.faq" :key="q.pergunta" class="pc-faq__item">
          <h3>{{ q.pergunta }}</h3>
          <p>{{ q.resposta }}</p>
        </div>

        <h2>Outros modelos com muitos registros</h2>
        <ul class="pc-modelos">
          <li v-for="o in outros" :key="o.slug">
            <NuxtLink :to="`/carro-de-leilao/${o.slug}`">{{ o.nome }} de leilão</NuxtLink>
          </li>
        </ul>

        <div class="pc-callout">
          <p>
            <strong>Antes de comprar um {{ m.nome }} usado, consulte a placa.</strong>
            A consulta básica é gratuita. O relatório completo traz o indicador de passagem por
            leilão, junto com restrição, gravame e indicador de roubo e furto.
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
          <NuxtLink to="/carro-de-leilao">Carro de leilão</NuxtLink>
          <span> &rsaquo; </span>
          <strong>{{ m.nome }}</strong>
        </nav>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Grade de modelos: lista mesmo, sem card, pra nao competir com o CTA. */
.pc-modelos {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px 16px;
}
</style>
