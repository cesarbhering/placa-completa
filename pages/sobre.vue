<script setup lang="ts">
useHead({
  title: 'Sobre o PlacaCompleta — Quem Somos, Fontes de Dados e Metodologia',
  meta: [
    { name: 'description', content: 'Conheça o PlacaCompleta: como funciona a consulta veicular gratuita, de onde vêm os dados (DETRAN, FIPE, banco BV), metodologia das análises IBV e compromisso com a LGPD.' },
    { property: 'og:title', content: 'Sobre o PlacaCompleta — Fontes de Dados e Metodologia' },
    { property: 'og:description', content: 'Transparência sobre fontes de dados, metodologia e privacidade da consulta veicular gratuita mais simples do Brasil.' },
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
          description: 'Serviço gratuito de consulta veicular por placa no Brasil. Dados de marca, modelo, ano, cor, situação e valor FIPE, enviados por e-mail em segundos.',
          knowsAbout: ['Consulta veicular', 'Tabela FIPE', 'Placas Mercosul', 'DETRAN', 'Mercado de veículos usados no Brasil'],
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
</script>

<template>
  <div class="desktop content-page">
    <main>
      <div class="win-window">
        <div class="win-window__titlebar">
          <span>Sobre o PlacaCompleta</span>
          <div class="win-window__titlebar-buttons">
            <span class="win-window__titlebar-btn">_</span>
            <span class="win-window__titlebar-btn">&square;</span>
            <span class="win-window__titlebar-btn">&times;</span>
          </div>
        </div>
        <div class="win-window__body">
          <h1 class="seo-title">Sobre o PlacaCompleta</h1>

          <div class="seo-content">
            <p>
              O <strong>PlacaCompleta</strong> é um serviço brasileiro e gratuito de consulta
              veicular por placa. Digitando a placa de qualquer veículo registrado no Brasil,
              você recebe marca, modelo, ano de fabricação e modelo, cor, município de registro,
              situação e o valor atualizado na Tabela FIPE — em segundos, sem cadastro.
            </p>

            <h2>De onde vêm os dados?</h2>
            <p>
              Todos os dados exibidos pelo PlacaCompleta vêm de fontes oficiais ou licenciadas:
            </p>
            <ul>
              <li>
                <strong>Dados cadastrais do veículo</strong> (marca, modelo, ano, cor, município,
                situação): bases públicas mantidas pelos DETRANs estaduais e pelo DENATRAN,
                acessadas por meio de API licenciada. São os mesmos dados públicos que qualquer
                cidadão pode consultar — a Lei 9.503/97 (Código de Trânsito Brasileiro) garante
                o acesso a dados não sensíveis do veículo.
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
              análise editorial em <NuxtLink to="/ibv">nosso blog</NuxtLink>: o que os números
              significam para quem está comprando ou vendendo um carro usado. Os percentuais são
              transcritos diretamente do relatório oficial; a interpretação (contexto de mercado,
              recomendações práticas) é nossa. Quando opinamos, deixamos claro que é análise —
              não recomendação financeira.
            </p>

            <h2>O que NÃO fazemos</h2>
            <ul>
              <li>Não exibimos dados pessoais do proprietário (nome, CPF, endereço) — nem temos acesso a eles.</li>
              <li>Não vendemos nem compartilhamos os e-mails ou telefones informados na consulta.</li>
              <li>Não armazenamos histórico de multas ou débitos — para isso, indicamos sempre o DETRAN do seu estado.</li>
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

            <div class="text-center mt-md">
              <NuxtLink to="/" class="win-btn win-btn--primary">
                Consultar Placa Grátis
              </NuxtLink>
            </div>

            <nav class="breadcrumb">
              <NuxtLink to="/">PlacaCompleta</NuxtLink>
              <span> &rsaquo; </span>
              <strong>Sobre</strong>
            </nav>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
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
