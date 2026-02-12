<script setup lang="ts">
const { isPWA, isMobile } = useAppMode()
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
const showDataModal = ref(false)
const vehicleData = ref<any>(null)
const showSnackbar = ref(false)
const snackbarMessage = ref('')
const showPwaEmailPrompt = ref(false)
const pwaEmail = ref('')
const pwaEmailError = ref('')
const photoInput = ref<HTMLInputElement | null>(null)
const processingPhoto = ref(false)
const photoProcessMessage = ref('')
const debugLogs = ref<string[]>([])
const showDebugButton = ref(false)

const placaRef = ref<HTMLInputElement | null>(null)

function addDebugLog(message: string) {
  if (isPWA.value) {
    debugLogs.value.push(`${new Date().toLocaleTimeString()}: ${message}`)
    console.log(message)
  }
}

async function testPermissionManual() {
  addDebugLog('🖱️ Botão clicado - tentando pedir permissão...')

  try {
    // Check current permission
    const current = Notification.permission
    addDebugLog(`📊 Permissão atual: ${current}`)

    if (current === 'granted') {
      addDebugLog('✅ Já tem permissão!')
      return
    }

    if (current === 'denied') {
      addDebugLog('🚫 Permissão foi negada antes. Resete nas configs do Safari!')
      return
    }

    // Request permission
    addDebugLog('🔔 Chamando Notification.requestPermission()...')
    const result = await Notification.requestPermission()
    addDebugLog(`📱 Resultado: ${result}`)

    if (result === 'granted') {
      addDebugLog('🎉 Permissão concedida! Registrando no OneSignal...')
      const { requestPermissionAndSave } = usePushNotifications()

      try {
        const response = await requestPermissionAndSave()
        if (response.success) {
          addDebugLog(`✅ Registrado! ID: ${response.userId}`)
        } else {
          addDebugLog(`❌ Falha no registro: ${response.error}`)
        }
      } catch (err: any) {
        addDebugLog(`❌ Erro ao registrar: ${err.message}`)
      }
    }
  } catch (error: any) {
    addDebugLog(`❌ Erro: ${error.message}`)
  }
}
const emailRef = ref<HTMLInputElement | null>(null)
const formStarted = ref(false)

const appTitle = computed(() => {
  return 'PlacaCompleta'
})

const allVehicleData = computed(() => {
  if (!vehicleData.value) return null
  const data = vehicleData.value
  const extra = data.extra || {}
  const fipeData = data.fipe?.dados?.[0]

  return {
    Placa: placa.value || '-',
    Marca: data.MARCA || data.marca || '-',
    Modelo: data.MODELO || data.modelo || '-',
    'Ano/Modelo': `${data.ano || '-'}/${data.anoModelo || '-'}`,
    Chassi: data.chassi || '-',
    Cor: data.cor || '-',
    Combustível: extra.combustivel || '-',
    Tipo: extra.tipo_veiculo || '-',
    Espécie: extra.especie || '-',
    Passageiros: extra.quantidade_passageiro || '-',
    Município: `${data.municipio || '-'} - ${data.uf || '-'}`,
    Origem: data.origem || '-',
    Situação: data.situacao || '-',
    'Valor FIPE': fipeData?.texto_valor || '-',
    'Modelo FIPE': fipeData?.texto_modelo || '-',
    'Ref. FIPE': fipeData?.mes_referencia || '-',
  }
})

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

onMounted(async () => {
  if (isPWA.value) {
    addDebugLog('🚀 PWA detectado')
    addDebugLog(`🌐 URL: ${window.location.href}`)
    showDebugButton.value = true

    // For PWA, load persistent email
    const savedPwaEmail = localStorage.getItem('pwa_email')
    if (savedPwaEmail) {
      email.value = savedPwaEmail
    }

    // Check notification support and current permission
    if ('Notification' in window) {
      const currentPermission = Notification.permission
      addDebugLog(`📊 Permissão: ${currentPermission}`)

      if (currentPermission === 'granted') {
        addDebugLog('✅ Já tem permissão! Registrando...')
        const { requestPermissionAndSave, listenForMessages } = usePushNotifications()
        const result = await requestPermissionAndSave()
        if (result.success) {
          addDebugLog('✅ Registrado! ID: ' + result.userId?.substring(0, 20))
        }
        listenForMessages()
      } else {
        addDebugLog('⏸️ Use o botão abaixo para testar permissão')
      }
    } else {
      addDebugLog('❌ Notification API não disponível')
    }
  } else {
    // For web, load last used email
    const saved = localStorage.getItem('pc_email')
    if (saved) email.value = saved
  }

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

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => {
    snackbarMessage.value = `${label} copiado!`
    showSnackbar.value = true
    setTimeout(() => {
      showSnackbar.value = false
    }, 2000)
  })
}

function savePwaEmail() {
  pwaEmailError.value = ''
  
  if (!validateEmail(pwaEmail.value)) {
    pwaEmailError.value = 'E-mail inválido.'
    return
  }
  
  localStorage.setItem('pwa_email', pwaEmail.value)
  email.value = pwaEmail.value
  showPwaEmailPrompt.value = false
  track('pwa_email_saved')
  
  // After saving email, proceed with the query
  handleSubmit()
}

function changePwaEmail() {
  pwaEmail.value = email.value
  showPwaEmailPrompt.value = true
  track('pwa_email_change_requested')
}

function triggerPhotoCapture() {
  photoInput.value?.click()
  track('photo_capture_initiated')
}

async function compressImage(file: File, maxWidth = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Calculate new dimensions
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // Convert to JPEG base64 with compression
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality)
        resolve(compressedBase64)
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function onPhotoCapture(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  processingPhoto.value = true
  placaError.value = ''
  message.value = ''
  track('photo_capture_started')

  try {
    // Step 1: Compress image
    photoProcessMessage.value = 'Enviando foto para processamento...'
    const base64 = await compressImage(file, 1024, 0.8)

    // Step 2: Send to OCR API
    photoProcessMessage.value = 'Aguardando identificação da placa...'
    const result = await $fetch<{ success: boolean; placa: string; message?: string }>('/api/read-plate', {
      method: 'POST',
      body: { image: base64 }
    })

    if (result.success && result.placa) {
      placa.value = result.placa
      track('photo_capture_success', { placa: result.placa })

      // Step 3: Auto-submit after photo capture
      photoProcessMessage.value = `Consultando placa ${result.placa}...`
      await handleSubmit()
    } else {
      placaError.value = result.message || 'Não foi possível ler a placa da foto. Tente novamente.'
      track('photo_capture_failed', { reason: result.message })
    }
  } catch (err: any) {
    const errMsg = err?.data?.message || err?.message || 'Erro ao processar a foto. Tente novamente.'
    placaError.value = errMsg
    track('photo_capture_error', { error_message: errMsg })
  } finally {
    processingPhoto.value = false
    photoProcessMessage.value = ''
    // Reset input to allow same file again
    target.value = ''
  }
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
  
  // In PWA mode, check if email is stored, if not prompt for it
  if (isPWA.value && !email.value) {
    showPwaEmailPrompt.value = true
    return
  }
  
  // Skip email validation in PWA mode (already validated when stored)
  if (!isPWA.value && !validateEmail(email.value)) {
    emailError.value = 'E-mail inválido.'
    track('form_validation_error', { error_field: 'email' })
    nextTick(() => emailRef.value?.focus())
    return
  }

  if (!isPWA.value) {
    localStorage.setItem('pc_email', email.value)
  }
  loading.value = true
  track('form_submit', { form_name: 'plate_consultation', pwa_mode: isPWA.value })

  try {
    const result = await $fetch<{ success: boolean; emailSent: boolean; message: string; data?: any }>('/api/consulta', {
      method: 'POST',
      body: {
        email: email.value,
        phone: null,
        placa: placa.value,
        isPWA: isPWA.value,
      },
    })

    if (isPWA.value) {
      // Show modal with data in PWA mode
      vehicleData.value = result.data || {
        marca: 'VW',
        modelo: 'CROSSFOX 1.6',
        ano: '2007/2007',
        cor: 'Prata',
        fipe: 'R$ 28.799,00',
        situacao: 'Sem restrição'
      }
      showDataModal.value = true
      track('consulta_success_pwa')
    } else {
      message.value = result.message
      messageType.value = result.emailSent ? 'success' : 'info'
      success.value = result.emailSent
      sentToEmail.value = email.value
      
      if (result.emailSent) {
        track('consulta_success')
      } else {
        track('consulta_success_no_email', { api_message: result.message })
      }
    }
    consultaCount.value++
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
    <main>
      <div class="win-window">
      <div class="win-window__titlebar">
        <span>{{ appTitle }}</span>
        <div class="win-window__titlebar-buttons">
          <span v-if="isPWA && email" class="win-window__titlebar-btn win-window__titlebar-btn--active" @click="changePwaEmail" title="Alterar e-mail">✉</span>
          <span class="win-window__titlebar-btn">_</span>
          <span class="win-window__titlebar-btn">&square;</span>
          <span class="win-window__titlebar-btn">&times;</span>
        </div>
      </div>
      <div class="win-window__body">
        <NuxtImg
          src="/logo-nobg-200.png"
          alt="PlacaCompleta - Consulta Veicular Grátis"
          class="logo"
          width="200"
          height="200"
          sizes="xs:140px sm:180px md:200px"
          format="webp"
          quality="85"
          loading="eager"
          fetchpriority="high"
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
          <div v-if="!processingPhoto && !loading" class="form-group">
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

          <div v-if="!isPWA && !processingPhoto && !loading" class="form-group">
            <label class="form-group__label" for="email">Seu e-mail</label>
            <input
              id="email"
              required
              ref="emailRef"
              v-model="email"
              type="email"
              class="win-input email-input"
              :class="{ 'win-input--error': emailError }"
              placeholder="seu@email.com"
              autocomplete="email"
              inputmode="email"
              @input="onEmailInput"
            />
            <span v-if="emailError" class="form-group__error">{{ emailError }}</span>
          </div>

          <button
            v-if="!processingPhoto && !loading"
            type="submit"
            class="win-btn win-btn--primary win-btn--block"
            :disabled="loading"
          >
            {{ isPWA ? 'Consultar Placa' : 'Receber Dados no E-mail' }}
          </button>

          <!-- Photo Capture for PWA -->
          <div v-if="isPWA && !processingPhoto && !loading">
            <input
              ref="photoInput"
              type="file"
              accept="image/*"
              capture="environment"
              style="display: none"
              @change="onPhotoCapture"
            />
            <button
              type="button"
              class="win-btn win-btn--secondary photo-btn"
              @click="triggerPhotoCapture"
            >
              <svg class="camera-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="7" width="20" height="13" rx="1" stroke="currentColor" stroke-width="2"/>
                <path d="M7 7L8.5 4H15.5L17 7" stroke="currentColor" stroke-width="2"/>
                <circle cx="12" cy="13" r="3" stroke="currentColor" stroke-width="2"/>
                <rect x="17" y="9" width="2" height="2" fill="currentColor"/>
              </svg>
              <span>ou tirar foto da placa</span>
            </button>
          </div>

          <div v-if="loading || processingPhoto" class="loading-bar">
            <div class="loading-bar__fill" />
          </div>

          <div v-if="photoProcessMessage" class="win-alert win-alert--info">
            {{ photoProcessMessage }}
          </div>

          <div v-if="message && !photoProcessMessage" class="win-alert" :class="`win-alert--${messageType}`">
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
        <div v-if="!isPWA" class="sample-preview">
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

    <!-- Data Modal for PWA -->
    <div v-if="showDataModal" class="modal-overlay" @click="showDataModal = false">
      <div class="modal-window" @click.stop>
        <div class="win-window">
          <div class="win-window__titlebar">
            <span>Dados do Veículo - {{ placa }}</span>
            <div class="win-window__titlebar-buttons">
              <span class="win-window__titlebar-btn win-window__titlebar-btn--active" @click="showDataModal = false">×</span>
            </div>
          </div>
          <div class="win-window__body">
            <div class="data-table">
              <div
                v-for="(value, key) in allVehicleData"
                :key="key"
                class="data-table__row"
                @click="copyToClipboard(value, key)"
              >
                <span class="data-table__label">{{ key }}</span>
                <span class="data-table__value">{{ value }}</span>
              </div>
            </div>
            <p class="data-table__hint">Clique nos valores para copiar</p>
            <button
              type="button"
              class="win-btn win-btn--primary win-btn--block"
              @click="showDataModal = false; resetForm()"
            >
              Nova Consulta
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Snackbar notification -->
    <div v-if="showSnackbar" class="snackbar">
      {{ snackbarMessage }}
    </div>

    <!-- PWA Email Prompt Modal -->
    <div v-if="showPwaEmailPrompt" class="modal-overlay" @click="showPwaEmailPrompt = false">
      <div class="modal-window" @click.stop>
        <div class="win-window">
          <div class="win-window__titlebar">
            <span>Configurar E-mail</span>
            <div class="win-window__titlebar-buttons">
              <span class="win-window__titlebar-btn win-window__titlebar-btn--active" @click="showPwaEmailPrompt = false">×</span>
            </div>
          </div>
          <div class="win-window__body">
            <p class="modal-instruction">Será necessário informar seu e-mail apenas uma vez.</p>
            <div class="form-group">
              <label class="form-group__label" for="pwa-email">Seu e-mail</label>
              <input
                id="pwa-email"
                v-model="pwaEmail"
                type="email"
                class="win-input"
                :class="{ 'win-input--error': pwaEmailError }"
                placeholder="seu@email.com"
                autocomplete="email"
                inputmode="email"
                @keyup.enter="savePwaEmail"
              />
              <span v-if="pwaEmailError" class="form-group__error">{{ pwaEmailError }}</span>
            </div>
            <button
              type="button"
              class="win-btn win-btn--primary win-btn--block"
              @click="savePwaEmail"
            >
              Salvar e Continuar
            </button>
          </div>
        </div>
      </div>
    </div>

    </main>

    <!-- Debug console (only in PWA) -->
    <div v-if="isPWA && debugLogs.length > 0" class="debug-console">
      <div class="debug-console__header">🔍 Debug</div>
      <div class="debug-console__logs">
        <div v-for="(log, index) in debugLogs" :key="index" class="debug-console__log">
          {{ log }}
        </div>
      </div>
      <button v-if="showDebugButton" @click="testPermissionManual" class="debug-console__button">
        🔔 Testar Permissão Manual
      </button>
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
  font-size: 0.75rem;
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
    font-size: 0.75rem;
    color: $win-darker;
    margin-top: $space-xs;
    text-align: center;
    font-style: italic;
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: $space-md;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.modal-window {
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  animation: slideUp 0.3s ease-out;
  margin: auto;

  .win-window__body {
    max-height: calc(90vh - 60px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-instruction {
  font-family: $font-body;
  font-size: 0.75rem;
  color: $graphite;
  text-align: center;
  margin-bottom: $space-md;
  font-style: italic;
}

.data-table {
  @include win-border-sunken;
  background: $win-white;
  padding: $space-sm;
  margin-bottom: $space-sm;

  &__row {
    display: flex;
    justify-content: space-between;
    padding: $space-xs 0;
    border-bottom: 1px dotted #9ab1d0;
    cursor: pointer;
    transition: background 0.1s;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: $powder-blue;
      padding-left: 4px;
      padding-right: 4px;
    }

    &:active {
      background: $smart-blue;
      color: $ivory;
    }
  }

  &__label {
    font-weight: 600;
    color: $graphite;
    font-size: 0.75rem;
  }

  &__value {
    color: $navy-electric;
    text-align: right;
    font-size: 0.75rem;
    font-weight: 700;
  }

  &__hint {
    font-size: 0.625rem;
    color: $win-darker;
    text-align: center;
    margin: 0 0 $space-sm;
    font-style: italic;
  }
}

.win-btn--secondary {
  background: $win-bg;
  color: $graphite;
  font-size: 0.875rem;
  margin-bottom: 0;
  font-weight: 600;
}

.photo-btn {
  margin-top: $space-lg;
  font-size: 0.75rem;
  padding: $space-xs $space-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  opacity: 0.85;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }

  .camera-icon {
    width: 16px;
    height: 16px;
    color: $graphite;
    flex-shrink: 0;
  }

  span {
    letter-spacing: 0.3px;
    font-style: italic;
  }
}

.snackbar {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: $navy-electric;
  color: $ivory;
  padding: $space-xs $space-lg;
  @include win-border-raised;
  font-family: $font-display;
  font-size: 0.875rem;
  z-index: 2000;
  animation: snackbarSlide 0.3s ease-out;
  letter-spacing: 0.5px;
}

@keyframes snackbarSlide {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.debug-console {
  position: fixed;
  bottom: 60px;
  left: 10px;
  right: 10px;
  max-height: 200px;
  background: rgba(0, 0, 0, 0.9);
  color: #0f0;
  font-family: monospace;
  font-size: 10px;
  border: 1px solid #0f0;
  border-radius: 4px;
  z-index: 9999;
  overflow: hidden;

  &__header {
    background: #0f0;
    color: #000;
    padding: 4px 8px;
    font-weight: bold;
  }

  &__logs {
    padding: 8px;
    max-height: 120px;
    overflow-y: auto;
  }

  &__log {
    margin-bottom: 4px;
    word-break: break-all;
  }

  &__button {
    width: 100%;
    padding: 8px;
    background: #0f0;
    color: #000;
    border: none;
    font-family: monospace;
    font-size: 11px;
    font-weight: bold;
    cursor: pointer;

    &:active {
      background: #0c0;
    }
  }
}
</style>
