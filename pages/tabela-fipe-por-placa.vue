<script setup lang="ts">
import { descricaoTabelaFipePorPlaca } from '~/shared/seo-meta'
import { fipeBrands } from '~/data/fipe-brands'
import { states } from '~/data/states'

function onCtaClick() {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: 'tabela-fipe-por-placa' })
  }
}

const ptMonths = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const _now = new Date()
const currentMonth = ptMonths[_now.getMonth()]
const currentYear = _now.getFullYear()

// Top brand links (for internal linking)
const topBrands = ['volkswagen', 'fiat', 'chevrolet', 'toyota', 'honda', 'hyundai', 'renault', 'jeep'].filter(s => fipeBrands[s])

// Top state links (high search volume)
const topStates = ['sao-paulo', 'minas-gerais', 'rio-de-janeiro', 'parana', 'rio-grande-do-sul', 'bahia', 'santa-catarina', 'goias'].filter(s => states[s])

// Illustrative FIPE evolution chart (Honda Civic 2020 EXL as anchor example)
// Static QuickChart URL — server-rendered SVG image, no JS needed.
const chartConfig = {
  type: 'line',
  data: {
    labels: ['Jan 2025', 'Mar 2025', 'Jun 2025', 'Set 2025', 'Dez 2025', 'Mar 2026', 'Jun 2026'],
    datasets: [{
      label: 'Honda Civic EXL 2020 (R$)',
      data: [122500, 121800, 120400, 118900, 117300, 115800, 114200],
      borderColor: '#1f6feb',
      backgroundColor: 'rgba(31,111,235,0.1)',
      fill: true,
      tension: 0.3,
    }],
  },
  options: {
    title: { display: true, text: 'Evolução FIPE: exemplo de modelo' },
    legend: { display: true, position: 'bottom' },
    scales: { yAxes: [{ ticks: { beginAtZero: false } }] },
  },
}
const chartUrl = `https://quickchart.io/chart?w=640&h=320&bkg=white&c=${encodeURIComponent(JSON.stringify(chartConfig))}`

const faqs = [
  {
    q: 'A consulta da Tabela FIPE pela placa é grátis?',
    a: 'Sim. No PlacaCompleta, você consulta o valor FIPE de qualquer veículo pela placa sem pagar nada. Basta informar a placa e um e-mail válido, e o resultado chega em segundos com marca, modelo, ano e o preço FIPE atualizado do mês de referência.',
  },
  {
    q: 'Qual a diferença entre o valor FIPE e o preço de mercado (Webmotors, OLX)?',
    a: 'A Tabela FIPE é uma média estatística calculada pela Fundação Instituto de Pesquisas Econômicas a partir de anúncios e transações. O preço de mercado em portais como Webmotors ou OLX é o que vendedores estão pedindo, e costuma ficar de 5% a 15% acima da FIPE para deixar margem de negociação. O valor de venda real geralmente fica entre o pedido no anúncio e a FIPE.',
  },
  {
    q: 'A Tabela FIPE muda todo mês?',
    a: 'Sim. A FIPE é atualizada mensalmente, geralmente na primeira semana do mês. Cada mês de referência reflete os preços coletados nas semanas anteriores. Por isso, o valor FIPE do seu carro hoje pode ser diferente do que era há 30 dias.',
  },
  {
    q: 'Posso vender meu carro pelo valor exato da FIPE?',
    a: 'Pode, mas raramente é o que acontece. Carros bem conservados, com baixa quilometragem e revisões em dia tendem a vender por valor próximo ou levemente acima da FIPE. Veículos com batidas no histórico, alta quilometragem ou pendências costumam fechar de 5% a 20% abaixo. A FIPE é o ponto de partida da negociação, não o preço final.',
  },
  {
    q: 'A FIPE serve para calcular o IPVA?',
    a: 'Sim. A base de cálculo do IPVA na maioria dos estados é o valor venal do veículo, e o valor venal segue a Tabela FIPE (ou tabela equivalente da SEFAZ estadual). Por isso, quando a FIPE do seu modelo cai, o IPVA do ano seguinte tende a cair também.',
  },
  {
    q: 'Existe Tabela FIPE para moto e caminhão?',
    a: 'Sim. A FIPE publica três tabelas separadas: carros e utilitários pequenos, motocicletas e caminhões/ônibus. Cada categoria tem códigos FIPE próprios e é atualizada no mesmo cronograma mensal. No PlacaCompleta, a consulta pela placa identifica automaticamente o tipo de veículo e retorna o valor da tabela correta.',
  },
  {
    q: 'Por que o valor FIPE da minha placa veio mais baixo do que eu esperava?',
    a: 'A FIPE reflete preço médio de mercado, e nos últimos anos vários segmentos sofreram depreciação acelerada (especialmente sedãs médios e hatches premium) por mudança de demanda em favor de SUVs. Outros motivos: o ano modelo retornado pode ser mais antigo do que você imaginava, ou a versão (motor, câmbio, acabamento) tem FIPE inferior à de outras versões do mesmo nome.',
  },
  {
    q: 'Como funciona a depreciação na Tabela FIPE?',
    a: 'Em média, um carro perde cerca de 15% a 20% do valor no primeiro ano e depois cai entre 8% e 12% ao ano nos cinco anos seguintes. Modelos com alta procura no usado (Toyota Corolla, Honda Civic, Hilux, Jeep Compass) desvalorizam mais devagar. Modelos com produção encerrada ou problemas conhecidos costumam desvalorizar mais rápido.',
  },
  {
    q: 'O que é o código FIPE e para que serve?',
    a: 'O código FIPE é um identificador único para cada versão de cada modelo (ex.: 038003-2 para o Honda Civic EXL 2.0). É o que garante que você está olhando o valor da versão certa, porque dentro do mesmo nome comercial podem existir várias versões com FIPE diferente.',
  },
  {
    q: 'A FIPE considera quilometragem ou estado de conservação?',
    a: 'Não. A FIPE é um valor padronizado por marca, modelo, ano e versão: assume veículo em estado médio de conservação para a idade. Para precificar com precisão, você precisa partir da FIPE e ajustar: para cima se o carro está acima da média (baixa km, segundo dono, revisões), para baixo se está abaixo (alta km, retoques de pintura, pendências).',
  },
  {
    q: 'Posso financiar pelo valor FIPE?',
    a: 'Bancos e financeiras usam a FIPE como teto de financiamento. Geralmente liberam crédito de até 100% da FIPE para veículos com até 5 anos, e percentuais menores para carros mais antigos. Acima da FIPE é difícil conseguir, porque o veículo seria garantia insuficiente em caso de inadimplência.',
  },
  {
    q: 'Como saber o ano modelo correto para consultar a FIPE certa?',
    a: 'O ano modelo costuma estar no CRLV (documento) e no último dígito do chassi. Ele pode ser diferente do ano de fabricação (ex.: um carro fabricado em outubro de 2023 pode ser ano modelo 2024). Quando você consulta pela placa no PlacaCompleta, o sistema retorna os dois anos e cruza com o código FIPE correto da versão.',
  },
]

useHead({
  title: `Tabela FIPE pela Placa ${currentYear}: Valor FIPE Atualizado em Segundos`,
  meta: [
    { name: 'description', content: descricaoTabelaFipePorPlaca(currentMonth, currentYear) },
    { name: 'keywords', content: 'tabela FIPE por placa, valor FIPE pela placa, consultar FIPE pela placa, preço veículo por placa, fipe pela placa, tabela fipe pela placa, codigo fipe placa' },
    { property: 'og:title', content: 'Tabela FIPE pela Placa: o valor do veículo' },
    { property: 'og:description', content: 'Descubra o valor FIPE de qualquer veículo pela placa, com marca, modelo, ano e preço na tela.' },
  ],
  link: [
    { rel: 'canonical', href: 'https://placacompleta.com.br/tabela-fipe-por-placa' },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://placacompleta.com.br' },
          { '@type': 'ListItem', position: 2, name: 'Tabela FIPE pela Placa', item: 'https://placacompleta.com.br/tabela-fipe-por-placa' },
        ],
      }),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'Como consultar a Tabela FIPE pela placa do veículo',
        description: 'Passo a passo para descobrir o valor FIPE atualizado de um carro, moto ou caminhão informando apenas a placa.',
        totalTime: 'PT1M',
        estimatedCost: { '@type': 'MonetaryAmount', currency: 'BRL', value: '0' },
        supply: [
          { '@type': 'HowToSupply', name: 'Placa do veículo (formato Mercosul ABC1D23 ou antigo ABC1234)' },
          { '@type': 'HowToSupply', name: 'E-mail válido para receber o resultado' },
        ],
        step: [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Abra placacompleta.com.br',
            text: 'Acesse a página inicial do PlacaCompleta diretamente pelo navegador, sem precisar criar conta ou instalar nada.',
            url: 'https://placacompleta.com.br',
          },
          {
            '@type': 'HowToStep',
            position: 2,
            name: 'Digite a placa do veículo',
            text: 'Informe a placa no campo principal. O sistema aceita o formato Mercosul (ABC1D23) e o antigo (ABC1234), inclusive de motos e caminhões.',
          },
          {
            '@type': 'HowToStep',
            position: 3,
            name: 'Informe seu e-mail',
            text: 'Coloque um e-mail válido. O resultado é entregue lá para você ter um registro com a data da consulta e o mês de referência FIPE.',
          },
          {
            '@type': 'HowToStep',
            position: 4,
            name: 'Receba marca, modelo, ano e valor FIPE',
            text: `Em segundos chega o e-mail com marca, modelo completo, ano de fabricação, ano modelo, versão, código FIPE e o valor FIPE de ${currentMonth} de ${currentYear}.`,
          },
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
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }),
    },
  ],
})
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">Tabela FIPE pela Placa</h1>

      <div class="pc-prose">
        <p class="pc-lead">
              Você digita a placa e vê aqui mesmo o <strong>valor FIPE atualizado</strong> do
              veículo em {{ currentMonth }} de {{ currentYear }}, junto com marca, modelo e ano.
              Sem cadastro, em segundos.
            </p>

            <FipePorPlaca />

            <h2>O que é a Tabela FIPE e por que ela importa</h2>
            <p>
              A <strong>Tabela FIPE</strong> é publicada pela Fundação Instituto de Pesquisas
              Econômicas, ligada à USP, desde 2001 a pedido da Receita Federal. Ela calcula o
              <strong>preço médio de mercado</strong> de cada versão de cada modelo de carro, moto
              e caminhão vendido no Brasil, e é atualizada mensalmente a partir de anúncios e
              transações reais entre concessionárias, lojistas e particulares.
            </p>
            <p>
              É a referência usada por bancos para liberar financiamento, por seguradoras para
              calcular indenização em caso de perda total, pelas SEFAZ estaduais para definir a
              base de cálculo do IPVA e por compradores e vendedores como ponto de partida em
              qualquer negociação. Saber a FIPE do seu veículo é, na prática, saber o piso de
              quanto ele vale, hoje, no mercado.
            </p>

            <h2>Como funciona a atualização mensal da FIPE</h2>
            <p>
              A FIPE coleta preços ao longo do mês e publica o novo mês de referência na primeira
              semana do mês seguinte. Em {{ currentMonth }} de {{ currentYear }}, por exemplo, o
              valor que aparece na consulta é o do mês de referência atual, já refletindo as
              transações dos últimos 30 dias. Por isso a FIPE de hoje pode estar 1% a 3% diferente
              da que estava há 30 dias, e até 10% diferente da de 12 meses atrás.
            </p>
            <p>
              A tendência geral é de queda gradual ao longo do ano (depreciação natural), com
              alguns modelos invertendo a curva em períodos de baixa oferta de carros novos:
              foi o que aconteceu entre 2021 e 2023, quando a crise de semicondutores valorizou
              usados em quase todas as categorias.
            </p>

            <h2>Por que consultar a FIPE pela placa (e não pelo modelo)</h2>
            <p>
              A consulta tradicional na FIPE pede marca, modelo, ano e versão, e é aí que a
              maioria das pessoas erra. Um Honda Civic 2020, por exemplo, tem versões EX, EXL,
              Touring e Sport, cada uma com código FIPE e valor diferente. Se você escolhe a
              versão errada, está olhando um preço que não é o do seu carro.
            </p>
            <p>
              Pela placa, o caminho é direto: o sistema identifica chassi, ano modelo e versão
              exata a partir de bases oficiais, e devolve o valor FIPE da versão correta. Você
              evita o erro mais comum em compras de usados, que é negociar com base na FIPE da
              versão errada.
            </p>

            <h2>Evolução de preço FIPE: como ler o histórico</h2>
            <p>
              A linha abaixo ilustra como o valor FIPE de um modelo se comporta ao longo de
              {{ currentYear - 1 }} e {{ currentYear }}. O padrão é típico: queda lenta e
              constante, com aceleração no final do ano (carros 0km do ano seguinte chegam ao
              mercado, pressionando o usado para baixo).
            </p>
            <p class="chart-wrap">
              <img
                :src="chartUrl"
                alt="Gráfico de evolução do valor FIPE de um modelo de exemplo nos últimos 18 meses"
                loading="lazy"
                width="640"
                height="320"
              >
            </p>
            <p>
              Na consulta pela placa, o e-mail traz a FIPE do mês atual, e cada nova consulta
              da mesma placa mostra a variação acumulada, útil para acompanhar a depreciação
              do seu carro ao longo do tempo.
            </p>

            <h2>Diferença entre FIPE, Webmotors, OLX e valor de venda</h2>
            <p>
              A FIPE é uma média estatística. O preço pedido em portais como Webmotors, iCarros
              e OLX costuma ficar entre 5% e 15% acima da FIPE, porque vendedores deixam margem
              para negociação. O <strong>valor de venda efetivo</strong> tende a fechar entre
              a FIPE e o preço de anúncio: em mercados aquecidos perto da FIPE, em mercados
              parados abaixo dela.
            </p>
            <p>
              Quem usa a FIPE como número único costuma errar a negociação. O caminho mais
              seguro é: pegue a FIPE da versão exata (pela placa), olhe o preço médio de
              anúncio do mesmo ano/versão e use a diferença entre os dois para definir piso e
              teto da sua oferta.
            </p>

            <h2>Fatores que afetam o preço além da FIPE</h2>
            <ul>
              <li><strong>Quilometragem:</strong> a cada 10.000 km acima da média esperada para a idade, o veículo desvaloriza de 2% a 4%.</li>
              <li><strong>Histórico de sinistros:</strong> batidas registradas em laudo cautelar derrubam o valor de 10% a 30%.</li>
              <li><strong>Revisões em dia:</strong> manual carimbado e revisões na concessionária seguram o valor próximo da FIPE.</li>
              <li><strong>Cor:</strong> branco, prata e preto valem mais que cores fora de moda. A diferença pode chegar a 5%.</li>
              <li><strong>Versão:</strong> dentro do mesmo nome comercial, versão top de linha vale 15% a 30% mais que a versão de entrada.</li>
              <li><strong>Único dono:</strong> reduz desconfiança e tende a sustentar valor próximo da FIPE.</li>
              <li><strong>Pendências:</strong> multas, IPVA atrasado, gravame de financiamento e restrições derrubam valor de venda, mesmo que a FIPE não mude.</li>
              <li><strong>Final de ano:</strong> entre outubro e dezembro, FIPE e mercado caem juntos por causa da chegada dos modelos do ano seguinte.</li>
            </ul>

            <h2>Quem usa a Tabela FIPE pela placa</h2>
            <ul>
              <li><strong>Compradores de usados:</strong> validam se o preço pedido bate com o mercado antes de fechar negócio.</li>
              <li><strong>Vendedores:</strong> definem preço inicial competitivo sem ficar acima do mercado e travar a venda.</li>
              <li><strong>Lojistas:</strong> avaliam estoque rapidamente e definem preço de tabela em concessionárias e revendas.</li>
              <li><strong>Bancos e financeiras:</strong> definem teto de financiamento a partir da FIPE da versão correta.</li>
              <li><strong>Seguradoras:</strong> calculam prêmio e indenização de perda total com base na FIPE.</li>
              <li><strong>SEFAZ:</strong> usam a FIPE como base do valor venal para cálculo do IPVA anual.</li>
              <li><strong>Auditorias e perícias:</strong> usam histórico FIPE em processos judiciais e inventários.</li>
            </ul>

            <h2>Quais dados chegam no e-mail</h2>
            <ul>
              <li><strong>Valor FIPE</strong> da versão exata em {{ currentMonth }} de {{ currentYear }}</li>
              <li><strong>Código FIPE</strong> da versão (identificador único)</li>
              <li><strong>Mês de referência</strong> da avaliação</li>
              <li>Marca, modelo, versão (motor, câmbio, acabamento)</li>
              <li>Ano de fabricação e ano modelo</li>
              <li>Combustível, cor, município de registro</li>
              <li>Situação do veículo (em circulação, baixado)</li>
            </ul>
            <p>
              Já tem a placa em mãos? O <NuxtLink to="/">relatório completo</NuxtLink> traz
              também débitos, indicadores de roubo/furto e registro de leilão, e o histórico completo do
              veículo.
            </p>

            <div class="pc-cta">
              <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick">
                Consultar Valor FIPE pela Placa
              </NuxtLink>
            </div>

            <h2>Marcas com mais consultas FIPE pela placa</h2>
            <div class="link-grid">
              <NuxtLink
                v-for="slug in topBrands"
                :key="slug"
                :to="`/tabela-fipe/${slug}`"
                class="link-card"
              >
                {{ fipeBrands[slug].name }}
              </NuxtLink>
            </div>

            <h2>Consultar placa por estado</h2>
            <div class="link-grid">
              <NuxtLink
                v-for="slug in topStates"
                :key="slug"
                :to="`/consultar-placa/${slug}`"
                class="link-card"
              >
                {{ states[slug].name }}
              </NuxtLink>
            </div>

            <h2>Perguntas frequentes sobre a Tabela FIPE pela placa</h2>
            <div v-for="faq in faqs" :key="faq.q" class="pc-faq__item">
              <h3>{{ faq.q }}</h3>
              <p>{{ faq.a }}</p>
            </div>

            <nav class="pc-breadcrumb">
              <NuxtLink to="/">Início</NuxtLink>
              <span> &rsaquo; </span>
              <strong>Tabela FIPE pela Placa</strong>
            </nav>
          </div>

      <div class="pc-cta">
        <NuxtLink to="/" class="pc-btn pc-btn--primary" @click="onCtaClick">
          Consultar FIPE Agora
        </NuxtLink>
      </div>
    </main>
  </div>
</template>


<style lang="scss" scoped>
// Tabela FIPE pela placa no design novo (tokens --pc-*). Grades de link em cards
// hairline; o grafico externo dentro de uma moldura hairline. Conteudo, headings,
// FAQ, schema e internal links ficam intactos.

.link-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  margin: 12px 0 20px;
}
.link-card {
  display: block;
  padding: 12px 14px;
  border: 1px solid var(--pc-hairline);
  border-radius: 12px;
  background: var(--pc-canvas);
  color: var(--pc-ink);
  font-weight: 600;
  font-size: 0.9375rem;
  text-decoration: none;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover { border-color: var(--pc-blue); background: var(--pc-cloud); }
}

.chart-wrap {
  margin: 12px 0 20px;
  border: 1px solid var(--pc-hairline);
  border-radius: 12px;
  background: var(--pc-canvas);
  padding: 12px;
  overflow-x: auto;

  img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 8px;
  }
}
</style>
