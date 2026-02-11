<script setup lang="ts">
const email = ref('')
const phone = ref('')
const placa = ref('')
const loading = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error' | 'info'>('info')
const emailError = ref('')
const placaError = ref('')
const clock = ref('')

function updateClock() {
  clock.value = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
updateClock()

let clockInterval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  clockInterval = setInterval(updateClock, 30000)
})
onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval)
})

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function formatPlaca(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7)
}

function onPhoneInput(e: Event) {
  const target = e.target as HTMLInputElement
  phone.value = formatPhone(target.value)
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

async function handleSubmit() {
  emailError.value = ''
  placaError.value = ''
  message.value = ''

  if (!validateEmail(email.value)) {
    emailError.value = 'E-mail inválido.'
    return
  }
  if (!validatePlaca(placa.value)) {
    placaError.value = 'Placa inválida. Use o formato ABC1D23 ou ABC1234.'
    return
  }

  loading.value = true

  try {
    const result = await $fetch<{ success: boolean; emailSent: boolean; message: string }>('/api/consulta', {
      method: 'POST',
      body: {
        email: email.value,
        phone: phone.value || null,
        placa: placa.value,
      },
    })

    message.value = result.message
    messageType.value = result.emailSent ? 'success' : 'info'
  } catch (err: any) {
    const errMsg = err?.data?.message || err?.message || 'Erro inesperado. Tente novamente.'
    message.value = errMsg
    messageType.value = 'error'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="desktop">
    <div class="win-window">
      <div class="win-window__titlebar">
        <span>Placa Completa</span>
        <div class="win-window__titlebar-buttons">
          <span class="win-window__titlebar-btn">_</span>
          <span class="win-window__titlebar-btn">□</span>
          <span class="win-window__titlebar-btn">×</span>
        </div>
      </div>
      <div class="win-window__body">
        <img
          src="~/assets/logo-nobg.png"
          alt="Placa Completa - Consulta Veicular Grátis"
          class="logo"
          width="180"
          height="180"
        />

        <h1 class="page-title">Consulta Veicular Grátis</h1>
        <p class="page-subtitle">
          Digite a placa e receba os dados completos do veículo no seu e-mail.
        </p>

        <hr class="win-separator" />

        <form @submit.prevent="handleSubmit" novalidate>
          <div class="form-group">
            <label class="form-group__label" for="email">E-mail</label>
            <input
              id="email"
              v-model="email"
              type="email"
              class="win-input"
              :class="{ 'win-input--error': emailError }"
              placeholder="seu@email.com"
              autocomplete="email"
              required
              @input="onEmailInput"
            />
            <span v-if="emailError" class="form-group__error">{{ emailError }}</span>
          </div>

          <div class="form-group">
            <label class="form-group__label form-group__label--optional" for="phone">Telefone</label>
            <input
              id="phone"
              :value="phone"
              type="tel"
              class="win-input"
              placeholder="(11) 99999-9999"
              autocomplete="tel"
              @input="onPhoneInput"
            />
          </div>

          <div class="form-group">
            <label class="form-group__label" for="placa">Placa do Veículo</label>
            <input
              id="placa"
              :value="placa"
              type="text"
              class="win-input placa-input"
              :class="{ 'win-input--error': placaError }"
              placeholder="ABC1D23"
              maxlength="7"
              autocomplete="off"
              required
              @input="onPlacaInput"
            />
            <span v-if="placaError" class="form-group__error">{{ placaError }}</span>
          </div>

          <button
            type="submit"
            class="win-btn win-btn--primary win-btn--block"
            :disabled="loading"
          >
            {{ loading ? 'Consultando...' : 'Consultar Placa' }}
          </button>

          <div v-if="loading" class="loading-bar">
            <div class="loading-bar__fill" />
          </div>

          <div v-if="message" class="win-alert" :class="`win-alert--${messageType}`">
            {{ message }}
          </div>
        </form>

        <div class="win-statusbar">
          Pronto
        </div>
      </div>
    </div>

    <footer class="footer">
      &copy; {{ new Date().getFullYear() }} Placa Completa — Consulta veicular grátis e segura.
    </footer>
  </div>

  <div class="taskbar">
    <div class="taskbar__start">
      <img src="~/assets/logo-cropped.png" alt="" class="taskbar__start-icon" width="16" height="16" />
      Início
    </div>
    <div class="taskbar__clock">{{ clock }}</div>
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
  color: $win-dark;
  text-align: center;
  margin-bottom: $space-md;
  line-height: 1.4;
}

.placa-input {
  font-family: $font-display;
  font-size: 1.5rem;
  text-align: center;
  letter-spacing: 4px;
  text-transform: uppercase;
}
</style>
