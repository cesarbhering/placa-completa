<script setup lang="ts">
// Grafico do valor FIPE no relatorio pago. ECharts com renderer SVG: imprime
// nitido (o relatorio tem folha de impressao) e so os modulos usados entram no
// bundle — linha, grade, tooltip e zoom, nada alem.
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, DataZoomComponent, GraphicComponent } from 'echarts/components'
import VChart from 'vue-echarts'

use([SVGRenderer, LineChart, GridComponent, TooltipComponent, DataZoomComponent, GraphicComponent])

const props = defineProps<{
  historico: { label: string; price: number }[]
}>()

// Paleta local, mesma convencao dos outros componentes v2 e a mesma adaptacao
// do DESIGN-hp.md que a home documenta: o azul de sinal do guia vira o azul da
// casa (#1f6feb) — o #024ad8 e marca da HP e fica de fora de proposito.
const AZUL = '#1f6feb'
const HAIR = '#e8e8e8'
const STEEL = '#c2c2c2'
const CLOUD = '#f7f7f7'
const INK = '#1a1a1a'
const GRAFITE = '#636363'
const FONTE = "'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

// HUD fixo no mobile: o tooltip padrao do ECharts nasce embaixo do dedo (segue
// o ponto de toque), entao no celular ele fica ESCONDIDO ATRAS DO PROPRIO DEDO
// — feedback de cliente real. No desktop o tooltip no cursor continua normal
// (mouse nao tampa a propria leitura). So no mobile a leitura sai daqui: uma
// faixa fixa no topo do grafico, atualizada conforme o dedo arrasta pelo eixo.
// Comeca no ultimo ponto (valor mais recente), que e o que a pessoa quer ver
// antes mesmo de tocar.
const hud = ref<{ label: string; price: number }>(
  props.historico[props.historico.length - 1],
)
// Historico trocou (ex.: o cliente indicou o cambio e a versao mudou): o HUD
// volta pro ultimo ponto da serie nova.
watch(() => props.historico, (h) => { if (h?.length) hud.value = h[h.length - 1] })
function aoMoverPonteiro(params: any) {
  const idx = params?.axesInfo?.[0]?.value
  const ponto = typeof idx === 'number' ? props.historico[Math.round(idx)] : null
  if (ponto) hud.value = ponto
}

// Mesmo breakpoint do CSS que mostra o HUD (640px): quando o HUD assume a
// leitura, o tooltip nativo do ECharts (que nasce sob o dedo) so atrapalharia
// — desliga ele nesse caso. Desktop mantem o tooltip no cursor normalmente.
const ehMobile = ref(false)
let mql: MediaQueryList | null = null
function atualizaMobile() { ehMobile.value = !!mql?.matches }
onMounted(() => {
  if (!import.meta.client) return
  mql = window.matchMedia('(max-width: 640px)')
  atualizaMobile()
  mql.addEventListener('change', atualizaMobile)
})
onUnmounted(() => mql?.removeEventListener('change', atualizaMobile))

const opcao = computed(() => ({
  animationDuration: 350,
  textStyle: { fontFamily: FONTE },
  // Marca d'agua: o logo atras dos dados, apagado o bastante pra nao competir
  // com a linha. `silent` tira ele do caminho do mouse; z negativo poe atras.
  graphic: [{
    type: 'image',
    left: 'center',
    top: 'middle',
    z: -10,
    silent: true,
    style: {
      image: '/logo-horizontal-600.png',
      width: 210,
      height: 83,   // proporcao real do arquivo (1200x474)
      opacity: 0.06,
    },
  }],
  grid: { left: 8, right: 16, top: 14, bottom: 48, containLabel: true },
  xAxis: {
    type: 'category',
    data: props.historico.map((p) => p.label),
    boundaryGap: false,
    axisLine: { lineStyle: { color: HAIR } },
    axisTick: { show: false },
    axisLabel: { color: GRAFITE, fontSize: 11 },
  },
  yAxis: {
    type: 'value',
    // Nao ancora no zero: em serie de preco, ancorar no zero achata a variacao
    // ate virar linha reta. Honesto porque o eixo e rotulado.
    scale: true,
    axisLabel: { color: GRAFITE, fontSize: 11, formatter: (v: number) => brl(v) },
    splitLine: { lineStyle: { color: HAIR } },
  },
  tooltip: {
    // No mobile o HUD fixo no topo assume a leitura (ver .gv-hud); o tooltip
    // nativo nasceria embaixo do dedo, escondido, entao some. axisPointer
    // (a linha vertical que acompanha o toque) continua — so o balao some.
    show: !ehMobile.value,
    trigger: 'axis',
    backgroundColor: '#ffffff',
    borderColor: HAIR,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: INK, fontFamily: FONTE, fontSize: 13 },
    formatter: (par: any) => {
      const p = Array.isArray(par) ? par[0] : par
      return `<span style="color:${GRAFITE};font-size:11px">${p.name}</span><br><strong>${brl(p.value)}</strong>`
    },
    axisPointer: { type: 'line', lineStyle: { color: STEEL, type: 'dashed' } },
  },
  dataZoom: [
    // Pinch no toque; roda do mouse so com Ctrl, senao o grafico sequestra a
    // rolagem da pagina.
    { type: 'inside', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false },
    {
      type: 'slider',
      height: 20,
      bottom: 6,
      borderColor: HAIR,
      backgroundColor: CLOUD,
      fillerColor: 'rgba(31, 111, 235, 0.10)',
      dataBackground: { lineStyle: { color: STEEL }, areaStyle: { color: 'rgba(31, 111, 235, 0.05)' } },
      selectedDataBackground: { lineStyle: { color: AZUL }, areaStyle: { color: 'rgba(31, 111, 235, 0.12)' } },
      handleStyle: { color: AZUL, borderColor: AZUL },
      moveHandleStyle: { color: AZUL },
      emphasis: { handleStyle: { color: AZUL }, moveHandleLabel: { show: false } },
      textStyle: { color: GRAFITE, fontSize: 10 },
      brushSelect: false,
    },
  ],
  series: [{
    type: 'line',
    data: props.historico.map((p) => p.price),
    // Com a serie inteira (anos de historico mensal), bolinha em todo ponto
    // vira colar de contas; o tooltip continua achando o ponto pelo eixo.
    showSymbol: props.historico.length <= 14,
    symbol: 'circle',
    symbolSize: 7,
    itemStyle: { color: AZUL, borderColor: '#ffffff', borderWidth: 1.5 },
    lineStyle: { color: AZUL, width: 2 },
    areaStyle: { color: 'rgba(31, 111, 235, 0.07)' },
  }],
}))
</script>

<template>
  <!-- ECharts mede o container no mount: so cliente. O fallback reserva a
       altura pra pagina nao pular quando o grafico chegar. -->
  <ClientOnly>
    <div class="gv-wrap">
      <!-- So visivel no mobile via CSS (ver media query abaixo); atualizado
           pelo evento de axis pointer independente da tela, custo desprezivel. -->
      <div class="gv-hud" aria-hidden="true">
        <span class="gv-hud__label">{{ hud.label }}</span>
        <strong class="gv-hud__price">{{ brl(hud.price) }}</strong>
      </div>
      <VChart
        class="gv"
        :option="opcao"
        autoresize
        role="img"
        :aria-label="`Variação do valor FIPE de ${historico[0].label} a ${historico[historico.length - 1].label}`"
        @updateAxisPointer="aoMoverPonteiro"
      />
    </div>
    <template #fallback>
      <div class="gv" aria-hidden="true" />
    </template>
  </ClientOnly>
</template>

<style scoped>
.gv-wrap {
  position: relative;
}

.gv {
  width: 100%;
  height: 280px;
}

.gv-hud {
  display: none;
}

@media (max-width: 640px) {
  /* No mobile o HUD substitui o tooltip como leitura principal: fica FIXO
     acima do grafico (nunca embaixo do dedo), atualiza pelo axisPointer. Em
     linha propria, fora da area do grafico: sobreposto ao topo, ele cobria o
     rotulo mais alto do eixo Y ("R$ 42.000"). */
  .gv-hud {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-height: 22px;
    padding: 0 8px 2px;
    pointer-events: none;
  }

  .gv-hud__label {
    font-size: 11px;
    color: #636363;
  }

  .gv-hud__price {
    font-size: 15px;
    font-weight: 700;
    color: #1a1a1a;
  }
}
</style>
