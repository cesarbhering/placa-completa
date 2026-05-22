<script setup lang="ts">
function onCtaClick() {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: 'como-consultar-placa' })
  }
}

useHead({
  title: 'Como Consultar Placa de Veículo Grátis - Passo a Passo',
  meta: [
    { name: 'description', content: 'Aprenda como consultar a placa de qualquer veículo gratuitamente. Passo a passo simples para verificar dados como marca, modelo, FIPE e situação.' },
    { name: 'keywords', content: 'como consultar placa, como pesquisar placa de carro, como verificar placa, consulta gratuita de placa, passo a passo consulta placa' },
    { property: 'og:title', content: 'Como Consultar Placa de Veículo Grátis' },
    { property: 'og:description', content: 'Passo a passo para consultar qualquer placa de veículo gratuitamente e receber os dados no seu e-mail.' },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'Como consultar placa de veículo grátis',
        description: 'Passo a passo para consultar qualquer placa de veículo no Brasil gratuitamente.',
        totalTime: 'PT1M',
        step: [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Acesse o PlacaCompleta',
            text: 'Acesse placacompleta.com.br pelo navegador no celular ou computador.',
            url: 'https://placacompleta.com.br',
          },
          {
            '@type': 'HowToStep',
            position: 2,
            name: 'Informe seu e-mail',
            text: 'Digite um e-mail válido para receber os dados do veículo.',
          },
          {
            '@type': 'HowToStep',
            position: 3,
            name: 'Digite a placa',
            text: 'Informe a placa no formato Mercosul (ABC1D23) ou antigo (ABC1234).',
          },
          {
            '@type': 'HowToStep',
            position: 4,
            name: 'Receba o resultado',
            text: 'Em segundos você recebe marca, modelo, ano, cor, valor FIPE e situação do veículo no e-mail.',
          },
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
            name: 'Como consultar a placa de um carro grátis?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Acesse placacompleta.com.br, digite a placa do veículo (formato Mercosul ABC1D23 ou antigo ABC1234), informe seu e-mail e clique em consultar. Em segundos você recebe marca, modelo, ano, FIPE e situação no e-mail. É 100% grátis, sem cadastro.',
            },
          },
          {
            '@type': 'Question',
            name: 'Preciso pagar para consultar uma placa?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Não. A consulta de placa no PlacaCompleta é totalmente gratuita. Os dados são públicos, mantidos pelo DETRAN, e a Lei 9.503/97 (Código de Trânsito Brasileiro) garante o direito à consulta de dados não sensíveis.',
            },
          },
          {
            '@type': 'Question',
            name: 'Quais dados aparecem na consulta de placa?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'A consulta retorna marca, modelo, ano de fabricação, ano modelo, cor oficial, município e estado de registro, situação do veículo, valor atualizado na Tabela FIPE, tipo de combustível, chassi parcial e categoria do veículo (carro, moto, caminhão, ônibus, van).',
            },
          },
          {
            '@type': 'Question',
            name: 'Posso consultar placa pelo celular?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Sim. O PlacaCompleta é um Progressive Web App (PWA) otimizado para celular. Você pode instalar como aplicativo na tela inicial e usar offline depois da primeira consulta.',
            },
          },
          {
            '@type': 'Question',
            name: 'A consulta de placa funciona com placa Mercosul?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Sim. O PlacaCompleta funciona com placas Mercosul (formato ABC1D23) e placas antigas (formato ABC1234). Não é preciso converter — basta digitar como está escrito.',
            },
          },
        ],
      }),
    },
  ],
})
</script>

<template>
  <div class="desktop pseo-page">
    <main>
      <div class="win-window">
      <div class="win-window__titlebar">
        <span>Como Consultar</span>
        <div class="win-window__titlebar-buttons">
          <span class="win-window__titlebar-btn">_</span>
          <span class="win-window__titlebar-btn">□</span>
          <span class="win-window__titlebar-btn">×</span>
        </div>
      </div>
      <div class="win-window__body">
        <h1 class="seo-title">Como Consultar Placa de Veículo</h1>

        <div class="seo-content">
          <p>
            Consultar uma placa de veículo nunca foi tão fácil. Com o <strong>Placa Completa</strong>,
            você descobre tudo sobre qualquer veículo em poucos cliques, sem precisar criar conta.
          </p>

          <h2>Passo a passo</h2>

          <div class="step">
            <div class="step__number">1</div>
            <div class="step__text">
              <strong>Acesse o Placa Completa</strong><br />
              Entre em <NuxtLink to="/">placacompleta.com.br</NuxtLink>
            </div>
          </div>

          <div class="step">
            <div class="step__number">2</div>
            <div class="step__text">
              <strong>Informe seu e-mail</strong><br />
              Os resultados serão enviados para o e-mail informado.
            </div>
          </div>

          <div class="step">
            <div class="step__number">3</div>
            <div class="step__text">
              <strong>Digite a placa</strong><br />
              Funciona com placa antiga (ABC1234) e Mercosul (ABC1D23).
            </div>
          </div>

          <div class="step">
            <div class="step__number">4</div>
            <div class="step__text">
              <strong>Clique em "Consultar Placa"</strong><br />
              Em segundos você recebe tudo no e-mail: marca, modelo, ano, FIPE, situação e mais.
            </div>
          </div>

          <h2>Por que usar o Placa Completa?</h2>
          <ul>
            <li><strong>100% grátis</strong> — sem custos escondidos</li>
            <li><strong>Sem cadastro</strong> — só precisa do e-mail</li>
            <li><strong>Rápido</strong> — resultado em segundos</li>
            <li><strong>Completo</strong> — inclui tabela FIPE, chassi, município</li>
            <li><strong>Seguro</strong> — seus dados ficam protegidos</li>
          </ul>

          <h2>Quando é útil consultar a placa?</h2>
          <ul>
            <li>Na <strong>compra de veículo usado</strong> — verifique restrições e dados</li>
            <li>Para <strong>confirmar informações</strong> de um veículo</li>
            <li>Para <strong>saber o valor FIPE</strong> atualizado</li>
            <li>Para <strong>lojistas</strong> que precisam consultar placas diariamente</li>
          </ul>
        </div>

        <div class="text-center mt-md">
          <NuxtLink to="/" class="win-btn win-btn--primary" @click="onCtaClick">
            Consultar Agora
          </NuxtLink>
        </div>

      </div>
    </div>
    </main>
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

  ul {
    padding-left: $space-lg;
    margin-bottom: $space-md;
  }

  li { margin-bottom: $space-xs; }

  a {
    color: $smart-blue;
    text-decoration: underline;
  }
}

.step {
  display: flex;
  align-items: flex-start;
  gap: $space-md;
  margin-bottom: $space-md;
  padding: $space-sm;
  @include win-border-sunken;
  background: $win-white;

  &__number {
    font-family: $font-display;
    font-size: 1.5rem;
    color: $navy-electric;
    font-weight: 700;
    min-width: 28px;
    text-align: center;
  }

  &__text {
    font-size: 0.8125rem;
    line-height: 1.5;
  }
}
</style>
