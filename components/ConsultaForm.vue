<script setup lang="ts">
const { isPWA } = useAppMode()
const { formatPlaca, validatePlaca, validateEmail } = useFormValidation()
const { track } = useAnalytics()
const { loading, message, messageType, sentToEmail, consultPlaca } = useVehicleConsultation()

const emit = defineEmits<{
  success: [data: any]
  showEmailPrompt: []
}>()

const placa = ref('')
const email = ref('')
const placaError = ref('')
const emailError = ref('')
const formStarted = ref(false)
const permissionRequested = ref(false)

const placaRef = ref<HTMLInputElement | null>(null)
const emailRef = ref<HTMLInputElement | null>(null)

onMounted(() => {
  // Load saved email
  if (isPWA.value) {
    const savedPwaEmail = localStorage.getItem('pwa_email')
    if (savedPwaEmail) {
      email.value = savedPwaEmail
    }
  } else {
    const savedEmail = localStorage.getItem('pc_email')
    if (savedEmail) {
      email.value = savedEmail
    }
  }

  // Check if permission was already requested
  const wasRequested = localStorage.getItem('pwa_permission_requested')
  if (wasRequested) {
    permissionRequested.value = true
  }

  // Focus placa input
  nextTick(() => {
    placaRef.value?.focus()
  })
})

function onFormStart() {
  if (!formStarted.value) {
    formStarted.value = true
    track('form_start', { form_name: 'plate_consultation' })
  }
}

function onPlacaInput(e: Event) {
  const target = e.target as HTMLInputElement
  placa.value = formatPlaca(target.value)
  placaError.value = ''
}

function onEmailInput() {
  emailError.value = ''
}

async function handleSubmit() {
  emailError.value = ''
  placaError.value = ''

  // PWA: Request push notification permission on first submit
  if (isPWA.value && !permissionRequested.value) {
    permissionRequested.value = true
    localStorage.setItem('pwa_permission_requested', 'true')

    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission()
      } catch (error) {
        // Continue even if permission fails
      }
    }
  }

  // Validate placa
  if (!validatePlaca(placa.value)) {
    placaError.value = 'Placa inválida. Use o formato ABC1D23 ou ABC1234.'
    track('form_validation_error', { error_field: 'placa' })
    nextTick(() => placaRef.value?.focus())
    return
  }

  // In PWA mode, check if email is stored
  if (isPWA.value && !email.value) {
    emit('showEmailPrompt')
    return
  }

  // Validate email (skip in PWA mode if already validated)
  if (!isPWA.value && !validateEmail(email.value)) {
    emailError.value = 'E-mail inválido.'
    track('form_validation_error', { error_field: 'email' })
    nextTick(() => emailRef.value?.focus())
    return
  }

  // Submit
  const result = await consultPlaca(placa.value, email.value)

  if (result.success && result.data) {
    emit('success', result.data)
  }
}

defineExpose({
  placa,
  email,
})
</script>

<template>
  <form @submit.prevent="handleSubmit" novalidate>
    <!-- Placa Input -->
    <div v-if="!loading" class="form-group">
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

    <!-- Email Input (Web only) -->
    <div v-if="!isPWA && !loading" class="form-group">
      <label class="form-group__label" for="email">E-mail</label>
      <input
        id="email"
        ref="emailRef"
        v-model="email"
        type="email"
        class="win-input"
        :class="{ 'win-input--error': emailError }"
        placeholder="seu@email.com"
        autocomplete="email"
        inputmode="email"
        required
        @input="onEmailInput"
      />
      <span v-if="emailError" class="form-group__error">{{ emailError }}</span>
      <span class="form-group__hint">Os dados serão enviados para este e-mail</span>
    </div>

    <!-- Submit Button -->
    <button
      type="submit"
      class="win-btn win-btn--primary win-btn--block"
      :disabled="loading"
    >
      {{ loading ? 'Consultando...' : 'Consultar Placa' }}
    </button>

    <!-- Success/Error Messages (Web only) -->
    <div
      v-if="!isPWA && message"
      class="win-alert"
      :class="{
        'win-alert--success': messageType === 'success',
        'win-alert--error': messageType === 'error',
        'win-alert--info': messageType === 'info'
      }"
    >
      {{ message }}
      <span v-if="sentToEmail" class="email-sent-to">
        (enviado para {{ sentToEmail }})
      </span>
    </div>
  </form>
</template>

<style lang="scss" scoped>
.placa-input {
  text-transform: uppercase;
  letter-spacing: 2px;
  font-family: $font-mono;
}

.email-sent-to {
  display: block;
  font-size: 0.75rem;
  margin-top: $space-xs;
  opacity: 0.8;
}
</style>
