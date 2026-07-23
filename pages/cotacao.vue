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
  <div class="cotacao-page">
    <header class="cotacao-page__header">
      <NuxtLink to="/" class="cotacao-page__brand">PlacaCompleta</NuxtLink>
    </header>

    <main class="cotacao-page__main">
      <template v-if="!done">
        <h1 v-if="prefilled && veiculo" class="cotacao-page__title">
          Cotação de seguro pro seu {{ veiculo.marca }} {{ veiculo.modelo }}
        </h1>
        <h1 v-else class="cotacao-page__title">Cotação de seguro pro seu carro</h1>

        <div v-if="prefilled && veiculo" class="cotacao-page__card">
          <div class="cotacao-page__card-row"><span>Placa</span><strong>{{ veiculo.placa }}</strong></div>
          <div class="cotacao-page__card-row"><span>Veículo</span><strong>{{ veiculo.marca }} {{ veiculo.modelo }}</strong></div>
          <div v-if="veiculo.ano" class="cotacao-page__card-row"><span>Ano</span><strong>{{ veiculo.ano }}</strong></div>
        </div>

        <div v-if="seguro" class="cotacao-page__estimativa">
          <p class="cotacao-page__estimativa-lead">Carros como o seu pagam em média</p>
          <p class="cotacao-page__premio">R$ {{ formatBRL(seguro.premioAnual) }}<span>/ano</span></p>
          <p class="cotacao-page__detalhe">
            <template v-if="seguro.regiaoDoUsuario">de seguro na sua região ({{ seguro.regiao.descricao }}). </template>
            <template v-else>de seguro. </template>
            Franquia média: R$ {{ formatBRL(seguro.franquia) }}.
          </p>
        </div>
        <p v-else class="cotacao-page__pitch">
          Deixe seu telefone e receba uma cotação real, feita por corretor, sem compromisso.
        </p>

        <form class="cotacao-page__form" @submit.prevent="submit">
          <div v-if="!prefilled" class="cotacao-page__field">
            <label for="cotacao-placa">Placa do veículo (opcional)</label>
            <input id="cotacao-placa" v-model="placaInput" type="text" maxlength="8" placeholder="ABC1D23" autocapitalize="characters">
          </div>
          <div class="cotacao-page__field">
            <label for="cotacao-phone">Telefone com DDD</label>
            <input
              id="cotacao-phone"
              v-model="phoneInput"
              type="tel"
              inputmode="tel"
              placeholder="(31) 99999-9999"
              :disabled="sending"
            >
            <p v-if="phoneError" class="cotacao-page__erro">{{ phoneError }}</p>
            <p v-if="sendError" class="cotacao-page__erro">Não conseguimos enviar. Tente de novo.</p>
          </div>
          <button type="submit" class="cotacao-page__cta" :disabled="sending">
            {{ sending ? 'Enviando...' : 'Receber contato' }}
          </button>
          <p class="cotacao-page__lgpd">Ao enviar, você autoriza o contato telefônico sobre sua cotação.</p>
          <p class="cotacao-page__fonte">Estimativa com base em dados oficiais SUSEP, corrigida pelo IPCA. Não substitui cotação de seguradora.</p>
        </form>
      </template>

      <template v-else>
        <div class="cotacao-page__done">
          <p class="cotacao-page__done-icon">✅</p>
          <h1 class="cotacao-page__title">Recebido!</h1>
          <p class="cotacao-page__pitch">Um corretor entrará em contato.</p>
          <NuxtLink to="/" class="cotacao-page__voltar">Voltar pro PlacaCompleta</NuxtLink>
        </div>
      </template>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.cotacao-page {
  min-height: 100vh;
  background: $surface-alt;

  &__header {
    background: $prussian-blue;
    padding: $space-sm $space-md;
  }

  &__brand {
    color: #fff;
    font-weight: 700;
    text-decoration: none;
    font-size: 1.1rem;
  }

  &__main {
    max-width: 480px;
    margin: 0 auto;
    padding: $space-lg $space-md $space-xl;
  }

  &__title {
    font-size: 1.4rem;
    color: $navy-electric;
    margin: 0 0 $space-md;
    text-wrap: balance;
  }

  &__card {
    background: $surface;
    border: 1px solid $border-light;
    border-radius: 10px;
    padding: $space-sm $space-md;
    margin-bottom: $space-md;
  }

  &__card-row {
    display: flex;
    justify-content: space-between;
    gap: $space-sm;
    padding: 6px 0;
    font-size: 0.9rem;

    span { color: $slate-grey; }
    strong { color: $graphite; text-align: right; }

    & + & { border-top: 1px solid $border-light; }
  }

  &__estimativa {
    text-align: center;
    background: $powder-blue;
    border-radius: 10px;
    padding: $space-md;
    margin-bottom: $space-md;
  }

  &__estimativa-lead { margin: 0 0 4px; font-size: 0.9rem; color: $graphite; }

  &__premio {
    font-size: 2.2rem;
    font-weight: 700;
    color: $navy-electric;
    margin: 0;

    span { font-size: 1rem; font-weight: 400; color: $graphite; }
  }

  &__detalhe { margin: 4px 0 0; font-size: 0.85rem; color: $graphite; }

  &__pitch { color: $graphite; margin: 0 0 $space-md; }

  &__field {
    margin-bottom: $space-sm;

    label { display: block; font-size: 0.85rem; font-weight: 600; color: $graphite; margin-bottom: 4px; }

    input {
      width: 100%;
      padding: 12px 14px;
      font-size: 1.05rem;
      border: 1px solid $border-mid;
      border-radius: 8px;
      background: $surface;

      &:focus { outline: 2px solid $smart-blue; border-color: $smart-blue; }
    }
  }

  &__cta {
    width: 100%;
    padding: 14px;
    font-size: 1.05rem;
    font-weight: 700;
    color: #fff;
    background: $smart-blue;
    border: none;
    border-radius: 8px;
    cursor: pointer;

    &:disabled { opacity: 0.6; cursor: default; }
  }

  &__erro { color: $error-red; font-size: 0.85rem; margin: 6px 0 0; }
  &__lgpd { font-size: 0.78rem; color: $slate-grey; margin: $space-sm 0 0; text-align: center; }
  &__fonte { font-size: 0.72rem; color: $lavender-grey; margin: $space-xs 0 0; text-align: center; }

  &__done { text-align: center; padding-top: $space-xl; }
  &__done-icon { font-size: 3rem; margin: 0 0 $space-sm; }
  &__voltar { color: $smart-blue; display: inline-block; margin-top: $space-md; }
}
</style>
