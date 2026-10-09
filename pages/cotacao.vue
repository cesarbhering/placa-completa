<script setup lang="ts">
const route = useRoute()
const token = computed(() => String(route.query.c || ''))

const { data: info } = await useAsyncData('cotacao-info', () =>
  token.value
    ? $fetch<any>('/api/cotacao-info', { params: { c: token.value } })
    : Promise.resolve({ generic: true })
)

const prefilled = computed(() => info.value && !info.value.generic)
const veiculo = computed(() => info.value?.veiculo || null)
const seguro = computed(() => info.value?.seguro || null)

const phoneInput = ref('')
const placaInput = ref('')
const phoneError = ref('')
const sendError = ref(false)
const sending = ref(false)
const done = ref(false)

onMounted(() => {
  if (info.value?.phonePrefill) phoneInput.value = info.value.phonePrefill
  track('cotacao_page_view', { prefilled: prefilled.value })
})

function track(event: string, params?: Record<string, any>) {
  if (import.meta.client && (window as any).gtag) {
    ;(window as any).gtag('event', event, params)
  }
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

async function submit() {
  phoneError.value = ''
  sendError.value = false
  const digits = phoneInput.value.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 13) {
    phoneError.value = 'Confira o DDD e o número (ex: 31 99999-9999).'
    return
  }
  sending.value = true
  try {
    await $fetch('/api/cotacao-seguro', {
      method: 'POST',
      body: {
        phone: phoneInput.value,
        consultaId: prefilled.value ? token.value : undefined,
        placa: prefilled.value ? veiculo.value?.placa : placaInput.value || undefined,
        veiculo: prefilled.value
          ? { marca: veiculo.value?.marca, modelo: veiculo.value?.modelo, ano: veiculo.value?.ano }
          : undefined,
        seguro: seguro.value
          ? { premioAnual: seguro.value.premioAnual, franquia: seguro.value.franquia, regiao: seguro.value.regiao }
          : undefined,
      },
    })
    done.value = true
    track('cotacao_solicitada', { source: 'email_page', premio: seguro.value?.premioAnual })
  } catch (err: any) {
    if (err?.statusCode === 400 || err?.status === 400) {
      phoneError.value = err?.data?.message || 'Telefone inválido.'
    } else {
      sendError.value = true
    }
  } finally {
    sending.value = false
  }
}

useHead({
  title: 'Cotação de Seguro',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

<template>
  <div class="pc-page">
    <main class="cotacao-main">
      <template v-if="!done">
            <h1 v-if="prefilled && veiculo" class="cotacao-title">
              Cotação de seguro pro seu {{ veiculo.marca }} {{ veiculo.modelo }}
            </h1>
            <h1 v-else class="cotacao-title">Cotação de seguro pro seu carro</h1>

            <div v-if="prefilled && veiculo" class="cotacao-card">
              <div class="cotacao-card__row"><span>Placa</span><strong>{{ veiculo.placa }}</strong></div>
              <div class="cotacao-card__row"><span>Veículo</span><strong>{{ veiculo.marca }} {{ veiculo.modelo }}</strong></div>
              <div v-if="veiculo.ano" class="cotacao-card__row"><span>Ano</span><strong>{{ veiculo.ano }}</strong></div>
            </div>

            <div v-if="seguro" class="cotacao-estimativa">
              <p class="cotacao-estimativa__lead">Carros como o seu pagam em média</p>
              <p class="cotacao-estimativa__premio">R$ {{ formatBRL(seguro.premioAnual) }}<span>/ano</span></p>
              <p class="cotacao-estimativa__detalhe">
                <template v-if="seguro.regiaoDoUsuario">de seguro na sua região ({{ seguro.regiao.descricao }}). </template>
                <template v-else>de seguro. </template>
                Franquia média: R$ {{ formatBRL(seguro.franquia) }}.
              </p>
            </div>
            <p v-else class="cotacao-pitch">
              Deixe seu telefone e receba uma cotação real, feita por corretor, sem compromisso.
            </p>

            <form @submit.prevent="submit">
              <div v-if="!prefilled" class="pc-field">
                <label class="pc-label" for="cotacao-placa">Placa do veículo (opcional)</label>
                <input
                  id="cotacao-placa"
                  v-model="placaInput"
                  type="text"
                  maxlength="8"
                  placeholder="ABC1D23"
                  autocapitalize="characters"
                  class="pc-input"
                >
              </div>
              <div class="pc-field">
                <label class="pc-label" for="cotacao-phone">Telefone com DDD</label>
                <input
                  id="cotacao-phone"
                  v-model="phoneInput"
                  type="tel"
                  inputmode="tel"
                  placeholder="(31) 99999-9999"
                  :disabled="sending"
                  class="pc-input"
                >
              </div>
              <div v-if="phoneError" class="pc-alert pc-alert--error">{{ phoneError }}</div>
              <div v-if="sendError" class="pc-alert pc-alert--error">Não conseguimos enviar. Tente de novo.</div>
              <button type="submit" class="pc-btn pc-btn--primary pc-btn--block" :disabled="sending">
                {{ sending ? 'Enviando...' : 'Receber contato' }}
              </button>
              <p class="cotacao-lgpd">Ao enviar, você autoriza o contato telefônico sobre sua cotação.</p>
              <p class="cotacao-fonte">Estimativa com base em dados oficiais SUSEP, corrigida pelo IPCA. Não substitui cotação de seguradora.</p>
            </form>
          </template>

      <template v-else>
        <div class="cotacao-done">
          <div class="pc-alert pc-alert--success">✅ Recebido! Um corretor entrará em contato.</div>
          <NuxtLink to="/" class="pc-btn pc-btn--block cotacao-done__voltar">Voltar pro PlacaCompleta</NuxtLink>
        </div>
      </template>
    </main>
  </div>
</template>

<style lang="scss" scoped>
// Cotacao no design novo (tokens --pc-*). A logica do form e o noindex ficam
// intactos; muda so o visual.
.cotacao-main {
  width: 100%;   // flex item do body (align-center): sem isso vira fit-content e estoura o viewport
  max-width: 480px;
  margin: 0 auto;
}

.cotacao-title {
  font-family: var(--pc-font);
  font-size: 1.375rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--pc-ink);
  margin: 0 0 16px;
  text-wrap: balance;
}

.cotacao-card {
  border: 1px solid var(--pc-hairline);
  border-radius: 12px;
  background: var(--pc-cloud);
  padding: 6px 14px;
  margin-bottom: 16px;

  &__row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    font-size: 0.9375rem;

    span { color: var(--pc-graphite); }
    strong { color: var(--pc-ink); font-weight: 600; text-align: right; }

    & + & { border-top: 1px solid var(--pc-hairline); }
  }
}

.cotacao-estimativa {
  text-align: center;
  background: var(--pc-cloud);
  border: 1px solid var(--pc-hairline);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;

  &__lead { margin: 0 0 4px; font-size: 0.9rem; color: var(--pc-graphite); }

  &__premio {
    font-size: 2.2rem;
    font-weight: 700;
    color: var(--pc-ink);
    margin: 0;

    span { font-size: 1rem; font-weight: 400; color: var(--pc-graphite); }
  }

  &__detalhe { margin: 4px 0 0; font-size: 0.85rem; color: var(--pc-graphite); }
}

.cotacao-pitch { color: var(--pc-charcoal); margin: 0 0 16px; line-height: 1.5; }

.cotacao-lgpd {
  font-size: 0.78rem;
  color: var(--pc-graphite);
  margin: 12px 0 0;
  text-align: center;
}

.cotacao-fonte {
  font-size: 0.72rem;
  color: var(--pc-steel);
  margin: 8px 0 0;
  text-align: center;
}

.cotacao-done {
  text-align: center;

  &__voltar { margin-top: 16px; }
}
</style>
