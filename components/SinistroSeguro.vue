<script setup lang="ts">
import type { TelaSinistro } from '~/shared/historico-veicular'

// Insurance block of the Completa report (vehicle history partner,
// 13/11/2026). Shows only when there is something: total loss, damage,
// accident, recovery, theft, restriction. The opinion follows the prototype
// approved by Cesar; two indicators feed it without their text ever showing.
defineProps<{ tela: TelaSinistro }>()
</script>

<template>
  <div class="ss">
    <p class="ss-sub">O que as bases de seguradoras registram sobre este veículo.</p>
    <dl v-if="tela.linhas.length" class="ss-linhas">
      <div v-for="(l, i) in tela.linhas" :key="`${l.titulo}-${i}`" class="ss-linha">
        <dt>{{ l.titulo }}</dt>
        <dd>
          <span class="ss-chip" :class="`ss-chip--${l.tom}`">{{ l.valor }}</span>
          <small v-if="l.detalhe">{{ l.detalhe }}</small>
        </dd>
      </div>
    </dl>
    <div v-if="tela.parecer" class="ss-parecer" :class="`ss-parecer--${tela.parecer.tom}`">
      <strong>{{ tela.parecer.titulo }}</strong>
      <p>{{ tela.parecer.texto }}</p>
    </div>
    <p class="ss-nota">Indicador de apoio à decisão. Cada seguradora tem a sua regra de aceitação.</p>
  </div>
</template>

<style scoped>
.ss-sub { margin: 0 0 12px; font-size: calc(13.5px * var(--rel-fs, 1)); color: #636363; }
.ss-linhas { margin: 0 0 12px; display: grid; gap: 8px; }
.ss-linha { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 4px 12px; align-items: baseline; font-size: calc(14px * var(--rel-fs, 1)); break-inside: avoid; }
.ss-linha dt { margin: 0; color: #636363; }
.ss-linha dd { margin: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; min-width: 0; }
.ss-linha small { font-size: calc(13px * var(--rel-fs, 1)); color: #636363; overflow-wrap: anywhere; }
.ss-chip { display: inline-flex; align-items: center; padding: 4px 9px; border-radius: 999px; font-size: calc(12.5px * var(--rel-fs, 1)); font-weight: 700; line-height: 1.1; white-space: nowrap; background: #f2f3f5; color: #3d3d3d; }
.ss-chip--atencao { background: #fff4dc; color: #6b4600; }
.ss-chip--alerta { background: #fdecea; color: #b3261e; }
.ss-parecer { border-radius: 12px; padding: 12px 14px; border: 1px solid; break-inside: avoid; }
.ss-parecer strong { display: block; font-size: calc(15px * var(--rel-fs, 1)); }
.ss-parecer p { margin: 4px 0 0; font-size: calc(13.5px * var(--rel-fs, 1)); line-height: 1.5; }
.ss-parecer--alerta { background: #fdf1f1; border-color: #f2c9c9; color: #8a1c1c; }
.ss-parecer--atencao { background: #fff8e8; border-color: #f1dca8; color: #6b4600; }
.ss-nota { margin: 12px 0 0; font-size: calc(12px * var(--rel-fs, 1)); color: #636363; }
@media (max-width: 560px) {
  .ss-linha { grid-template-columns: minmax(0, 1fr); }
}
@media print {
  .ss-chip, .ss-parecer { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
