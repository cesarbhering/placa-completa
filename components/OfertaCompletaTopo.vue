<script setup lang="ts">
// Consulta e oferta do Relatorio Completo logo abaixo da resposta direta das paginas de
// guia (leilao e roubo), com o campo de placa primeiro e a oferta logo depois. O preco vem de <PrecoCompleta>/<PrecoPromo> (teste A/B
// de preco), nunca escrito no texto. O campo de placa leva para /placa/<PLACA>,
// onde a oferta e o checkout rodam.
import { precoDePromocao } from '~/shared/planos'
const props = defineProps<{ origem: string; foco: string }>()
const { t } = useIdioma()
const temPromo = !!precoDePromocao('completa')
</script>

<template>
  <ConsultarPlacaCard :origem="props.origem" titulo="Digite a placa e veja o que consta" />
  <div class="pc-callout">
    <p>
      <strong>{{ t('compra.relatorioCompleto') }}</strong> <PrecoPromo v-if="temPromo" inline /><strong v-else><PrecoCompleta espaco="&nbsp;" /></strong>.
      Ele consulta as bases e mostra {{ props.foco }} da placa, direto na tela. {{ t('compra.pagamento') }}
    </p>
  </div>
</template>
