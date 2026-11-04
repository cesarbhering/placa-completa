<script setup lang="ts">
import { precoBRL } from '~/shared/planos'
import { linkBump } from '~/shared/cupom-bump'
import { enfileirarEventoFunil } from '~/composables/useAnalytics'

// Pedido acoplado (04/nov/2026): depois do pagamento confirmado, a segunda
// placa com o relatorio completo por R$ 29,90. O servidor cria o cupom (preso
// ao e-mail do comprador, 1 uso, 24 h) e e ele que recusa fora disso; aqui so
// mostra. Sem cupom (pedido sem e-mail, app, ja usado, vencido): nada aparece.
const props = defineProps<{ token: string; onde: 'checkout' | 'relatorio' }>()

const bump = ref<{ codigo: string; validoAte: string; precoCentavos: number } | null>(null)

const vence = computed(() => {
  if (!bump.value) return ''
  const p = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(bump.value.validoAte))
  const g = (t: string) => p.find((x) => x.type === t)?.value || ''
  return `${g('day')}/${g('month')} às ${g('hour')}h${g('minute')}`
})

onMounted(async () => {
  if (!props.token) return
  try {
    const r: any = await $fetch('/api/premium/cupom-bump', { query: { token: props.token } })
    if (r?.bump?.codigo) {
      bump.value = r.bump
      enfileirarEventoFunil('bump_visto', { plano: 'completa', extra: { onde: props.onde } })
    }
  } catch { /* sem oferta */ }
})

function clicou() {
  enfileirarEventoFunil('bump_click', { plano: 'completa', extra: { onde: props.onde } })
}
</script>

<template>
  <div v-if="bump" class="osp" :class="`osp--${onde}`">
    <p class="osp__t">Consultar uma segunda placa com o relatório completo por {{ precoBRL(bump.precoCentavos) }}</p>
    <p class="osp__s">Vale até {{ vence }}, uma vez, para o e-mail desta compra.</p>
    <a :href="linkBump(bump.codigo)" class="osp__btn" @click="clicou">Consultar outra placa</a>
  </div>
</template>

<style scoped>
.osp { margin: 12px 0; padding: 14px 16px; border: 2px solid #1f6feb; border-radius: 12px; background: #f3f8ff; text-align: left; }
.osp__t { margin: 0 0 4px; font-weight: 700; color: #0f2d5c; font-size: 16px; line-height: 1.35; }
.osp__s { margin: 0 0 10px; font-size: 13px; color: #3d3d3d; }
.osp__btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 18px; border-radius: 8px; background: #1f6feb; color: #fff; font-weight: 600; text-decoration: none; }
.osp__btn:hover { background: #1958c2; }
</style>
