<script setup lang="ts">
import type { LinhaUso } from '~/shared/historico-veicular'

// Previous use block of the Completa report (vehicle history partner,
// 13/11/2026). Shows only when there is something. Bank and insurer may be
// named (companies); a private company never.
defineProps<{ tela: { linhas: LinhaUso[]; nota: string | null } }>()
</script>

<template>
  <div class="ua">
    <p class="ua-sub">Quem já usou o veículo e como, pelas bases consultadas.</p>
    <dl class="ua-linhas">
      <div v-for="(l, i) in tela.linhas" :key="`${l.titulo}-${i}`" class="ua-linha">
        <dt>{{ l.titulo }}</dt>
        <dd><span class="ua-chip" :class="`ua-chip--${l.tom}`">{{ l.texto }}</span></dd>
      </div>
    </dl>
    <p v-if="tela.nota" class="ua-nota">{{ tela.nota }}</p>
  </div>
</template>

<style scoped>
.ua-sub { margin: 0 0 12px; font-size: calc(13.5px * var(--rel-fs, 1)); color: #636363; }
.ua-linhas { margin: 0; display: grid; gap: 8px; }
.ua-linha { display: grid; grid-template-columns: 160px minmax(0, 1fr); gap: 4px 12px; align-items: baseline; font-size: calc(14px * var(--rel-fs, 1)); break-inside: avoid; }
.ua-linha dt { margin: 0; color: #636363; }
.ua-linha dd { margin: 0; min-width: 0; }
.ua-chip { display: inline-block; max-width: 100%; padding: 4px 10px; border-radius: 10px; line-height: 1.4; font-weight: 600; background: #f2f3f5; color: #3d3d3d; overflow-wrap: anywhere; }
.ua-chip--atencao { background: #fff4dc; color: #6b4600; }
.ua-chip--alerta { background: #fdecea; color: #b3261e; }
.ua-nota { margin: 12px 0 0; font-size: calc(12px * var(--rel-fs, 1)); color: #636363; }
@media (max-width: 560px) {
  .ua-linha { grid-template-columns: minmax(0, 1fr); }
}
@media print {
  .ua-chip { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
