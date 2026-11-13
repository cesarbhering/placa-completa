<script setup lang="ts">
import { computed, ref } from 'vue'
import { DONOS_VISIVEIS, type TelaDonos } from '~/shared/historico-veicular'

// Owners block of the Completa report (vehicle history partner, 13/11/2026;
// content of the prototype approved by Cesar). Counts, current owner, states,
// the five most recent records and "see all". Never a name or a document: the
// server sends only type, state, date and time with the vehicle.
const props = defineProps<{ tela: TelaDonos; nomeVeiculo?: string }>()
const aberto = ref(false)
// All records render; the older ones stay hidden on screen until "see all"
// and always go to paper.
const linhas = computed(() => props.tela.linhas)
const sobra = computed(() => props.tela.linhas.length > DONOS_VISIVEIS)
</script>

<template>
  <div class="hd">
    <p class="hd-sub">Por quantas mãos o {{ nomeVeiculo || 'veículo' }} passou, por quanto tempo e em quais estados.</p>
    <div class="hd-nums">
      <div>
        <b>{{ tela.total }}</b>
        <span>{{ tela.totalTexto }}</span>
      </div>
      <div>
        <b>{{ tela.atual?.tempo || 'Sem dado' }}</b>
        <span>com o dono atual<template v-if="tela.atual?.desde">, desde {{ tela.atual.desde }}</template></span>
      </div>
      <div>
        <b>{{ tela.estados.length ? tela.estados.join(' · ') : 'Sem dado' }}</b>
        <span>{{ tela.estados.length === 1 ? 'estado por onde passou' : 'estados por onde passou' }}<template v-if="tela.zeroKm">; zero km em {{ tela.zeroKm }}</template></span>
      </div>
    </div>
    <p v-if="tela.alertaTrocaRapida" class="hd-alerta" role="note">{{ tela.alertaTrocaRapida }}</p>
    <ul v-if="linhas.length" class="hd-tempo">
      <li v-for="(l, i) in linhas" :key="`${l.data}-${i}`" :class="{ 'hd-tempo--atual': l.atual, 'hd-extra': !aberto && i >= DONOS_VISIVEIS }">
        <span class="hd-data">{{ l.data }}</span>
        <span class="hd-quem"><i class="hd-ponto" :class="`hd-ponto--${l.atual ? 'atual' : l.curta ? 'curta' : 'antes'}`" aria-hidden="true" />{{ l.tipo }}<template v-if="l.uf"> · {{ l.uf }}</template></span>
        <span class="hd-posse">
          <span>{{ l.posse }}</span>
          <span class="hd-barra" :class="{ 'hd-barra--curta': l.curta }" aria-hidden="true"><b :style="{ width: `${l.largura}%` }" /></span>
        </span>
      </li>
    </ul>
    <button v-if="sobra" type="button" class="hd-mais" :aria-expanded="aberto" @click="aberto = !aberto">
      {{ aberto ? `Mostrar só os ${DONOS_VISIVEIS} mais recentes` : `Ver os ${tela.linhas.length} registros com data` }}
    </button>
    <p class="hd-nota">{{ tela.nota }}</p>
  </div>
</template>

<style scoped>
.hd-sub { margin: 0 0 12px; font-size: calc(13.5px * var(--rel-fs, 1)); color: #636363; }
.hd-nums { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 0 0 12px; }
.hd-nums > div { border: 1px solid #e8e8e8; border-radius: 12px; padding: 10px 12px; background: #fafbfc; min-width: 0; }
.hd-nums b { display: block; font-size: calc(17px * var(--rel-fs, 1)); line-height: 1.25; color: #1a1a1a; overflow-wrap: anywhere; }
.hd-nums span { display: block; margin-top: 2px; font-size: calc(12.5px * var(--rel-fs, 1)); color: #636363; line-height: 1.35; }
.hd-alerta { margin: 0 0 12px; padding: 10px 12px; border-radius: 10px; background: #fff4dc; color: #6b4600; font-size: calc(13.5px * var(--rel-fs, 1)); line-height: 1.45; font-weight: 600; }
.hd-tempo { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
.hd-tempo li { display: grid; grid-template-columns: 92px minmax(0, 1fr) minmax(0, 1.1fr); gap: 4px 12px; align-items: center; padding: 8px 0; border-top: 1px solid #eceef1; font-size: calc(13.5px * var(--rel-fs, 1)); break-inside: avoid; }
.hd-tempo li:first-child { border-top: 0; }
.hd-tempo li.hd-extra { display: none; }
.hd-data { color: #636363; font-variant-numeric: tabular-nums; }
.hd-quem { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #1a1a1a; min-width: 0; }
.hd-ponto { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; background: #c2c2c2; }
.hd-ponto--atual { background: #1f6feb; }
.hd-ponto--curta { background: #d39a00; }
.hd-posse { display: grid; gap: 4px; color: #3d3d3d; }
.hd-tempo--atual .hd-posse > span:first-child { font-weight: 600; color: #1a1a1a; }
.hd-barra { display: block; height: 5px; border-radius: 999px; background: #f2f3f5; overflow: hidden; }
.hd-barra b { display: block; height: 100%; border-radius: inherit; background: #9fb8dd; }
.hd-barra--curta b { background: #e3b341; }
.hd-mais { margin: 8px 0 0; padding: 0; border: 0; background: none; color: #1f6feb; font: inherit; font-size: calc(13.5px * var(--rel-fs, 1)); font-weight: 600; cursor: pointer; text-decoration: underline; }
.hd-nota { margin: 12px 0 0; font-size: calc(12px * var(--rel-fs, 1)); color: #636363; line-height: 1.45; }
@media (max-width: 560px) {
  .hd-nums { grid-template-columns: minmax(0, 1fr); }
  .hd-tempo li { grid-template-columns: 84px minmax(0, 1fr); }
  .hd-posse { grid-column: 1 / -1; }
}
@media print {
  .hd-tempo li.hd-extra { display: grid; }
  .hd-ponto, .hd-barra b, .hd-alerta { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
