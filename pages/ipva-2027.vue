<script setup lang="ts">
// IPVA 2027 pela placa (Cesar, Nov 26, 2026). An ESTIMATE of IPVA 2027 (FIPE
// value x passenger-car rate of the state), the 2027 calendar with only the
// dates each state already published, and what to check before paying. Never
// the official value and never a debt lookup. Data, sources and check dates:
// shared/ipva-2027.ts. The plate lookup and the offer below the result are the
// ones of /tabela-fipe-por-placa (components/FipePorPlaca.vue, basic plan).
import { escolherTitulo, emEstado } from '~/shared/seo-titulo'
import { DESCRICOES } from '~/shared/seo-meta'
import { states } from '~/data/states'
import {
  CALENDARIO_IPVA_2027, FAQ_IPVA_2027, CONFERIDO_EM,
  aliquotaEmTexto, reais, tabelaAliquotas, ancoraCalendario, valorFipeDoTexto, dependeEmTexto,
} from '~/shared/ipva-2027'

const URL_PAGINA = 'https://placacompleta.com.br/ipva-2027'

const estadoPorUf = (uf: string) => Object.values(states).find((s) => s.uf === uf)
const slugPorUf: Record<string, string> = Object.fromEntries(Object.values(states).map((s) => [s.uf, s.slug]))

// Worked example with the same function as the tool: a R$ 50.000 gasoline or
// flex car in every state, with the range where the rate depends on power or
// engine size, and "não conferida" where no official source was read.
const FIPE_EXEMPLO = 50000
const exemplos = tabelaAliquotas(FIPE_EXEMPLO)
  .map((l) => ({ ...l, nome: estadoPorUf(l.uf)?.name || l.uf }))
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
const naoConferidas = exemplos.filter((l) => l.estimativa.tipo === 'aliquota_nao_conferida').map((l) => l.nome)

const STATUS_ROTULO: Record<string, string> = {
  publicado: 'Publicado',
  parcial: 'Publicado em parte',
  nao_publicado: 'Ainda não publicado',
}

// Typed FIPE value (no plate): same estimate, no lookup.
const fipeManual = ref('')
const valorManual = computed(() => valorFipeDoTexto(fipeManual.value))

function onCtaClick() {
  if (import.meta.client && window.gtag) {
    window.gtag('event', 'cta_click', { source_page: 'ipva-2027' })
  }
}

useHead({
  title: escolherTitulo(['IPVA 2027: estimativa do valor pela placa e calendário']),
  titleTemplate: '%s',
  meta: [
    { name: 'description', content: DESCRICOES.ipva2027 },
    { name: 'keywords', content: 'ipva 2027, consulta valor ipva 2027, ipva 2027 pela placa, ipva 2027 sp, ipva 2027 mg, ipva 2027 rs, ipva 2027 ms, calendário ipva 2027, estimativa ipva 2027' },
    { property: 'og:title', content: 'IPVA 2027: estimativa do valor pela placa e calendário' },
    { property: 'og:description', content: DESCRICOES.ipva2027 },
  ],
  link: [
    { rel: 'canonical', href: URL_PAGINA },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://placacompleta.com.br' },
          { '@type': 'ListItem', position: 2, name: 'IPVA 2027', item: URL_PAGINA },
        ],
      }),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ_IPVA_2027.map((f) => ({
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
      <h1 class="pc-h1">IPVA 2027 pela placa: estimativa do valor e calendário</h1>

      <div class="pc-prose">
        <p class="pc-lead">
          Em São Paulo, o IPVA 2027 vence entre 11 e 22 de janeiro, conforme o final da placa. Digite
          a placa e veja uma <strong>estimativa do IPVA 2027</strong> do carro: o valor FIPE vezes a
          alíquota do estado. É uma conta para planejar, não o valor oficial nem uma consulta de
          débitos. Quem define a base de cálculo e o valor final é a Secretaria da Fazenda (SEFAZ)
          de cada estado.
        </p>

        <div id="estimar">
          <FipePorPlaca source-page="ipva-2027" botao="Estimar IPVA" rotulo="Estimar o IPVA 2027 pela placa">
            <template #estimativa="{ resultado }">
              <Ipva2027Estimativa
                :fipe="resultado.fipe"
                :uf-inicial="resultado.uf"
                :segmento="resultado.segmento"
                :combustivel-texto="resultado.combustivel"
                :modelo="resultado.modelo"
                :faixas-decididas="resultado.ipvaFaixas"
                id-base="ipp"
              />
            </template>
          </FipePorPlaca>
        </div>

        <details class="ipva-manual">
          <summary>Já sabe o valor FIPE? Faça a conta sem a placa</summary>
          <label for="ipva-fipe-manual" class="ipva-manual__label">Valor FIPE do carro (R$)</label>
          <input
            id="ipva-fipe-manual"
            v-model="fipeManual"
            class="ipva-manual__input"
            inputmode="numeric"
            placeholder="50.000"
            autocomplete="off"
          >
          <p class="ipva-nota">A conta sem a placa vale para carro a gasolina ou flex.</p>
          <Ipva2027Estimativa :fipe="valorManual" segmento="carro" combustivel="comum" origem="manual" id-base="ipm" />
        </details>

        <h2>Como a estimativa do IPVA 2027 é calculada</h2>
        <p>
          A conta tem duas partes: o valor FIPE do carro e a alíquota de automóvel do estado onde
          ele está registrado. Para um carro a gasolina ou flex de {{ reais(FIPE_EXEMPLO) }}, fica
          assim:
        </p>
        <div class="ipva-tabela">
          <table>
            <thead>
              <tr><th>Estado</th><th>Alíquota de automóvel</th><th>IPVA 2027 estimado</th><th>Fonte</th></tr>
            </thead>
            <tbody>
              <tr v-for="l in exemplos" :key="l.uf">
                <td>{{ l.nome }} ({{ l.uf }})</td>
                <template v-if="l.estimativa.tipo === 'valor'">
                  <td>{{ aliquotaEmTexto(l.estimativa.aliquota) }}</td>
                  <td><strong>{{ reais(l.estimativa.ipva) }}</strong></td>
                  <td><a :href="l.estimativa.fonte.url" target="_blank" rel="noopener noreferrer">fonte oficial</a></td>
                </template>
                <template v-else-if="l.estimativa.tipo === 'faixa'">
                  <td>{{ aliquotaEmTexto(l.estimativa.min) }} a {{ aliquotaEmTexto(l.estimativa.max) }}, depende {{ dependeEmTexto(l.estimativa.depende) }}</td>
                  <td><strong>{{ reais(l.estimativa.ipvaMin) }} a {{ reais(l.estimativa.ipvaMax) }}</strong></td>
                  <td><a :href="l.estimativa.fonte.url" target="_blank" rel="noopener noreferrer">fonte oficial</a></td>
                </template>
                <template v-else>
                  <td colspan="3" class="ipva-tabela__nc">Alíquota 2027 ainda não conferida</td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="ipva-nota">Alíquotas conferidas em {{ CONFERIDO_EM }} nas fontes oficiais de cada estado.</p>
        <p>
          Em alguns estados a alíquota muda com a potência, a cilindrada ou o valor do carro. Na
          consulta pela placa, a estimativa usa a faixa do carro quando a consulta traz esse dado; sem
          ele, mostramos a faixa de valores, como na tabela acima. Para carro elétrico, híbrido, a gás,
          a diesel ou só a etanol, seguimos a fonte de cada estado: onde a alíquota vale para qualquer
          automóvel, a conta é a mesma; onde há regra própria para o combustível, usamos a alíquota
          dela, e não estimamos quando a regra depende de condições que a conta não cobre.
        </p>
        <p v-if="naoConferidas.length">
          Ainda não conferimos numa fonte oficial a alíquota de {{ naoConferidas.join(', ') }}. Para
          esses estados, a página mostra o valor FIPE e indica a SEFAZ do estado, sem número.
        </p>

        <h3>Por que o valor oficial pode ser diferente</h3>
        <ul>
          <li>
            <strong>A base é a tabela da SEFAZ, não a FIPE do mês.</strong> Cada estado publica a
            tabela de valores que usa no ano. Em Minas Gerais, por exemplo, a base do carro usado é o
            preço médio de mercado no fim do ano anterior, apurado pela FIPE com supervisão da SEF-MG.
          </li>
          <li>
            <strong>Descontos não entram na conta</strong>, como os 3% do pagamento integral em
            janeiro em São Paulo.
          </li>
          <li>
            <strong>Isenções e reduções também não</strong>: carro antigo, pessoa com deficiência,
            táxi, carro a gás, elétrico ou híbrido, conforme a regra de cada estado.
          </li>
          <li>
            <strong>A alíquota é a de automóvel.</strong> Motos e caminhões podem ter alíquota
            diferente, então a página não mostra estimativa para eles.
          </li>
        </ul>

        <h2>Calendário do IPVA 2027 por estado</h2>
        <p>
          Aqui entram só as datas que cada estado já publicou oficialmente para 2027, com a fonte e o
          dia em que conferimos. Estado que ainda não publicou aparece como "calendário 2027 ainda não
          publicado", e não usamos datas de anos anteriores no lugar.
        </p>

        <article
          v-for="c in CALENDARIO_IPVA_2027"
          :id="ancoraCalendario(c.uf)"
          :key="c.uf"
          class="ipva-uf"
        >
          <div class="ipva-uf__topo">
            <h3>IPVA 2027 {{ emEstado(c.uf, c.nome) }}</h3>
            <span class="ipva-uf__status" :class="`ipva-uf__status--${c.status}`">{{ STATUS_ROTULO[c.status] }}</span>
          </div>
          <p class="ipva-uf__resumo">{{ c.resumo }}</p>
          <div v-if="c.vencimentos" class="ipva-tabela">
            <table>
              <thead>
                <tr><th>Final da placa</th><th>{{ c.rotuloVencimento }}</th></tr>
              </thead>
              <tbody>
                <tr v-for="v in c.vencimentos" :key="v.finais">
                  <td>Final {{ v.finais }}</td>
                  <td>{{ v.quando }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul>
            <li v-for="r in c.regras" :key="r">{{ r }}</li>
          </ul>
          <p class="ipva-nota">
            Fonte: <a :href="c.fonte.url" target="_blank" rel="noopener noreferrer">{{ c.fonte.nome }}</a>.
            Conferido em {{ c.conferidoEm }}.
            <template v-if="slugPorUf[c.uf]">
              Veja também a <NuxtLink :to="`/consultar-placa/${slugPorUf[c.uf]}`">consulta de placa {{ emEstado(c.uf, c.nome) }}</NuxtLink>.
            </template>
          </p>
        </article>

        <h2>O que conferir antes de pagar o IPVA</h2>

        <h3>Boleto e Pix falsos</h3>
        <p>
          Golpistas mandam boleto e QR code falsos de IPVA por mensagem e criam sites que imitam os
          oficiais. Desconfie de link recebido por mensagem e de anúncio patrocinado no buscador: gere
          a guia ou o Pix só no site oficial da Secretaria da Fazenda do seu estado, que fica num
          endereço .gov.br, e confira o valor antes de pagar.
        </p>
        <p>
          No Rio Grande do Sul, a Receita Estadual
          <a href="https://atendimento.receita.rs.gov.br/atencao-site-pagamento-pix-clonado" target="_blank" rel="noopener noreferrer">avisa</a>
          que o golpe mais comum vem de anúncios patrocinados que aparecem antes do site do governo, e
          que os sites oficiais ficam no domínio rs.gov.br. No Mato Grosso do Sul, a SEFAZ tem uma
          página para
          <a href="https://servicos.efazenda.ms.gov.br/daemsabertopublico/consultadaems?TipoConsulta=IPVA" target="_blank" rel="noopener noreferrer">conferir se o documento de arrecadação (DAEMS) é autêntico</a>.
        </p>

        <h3>Débitos e multas</h3>
        <p>
          IPVA de anos anteriores, multas e licenciamento atrasado continuam ligados ao carro e travam
          o licenciamento e a transferência. Antes de pagar o de 2027, veja se não há nada atrasado no
          site da SEFAZ e do DETRAN do estado. Se for comprar o carro, faça isso antes de fechar negócio.
        </p>

        <h3>Licenciamento</h3>
        <p>
          Pagar o IPVA não basta para o carro circular em dia. O licenciamento anual tem calendário
          próprio do DETRAN, e o documento do carro (CRLV-e) só sai com IPVA, taxas e multas vencidas
          quitados.
        </p>

        <h3>Vai negociar um carro?</h3>
        <p>
          O IPVA 2027 entra na conta de quem compra agora. <a href="#estimar">Consulte a placa</a> no
          topo desta página para ver o valor FIPE e a estimativa. Depois do resultado, a consulta básica
          mostra o histórico do valor FIPE, o seguro estimado e a ficha técnica completa do carro.
        </p>
        <p>
          Veja também o <NuxtLink to="/tabela-fipe-por-placa">valor FIPE pela placa</NuxtLink> e a
          consulta de placa de <NuxtLink to="/consultar-placa/sao-paulo">São Paulo</NuxtLink>,
          <NuxtLink to="/consultar-placa/minas-gerais">Minas Gerais</NuxtLink>,
          <NuxtLink to="/consultar-placa/rio-grande-do-sul">Rio Grande do Sul</NuxtLink> e
          <NuxtLink to="/consultar-placa/mato-grosso-do-sul">Mato Grosso do Sul</NuxtLink>.
        </p>

        <h2>Perguntas frequentes sobre o IPVA 2027</h2>
        <div v-for="faq in FAQ_IPVA_2027" :key="faq.q" class="pc-faq__item">
          <h3>{{ faq.q }}</h3>
          <p>{{ faq.a }}</p>
        </div>

        <nav class="pc-breadcrumb">
          <NuxtLink to="/">Início</NuxtLink>
          <span> &rsaquo; </span>
          <strong>IPVA 2027</strong>
        </nav>
      </div>

      <div class="pc-cta">
        <a href="#estimar" class="pc-btn pc-btn--primary" @click="onCtaClick">
          Estimar o IPVA pela placa
        </a>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
// IPVA 2027 in the new design (tokens --pc-*): hairline tables and state cards.

.ipva-manual {
  margin: 0 0 28px;
  padding: 14px 16px;
  border: 1px solid var(--pc-hairline);
  border-radius: 12px;
  background: var(--pc-canvas);

  summary { cursor: pointer; font-weight: 600; color: var(--pc-ink); }
}
.ipva-manual__label {
  display: block;
  margin: 14px 0 8px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--pc-graphite);
}
.ipva-manual__input {
  width: 100%;
  max-width: 240px;
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--pc-steel);
  border-radius: 8px;
  font: inherit;
  font-size: 1.125rem;
  color: var(--pc-ink);

  &:focus { outline: 2px solid var(--pc-blue); outline-offset: 1px; }
}

.ipva-tabela {
  margin: 12px 0 8px;
  overflow-x: auto;
  border: 1px solid var(--pc-hairline);
  border-radius: 12px;

  table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--pc-hairline); }
  th, td:first-child { white-space: nowrap; }
  th { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--pc-graphite); background: var(--pc-cloud); }
  tbody tr:last-child td { border-bottom: 0; }
}

.ipva-nota { font-size: 0.8125rem; color: var(--pc-graphite); }
.ipva-tabela__nc { color: var(--pc-graphite); }

.ipva-uf {
  margin: 16px 0;
  padding: 16px 18px;
  border: 1px solid var(--pc-hairline);
  border-radius: 12px;
  background: var(--pc-canvas);
  scroll-margin-top: 80px;

  h3 { margin: 0; }
}
.ipva-uf__topo { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.ipva-uf__resumo { margin: 10px 0 0; color: var(--pc-ink); font-weight: 600; }
.ipva-uf__status {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--pc-hairline);
  color: var(--pc-graphite);
  background: var(--pc-cloud);
}
.ipva-uf__status--publicado { color: var(--pc-green); border-color: currentColor; background: transparent; }
.ipva-uf__status--parcial { color: var(--pc-blue); border-color: currentColor; background: transparent; }
</style>
