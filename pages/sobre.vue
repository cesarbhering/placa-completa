<script setup lang="ts">
import { escolherTitulo } from '~/shared/seo-titulo'
import { DESCRICOES } from '~/shared/seo-meta'
import { DESCRICOES_EN } from '~/shared/seo-meta-en'
const { emIngles, rota } = useIdioma()

// English twin (Nov 6, 2026): same page, own head. The PT head below is the
// original one, untouched.
if (emIngles.value) {
  useHead({
    title: escolherTitulo(['About PlacaCompleta: Who We Are, Data Sources and Method', 'About PlacaCompleta: Who We Are and Our Data Sources']),
    titleTemplate: '%s',
    meta: [
      { name: 'description', content: DESCRICOES_EN.sobre },
      { property: 'og:title', content: 'About PlacaCompleta: Method and Privacy' },
      { property: 'og:description', content: 'How PlacaCompleta checks Brazilian vehicles by license plate: data sources, method and privacy.' },
    ],
    link: [{ rel: 'canonical', href: 'https://placacompleta.com.br/en/sobre' }],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: 'About PlacaCompleta',
          url: 'https://placacompleta.com.br/en/sobre',
          inLanguage: 'en',
          mainEntity: {
            '@type': 'Organization',
            name: 'PlacaCompleta',
            url: 'https://placacompleta.com.br',
            logo: 'https://placacompleta.com.br/logo-horizontal-600.png',
            areaServed: 'BR',
            email: 'contato@placacompleta.com.br',
            description: 'Vehicle history check by license plate in Brazil, with a full report on the vehicle: auction records, theft, liens, fines, recalls, outstanding fees and FIPE value.',
            knowsAbout: ['Vehicle history checks', 'FIPE price table', 'Mercosur license plates', 'Vehicle documentation', 'Used vehicle market in Brazil'],
          },
        }),
      },
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'PlacaCompleta', item: 'https://placacompleta.com.br' },
            { '@type': 'ListItem', position: 2, name: 'About' },
          ],
        }),
      },
    ],
  })
} else {
  useHead({
    title: escolherTitulo(['Sobre o PlacaCompleta: Quem Somos, Fontes de Dados e Metodologia', 'Sobre o PlacaCompleta: Quem Somos, Fontes e Metodologia']),
    titleTemplate: '%s',
    meta: [
      { name: 'description', content: DESCRICOES.sobre },
      { property: 'og:title', content: 'Sobre o PlacaCompleta: Metodologia e Privacidade' },
      { property: 'og:description', content: 'Transparência sobre fontes de dados, metodologia e privacidade da consulta veicular por placa do PlacaCompleta.' },
    ],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: 'Sobre o PlacaCompleta',
          url: 'https://placacompleta.com.br/sobre',
          mainEntity: {
            '@type': 'Organization',
            name: 'PlacaCompleta',
            url: 'https://placacompleta.com.br',
            logo: 'https://placacompleta.com.br/logo-horizontal-600.png',
            areaServed: 'BR',
            email: 'contato@placacompleta.com.br',
            description: 'Serviço de consulta veicular por placa no Brasil, com relatório completo do veículo: registro de leilão, roubo e furto, gravame, multas, recall, débitos e valor FIPE.',
            knowsAbout: ['Consulta veicular', 'Tabela FIPE', 'Placas Mercosul', 'Documentação veicular', 'Mercado de veículos usados no Brasil'],
          },
        }),
      },
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'PlacaCompleta', item: 'https://placacompleta.com.br' },
            { '@type': 'ListItem', position: 2, name: 'Sobre' },
          ],
        }),
      },
    ],
  })
}
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <template v-if="emIngles">
      <h1 class="pc-h1">About PlacaCompleta</h1>

      <div class="pc-prose">
        <p>
          <strong>PlacaCompleta</strong> is a Brazilian vehicle check service by license plate.
          Enter the plate of any vehicle registered in Brazil and you get the make, model,
          manufacture and model year, color, city of registration, status and the current
          value in the FIPE table (the reference price table for used vehicles in Brazil),
          in seconds, with no sign-up.
        </p>

        <h2>Where does the data come from?</h2>
        <p>
          All the data PlacaCompleta shows comes from official or licensed sources:
        </p>
        <ul>
          <li>
            <strong>Vehicle registration data</strong> (make, model, year, color, city,
            status): official public records, accessed through a licensed API. It is the
            same public data any citizen can look up, and Law 9,503/97 (the Brazilian
            Traffic Code) guarantees access to non-sensitive vehicle data.
          </li>
          <li>
            <strong>Market value</strong>: the FIPE table, the official index of the Fundação
            Instituto de Pesquisas Econômicas, updated every month. We always show the
            reference month next to the value.
          </li>
          <li>
            <strong>Market analysis (IBV blog)</strong>: IBV Auto, a used vehicle price index
            published every month by Banco BV based on real financing transactions. The
            charts we reproduce credit the original source.
          </li>
        </ul>

        <h2>How we write the IBV analysis</h2>
        <p>
          Every month, after Banco BV releases the IBV Auto report, we publish an editorial
          analysis on <NuxtLink to="/blog/tag/ibv-auto">our blog</NuxtLink> (in Portuguese):
          what the numbers mean for people buying or selling a used car. The percentages are
          copied directly from the official report; the interpretation (market context,
          practical advice) is ours. When we give an opinion, we make it clear that it is
          analysis, not financial advice.
        </p>

        <h2>What we DO NOT do</h2>
        <ul>
          <li>We do not show the owner's personal data (name, tax ID, address): we do not even have access to it.</li>
          <li>We do not sell or share the emails or phone numbers entered in a check.</li>
          <li>We do not store a history of fines or fees: they appear as indicators in the full report.</li>
        </ul>

        <h2>Privacy and the LGPD</h2>
        <p>
          We comply with the Brazilian General Data Protection Law (LGPD, Law 13,709/2018).
          The email you enter is used only to deliver the result of your check.
          Details in our <NuxtLink to="/en/politica-de-privacidade">Privacy Policy</NuxtLink>
          and our <NuxtLink to="/en/termos-de-uso">Terms of Use</NuxtLink>.
        </p>

        <h2>Contact</h2>
        <p>
          Questions, corrections or press: <strong>contato[at]placacompleta.com.br</strong>.
          Factual errors in blog analysis are fixed with an update note in the post itself.
        </p>

        <div class="pc-cta">
          <NuxtLink :to="rota('/')" class="pc-btn pc-btn--primary">
            Check a plate
          </NuxtLink>
        </div>

        <nav class="pc-breadcrumb">
          <NuxtLink :to="rota('/')">PlacaCompleta</NuxtLink>
          <span> &rsaquo; </span>
          <strong>About</strong>
        </nav>
      </div>
      </template>
      <template v-else>
      <h1 class="pc-h1">Sobre o PlacaCompleta</h1>

      <div class="pc-prose">
        <p>
              O <strong>PlacaCompleta</strong> é um serviço brasileiro e gratuito de consulta
              veicular por placa. Digitando a placa de qualquer veículo registrado no Brasil,
              você recebe marca, modelo, ano de fabricação e modelo, cor, município de registro,
              situação e o valor atualizado na Tabela FIPE, em segundos, sem cadastro.
            </p>

            <h2>De onde vêm os dados?</h2>
            <p>
              Todos os dados exibidos pelo PlacaCompleta vêm de fontes oficiais ou licenciadas:
            </p>
            <ul>
              <li>
                <strong>Dados cadastrais do veículo</strong> (marca, modelo, ano, cor, município,
                situação): bases públicas oficiais, acessadas por meio de API licenciada. São os
                mesmos dados públicos que qualquer cidadão pode consultar, e a Lei 9.503/97
                (Código de Trânsito Brasileiro) garante o acesso a dados não sensíveis do veículo.
              </li>
              <li>
                <strong>Valor de mercado</strong>: Tabela FIPE, índice oficial da Fundação
                Instituto de Pesquisas Econômicas, atualizado mensalmente. Citamos sempre o mês
                de referência junto ao valor.
              </li>
              <li>
                <strong>Análises de mercado (blog IBV)</strong>: IBV Auto, índice de preços de
                veículos usados publicado mensalmente pelo banco BV com base em transações reais
                de financiamento. Os gráficos reproduzidos citam a fonte original.
              </li>
            </ul>

            <h2>Metodologia das análises IBV</h2>
            <p>
              Todo mês, após a divulgação do relatório IBV Auto pelo banco BV, publicamos uma
              análise editorial em <NuxtLink to="/blog/tag/ibv-auto">nosso blog</NuxtLink>: o que os números
              significam para quem está comprando ou vendendo um carro usado. Os percentuais são
              transcritos diretamente do relatório oficial; a interpretação (contexto de mercado,
              recomendações práticas) é nossa. Quando opinamos, deixamos claro que é análise,
              não recomendação financeira.
            </p>

            <h2>O que NÃO fazemos</h2>
            <ul>
              <li>Não exibimos dados pessoais do proprietário (nome, CPF, endereço): nem temos acesso a eles.</li>
              <li>Não vendemos nem compartilhamos os e-mails ou telefones informados na consulta.</li>
              <li>Não armazenamos histórico de multas ou débitos: eles aparecem como indicadores no relatório completo.</li>
            </ul>

            <h2>Privacidade e LGPD</h2>
            <p>
              Operamos em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018).
              O e-mail informado é usado exclusivamente para entregar o resultado da consulta.
              Detalhes na nossa <NuxtLink to="/politica-de-privacidade">Política de Privacidade</NuxtLink>
              e nos <NuxtLink to="/termos-de-uso">Termos de Uso</NuxtLink>.
            </p>

            <h2>Contato</h2>
            <p>
              Dúvidas, correções ou imprensa: <strong>contato[at]placacompleta.com.br</strong>.
              Erros factuais em análises do blog são corrigidos com nota de atualização no próprio post.
            </p>

            <div class="pc-cta">
              <NuxtLink to="/" class="pc-btn pc-btn--primary">
                Consultar Placa Grátis
              </NuxtLink>
            </div>

        <nav class="pc-breadcrumb">
          <NuxtLink to="/">PlacaCompleta</NuxtLink>
          <span> &rsaquo; </span>
          <strong>Sobre</strong>
        </nav>
      </div>
      </template>
    </main>
  </div>
</template>

