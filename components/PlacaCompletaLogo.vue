<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'default' | 'brutalist' | 'fintech' | 'inverted'
  /**
   * Corta o vazio vertical do viewBox original (0 0 304 120), que tem 28
   * unidades sobrando em cima e 12,5 embaixo: 34% da altura sem tinta, e
   * assimetrico, o que ainda empurra a marca pra baixo dentro da caixa.
   *
   * O corte sai da GEOMETRIA, nao de getBBox(): os cantos vao de y=28 a y=100
   * e os dois textos sao caixa alta com baseline em y=100, entao abaixo disso
   * so existe descendente vazio. Assim o recorte nao depende da fonte estar
   * instalada. Na horizontal nao mexo: a largura do texto muda conforme a
   * Trebuchet exista ou caia no fallback, e cortar ali arriscaria clipar.
   *
   * Opcional porque quem dimensiona por largura (dash, admin, PWA) veria a
   * altura encolher. Ligado so onde foi pedido.
   */
  crop?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  crop: false,
})

const viewBox = computed(() => (props.crop ? '0 26 304 76' : '0 0 304 120'))

const colors = computed(() => {
  switch (props.variant) {
    case 'brutalist':
      return { primary: '#000000', accent: '#00FFA3' }
    case 'fintech':
      return { primary: '#0B1F3A', accent: '#2BD9C3' }
    case 'inverted':
      return { primary: '#ffffff', accent: '#00FFA3' }
    default:
      return { primary: '#0B1F3A', accent: '#00D1B2' }
  }
})
</script>

<template>
  <svg
    class="placa-logo"
    :viewBox="viewBox"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="PlacaCompleta"
  >
    <rect x="24" y="40" width="80" height="48" rx="2" :fill="colors.primary" />
    <rect x="24" y="40" width="8" height="48" :fill="colors.accent" />

    <rect x="40" y="60" width="8" height="8" fill="#fff" />
    <rect x="56" y="60" width="8" height="8" fill="#fff" />
    <rect x="72" y="60" width="8" height="8" fill="#fff" />

    <path d="M16 32 H36 V28 H12 V52 H16 Z" :fill="colors.primary" />
    <path d="M112 32 H92 V28 H116 V52 H112 Z" :fill="colors.primary" />
    <path d="M16 96 H36 V100 H12 V76 H16 Z" :fill="colors.primary" />
    <path d="M112 96 H92 V100 H116 V76 H112 Z" :fill="colors.primary" />

    <!--
      textLength trava a largura das duas palavras.
      Sem ele, a largura dependia de a Trebuchet existir na maquina de quem
      abre o site: onde ela nao existe (Linux, boa parte dos Androids, e o
      nosso proprio headless), a fonte de fallback e mais larga e o A final de
      COMPLETA passava dos 304 do viewBox e ficava CORTADO. Estava assim no
      cabecalho de todas as paginas.
      Aumentar o viewBox resolveria o corte mas deixaria a marca flutuando com
      largura diferente em cada maquina; fixar o comprimento mantem o
      logotipo igual em qualquer lugar, que e o minimo que se espera de uma
      marca. lengthAdjust=spacingAndGlyphs condensa letra e espaco juntos, em
      vez de so espremer os espacos.
    -->
    <text
      x="140"
      y="70"
      font-family="'Trebuchet MS', Tahoma, 'Segoe UI', sans-serif"
      font-size="36"
      font-weight="700"
      textLength="120"
      lengthAdjust="spacingAndGlyphs"
      :fill="colors.primary"
    >PLACA</text>
    <text
      x="140"
      y="100"
      font-family="'Trebuchet MS', Tahoma, 'Segoe UI', sans-serif"
      font-size="32"
      font-weight="400"
      textLength="156"
      lengthAdjust="spacingAndGlyphs"
      :fill="colors.primary"
    >COMPLETA</text>
  </svg>
</template>

<style scoped>
.placa-logo {
  display: block;
  width: 100%;
  height: auto;
}
</style>
