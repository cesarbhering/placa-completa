<script setup lang="ts">
// FIPE na propria /tabela-fipe-por-placa (plano SEO 02/out, item #8 aprovado).
// Usa o MESMO POST /api/consulta da home (canal 'tela'): bloqueio de UA,
// rate-limit, teto por IP e cache valem igual; nenhuma rota nova. O resultado
// aparece aqui mesmo, sem URL nova. Logo abaixo, a oferta da Completa, que
// abre o mesmo checkout da home.
//
// Funil: de proposito NAO enfileira resultado_exibido/cta_completa_* aqui.
// Esses eventos sao o denominador do A/B do resultado da home e sairiam
// carimbados com a variante da sessao; aqui so vai o evento do gtag.
import { origemDaSessao } from '~/shared/origem-trafego'
import { PLANOS } from '~/shared/planos'

const { validatePlaca } = useFormValidation()
const placa = ref('')
const carregando = ref(false)
const erro = ref('')
const resultado = ref<Record<string, any> | null>(null)
const abrirCheckout = ref(false)
const preco = `R$ ${(PLANOS.completa.valorCentavos / 100).toFixed(2).replace('.', ',')}`
const INCLUI = ['Roubo e furto', 'Leilão', 'Gravame', 'RENAJUD', 'Multas', 'Restrições']

function gtag(evento: string, params: Record<string, any>) {
  if (import.meta.client && (window as any).gtag) (window as any).gtag('event', evento, { source_page: 'tabela-fipe-por-placa', ...params })
}

function onInput(e: Event) {
  placa.value = (e.target as HTMLInputElement).value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7)
  erro.value = ''
}

async function consultar() {
  erro.value = ''
  if (!validatePlaca(placa.value)) { erro.value = 'Placa inválida. Use o formato ABC1D23 ou ABC1234.'; return }
  carregando.value = true
  resultado.value = null
  try {
    const r: any = await $fetch('/api/consulta', {
      method: 'POST',
      body: { email: null, phone: null, channel: 'tela', placa: placa.value, isPWA: false, origin: origemDaSessao() },
    })
    resultado.value = r?.basico || null
    if (!resultado.value) erro.value = r?.message || 'Não encontramos dados para esta placa.'
    gtag('fipe_por_placa_resultado', { tem_fipe: !!r?.basico?.fipe })
  } catch (err: any) {
    erro.value = err?.data?.message || 'Não foi possível consultar agora. Tente de novo em instantes.'
  } finally {
    carregando.value = false
  }
}

function comprar() {
  gtag('cta_click', { origem: 'fipe_por_placa_oferta' })
  abrirCheckout.value = true
}
</script>

<template>
  <section class="fpp" aria-label="Consultar valor FIPE pela placa">
    <form class="fpp__form" novalidate @submit.prevent="consultar">
      <label for="fpp-placa" class="fpp__label">Placa do veículo</label>
      <div class="fpp__linha">
        <input
          id="fpp-placa"
          :value="placa"
          name="placa"
          type="text"
          class="fpp__input"
          placeholder="ABC1D23"
          maxlength="7"
          autocomplete="off"
          autocapitalize="characters"
          @input="onInput"
        >
        <button type="submit" class="pc-btn pc-btn--primary fpp__btn" :disabled="carregando">
          {{ carregando ? 'Consultando…' : 'Ver valor FIPE' }}
        </button>
      </div>
      <p v-if="erro" class="fpp__erro" role="alert">{{ erro }}</p>
    </form>

    <div v-if="resultado" class="fpp__res" aria-live="polite">
      <p class="fpp__veic">
        <strong>{{ [resultado.marca, resultado.modelo].filter(Boolean).join(' ') }}</strong>
        <span v-if="resultado.ano"> · {{ resultado.anoFabricacao && resultado.anoFabricacao !== resultado.ano ? `${resultado.anoFabricacao}/${resultado.ano}` : resultado.ano }}</span>
        <span v-if="resultado.cor"> · {{ resultado.cor }}</span>
      </p>
      <div class="fpp__fipe">
        <span>Valor FIPE</span>
        <strong>{{ resultado.fipe || 'Não disponível para esta placa' }}</strong>
      </div>
      <p v-if="resultado.fipeNota" class="fpp__nota">{{ resultado.fipeNota }}</p>

      <div class="fpp__oferta">
        <p class="fpp__oferta-t">O valor FIPE não diz se este carro tem problema.</p>
        <p class="fpp__oferta-s">O relatório completo mostra o que trava a transferência ou derruba o preço, em até 5 minutos.</p>
        <ul class="fpp__inclui"><li v-for="it in INCLUI" :key="it">{{ it }}</li></ul>
        <button type="button" class="pc-btn pc-btn--primary fpp__cta" @click="comprar">Ver o relatório completo · {{ preco }}</button>
        <p class="fpp__nota">Pagamento único, sem assinatura. Se o veículo não for encontrado, o Pix volta sozinho.</p>
      </div>
    </div>

    <PremiumInlineCheckout
      v-if="abrirCheckout && resultado"
      :placa="placa"
      plano="completa"
      :ja-consultada="true"
      @close="abrirCheckout = false"
    />
  </section>
</template>

<style scoped>
.fpp { margin: 8px 0 28px; padding: 18px; border: 1px solid var(--pc-hairline); border-radius: 16px; background: var(--pc-canvas); }
.fpp__label { display: block; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--pc-graphite); margin-bottom: 8px; }
.fpp__linha { display: flex; flex-wrap: wrap; gap: 10px; }
.fpp__input { flex: 1 1 160px; min-width: 0; height: 48px; padding: 0 14px; border: 1px solid var(--pc-steel); border-radius: 8px; font: inherit; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--pc-ink); }
.fpp__input:focus { outline: 2px solid var(--pc-blue); outline-offset: 1px; }
.fpp__btn { flex: 0 0 auto; }
.fpp__erro { margin: 10px 0 0; color: var(--pc-red); font-size: 0.875rem; }
.fpp__res { margin-top: 18px; border-top: 1px solid var(--pc-hairline); padding-top: 16px; }
.fpp__veic { margin: 0 0 10px; color: var(--pc-charcoal); }
.fpp__fipe { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px; padding: 14px 16px; border-radius: 12px; background: var(--pc-cloud); }
.fpp__fipe span { font-size: 0.8125rem; color: var(--pc-graphite); text-transform: uppercase; letter-spacing: 0.05em; }
.fpp__fipe strong { font-size: 1.5rem; color: var(--pc-ink); }
.fpp__nota { font-size: 0.8125rem; color: var(--pc-graphite); margin: 8px 0 0; }
.fpp__oferta { margin-top: 18px; padding: 16px; border: 2px solid var(--pc-blue); border-radius: 14px; }
.fpp__oferta-t { margin: 0 0 4px; font-weight: 700; color: var(--pc-ink); }
.fpp__oferta-s { margin: 0 0 10px; color: var(--pc-charcoal); font-size: 0.9375rem; }
.fpp__inclui { list-style: none; padding: 0; margin: 0 0 14px; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px 12px; font-size: 0.875rem; font-weight: 600; color: var(--pc-ink); }
.fpp__inclui li::before { content: '✓ '; color: var(--pc-green); }
.fpp__cta { width: 100%; }
</style>
