<script setup lang="ts">
// Caixa do topo do bloco do DETRAN (14/out, aprovada pelo Cesar): quanto falta
// quitar pra transferir, por item, o que trava a transferencia e a
// consequencia do licenciamento atrasado. Logica em shared/detran-quitar.ts.
import type { ResumoQuitar } from '~/shared/detran-quitar'

const props = defineProps<{ resumo: ResumoQuitar }>()
const reais = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ')
</script>

<template>
  <div class="dq" :class="{ 'dq--ok': !props.resumo.totalCentavos && !props.resumo.travas.length }">
    <p v-if="props.resumo.totalCentavos" class="dq__tit">
      <span>Para transferir este veículo, falta quitar</span>
      <b class="dq__total">{{ reais(props.resumo.totalCentavos) }}</b>
    </p>
    <p v-else class="dq__tit dq__tit--nada">{{ props.resumo.nadaAQuitar }}</p>

    <ul v-if="props.resumo.linhas.length" class="dq__linhas">
      <li v-for="l in props.resumo.linhas" :key="l.rotulo">
        <span>{{ l.rotulo }}</span><b>{{ reais(l.centavos) }}</b>
      </li>
    </ul>
    <p v-if="props.resumo.totalDoDetran" class="dq__nota">Total informado pelo próprio DETRAN{{ props.resumo.uf ? '-' + props.resumo.uf : '' }}, com juros e correção.</p>

    <p class="dq__travas">
      <b>Restrições que travam a transferência:</b>
      {{ props.resumo.travas.length ? props.resumo.travas.join('; ') + '.' : 'nenhuma.' }}
    </p>
    <p v-if="props.resumo.consequencia" class="dq__alerta">{{ props.resumo.consequencia }}</p>
  </div>
</template>

<style scoped>
.dq { border: 1px solid #f1c4c4; background: #fff7f7; border-radius: 10px; padding: 12px 14px; margin: 6px 0 12px; }
.dq--ok { border-color: #c9e7d2; background: #f4fbf6; }
.dq__tit { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin: 0; font-size: calc(14px * var(--rel-fs, 1)); color: #1a1a1a; font-weight: 600; }
.dq__tit--nada { color: #1d6b3a; }
.dq__total { color: #a32020; font-size: calc(20px * var(--rel-fs, 1)); white-space: nowrap; }
.dq__linhas { list-style: none; margin: 8px 0 0; padding: 0; }
.dq__linhas li { display: flex; justify-content: space-between; gap: 10px; padding: 3px 0; font-size: calc(13px * var(--rel-fs, 1)); color: #3d3d3d; border-top: 1px dashed #ead6d6; }
.dq__linhas b { white-space: nowrap; color: #1a1a1a; }
.dq__nota { margin: 6px 0 0; font-size: calc(12px * var(--rel-fs, 1)); color: #6b7280; }
.dq__travas { margin: 8px 0 0; font-size: calc(13px * var(--rel-fs, 1)); color: #3d3d3d; }
.dq__alerta { margin: 8px 0 0; font-size: calc(13px * var(--rel-fs, 1)); color: #a32020; font-weight: 600; }
</style>
