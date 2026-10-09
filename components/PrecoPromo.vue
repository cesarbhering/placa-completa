<script setup lang="ts">
// "Promoção: de <preco antigo> por <preco atual>". Os dois valores vem de shared/planos.ts
// (precoDeCentavos e valorCentavos); sem promocao valida, nao renderiza nada.
import { computed } from 'vue'
import { PLANOS, precoDePromocao, type PlanoId } from '~/shared/planos'

const props = withDefaults(defineProps<{ plano?: PlanoId; semRotulo?: boolean }>(), { plano: 'completa', semRotulo: false })
const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`
const de = computed(() => precoDePromocao(props.plano))
const por = computed(() => PLANOS[props.plano].valorCentavos)
</script>

<template>
  <span v-if="de" class="pp">
    <span v-if="!semRotulo" class="pp__tag">Promoção</span>
    <s class="pp__de">de {{ brl(de) }}</s>
    <strong class="pp__por">por {{ brl(por) }}</strong>
  </span>
</template>

<style scoped>
.pp {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
}
.pp__tag {
  font-size: 0.72em;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #14622f;
  background: #e7f5ec;
  border-radius: 999px;
  padding: 2px 8px;
  align-self: center;
}
.pp__de {
  color: #636363;
  font-weight: 500;
}
.pp__por {
  color: inherit;
  font-weight: 800;
}
</style>
