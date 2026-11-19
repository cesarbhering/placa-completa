<script setup lang="ts">
// Oferta do Relatorio Completo logo abaixo da resposta direta das paginas de
// guia (leilao e roubo). O preco vem de <PrecoCompleta>/<PrecoPromo> (teste A/B
// de preco), nunca escrito no texto. O campo de placa leva para /placa/<PLACA>,
// onde a oferta e o checkout rodam.
import { precoDePromocao } from '~/shared/planos'
const props = defineProps<{ origem: string; foco: string }>()
const { t } = useIdioma()
const temPromo = !!precoDePromocao('completa')
</script>

<template>
  <div class="pc-callout">
    <p>
      <strong>{{ t('compra.relatorioCompleto') }}</strong> <PrecoPromo v-if="temPromo" inline /><strong v-else><PrecoCompleta espaco=" " /></strong>.
      Ele consulta as bases e mostra {{ props.foco }} da placa, direto na tela. {{ t('compra.pagamento') }}
    </p>
  </div>
  <ConsultarPlacaCard :origem="props.origem" titulo="Digite a placa e veja o que consta" />
</template>
