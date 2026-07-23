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
  title: 'Cotação de Seguro | PlacaCompleta',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

<template>
  <div class="desktop content-page">
    <main class="cotacao-main">
      <div class="win-window">
        <div class="win-window__titlebar">
          <span>Cotação de Seguro</span>
          <div class="win-window__titlebar-buttons">
            <span class="win-window__titlebar-btn">_</span>
            <span class="win-window__titlebar-btn">□</span>
            <span class="win-window__titlebar-btn">×</span>
          </div>
        </div>
        <div class="win-window__body">
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
              <div v-if="!prefilled" class="form-group">
                <label class="form-group__label" for="cotacao-placa">Placa do veículo (opcional)</label>
                <input
                  id="cotacao-placa"
                  v-model="placaInput"
                  type="text"
                  maxlength="8"
                  placeholder="ABC1D23"
                  autocapitalize="characters"
                  class="win-input"
                >
              </div>
              <div class="form-group">
                <label class="form-group__label" for="cotacao-phone">Telefone com DDD</label>
                <input
                  id="cotacao-phone"
                  v-model="phoneInput"
                  type="tel"
                  inputmode="tel"
                  placeholder="(31) 99999-9999"
                  :disabled="sending"
                  class="win-input"
                >
              </div>
              <div v-if="phoneError" class="win-alert win-alert--error">{{ phoneError }}</div>
              <div v-if="sendError" class="win-alert win-alert--error">Não conseguimos enviar. Tente de novo.</div>
              <button type="submit" class="win-btn win-btn--primary win-btn--block" :disabled="sending">
                {{ sending ? 'Enviando...' : 'Receber contato' }}
              </button>
              <p class="cotacao-lgpd">Ao enviar, você autoriza o contato telefônico sobre sua cotação.</p>
              <p class="cotacao-fonte">Estimativa com base em dados oficiais SUSEP, corrigida pelo IPCA. Não substitui cotação de seguradora.</p>
            </form>
          </template>

          <template v-else>
            <div class="cotacao-done">
              <div class="win-alert win-alert--success">✅ Recebido! Um corretor entrará em contato.</div>
              <NuxtLink to="/" class="win-btn win-btn--block cotacao-done__voltar">Voltar pro PlacaCompleta</NuxtLink>
            </div>
          </template>
        </div>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.cotacao-main {
  width: 100%;          // flex item do .desktop (align-center): sem isso vira fit-content e estoura o viewport
  max-width: 480px;
  margin: 0 auto;

  // o .win-window global tem largura fixa; aqui ele se adapta ao viewport
  .win-window {
    width: 100%;
    max-width: 100%;
  }
}

.cotacao-title {
  font-size: 1.25rem;
  color: $navy-electric;
  margin: 0 0 $space-md;
  text-wrap: balance;
}

.cotacao-card {
  border: 1px solid $border-mid;
  background: $surface-alt;
  padding: $space-xs $space-sm;
  margin-bottom: $space-md;

  &__row {
    display: flex;
    justify-content: space-between;
    gap: $space-sm;
    padding: 6px 0;
    font-size: 0.9rem;

    span { color: $slate-grey; }
    strong { color: $graphite; text-align: right; }

    & + & { border-top: 1px solid $border-light; }
  }
}

.cotacao-estimativa {
  text-align: center;
  background: $powder-blue;
  border: 1px solid $border-light;
  padding: $space-md;
  margin-bottom: $space-md;

  &__lead { margin: 0 0 4px; font-size: 0.9rem; color: $graphite; }

  &__premio {
    font-size: 2.2rem;
    font-weight: 700;
    color: $navy-electric;
    margin: 0;

    span { font-size: 1rem; font-weight: 400; color: $graphite; }
  }

  &__detalhe { margin: 4px 0 0; font-size: 0.85rem; color: $graphite; }
}

.cotacao-pitch { color: $graphite; margin: 0 0 $space-md; }

.cotacao-lgpd {
  font-size: 0.78rem;
  color: $slate-grey;
  margin: $space-sm 0 0;
  text-align: center;
}

.cotacao-fonte {
  font-size: 0.72rem;
  color: $lavender-grey;
  margin: $space-xs 0 0;
  text-align: center;
}

.cotacao-done {
  text-align: center;

  &__voltar {
    margin-top: $space-md;
    text-decoration: none;
  }
}

.win-alert {
  margin-bottom: $space-sm;
}
</style>
