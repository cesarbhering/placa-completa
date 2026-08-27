<script setup lang="ts">
// Simulacao da placa Mercosul. Nasceu embutida no hero e agora e componente
// porque o relatorio mostra a mesma placa: duas copias da moldura divergiriam
// no primeiro ajuste. Todo o dimensionamento e por container query, entao o
// tamanho vem de quem usa (basta dar largura), e as proporcoes se mantem.
//
// Dois modos: com slot vira campo digitavel (hero), sem slot vira leitura
// (relatorio), usando a prop `placa`.
//
// `width`: usado pelos usos "mini" (relatorio, exemplo da home) que
// precisam de uma largura menor que o max-width padrao (460px). ANTES isso
// era feito passando uma class externa (ex: class="rel__placa-tag") que o
// Vue funde no elemento raiz do componente — mas essa class e o CSS proprio
// do componente (.cb-plate { width:100% }) ficam com a MESMA especificidade
// (ambos ganham o atributo de escopo do Vue), entao quem vence e so questao
// de qual chunk de CSS carregou primeiro. Isso causava o flash reportado: a
// placa nascia no tamanho grande (460px, CSS do proprio componente) e so
// encolhia pro tamanho certo (190px/132px) quando o CSS da PAGINA que passa
// a class terminava de carregar, as vezes um bom tempo depois do primeiro
// paint. Prop + inline style e IMEDIATO e nao depende de ordem de carga:
// style inline sempre vence qualquer regra de classe, mesma especificidade
// ou nao.
defineProps<{
  placa?: string
  erro?: boolean
  mini?: boolean
  width?: number | string
}>()
</script>

<template>
  <!-- moldura preta, tarja azul com o selo do Mercosul a esquerda, BRASIL
       centralizado e a bandeira a direita, "BR" no canto inferior esquerdo. -->
  <div
    class="cb-plate"
    :class="{ 'is-erro': erro, 'is-mini': mini }"
    :style="width ? { width: typeof width === 'number' ? `${width}px` : width, flexShrink: 0 } : undefined"
  >
    <div class="cb-plate__band">
      <span class="cb-plate__merco" aria-hidden="true">
        <svg viewBox="0 0 44 20" class="cb-plate__estrelas">
          <!-- as quatro estrelas do selo, em arco -->
          <path d="M8 9 L8.9 11.1 11.1 11.3 9.4 12.8 9.9 15 8 13.8 6.1 15 6.6 12.8 4.9 11.3 7.1 11.1Z" />
          <path d="M17 5.5 L17.9 7.6 20.1 7.8 18.4 9.3 18.9 11.5 17 10.3 15.1 11.5 15.6 9.3 13.9 7.8 16.1 7.6Z" />
          <path d="M27 5.5 L27.9 7.6 30.1 7.8 28.4 9.3 28.9 11.5 27 10.3 25.1 11.5 25.6 9.3 23.9 7.8 26.1 7.6Z" />
          <path d="M36 9 L36.9 11.1 39.1 11.3 37.4 12.8 37.9 15 36 13.8 34.1 15 34.6 12.8 32.9 11.3 35.1 11.1Z" />
        </svg>
        <span class="cb-plate__merco-txt">MERCOSUL</span>
      </span>
      <span class="cb-plate__country">BRASIL</span>
      <img src="/flag-br.svg" alt="" class="cb-plate__bandeira" aria-hidden="true" width="30" height="21">
    </div>
    <slot>
      <span class="cb-plate__texto">{{ placa }}</span>
    </slot>
    <span class="cb-plate__br" aria-hidden="true">BR</span>
  </div>
</template>

<style lang="scss" scoped>
// Paleta local, mesma convencao dos outros componentes v2.
$c-blue: #1f6feb;
$c-red: #d33a3a;
$c-font: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

// A placa real usa a FE-Schrift, estreita e pesada. Sem ela, peso maximo com
// tracking largo e o que mais aproxima. 15cqw deixa o glifo em ~34% da altura
// da placa (na fisica sao ~37%).
@mixin caracteres {
  flex: 1;
  min-height: 0;
  // O componente e a moldura: o campo entra sem cromo proprio. O anel de foco
  // fica no :focus-within do container, entao tirar o outline aqui nao deixa
  // o teclado sem indicacao.
  border: 0;
  background: transparent;
  outline: none;
  appearance: none;
  border-radius: 0;
  font-family: $c-font;
  font-size: 40px;
  font-size: 15cqw;
  font-weight: 800;
  letter-spacing: 0.1em;
  line-height: 1;
  color: #111;
  text-align: center;
  padding: 0 2cqw 0 6cqw;   // folga a esquerda pro selo "BR"
  text-transform: uppercase;
}

.cb-plate {
  position: relative;
  container-type: inline-size;
  aspect-ratio: 400 / 130;
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  border: 3px solid #111;
  border-radius: 10px;
  box-shadow: none;
  overflow: hidden;
  background: #fff;

  // Guia: foco troca a borda, sem halo. Aqui a moldura preta e da propria
  // placa, entao o foco vai num anel externo pra nao descaracterizar o objeto.
  &:focus-within {
    border-color: #111;
    box-shadow: 0 0 0 3px rgba(31, 111, 235, 0.45);
  }

  &.is-erro { border-color: $c-red; }

  // Em tamanho pequeno a moldura de 3px come a placa e o raio de 10px
  // arredonda demais pro que sobra.
  &.is-mini {
    border-width: 2px;
    border-radius: 5px;
    margin: 0;
  }

  &__band {
    flex: 0 0 26%;   // a tarja ocupa ~25% da altura na placa real
    // Mesmo azul do CTA logo abaixo, em vez do navy da placa fisica: a tarja
    // passa a conversar com o botao "Consultar placa".
    background: $c-blue;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1.5cqw;
    padding: 0 2cqw;
  }

  // selo do Mercosul (estrelas + palavra), alinhado a esquerda
  &__merco {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.3cqw;
    line-height: 1;
  }

  &__estrelas {
    width: 7cqw;
    height: 3.2cqw;
    fill: #fff;
    display: block;
  }

  &__merco-txt {
    font-size: 1.6cqw;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #fff;
  }

  &__country {
    color: #fff;
    font-family: $c-font;
    font-size: 3.6cqw;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-align: center;
    text-indent: 0.22em;   // o tracking desloca; compensa pra centrar de fato
    line-height: 1;
  }

  &__bandeira {
    width: 7cqw;
    height: 4.9cqw;
    display: block;
    justify-self: end;
    border-radius: 1px;
  }

  // "BR" no canto inferior esquerdo, em caixa preta
  &__br {
    position: absolute;
    left: 1.2cqw;
    bottom: 1.2cqw;
    background: #111;
    color: #fff;
    font-family: $c-font;
    font-size: 2.6cqw;
    font-weight: 800;
    line-height: 1;
    padding: 0.6cqw 0.8cqw;
    border-radius: 2px;
    pointer-events: none;
  }

  // modo leitura
  &__texto {
    @include caracteres;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

// modo campo: o input vem de quem usa, entao precisa de :slotted pra receber
// o estilo da placa.
:slotted(.cb-plate__input) {
  @include caracteres;

  &::placeholder { color: #c9c9c9; letter-spacing: 0.1em; font-weight: 800; }
}
</style>
