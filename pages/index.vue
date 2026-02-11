<script setup lang="ts">
const email = ref('')
const placa = ref('')
const loading = ref(false)
const success = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error' | 'info'>('info')
const emailError = ref('')
const placaError = ref('')
const consultaCount = ref(0)
const sentToEmail = ref('')

const placaRef = ref<HTMLInputElement | null>(null)
const emailRef = ref<HTMLInputElement | null>(null)
const formStarted = ref(false)

function track(event: string, params?: Record<string, any>) {
  if (import.meta.client && window.gtag) {
    window.gtag('event', event, params)
  }
}

function onFormStart() {
  if (!formStarted.value) {
    formStarted.value = true
    track('form_start', { form_name: 'plate_consultation' })
  }
}

const { data: countData } = await useFetch('/api/count')
if (countData.value?.count) {
  consultaCount.value = countData.value.count
}

onMounted(() => {
  const saved = localStorage.getItem('pc_email')
  if (saved) email.value = saved

  nextTick(() => {
    placaRef.value?.focus()
  })
})

function formatPlaca(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7)
}

function onPlacaInput(e: Event) {
  const target = e.target as HTMLInputElement
  placa.value = formatPlaca(target.value)
  placaError.value = ''
}

function onEmailInput() {
  emailError.value = ''
}

function validateEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
}

function validatePlaca(val: string): boolean {
  const clean = val.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(clean)
}

function resetForm() {
  placa.value = ''
  message.value = ''
  success.value = false
  sentToEmail.value = ''
  messageType.value = 'info'
  formStarted.value = false
  track('new_consulta_click')
  nextTick(() => {
    placaRef.value?.focus()
  })
}

async function handleSubmit() {
  emailError.value = ''
  placaError.value = ''
  message.value = ''

  if (!validatePlaca(placa.value)) {
    placaError.value = 'Placa inválida. Use o formato ABC1D23 ou ABC1234.'
    track('form_validation_error', { error_field: 'placa' })
    nextTick(() => placaRef.value?.focus())
    return
  }
  if (!validateEmail(email.value)) {
    emailError.value = 'E-mail inválido.'
    track('form_validation_error', { error_field: 'email' })
    nextTick(() => emailRef.value?.focus())
    return
  }

  localStorage.setItem('pc_email', email.value)
  loading.value = true
  track('form_submit', { form_name: 'plate_consultation' })

  try {
    const result = await $fetch<{ success: boolean; emailSent: boolean; message: string }>('/api/consulta', {
      method: 'POST',
      body: {
        email: email.value,
        phone: null,
        placa: placa.value,
      },
    })

    message.value = result.message
    messageType.value = result.emailSent ? 'success' : 'info'
    success.value = result.emailSent
    sentToEmail.value = email.value
    consultaCount.value++

    if (result.emailSent) {
      track('consulta_success')
    } else {
      track('consulta_success_no_email', { api_message: result.message })
    }
  } catch (err: any) {
    const errMsg = err?.data?.message || err?.message || 'Erro inesperado. Tente novamente.'
    message.value = errMsg
    messageType.value = 'error'
    track('consulta_error', { error_message: errMsg })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="desktop">
    <div class="win-window">
      <div class="win-window__titlebar">
        <span>PlacaCompleta</span>
        <div class="win-window__titlebar-buttons">
          <span class="win-window__titlebar-btn">_</span>
          <span class="win-window__titlebar-btn">&square;</span>
          <span class="win-window__titlebar-btn">&times;</span>
        </div>
      </div>
      <div class="win-window__body">
        <img
          src="~/assets/logo-nobg-200.png"
          alt="PlacaCompleta - Consulta Veicular Grátis"
          class="logo"
          width="100"
          height="100"
        />

        <h1 class="page-title">Consulta Veicular Grátis</h1>
        <p class="page-subtitle">
          Digite a placa e receba os dados completos do veículo no seu e-mail.
        </p>

        <p v-if="consultaCount > 0" class="counter">
          {{ consultaCount.toLocaleString('pt-BR') }} consultas realizadas
        </p>

        <hr class="win-separator" />

        <form v-if="!success" @submit.prevent="handleSubmit" novalidate>
          <div class="form-group">
            <label class="form-group__label" for="placa">Placa do Veículo</label>
            <input
              id="placa"
              ref="placaRef"
              :value="placa"
              type="text"
              class="win-input placa-input"
              :class="{ 'win-input--error': placaError }"
              placeholder="ABC1D23"
              maxlength="7"
              autocomplete="off"
              autocapitalize="characters"
              inputmode="text"
              required
              @focus="onFormStart"
              @input="onPlacaInput"
            />
            <span v-if="placaError" class="form-group__error">{{ placaError }}</span>
          </div>

          <div class="form-group">
            <label class="form-group__label" for="email">Seu e-mail</label>
            <input
              id="email"
              ref="emailRef"
              v-model="email"
              type="email"
              class="win-input email-input"
              :class="{ 'win-input--error': emailError }"
              placeholder="seu@email.com"
              autocomplete="email"
              inputmode="email"
              required
              @input="onEmailInput"
            />
            <span v-if="emailError" class="form-group__error">{{ emailError }}</span>
          </div>

          <button
            type="submit"
            class="win-btn win-btn--primary win-btn--block"
            :disabled="loading"
          >
            {{ loading ? 'Consultando...' : 'Receber Dados no E-mail' }}
          </button>

          <div v-if="loading" class="loading-bar">
            <div class="loading-bar__fill" />
          </div>

          <div v-if="message" class="win-alert" :class="`win-alert--${messageType}`">
            {{ message }}
          </div>

          <p class="trust-line">Resultado em segundos. Sem cadastro. 100% grátis.</p>
        </form>

        <!-- Post-success state -->
        <div v-else class="success-state">
          <div class="win-alert win-alert--success">
            {{ message }}
          </div>
          <p class="success-state__sent-to">
            Enviado para <strong>{{ sentToEmail }}</strong>
          </p>
          <button
            type="button"
            class="win-btn win-btn--primary win-btn--block"
            @click="resetForm"
          >
            Consultar Outra Placa
          </button>
        </div>

        <!-- Sample result preview -->
        <div class="sample-preview">
          <p class="sample-preview__title">Exemplo de dados recebidos:</p>
          <div class="sample-preview__table">
            <div class="sample-preview__row">
              <span class="sample-preview__label">Marca</span>
              <span class="sample-preview__value">VW</span>
            </div>
            <div class="sample-preview__row">
              <span class="sample-preview__label">Modelo</span>
              <span class="sample-preview__value">CROSSFOX 1.6</span>
            </div>
            <div class="sample-preview__row">
              <span class="sample-preview__label">Ano</span>
              <span class="sample-preview__value">2007/2007</span>
            </div>
            <div class="sample-preview__row">
              <span class="sample-preview__label">Cor</span>
              <span class="sample-preview__value">Prata</span>
            </div>
            <div class="sample-preview__row">
              <span class="sample-preview__label">FIPE</span>
              <span class="sample-preview__value">R$ 28.799,00</span>
            </div>
            <div class="sample-preview__row">
              <span class="sample-preview__label">Situação</span>
              <span class="sample-preview__value">Sem restrição</span>
            </div>
          </div>
          <p class="sample-preview__note">+ chassi, combustível, município, tipo e mais</p>
        </div>

      </div>
    </div>

    <footer class="footer">
      <p>&copy; {{ new Date().getFullYear() }} PlacaCompleta — Consulta veicular grátis e segura.</p>
      <p class="footer__email">contato[at]placacompleta.com.br</p>
      <nav class="footer__links">
        <NuxtLink to="/termos-de-uso">Termos de Uso</NuxtLink>
        <span class="footer__sep">|</span>
        <NuxtLink to="/politica-de-privacidade">Política de Privacidade</NuxtLink>
      </nav>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
.page-title {
  font-family: $font-display;
  font-size: 2rem;
  color: $navy-electric;
  text-align: center;
  margin-bottom: $space-xs;
  letter-spacing: 1px;
}

.page-subtitle {
  font-family: $font-body;
  font-size: 0.8125rem;
  color: $graphite;
  text-align: center;
  margin-bottom: $space-xs;
  line-height: 1.4;
}

.counter {
  font-family: $font-display;
  font-size: 0.9375rem;
  color: $smart-blue;
  text-align: center;
  margin-bottom: $space-sm;
  letter-spacing: 0.5px;
}

.email-input {
  text-align: center;
}

.placa-input {
  font-family: $font-display;
  font-size: 1.5rem;
  text-align: center;
  letter-spacing: 4px;
  text-transform: uppercase;
}

.trust-line {
  font-family: $font-body;
  font-size: 0.6875rem;
  color: $graphite;
  text-align: center;
  margin-top: $space-md;
  letter-spacing: 0.3px;
}

.success-state {
  text-align: center;

  .win-alert {
    margin-bottom: $space-sm;
  }

  &__sent-to {
    font-family: $font-body;
    font-size: 0.75rem;
    color: $graphite;
    margin-bottom: $space-md;

    strong {
      color: $navy-electric;
    }
  }
}

.sample-preview {
  margin-top: $space-lg;
  @include win-border-sunken;
  background: $win-white;
  padding: $space-sm $space-md;

  &__title {
    font-family: $font-display;
    font-size: 0.875rem;
    color: $win-darker;
    margin-bottom: $space-sm;
  }

  &__table {
    font-size: 0.75rem;
  }

  &__row {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
    border-bottom: 1px dotted #9ab1d0;

    &:last-child {
      border-bottom: none;
    }
  }

  &__label {
    font-weight: 600;
    color: $graphite;
  }

  &__value {
    color: $navy-electric;
  }

  &__note {
    font-size: 0.6875rem;
    color: $win-darker;
    margin-top: $space-xs;
    text-align: center;
    font-style: italic;
  }
}
</style>
