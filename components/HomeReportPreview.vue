<script setup lang="ts">
// Previa do relatorio completo, na section "Exemplo de relatorio" da home.
//
// Espelha a anatomia do relatorio de verdade (mockup v2.0): resumo do veiculo
// com veredito, grade de indicadores, restricoes detalhadas, ficha cadastral e
// tecnica, valor FIPE com serie historica, seguro estimado e custo em 5 anos.
// A ideia e a pessoa reconhecer o documento antes de pagar por ele.
//
// Estatico e ilustrativo de proposito: dado inventado aqui nao vira promessa,
// porque a tela deixa claro que e exemplo. Nao revela a fonte dos dados.

const indicadores = [
  { label: 'Roubo / furto', valor: 'NADA CONSTA', risco: false },
  { label: 'Leilão', valor: 'NADA CONSTA', risco: false },
  { label: 'Gravame', valor: 'ALIENADO', risco: true },
  { label: 'RENAJUD', valor: 'CONSTA', risco: true },
  { label: 'Recall', valor: 'EM DIA', risco: false },
  { label: 'Restrição RFB', valor: 'NADA CONSTA', risco: false },
  { label: 'Multa RENAINF', valor: 'NADA CONSTA', risco: false },
  { label: 'Comunic. venda', valor: 'NÃO', risco: false },
  { label: 'Pend. emissão', valor: 'NÃO', risco: false },
  { label: 'Circulação', valor: 'LIVRE', risco: false },
]

// A ficha e o produto: mostrar resumida esconde justamente o que se vende.
// Os tres grupos saem do relatorio de verdade, com os mesmos rotulos.
const ficha: { grupo: string; linhas: [string, string][] }[] = [
  {
    grupo: 'Cadastral',
    linhas: [
      ['Placa', 'ABC1D23'],
      ['Renavam', '01234567909'],
      ['Chassi', '9BWZZZ377JT004321'],
      ['Marca / modelo', 'VW / Gol 1.0 Flex 12V'],
      ['Ano fab. / modelo', '2018 / 2018'],
      ['Cor', 'Branca'],
      ['Espécie', 'Passageiro'],
      ['Tipo do veículo', 'Automóvel'],
      ['Categoria', 'Particular'],
      ['Situação', 'Em circulação'],
      ['UF da jurisdição', 'SP'],
    ],
  },
  {
    grupo: 'Técnica',
    linhas: [
      ['Potência', '82 cv'],
      ['Cilindrada', '999 cm³'],
      ['Combustível', 'Álcool / Gasolina (Flex)'],
      ['Carroceria', 'Hatchback'],
      ['Número de eixos', '2'],
      ['Lotação', '5 lugares'],
      ['Peso bruto total', '1,42 t'],
      ['Cap. máx. de carga', '0,45 t'],
      ['Cap. máx. de tração', 'Não se aplica'],
    ],
  },
]

// Licenciamento sai da grade de duas colunas e vira uma linha acima delas: sao
// so dois campos, e numa coluna de tabela eles ficavam perdidos no fim.
const licenciamento: [string, string][] = [
  ['CRLV · exercício', '2026'],
  ['CRLV · emissão', '21/05/2026'],
  ['Situação do licenciamento', 'Em dia'],
]
</script>

<template>
  <article class="hrp" aria-label="Exemplo de relatório completo">
    <!-- barra do documento -->
    <header class="hrp__bar">
      <span class="hrp__bar-title">Relatório completo</span>
      <span class="hrp__bar-meta">Consulta #A1B2C3 · 18/08/2026</span>
    </header>

    <div class="hrp__body">
      <!-- resumo do veiculo -->
      <div class="hrp__veh">
        <span class="hrp__ic" aria-hidden="true"><img src="/brand-vw.svg" alt="" class="hrp__brand"></span>
        <span class="hrp__veh-txt">
          <strong>VW Gol 1.0 Flex 12V 5p</strong>
          <span>2018/2018 · Branco · Automóvel · São Paulo/SP</span>
        </span>
        <span class="hrp__plate">ABC1D23</span>
      </div>

      <!-- veredito: e o que a pessoa procura no relatorio -->
      <div class="hrp__verdict">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 2.5 18.5 17.5H1.5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          <path d="M10 8v3.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <circle cx="10" cy="14.6" r="1" fill="currentColor" />
        </svg>
        <span>
          <strong>Atenção: gravame ativo e restrição RENAJUD.</strong>
          Nada consta de roubo, furto, leilão ou recall. Veja os detalhes antes de negociar.
        </span>
      </div>

      <!-- indicadores -->
      <h4 class="hrp__h">Indicadores</h4>
      <div class="hrp__inds">
        <div
          v-for="i in indicadores"
          :key="i.label"
          class="hrp__ind"
          :class="i.risco ? 'hrp__ind--bad' : 'hrp__ind--ok'"
        >
          <span class="hrp__ind-lab">{{ i.label }}</span>
          <span class="hrp__ind-val">{{ i.valor }}</span>
        </div>
      </div>

      <!-- restricoes detalhadas -->
      <h4 class="hrp__h">Restrições detalhadas</h4>
      <div class="hrp__restr">
        <span class="hrp__tag">Gravame</span>
        <span>
          <strong>Alienação fiduciária</strong>
          Financiamento em aberto. A baixa do gravame é necessária para transferir o veículo.
        </span>
      </div>
      <div class="hrp__restr">
        <span class="hrp__tag">Judicial</span>
        <span>
          <strong>Restrição RENAJUD ativa</strong>
          Bloqueio judicial registrado. Pode impedir a transferência até a liberação.
        </span>
      </div>

      <!-- numeros: faixa de tres. Antes viviam numa coluna lateral e deixavam
           ~1600px vazios ao lado da ficha, que e comprida. -->
      <h4 class="hrp__h">Valor, seguro e custo de posse</h4>
      <div class="hrp__nums">
        <div class="hrp__num">
          <span class="hrp__num-lab">Valor de mercado</span>
          <p class="hrp__big">R$ 42.315 <small>ago/2026</small></p>
          <p class="hrp__delta">12 meses: <b>+3,1%</b></p>
          <svg class="hrp__spark" viewBox="0 0 240 56" aria-hidden="true">
            <path d="M4,40 38,37 72,40 106,29 140,21 174,16 208,11 236,5 L236,52 L4,52 Z" fill="rgba(31,111,235,.10)" />
            <polyline points="4,40 38,37 72,40 106,29 140,21 174,16 208,11 236,5"
                      fill="none" stroke="#1f6feb" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
            <circle cx="236" cy="5" r="3" fill="#1f6feb" />
          </svg>
        </div>
        <div class="hrp__num">
          <span class="hrp__num-lab">Seguro estimado</span>
          <p class="hrp__big">R$ 1.881 <small>/ ano</small></p>
          <p class="hrp__delta">Franquia R$ 2.881</p>
          <p class="hrp__delta">Faixa na região: R$ 1.104 a R$ 2.345</p>
        </div>
        <div class="hrp__num">
          <span class="hrp__num-lab">Custo em 5 anos</span>
          <p class="hrp__big">R$ 28.750</p>
          <p class="hrp__delta">Manutenção R$ 22.400 · IPVA R$ 6.350</p>
          <p class="hrp__delta">68% do valor FIPE</p>
        </div>
      </div>

      <!-- ficha completa: e o que se vende, entao vai inteira, em duas colunas -->
      <h4 class="hrp__h">Ficha cadastral, técnica e licenciamento</h4>

      <div class="hrp__linha">
        <span class="hrp__sub hrp__sub--linha">Licenciamento</span>
        <div class="hrp__pares">
          <span v-for="([k, v]) in licenciamento" :key="k" class="hrp__par">
            <em>{{ k }}</em><b>{{ v }}</b>
          </span>
        </div>
      </div>

      <div class="hrp__ficha">
        <div v-for="g in ficha" :key="g.grupo" class="hrp__grupo">
          <span class="hrp__sub">{{ g.grupo }}</span>
          <table class="hrp__tab">
            <tbody>
              <tr v-for="([k, v]) in g.linhas" :key="k">
                <td>{{ k }}</td>
                <td>{{ v }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <p class="hrp__foot">Exemplo ilustrativo. O seu relatório traz os dados do veículo que você consultar.</p>
  </article>
</template>

<style lang="scss" scoped>
// Paleta local espelhando a home v2 (guia HP): superficies, tinta e um acento.
$c-canvas: #ffffff;
$c-cloud: #f7f7f7;
$c-slab: #0B1F3A;
$c-hair: #e8e8e8;
$c-ink: #1a1a1a;
$c-charcoal: #3d3d3d;
$c-graphite: #636363;
$c-blue: #1f6feb;
$c-green: #1e9e4a;
$c-red: #d33a3a;
$c-amber: #9a6400;
$font: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

.hrp {
  font-family: $font;
  color: $c-ink;
  line-height: 1.4;
  background: $c-canvas;
  border-radius: 16px;
  overflow: hidden;
  text-align: left;

  // barra do documento: da o enquadramento de "isto e um arquivo"
  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: $c-slab;
    color: #fff;
    padding: 12px 20px;
    flex-wrap: wrap;
  }

  &__bar-title { font-size: 14px; font-weight: 600; letter-spacing: 0.7px; text-transform: uppercase; }
  &__bar-meta { font-size: 12px; color: rgba(255, 255, 255, 0.65); }

  &__body { padding: 20px; }

  // ---- veiculo ----
  &__veh {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 16px;
    border-bottom: 1px solid $c-hair;
  }

  &__ic {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    background: $c-cloud;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__brand { width: 30px; height: 30px; object-fit: contain; }

  &__veh-txt {
    display: flex;
    flex-direction: column;
    min-width: 0;

    strong { font-size: 16px; font-weight: 500; }
    span { font-size: 13px; color: $c-graphite; }
  }

  &__plate {
    margin-left: auto;
    background: $c-slab;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.1em;
    border-radius: 4px;
    padding: 6px 10px;
    flex-shrink: 0;
  }

  // ---- veredito ----
  &__verdict {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin-top: 16px;
    padding: 12px 14px;
    border: 1px solid #e6c07a;
    background: #fdf5e6;
    border-radius: 8px;
    color: $c-amber;
    font-size: 13px;
    line-height: 1.38;

    svg { width: 20px; height: 20px; flex-shrink: 0; margin-top: 1px; }
    strong { display: block; color: #7a4d00; font-weight: 700; }
  }

  &__h {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $c-graphite;
    margin: 22px 0 10px;

    &--flush { margin-top: 0; }
  }

  // ---- indicadores ----
  &__inds {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;

    @media (max-width: 720px) { grid-template-columns: repeat(2, 1fr); }
  }

  &__ind {
    border: 1px solid $c-hair;
    border-radius: 8px;
    padding: 9px 8px;
    text-align: center;
    background: $c-cloud;
  }

  &__ind-lab { display: block; font-size: 11px; color: $c-graphite; margin-bottom: 3px; }
  &__ind-val { display: block; font-size: 11.5px; font-weight: 700; letter-spacing: 0.03em; }

  &__ind--ok { background: #edf7f1; border-color: #c3e4d1; .hrp__ind-val { color: $c-green; } }
  &__ind--bad { background: #fdeeec; border-color: #f2c3bd; .hrp__ind-val { color: $c-red; } }

  // ---- restricoes ----
  &__restr {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 0;
    border-bottom: 1px solid $c-hair;
    font-size: 13px;
    line-height: 1.38;
    color: $c-charcoal;

    &:last-of-type { border-bottom: 0; }
    strong { display: block; color: $c-ink; font-weight: 500; }
  }

  &__tag {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: #fdeeec;
    color: $c-red;
    border-radius: 4px;
    padding: 3px 7px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  // ---- numeros ----
  &__nums {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;

    @media (max-width: 720px) { grid-template-columns: 1fr; }
  }

  &__num {
    border: 1px solid $c-hair;
    border-radius: 8px;
    padding: 14px;
  }

  &__num-lab {
    display: block;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $c-graphite;
    margin-bottom: 6px;
  }

  &__big {
    margin: 0;
    font-size: 24px;
    font-weight: 500;
    line-height: 1.17;
    color: $c-ink;

    small { font-size: 12px; font-weight: 400; color: $c-graphite; }
  }

  &__delta {
    margin: 4px 0 0;
    font-size: 12px;
    color: $c-graphite;

    b { color: $c-green; font-weight: 700; }
  }

  &__spark { width: 100%; height: auto; margin-top: 8px; display: block; }

  // ---- ficha ----
  &__ficha {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 28px;
    align-items: start;

    @media (max-width: 720px) { grid-template-columns: 1fr; }
  }

  // Faixa do licenciamento, acima das duas colunas.
  &__linha {
    border: 1px solid $c-hair;
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 18px;
  }

  &__pares {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 28px;
  }

  &__par {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 13px;

    em { font-style: normal; color: $c-graphite; }
    b { font-weight: 500; color: $c-ink; }
  }

  &__sub--linha { margin-bottom: 10px; }

  &__sub {
    display: block;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $c-blue;
    border-bottom: 1px solid $c-blue;
    padding-bottom: 6px;
    margin-bottom: 4px;
  }

  &__tab {
    width: 100%;
    border-collapse: collapse;

    td {
      padding: 7px 0;
      border-bottom: 1px solid $c-hair;
      font-size: 13px;
    }
    td:first-child { color: $c-graphite; width: 52%; }
    td:last-child { font-weight: 500; text-align: right; }
    tr:last-child td { border-bottom: 0; }
  }

  &__foot {
    margin: 0;
    padding: 12px 20px;
    border-top: 1px solid $c-hair;
    background: $c-cloud;
    font-size: 12px;
    line-height: 1.5;
    color: $c-graphite;
    text-align: center;
  }
}
</style>
