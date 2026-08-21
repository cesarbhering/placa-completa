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

// MESMOS 10 indicadores do relatorio real, mesmos rotulos, mesma ordem
// (pages/premium/[token].vue). O exemplo e vitrine do produto: divergir daqui
// e prometer um documento diferente do que se entrega. "Gravame" nao esta
// aqui de proposito — no laudo real ele aparece na secao de Restricoes.
const indicadores = [
  { label: 'Roubo / furto', valor: 'NADA CONSTA', risco: false },
  { label: 'Leilão', valor: 'NADA CONSTA', risco: false },
  { label: 'RENAJUD', valor: 'CONSTA', risco: true },
  { label: 'Restrição RFB', valor: 'NADA CONSTA', risco: false },
  { label: 'Multa RENAINF', valor: 'NADA CONSTA', risco: false },
  { label: 'Recall', valor: 'EM DIA', risco: false },
  { label: 'Pendência de emissão', valor: 'NÃO', risco: false },
  { label: 'Alarme', valor: 'NÃO', risco: false },
  { label: 'Comunicação de venda', valor: 'NÃO', risco: false },
  { label: 'SINIAV', valor: 'NÃO', risco: false },
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
// Faixa de status, igual a do relatorio de verdade.
const licenciamento = { rotulo: 'Em dia', texto: 'Último licenciamento 2026 · documento emitido em 21/05/2026' }

// Restricoes com a explicacao de consequencia, como no laudo real.
const restricoes = [
  { rotulo: 'Alienação fiduciária', explica: 'O veículo está financiado e é a garantia do contrato. A transferência depende da quitação e da baixa do gravame.' },
  { rotulo: 'Restrição judicial (RENAJUD)', explica: 'Uma decisão da Justiça impede a transferência do veículo até a liberação.' },
]

// QR de autenticidade do exemplo: real e escaneavel (aponta pra home), gerado
// no cliente com a mesma lib do laudo.
const qrExemplo = ref('')
onMounted(async () => {
  try {
    const { renderSVG } = await import('uqr')
    qrExemplo.value = renderSVG('https://placacompleta.com.br', { border: 1 })
  } catch { /* sem QR o rodape segue com o texto */ }
})
</script>

<template>
  <article class="hrp" aria-label="Exemplo de relatório completo">
    <div class="hrp__body">
      <!-- cabecalho de documento, como no laudo real -->
      <header class="hrp__doc">
        <PlacaCompletaLogo variant="default" crop class="hrp__doc-logo" />
        <div class="hrp__doc-meta">
          <span class="hrp__doc-titulo">Relatório de Consulta Veicular</span>
          <span class="hrp__doc-linha">Relatório completo · Documento PC-2026-EXEMPLO</span>
          <span class="hrp__doc-linha">Emitido em 18/08/2026 às 14h32</span>
        </div>
      </header>
      <p class="hrp__doc-validade">Este documento retrata a situação do veículo na data e hora de emissão.</p>

      <!-- 1. identificacao -->
      <h4 class="hrp__h">1. Identificação do veículo</h4>
      <div class="hrp__veh">
        <MarcaLogo marca="VW/GOL" />
        <span class="hrp__veh-txt">
          <strong>VW Gol 1.0 Flex 12V 5p</strong>
          <span>2018/2018 · Branco · Automóvel · São Paulo/SP</span>
        </span>
        <PlacaMercosul placa="ABC1D23" mini class="hrp__placa" />
      </div>

      <span class="hrp__parecer-rotulo">Parecer</span>
      <div class="hrp__verdict">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 2.5 18.5 17.5H1.5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          <path d="M10 8v3.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <circle cx="10" cy="14.6" r="1" fill="currentColor" />
        </svg>
        <span>
          <strong>Atenção: consta alienação fiduciária e restrição judicial.</strong>
          Verifique os detalhes nas seções seguintes antes de concluir a negociação.
        </span>
      </div>

      <!-- 2. indicadores -->
      <h4 class="hrp__h">2. Indicadores verificados</h4>
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

      <!-- 3. restricoes -->
      <h4 class="hrp__h">3. Restrições</h4>
      <div v-for="r in restricoes" :key="r.rotulo" class="hrp__restr">
        <span class="hrp__tag">Restrição</span>
        <span>
          <strong>{{ r.rotulo }}</strong>
          {{ r.explica }}
        </span>
      </div>

      <!-- 4. ficha (antes do valor, como no laudo) -->
      <h4 class="hrp__h">4. Ficha cadastral e técnica</h4>
      <div class="hrp__lic">
        <span class="hrp__lic-pill">{{ licenciamento.rotulo }}</span>
        <span>{{ licenciamento.texto }}</span>
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

      <!-- 5. valor -->
      <h4 class="hrp__h">5. Valor de mercado e custo de propriedade</h4>
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

      <!-- verificacao de autenticidade, como no laudo -->
      <footer class="hrp__aut">
        <div v-if="qrExemplo" class="hrp__aut-qr" aria-hidden="true" v-html="qrExemplo" />
        <div class="hrp__aut-txt">
          <strong>Verificação de autenticidade</strong>
          <span>Todo relatório tem código próprio e endereço permanente para conferir o documento original.</span>
        </div>
      </footer>
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

  &__body { padding: 20px; }

  // cabecalho de documento: mesma gramatica do laudo real
  &__doc {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid $c-slab;
  }

  &__doc-logo,
  &__doc-logo :deep(.placa-logo) { height: 36px; width: auto; flex-shrink: 0; }

  &__doc-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    text-align: right;
  }

  &__doc-titulo {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $c-slab;
  }

  &__doc-linha { font-size: 11px; color: $c-graphite; }

  &__doc-validade { margin: 6px 0 0; font-size: 11px; color: $c-graphite; }

  @media (max-width: 560px) {
    &__doc { flex-direction: column; align-items: flex-start; }
    &__doc-meta { align-items: flex-start; text-align: left; }
  }

  // ---- veiculo ----
  &__veh {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 16px;
    border-bottom: 1px solid $c-hair;
  }

  &__veh-txt {
    display: flex;
    flex-direction: column;
    min-width: 0;

    strong { font-size: 16px; font-weight: 500; }
    span { font-size: 13px; color: $c-graphite; }
  }

  // a mesma placa Mercosul do laudo, em miniatura
  &__placa { width: 132px; flex-shrink: 0; margin-left: auto; }

  &__parecer-rotulo {
    display: block;
    margin: 14px 0 4px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $c-graphite;
  }

  &__lic {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    margin-bottom: 12px;
    border: 1px solid rgba(30, 158, 74, 0.35);
    background: #eef9f1;
    border-radius: 4px;
    font-size: 12px;
    color: #14622f;
  }

  &__lic-pill {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
    padding: 2px 7px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.75);
  }

  &__aut {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 20px;
    padding: 12px 14px;
    border: 1px solid $c-hair;
    border-radius: 4px;
  }

  &__aut-qr {
    width: 52px;
    height: 52px;
    flex-shrink: 0;

    :deep(svg) { width: 100%; height: 100%; display: block; }
  }

  &__aut-txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11.5px;
    line-height: 1.45;
    color: $c-graphite;

    strong {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: $c-ink;
    }
  }

  // ---- veredito ----
  &__verdict {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin-top: 0;
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
