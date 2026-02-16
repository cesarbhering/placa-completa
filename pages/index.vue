<script setup lang="ts">
import { homepageFaqs } from '~/data/homepage-faqs'

const { isPWA, isMobile } = useAppMode()

// A/B Test version tracking
const pageVersion = computed(() => isPWA.value ? 'v1' : 'v2')

function track(event: string, params?: Record<string, any>) {
  if (import.meta.client && window.gtag) {
    window.gtag('event', event, { ...params, page_version: pageVersion.value })
  }
}

// SEO
useHead({
  title: 'PlacaCompleta — Consulta Veicular Completa e Grátis',
  meta: [
    { name: 'description', content: 'Digite a placa e receba dados completos do veículo no seu e-mail. Marca, modelo, FIPE, situação e mais — em segundos. 100% grátis.' },
    { name: 'keywords', content: 'consulta placa, consulta veicular grátis, dados veículo por placa, tabela FIPE por placa, placa completa, consultar placa gratis' },
    { property: 'og:title', content: 'PlacaCompleta — Consulta Veicular Completa e Grátis' },
    { property: 'og:description', content: 'Digite a placa e receba dados completos do veículo no seu e-mail. Marca, modelo, FIPE, situação e mais — em segundos.' },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: homepageFaqs.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      }),
    },
  ],
})

// ==========================================
// Shared state (both versions)
// ==========================================
const placa = ref('')
const email = ref('')
const placaError = ref('')
const emailError = ref('')
const loading = ref(false)
const consultaCount = ref(0)
const placaRef = ref<HTMLInputElement | null>(null)

// Fetch consultation count
const { data: countData } = await useFetch('/api/count')
if (countData.value?.count) {
  consultaCount.value = countData.value.count
}

// Shared functions
function formatPlaca(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7)
}

function onPlacaInput(e: Event) {
  const target = e.target as HTMLInputElement
  placa.value = formatPlaca(target.value)
  placaError.value = ''
}

function validateEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
}

function validatePlaca(val: string): boolean {
  const clean = val.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(clean)
}

// ==========================================
// V1 (PWA) state & functions
// ==========================================
const success = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error' | 'info'>('info')
const sentToEmailV1 = ref('')
const showDataModal = ref(false)
const vehicleData = ref<any>(null)
const showSnackbar = ref(false)
const snackbarMessage = ref('')
const showPwaEmailPrompt = ref(false)
const pwaEmail = ref('')
const pwaEmailError = ref('')
const showWebEmailPrompt = ref(false)
const webEmail = ref('')
const webEmailError = ref('')
const showEmailConfirm = ref(false)
const emailConfirmed = ref(false)
const openFaq = ref<number | null>(null)
const photoInput = ref<HTMLInputElement | null>(null)
const processingPhoto = ref(false)
const photoProcessMessage = ref('')
const formStarted = ref(false)
const permissionRequested = ref(false)
const modalWindowRef = ref<HTMLElement | null>(null)
const preparingShare = ref(false)

const appTitle = computed(() => 'PlacaCompleta')

const allVehicleData = computed(() => {
  if (!vehicleData.value) return null
  const data = vehicleData.value
  const extra = data.extra || {}

  const fipeData = data.fipe?.dados?.reduce((max: any, item: any) =>
    (item.score > (max?.score || 0)) ? item : max
  , null)

  const chassiValue = isPWA.value
    ? (extra.chassi || data.chassi || '-')
    : (data.chassi || '-')

  return {
    Placa: placa.value || '-',
    Marca: data.MARCA || data.marca || '-',
    Modelo: data.MODELO || data.modelo || '-',
    'Ano/Modelo': `${data.ano || '-'}/${data.anoModelo || '-'}`,
    Chassi: chassiValue,
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

function onFormStart() {
  if (!formStarted.value) {
    formStarted.value = true
    track('form_start', { form_name: 'plate_consultation' })
  }
}

function resetFormV1() {
  placa.value = ''
  message.value = ''
  success.value = false
  sentToEmailV1.value = ''
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

async function shareVehicleData() {
  if (!modalWindowRef.value) return

  try {
    const html2canvas = (await import('html2canvas')).default
    preparingShare.value = true

    await nextTick()
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    await new Promise(resolve => setTimeout(resolve, 300))

    const canvas = await html2canvas(modalWindowRef.value, {
      backgroundColor: '#c0c0c0',
      scale: 3,
      logging: false,
      useCORS: true,
      allowTaint: true,
      imageTimeout: 0,
      removeContainer: true,
      windowWidth: modalWindowRef.value.scrollWidth,
      windowHeight: modalWindowRef.value.scrollHeight,
      onclone: (_clonedDoc: Document, clonedElement: HTMLElement) => {
        const overlay = clonedElement.closest('.modal-overlay')
        if (overlay) {
          ;(overlay as HTMLElement).style.background = 'transparent'
        }
        _clonedDoc.body.style.background = '#c0c0c0'
        clonedElement.style.animation = 'none'
      },
    })

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png', 1.0)
    })

    const file = new File([blob], `placacompleta-${placa.value}.png`, { type: 'image/png' })

    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `Dados do Veículo - ${placa.value}`,
        text: `Consulta realizada em www.PlacaCompleta.com.br`,
        files: [file],
      })
      track('vehicle_data_shared', { placa: placa.value })
    } else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `placacompleta-${placa.value}.png`
      a.click()
      URL.revokeObjectURL(url)
      track('vehicle_data_downloaded', { placa: placa.value })
    }
  } catch (error) {
    console.error('Share error:', error)
    snackbarMessage.value = 'Erro ao compartilhar'
    showSnackbar.value = true
    setTimeout(() => {
      showSnackbar.value = false
    }, 2000)
  } finally {
    preparingShare.value = false
  }
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
  handleSubmitV1()
}

function saveWebEmail() {
  webEmailError.value = ''
  if (!validateEmail(webEmail.value)) {
    webEmailError.value = 'E-mail inválido.'
    return
  }
  localStorage.setItem('pc_email', webEmail.value)
  email.value = webEmail.value
  showWebEmailPrompt.value = false
  track('web_email_saved')
  emailConfirmed.value = true
  handleSubmitV1()
}

function confirmEmailV1() {
  showEmailConfirm.value = false
  emailConfirmed.value = true
  handleSubmitV1()
}

function changeEmailV1() {
  showEmailConfirm.value = false
  webEmail.value = email.value
  showWebEmailPrompt.value = true
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
    photoProcessMessage.value = 'Enviando foto para processamento...'
    const base64 = await compressImage(file, 1024, 0.8)
    photoProcessMessage.value = 'Aguardando identificação da placa...'
    const result = await $fetch<{ success: boolean; placa: string; message?: string }>('/api/read-plate', {
      method: 'POST',
      body: { image: base64 }
    })

    if (result.success && result.placa) {
      placa.value = result.placa
      track('photo_capture_success', { placa: result.placa })
      photoProcessMessage.value = `Consultando placa ${result.placa}...`
      await handleSubmitV1()
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
    target.value = ''
  }
}

async function handleSubmitV1() {
  emailError.value = ''
  placaError.value = ''
  message.value = ''

  if (isPWA.value && !permissionRequested.value) {
    permissionRequested.value = true
    localStorage.setItem('pwa_permission_requested', 'true')
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission() } catch { /* continue */ }
    }
  }

  if (!validatePlaca(placa.value)) {
    placaError.value = 'Placa inválida. Use o formato ABC1D23 ou ABC1234.'
    track('form_validation_error', { error_field: 'placa' })
    nextTick(() => placaRef.value?.focus())
    return
  }

  if (isPWA.value && !email.value) {
    showPwaEmailPrompt.value = true
    return
  }

  if (!isPWA.value && !email.value) {
    showWebEmailPrompt.value = true
    return
  }

  if (!isPWA.value && email.value && !emailConfirmed.value) {
    showEmailConfirm.value = true
    return
  }
  emailConfirmed.value = false

  if (!isPWA.value && !validateEmail(email.value)) {
    emailError.value = 'E-mail inválido.'
    track('form_validation_error', { error_field: 'email' })
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
      vehicleData.value = result.data || {}
      showDataModal.value = true
      track('consulta_success_pwa')
    } else {
      message.value = result.message
      messageType.value = result.emailSent ? 'success' : 'info'
      success.value = result.emailSent
      sentToEmailV1.value = email.value
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

// ==========================================
// V2 (Landing page) state & functions
// ==========================================
const openFaqIndex = ref<number | null>(null)
const showMobileMenu = ref(false)
const showEmailModal = ref(false)
const emailStep = ref<'input' | 'confirm'>('input')
const submitSuccess = ref(false)
const submitMessage = ref('')
const sentToEmail = ref('')
const emailInputRef = ref<HTMLInputElement | null>(null)

function toggleFaq(index: number) {
  openFaqIndex.value = openFaqIndex.value === index ? null : index
}

function scrollTo(id: string) {
  showMobileMenu.value = false
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

function resetFormV2() {
  placa.value = ''
  submitSuccess.value = false
  submitMessage.value = ''
  sentToEmail.value = ''
  nextTick(() => {
    placaRef.value?.focus()
    scrollTo('hero')
  })
}

function handlePlacaSubmit() {
  placaError.value = ''

  if (!validatePlaca(placa.value)) {
    placaError.value = 'Placa inválida. Use o formato ABC1D23 ou ABC1234.'
    return
  }

  const savedEmail = localStorage.getItem('pc_email')
  if (savedEmail) {
    email.value = savedEmail
    emailStep.value = 'confirm'
  } else {
    email.value = ''
    emailStep.value = 'input'
  }

  showEmailModal.value = true

  if (!savedEmail) {
    nextTick(() => {
      emailInputRef.value?.focus()
    })
  }
}

function changeEmailV2() {
  emailStep.value = 'input'
  email.value = ''
  nextTick(() => {
    emailInputRef.value?.focus()
  })
}

async function handleSubmitV2() {
  emailError.value = ''

  if (!validateEmail(email.value)) {
    emailError.value = 'Informe um e-mail válido.'
    return
  }

  localStorage.setItem('pc_email', email.value)
  loading.value = true
  track('form_submit', { form_name: 'plate_consultation', pwa_mode: false })

  try {
    const result = await $fetch<{ success: boolean; emailSent: boolean; message: string }>('/api/consulta', {
      method: 'POST',
      body: {
        email: email.value,
        phone: null,
        placa: placa.value,
        isPWA: false,
      },
    })

    showEmailModal.value = false
    submitSuccess.value = true
    sentToEmail.value = email.value

    if (result.emailSent) {
      submitMessage.value = result.message || 'Consulta enviada com sucesso! Verifique seu e-mail.'
      track('consulta_success')
    } else {
      submitMessage.value = result.message || 'Consulta realizada! Os dados serão enviados em breve.'
      track('consulta_success_no_email', { api_message: result.message })
    }

    consultaCount.value++
  } catch {
    showEmailModal.value = false
    submitSuccess.value = true
    sentToEmail.value = email.value
    submitMessage.value = 'Consulta recebida! Os dados serão enviados para seu e-mail em breve.'
    track('consulta_error', { error_message: 'network_error' })
  } finally {
    loading.value = false
  }
}

// ==========================================
// Lifecycle
// ==========================================
onMounted(async () => {
  // Track page version on load
  track('page_view_version', { version: pageVersion.value })

  if (isPWA.value) {
    // V1 (PWA) setup
    const savedPwaEmail = localStorage.getItem('pwa_email')
    if (savedPwaEmail) {
      email.value = savedPwaEmail
    }

    const wasRequested = localStorage.getItem('pwa_permission_requested')
    if (wasRequested) {
      permissionRequested.value = true
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      const { requestPermissionAndSave, listenForMessages } = usePushNotifications()
      await requestPermissionAndSave()
      listenForMessages()
    }
  } else {
    // V2 (Landing) setup - override body styles for dark theme
    const saved = localStorage.getItem('pc_email')
    if (saved) email.value = saved

    document.body.style.background = '#060824'
    document.body.style.backgroundImage = 'none'
    document.body.style.display = 'block'
  }

  nextTick(() => {
    placaRef.value?.focus()
  })
})

onUnmounted(() => {
  if (!isPWA.value) {
    document.body.style.background = ''
    document.body.style.backgroundImage = ''
    document.body.style.display = ''
  }
})

// ==========================================
// Static data (landing page showcase)
// ==========================================
const showcaseData = [
  { label: 'Placa', value: 'ABC1D23' },
  { label: 'Marca', value: 'VOLKSWAGEN' },
  { label: 'Modelo', value: 'CROSSFOX 1.6' },
  { label: 'Ano/Modelo', value: '2007/2007' },
  { label: 'Cor', value: 'Prata' },
  { label: 'Combustível', value: 'GASOLINA' },
  { label: 'Município', value: 'SAO PAULO - SP' },
  { label: 'Situação', value: 'Sem restrição' },
  { label: 'Valor FIPE', value: 'R$ 28.799,00' },
  { label: 'Chassi', value: '*************57092' },
]

const includedItems = [
  { icon: 'car', title: 'Marca e Modelo', desc: 'Fabricante e modelo completo do veículo' },
  { icon: 'calendar', title: 'Ano Fabricação', desc: 'Ano de fabricação e ano modelo' },
  { icon: 'palette', title: 'Cor', desc: 'Cor predominante do veículo' },
  { icon: 'dollar', title: 'Valor FIPE', desc: 'Preço atualizado pela tabela FIPE' },
  { icon: 'shield', title: 'Situação', desc: 'Restrições, roubo/furto, alertas' },
  { icon: 'key', title: 'Chassi', desc: 'Número do chassi (parcial)' },
  { icon: 'fuel', title: 'Combustível', desc: 'Tipo de combustível do veículo' },
  { icon: 'map', title: 'Município/UF', desc: 'Cidade e estado de registro' },
]
</script>

<template>
  <!-- ========================================== -->
  <!-- V1: PWA (Win95 style) - same as always     -->
  <!-- ========================================== -->
  <div v-if="isPWA" class="desktop">
    <main>
      <div class="win-window">
        <div class="win-window__titlebar">
          <span>{{ appTitle }}</span>
          <div class="win-window__titlebar-buttons">
            <span v-if="isPWA && email" class="win-window__titlebar-btn win-window__titlebar-btn--active" @click="changePwaEmail" title="Alterar e-mail">&#9993;</span>
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
            Digite a placa e descubra os dados completos do veículo.
          </p>

          <p v-if="consultaCount > 0" class="counter">
            {{ consultaCount.toLocaleString('pt-BR') }} consultas realizadas
          </p>

          <hr class="win-separator" />

          <form v-if="!success" @submit.prevent="handleSubmitV1" novalidate>
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

            <button
              v-if="!processingPhoto && !loading"
              type="submit"
              class="win-btn win-btn--primary win-btn--block"
              :disabled="loading"
            >
              Consultar Placa
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
              Enviado para <strong>{{ sentToEmailV1 }}</strong>
            </p>
            <button
              type="button"
              class="win-btn win-btn--primary win-btn--block"
              @click="resetFormV1"
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

      <!-- FAQ Section (web only) -->
      <div v-if="!isPWA" class="win-window faq-window">
        <div class="win-window__titlebar">
          <span>Perguntas Frequentes</span>
          <div class="win-window__titlebar-buttons">
            <span class="win-window__titlebar-btn">_</span>
            <span class="win-window__titlebar-btn">&square;</span>
            <span class="win-window__titlebar-btn">&times;</span>
          </div>
        </div>
        <div class="win-window__body faq-body">
          <div
            v-for="(faq, index) in homepageFaqs"
            :key="faq.question"
            class="faq-item"
            :class="{ 'faq-item--open': openFaq === index }"
          >
            <button class="faq-item__toggle" @click="openFaq = openFaq === index ? null : index">
              <span class="faq-item__icon">{{ openFaq === index ? '−' : '+' }}</span>
              <h3>{{ faq.question }}</h3>
            </button>
            <div v-show="openFaq === index" class="faq-item__answer">
              <p>{{ faq.answer }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Data Modal for PWA -->
      <div v-if="showDataModal" class="modal-overlay" @click="showDataModal = false">
        <div class="modal-window" :class="{ 'modal-window--capturing': preparingShare }" ref="modalWindowRef" @click.stop>
          <div class="win-window">
            <div class="win-window__titlebar">
              <span>Dados do Veículo - {{ placa }}</span>
              <div class="win-window__titlebar-buttons">
                <span class="win-window__titlebar-btn win-window__titlebar-btn--active" @click="showDataModal = false">&times;</span>
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

              <p v-if="!preparingShare" class="data-table__hint">Clique nos valores para copiar</p>

              <button
                v-if="preparingShare"
                type="button"
                class="win-btn win-btn--primary win-btn--block"
                disabled
                style="cursor: default; opacity: 1; color: #ffffff !important;"
              >
                www.placacompleta.com.br
              </button>

              <div v-if="!preparingShare" class="modal-actions">
                <button
                  type="button"
                  class="win-btn win-btn--primary"
                  @click="showDataModal = false; resetFormV1()"
                >
                  Nova Consulta
                </button>
                <button
                  type="button"
                  class="win-btn win-btn--secondary modal-share-btn"
                  @click="shareVehicleData"
                  title="Compartilhar"
                >
                  <img src="/share-website.svg" alt="Compartilhar" width="18" height="18" />
                </button>
              </div>
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
                <span class="win-window__titlebar-btn win-window__titlebar-btn--active" @click="showPwaEmailPrompt = false">&times;</span>
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

      <!-- Email Confirmation Modal -->
      <div v-if="showEmailConfirm" class="modal-overlay" @click="showEmailConfirm = false">
        <div class="modal-window" @click.stop>
          <div class="win-window">
            <div class="win-window__titlebar">
              <span>Confirmar E-mail</span>
              <div class="win-window__titlebar-buttons">
                <span class="win-window__titlebar-btn win-window__titlebar-btn--active" @click="showEmailConfirm = false">&times;</span>
              </div>
            </div>
            <div class="win-window__body">
              <p class="modal-instruction">Enviar resultado da consulta para:</p>
              <p class="confirm-email">{{ email }}</p>
              <div class="confirm-actions">
                <button
                  type="button"
                  class="win-btn win-btn--primary win-btn--block"
                  @click="confirmEmailV1"
                >
                  Enviar para este e-mail
                </button>
                <button
                  type="button"
                  class="win-btn win-btn--block"
                  @click="changeEmailV1"
                >
                  Usar outro e-mail
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Web Email Prompt Modal -->
      <div v-if="showWebEmailPrompt" class="modal-overlay" @click="showWebEmailPrompt = false">
        <div class="modal-window" @click.stop>
          <div class="win-window">
            <div class="win-window__titlebar">
              <span>Informe seu E-mail</span>
              <div class="win-window__titlebar-buttons">
                <span class="win-window__titlebar-btn win-window__titlebar-btn--active" @click="showWebEmailPrompt = false">&times;</span>
              </div>
            </div>
            <div class="win-window__body">
              <p class="modal-instruction">Informe seu e-mail para receber os dados completos do veículo.</p>
              <div class="form-group">
                <label class="form-group__label" for="web-email">Seu e-mail</label>
                <input
                  id="web-email"
                  v-model="webEmail"
                  type="email"
                  class="win-input"
                  :class="{ 'win-input--error': webEmailError }"
                  placeholder="seu@email.com"
                  autocomplete="email"
                  inputmode="email"
                  @keyup.enter="saveWebEmail"
                />
                <span v-if="webEmailError" class="form-group__error">{{ webEmailError }}</span>
              </div>
              <button
                type="button"
                class="win-btn win-btn--primary win-btn--block"
                @click="saveWebEmail"
              >
                Receber Dados no E-mail
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <!-- ========================================== -->
  <!-- V2: Landing page (web visitors)            -->
  <!-- ========================================== -->
  <div v-else class="lp">
    <!-- Navbar -->
    <nav class="lp-nav">
      <div class="lp-nav__inner">
        <div class="lp-nav__brand" @click="scrollTo('hero')">
          <img src="/logo-nobg-200.png" alt="PlacaCompleta" class="lp-nav__logo" width="32" height="32" />
          <span class="lp-nav__name">PlacaCompleta</span>
        </div>

        <div class="lp-nav__links" :class="{ 'lp-nav__links--open': showMobileMenu }">
          <a href="#como-funciona" @click.prevent="scrollTo('como-funciona')">Como Funciona</a>
          <a href="#perguntas" @click.prevent="scrollTo('perguntas')">Perguntas</a>
        </div>

        <button class="lp-nav__cta" @click="scrollTo('hero')">Consultar Agora</button>

        <button class="lp-nav__hamburger" @click="showMobileMenu = !showMobileMenu" aria-label="Menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>

    <!-- Hero Section -->
    <section id="hero" class="lp-hero">
      <div class="lp-hero__inner">
        <!-- Showcase Card (left) -->
        <div class="lp-hero__showcase">
          <div class="showcase-card">
            <div class="showcase-card__titlebar">
              <span class="showcase-card__titlebar-icon">&#128203;</span>
              <span>Dados do Veículo &mdash; ABC1D23</span>
              <div class="showcase-card__titlebar-buttons">
                <span class="showcase-card__btn">_</span>
                <span class="showcase-card__btn">&square;</span>
                <span class="showcase-card__btn">&times;</span>
              </div>
            </div>
            <div class="showcase-card__body">
              <div
                v-for="(item, i) in showcaseData"
                :key="item.label"
                class="showcase-card__row"
                :style="{ animationDelay: `${0.3 + i * 0.1}s` }"
              >
                <span class="showcase-card__label">{{ item.label }}</span>
                <span class="showcase-card__value">{{ item.value }}</span>
              </div>
            </div>
            <div class="showcase-card__statusbar">
              Consulta realizada com sucesso &mdash; 100% grátis
            </div>
          </div>
        </div>

        <!-- Copy + CTA (right) -->
        <div class="lp-hero__copy">
          <div v-if="consultaCount > 0" class="lp-hero__badge">
            {{ consultaCount.toLocaleString('pt-BR') }} consultas realizadas
          </div>

          <h1 class="lp-hero__title">
            Consulta Veicular<br />
            <span class="lp-hero__title-accent">Completa e Grátis</span>
          </h1>

          <p class="lp-hero__subtitle">
            Digite a placa e receba dados completos do veículo no seu e-mail.
            Marca, modelo, FIPE, situação e mais &mdash; em segundos.
          </p>

          <!-- Success State -->
          <div v-if="submitSuccess" class="lp-hero__success">
            <div class="lp-hero__success-icon">&#10003;</div>
            <p class="lp-hero__success-message">{{ submitMessage }}</p>
            <p v-if="sentToEmail" class="lp-hero__success-email">
              Enviado para <strong>{{ sentToEmail }}</strong>
            </p>
            <button class="lp-hero__submit" @click="resetFormV2">
              Consultar Outra Placa &rarr;
            </button>
          </div>

          <!-- Form -->
          <template v-else>
            <form class="lp-hero__form" @submit.prevent="handlePlacaSubmit" novalidate>
              <div class="lp-hero__form-row">
                <div class="lp-hero__field">
                  <input
                    ref="placaRef"
                    :value="placa"
                    type="text"
                    class="lp-hero__input lp-hero__input--placa"
                    :class="{ 'lp-hero__input--error': placaError }"
                    placeholder="ABC1D23"
                    maxlength="7"
                    autocomplete="off"
                    autocapitalize="characters"
                    inputmode="text"
                    @input="onPlacaInput"
                  />
                  <span v-if="placaError" class="lp-hero__error">{{ placaError }}</span>
                </div>
                <button
                  type="submit"
                  class="lp-hero__submit"
                >
                  Consultar Grátis &rarr;
                </button>
              </div>
            </form>

            <p class="lp-hero__trust">
              Sem cadastro &middot; 100% grátis &middot; Resultado em segundos
            </p>
          </template>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section id="como-funciona" class="lp-steps">
      <div class="lp-steps__inner">
        <h2 class="lp-section-title">Como Funciona</h2>
        <div class="lp-steps__grid">
          <div class="lp-step">
            <div class="lp-step__number">1</div>
            <h3 class="lp-step__title">Digite a placa</h3>
            <p class="lp-step__desc">Insira a placa do veículo no formato padrão ou Mercosul.</p>
          </div>
          <div class="lp-step">
            <div class="lp-step__number">2</div>
            <h3 class="lp-step__title">Confirme seu e-mail</h3>
            <p class="lp-step__desc">Informe ou confirme o e-mail para receber os dados na sua caixa de entrada.</p>
          </div>
          <div class="lp-step">
            <div class="lp-step__number">3</div>
            <h3 class="lp-step__title">Receba os dados</h3>
            <p class="lp-step__desc">Em segundos, todos os dados do veículo chegam no seu e-mail.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- What's Included -->
    <section class="lp-included">
      <div class="lp-included__inner">
        <h2 class="lp-section-title">O que está incluído</h2>
        <div class="lp-included__grid">
          <div v-for="item in includedItems" :key="item.title" class="lp-included__card">
            <div class="lp-included__icon">
              <svg v-if="item.icon === 'car'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M5 17a2 2 0 00-2 2v0a2 2 0 002 2h0M19 17a2 2 0 012 2v0a2 2 0 01-2 2h0"/></svg>
              <svg v-else-if="item.icon === 'calendar'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              <svg v-else-if="item.icon === 'palette'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="12" r="1.5" fill="currentColor"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/></svg>
              <svg v-else-if="item.icon === 'dollar'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
              <svg v-else-if="item.icon === 'shield'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z"/><path d="M9 12l2 2 4-4"/></svg>
              <svg v-else-if="item.icon === 'key'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              <svg v-else-if="item.icon === 'fuel'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 22V6a2 2 0 012-2h8a2 2 0 012 2v16"/><path d="M3 22h12"/><rect x="5" y="8" width="8" height="4"/><path d="M15 12h2a2 2 0 012 2v2a2 2 0 002 2v0"/><path d="M21 10v4"/></svg>
              <svg v-else-if="item.icon === 'map'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            </div>
            <h3 class="lp-included__title">{{ item.title }}</h3>
            <p class="lp-included__desc">{{ item.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section id="perguntas" class="lp-faq">
      <div class="lp-faq__inner">
        <h2 class="lp-section-title">Perguntas Frequentes</h2>
        <div class="lp-faq__list">
          <div
            v-for="(faq, i) in homepageFaqs"
            :key="faq.question"
            class="lp-faq__item"
            :class="{ 'lp-faq__item--open': openFaqIndex === i }"
          >
            <button class="lp-faq__question" @click="toggleFaq(i)">
              <span>{{ faq.question }}</span>
              <span class="lp-faq__chevron">&#9660;</span>
            </button>
            <div class="lp-faq__answer">
              <p>{{ faq.answer }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Bottom CTA -->
    <section class="lp-bottom-cta">
      <div class="lp-bottom-cta__inner">
        <h2 class="lp-bottom-cta__title">Pronto para consultar?</h2>
        <p class="lp-bottom-cta__desc">
          Digite a placa e receba todos os dados do veículo no seu e-mail. Grátis e sem cadastro.
        </p>
        <button class="lp-hero__submit" @click="scrollTo('hero')">
          Consultar Agora &rarr;
        </button>
      </div>
    </section>

    <!-- Email Modal -->
    <div v-if="showEmailModal" class="lp-email-overlay" @click.self="showEmailModal = false">
      <div class="lp-email-modal">
        <button class="lp-email-modal__close" @click="showEmailModal = false">&times;</button>

        <!-- Confirm existing email -->
        <template v-if="emailStep === 'confirm'">
          <div class="lp-email-modal__icon">&#9993;</div>
          <h3 class="lp-email-modal__title">Confirmar e-mail</h3>
          <p class="lp-email-modal__text">
            Enviaremos os dados da placa <strong>{{ placa }}</strong> para:
          </p>
          <p class="lp-email-modal__address">{{ email }}</p>
          <button
            class="lp-hero__submit lp-email-modal__submit"
            :disabled="loading"
            @click="handleSubmitV2"
          >
            <span v-if="loading" class="lp-hero__submit-loading"></span>
            <span v-else>Confirmar e Enviar &rarr;</span>
          </button>
          <button class="lp-email-modal__change" @click="changeEmailV2">
            Usar outro e-mail
          </button>
        </template>

        <!-- Input new email -->
        <template v-else>
          <div class="lp-email-modal__icon">&#9993;</div>
          <h3 class="lp-email-modal__title">Informe seu e-mail</h3>
          <p class="lp-email-modal__text">
            Para receber os dados completos da placa <strong>{{ placa }}</strong>:
          </p>
          <form @submit.prevent="handleSubmitV2" novalidate>
            <input
              ref="emailInputRef"
              v-model="email"
              type="email"
              class="lp-hero__input lp-email-modal__input"
              :class="{ 'lp-hero__input--error': emailError }"
              placeholder="seu@email.com"
              autocomplete="email"
              inputmode="email"
            />
            <span v-if="emailError" class="lp-hero__error">{{ emailError }}</span>
            <button
              type="submit"
              class="lp-hero__submit lp-email-modal__submit"
              :disabled="loading"
            >
              <span v-if="loading" class="lp-hero__submit-loading"></span>
              <span v-else>Enviar Consulta &rarr;</span>
            </button>
          </form>
        </template>
      </div>
    </div>

    <!-- Footer handled by app.vue -->
  </div>
</template>

<style lang="scss" scoped>
/* ======================================================== */
/* V1 (PWA) STYLES                                          */
/* ======================================================== */
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

.modal-window--capturing {
  max-height: none !important;

  .win-window__body {
    max-height: none !important;
    overflow-y: visible !important;
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

.confirm-email {
  font-family: $font-display;
  font-size: 1.125rem;
  color: $navy-electric;
  text-align: center;
  margin-bottom: $space-md;
  word-break: break-all;
}

.confirm-actions {
  display: flex;
  flex-direction: column;
  gap: $space-xs;
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

.modal-actions {
  display: flex;
  gap: $space-sm;
  align-items: center;

  .win-btn--primary {
    flex: 1;
  }

  .modal-share-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: auto;

    svg {
      display: block;
    }
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

.faq-window {
  margin-top: $space-md;
  overflow: hidden;
}

.faq-body {
  padding: $space-xs !important;
}

.faq-item {
  @include win-border-sunken;
  background: $win-white;
  margin-bottom: $space-xs;

  &:last-child {
    margin-bottom: 0;
  }

  &--open {
    .faq-item__toggle {
      background: $powder-blue;
    }
  }

  &__toggle {
    display: flex;
    align-items: center;
    gap: $space-xs;
    width: 100%;
    padding: $space-sm;
    border: none;
    background: transparent;
    cursor: pointer;
    text-align: left;

    &:hover {
      background: $powder-blue;
    }

    h3 {
      font-family: $font-display;
      font-size: 0.9375rem;
      color: $smart-blue;
      margin: 0;
    }
  }

  &__icon {
    font-family: $font-display;
    font-size: 1.125rem;
    color: $navy-electric;
    min-width: 16px;
    text-align: center;
    font-weight: 700;
  }

  &__answer {
    padding: 0 $space-sm $space-sm;
    border-top: 1px dotted #9ab1d0;

    p {
      font-size: 0.8125rem;
      line-height: 1.6;
      color: $graphite;
      margin: $space-sm 0 0;
    }
  }
}

/* ======================================================== */
/* V2 (LANDING PAGE) STYLES                                 */
/* ======================================================== */
$lp-bg: #060824;
$lp-bg-card: #0c1038;
$lp-navy: #090c9b;
$lp-blue: #3066be;
$lp-pink: #e84393;
$lp-pink-dark: #c0392b;
$lp-ivory: #fbfff1;
$lp-text: #c8cfe6;
$lp-text-muted: #7e89a8;
$lp-border: rgba(48, 102, 190, 0.2);
$lp-card-border: rgba(48, 102, 190, 0.15);

.lp {
  background: $lp-bg;
  background-image:
    radial-gradient(ellipse at 20% 50%, rgba($lp-navy, 0.4) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 20%, rgba($lp-blue, 0.15) 0%, transparent 50%);
  color: $lp-text;
  min-height: 100vh;
  font-family: $font-body;
  overflow-x: hidden;
  position: relative;

  &::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
  }
}

.lp > * {
  position: relative;
  z-index: 1;
}

.lp-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba($lp-bg, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid $lp-border;

  &__inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    flex-shrink: 0;
  }

  &__logo {
    width: 32px;
    height: 32px;
  }

  &__name {
    font-family: $font-display;
    font-size: 1.375rem;
    color: $lp-ivory;
    letter-spacing: 1px;
  }

  &__links {
    display: flex;
    gap: 32px;

    a {
      color: $lp-text-muted;
      text-decoration: none;
      font-size: 0.875rem;
      transition: color 0.2s;

      &:hover {
        color: $lp-ivory;
      }
    }
  }

  &__cta {
    background: $lp-pink;
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: 6px;
    font-family: $font-display;
    font-size: 1rem;
    cursor: pointer;
    letter-spacing: 0.5px;
    transition: background 0.2s, box-shadow 0.2s;
    flex-shrink: 0;

    &:hover {
      background: #ec5ba5;
      box-shadow: 0 0 20px rgba($lp-pink, 0.4);
    }
  }

  &__hamburger {
    display: none;
    flex-direction: column;
    gap: 4px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;

    span {
      display: block;
      width: 20px;
      height: 2px;
      background: $lp-ivory;
      transition: transform 0.2s;
    }
  }
}

@media (max-width: 768px) {
  .lp-nav {
    &__links {
      display: none;
      position: absolute;
      top: 60px;
      left: 0;
      right: 0;
      background: rgba($lp-bg, 0.95);
      backdrop-filter: blur(12px);
      flex-direction: column;
      padding: 16px 24px;
      gap: 16px;
      border-bottom: 1px solid $lp-border;

      &--open {
        display: flex;
      }
    }

    &__cta {
      display: none;
    }

    &__hamburger {
      display: flex;
    }
  }
}

.lp-hero {
  padding: 80px 24px 40px;
  min-height: calc(100vh - 60px);
  display: flex;
  align-items: center;

  &__inner {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 64px;
    align-items: center;
    width: 100%;
  }

  &__showcase {
    animation: heroSlideInLeft 0.8s ease-out both;
  }
}

.showcase-card {
  background: $win-bg;
  border: 2px solid;
  border-color: $win-white $win-darker $win-darker $win-white;
  transform: perspective(800px) rotateY(-2deg) rotateX(1deg);
  box-shadow:
    12px 12px 40px rgba(0, 0, 0, 0.5),
    0 0 30px rgba($lp-blue, 0.1);
  transition: transform 0.4s ease, box-shadow 0.4s ease;

  &:hover {
    transform: perspective(800px) rotateY(0deg) rotateX(0deg);
    box-shadow:
      0 8px 30px rgba(0, 0, 0, 0.4),
      0 0 40px rgba($lp-blue, 0.15);
  }

  &__titlebar {
    background: linear-gradient(90deg, $win-title, $lp-blue);
    color: white;
    font-family: $font-display;
    font-size: 1rem;
    padding: 4px 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    user-select: none;

    &-icon { font-size: 0.875rem; }
    &-buttons { margin-left: auto; display: flex; gap: 2px; }
  }

  &__btn {
    width: 16px;
    height: 16px;
    background: $win-bg;
    border: 2px solid;
    border-color: $win-white $win-darker $win-darker $win-white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    line-height: 1;
  }

  &__body {
    padding: 8px 12px;
    background: $win-white;
    margin: 4px;
    border: 2px solid;
    border-color: $win-darker $win-white $win-white $win-darker;
  }

  &__row {
    display: flex;
    justify-content: space-between;
    padding: 4px 2px;
    border-bottom: 1px dotted #9ab1d0;
    font-size: 0.8125rem;
    animation: rowReveal 0.4s ease-out both;

    &:last-child { border-bottom: none; }
  }

  &__label {
    font-weight: 600;
    color: $graphite;
    font-family: $font-body;
  }

  &__value {
    color: $navy-electric;
    font-weight: 700;
    font-family: $font-body;
    text-align: right;
  }

  &__statusbar {
    border: 2px solid;
    border-color: $win-darker $win-white $win-white $win-darker;
    background: $win-bg;
    padding: 3px 8px;
    font-family: $font-body;
    font-size: 0.6875rem;
    color: $graphite;
    margin: 0 4px 4px;
  }
}

.lp-hero__copy {
  animation: heroFadeInUp 0.8s ease-out 0.2s both;
}

.lp-hero__badge {
  display: inline-block;
  background: rgba($lp-blue, 0.15);
  border: 1px solid rgba($lp-blue, 0.3);
  color: $lp-blue;
  font-family: $font-display;
  font-size: 0.9375rem;
  padding: 6px 16px;
  border-radius: 20px;
  margin-bottom: 20px;
  letter-spacing: 0.5px;
}

.lp-hero__title {
  font-family: $font-display;
  font-size: 3rem;
  color: $lp-ivory;
  line-height: 1.1;
  margin-bottom: 16px;
  letter-spacing: 1px;

  &-accent { color: $lp-pink; }
}

.lp-hero__subtitle {
  font-size: 1rem;
  color: $lp-text;
  line-height: 1.6;
  margin-bottom: 32px;
  max-width: 480px;
}

.lp-hero__form { margin-bottom: 16px; }

.lp-hero__form-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.lp-hero__field {
  flex: 1;
  min-width: 140px;
}

.lp-hero__input {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.07);
  border: 2px solid $lp-border;
  border-radius: 8px;
  color: $lp-ivory;
  font-family: $font-body;
  font-size: 0.9375rem;
  outline: none;
  transition: border-color 0.2s, background 0.2s;

  &::placeholder { color: $lp-text-muted; }
  &:focus { border-color: $lp-blue; background: rgba(255, 255, 255, 0.1); }
  &--placa { font-family: $font-display; font-size: 1.25rem; text-transform: uppercase; letter-spacing: 3px; text-align: center; }
  &--error { border-color: $lp-pink; background: rgba($lp-pink, 0.08); }
}

.lp-hero__error {
  display: block;
  font-size: 0.75rem;
  color: $lp-pink;
  margin-top: 4px;
}

.lp-hero__submit {
  background: $lp-pink;
  color: white;
  border: none;
  padding: 12px 28px;
  border-radius: 8px;
  font-family: $font-display;
  font-size: 1.125rem;
  cursor: pointer;
  letter-spacing: 0.5px;
  white-space: nowrap;
  transition: background 0.2s, box-shadow 0.2s, transform 0.2s;
  flex-shrink: 0;

  &:hover:not(:disabled) { background: #ec5ba5; box-shadow: 0 0 30px rgba($lp-pink, 0.4); transform: translateY(-1px); }
  &:active:not(:disabled) { transform: translateY(0); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }

  &-loading {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
}

.lp-hero__trust {
  font-size: 0.8125rem;
  color: $lp-text-muted;
  letter-spacing: 0.3px;
}

.lp-hero__success {
  background: rgba($lp-bg-card, 0.8);
  border: 1px solid rgba(46, 204, 113, 0.3);
  border-radius: 12px;
  padding: 32px 24px;
  text-align: center;

  &-icon {
    width: 56px;
    height: 56px;
    background: rgba(46, 204, 113, 0.15);
    color: #2ecc71;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.75rem;
    margin: 0 auto 16px;
    border: 2px solid rgba(46, 204, 113, 0.3);
  }

  &-message { font-size: 1rem; color: $lp-ivory; margin-bottom: 8px; line-height: 1.5; }
  &-email { font-size: 0.875rem; color: $lp-text-muted; margin-bottom: 24px; strong { color: $lp-blue; } }
}

@media (max-width: 768px) {
  .lp-hero {
    padding: 70px 16px 24px;
    min-height: auto;

    &__inner { grid-template-columns: 1fr; gap: 40px; }
    &__copy { order: 1; }
    &__showcase { order: 2; }
  }

  .lp-hero__title { font-size: 2.25rem; }
  .lp-hero__form-row { flex-direction: column; }
  .lp-hero__field { min-width: 100%; }

  .showcase-card {
    transform: perspective(800px) rotateY(0deg) rotateX(1deg);
    &:hover { transform: perspective(800px) rotateY(0deg) rotateX(0deg); }
  }
}

.lp-section-title {
  font-family: $font-display;
  font-size: 2rem;
  color: $lp-ivory;
  text-align: center;
  margin-bottom: 36px;
  letter-spacing: 1px;
}

.lp-steps {
  padding: 56px 24px;
  border-top: 1px solid $lp-border;

  &__inner { max-width: 900px; margin: 0 auto; }
  &__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }
}

.lp-step {
  text-align: center;
  padding: 32px 24px;
  background: rgba($lp-bg-card, 0.6);
  border: 1px solid $lp-card-border;
  border-radius: 12px;
  transition: border-color 0.3s, transform 0.3s;

  &:hover { border-color: rgba($lp-blue, 0.4); transform: translateY(-4px); }

  &__number {
    width: 48px; height: 48px;
    background: rgba($lp-pink, 0.15); color: $lp-pink;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-family: $font-display; font-size: 1.5rem;
    margin: 0 auto 16px;
    border: 2px solid rgba($lp-pink, 0.3);
  }

  &__title { font-family: $font-display; font-size: 1.25rem; color: $lp-ivory; margin-bottom: 8px; letter-spacing: 0.5px; }
  &__desc { font-size: 0.875rem; color: $lp-text-muted; line-height: 1.5; }
}

@media (max-width: 768px) {
  .lp-steps__grid { grid-template-columns: 1fr; max-width: 400px; margin: 0 auto; }
}

.lp-included {
  padding: 56px 24px;
  border-top: 1px solid $lp-border;

  &__inner { max-width: 1000px; margin: 0 auto; }
  &__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }

  &__card {
    background: rgba($lp-bg-card, 0.6);
    border: 1px solid $lp-card-border;
    border-radius: 10px;
    padding: 24px 16px;
    text-align: center;
    transition: border-color 0.3s, transform 0.3s;

    &:hover { border-color: rgba($lp-blue, 0.4); transform: translateY(-3px); }
  }

  &__icon { width: 40px; height: 40px; margin: 0 auto 12px; color: $lp-blue; svg { width: 100%; height: 100%; } }
  &__title { font-family: $font-display; font-size: 1.0625rem; color: $lp-ivory; margin-bottom: 6px; letter-spacing: 0.5px; }
  &__desc { font-size: 0.75rem; color: $lp-text-muted; line-height: 1.4; }
}

@media (max-width: 768px) { .lp-included__grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
@media (max-width: 480px) { .lp-included__grid { grid-template-columns: 1fr 1fr; } }

.lp-faq {
  padding: 56px 24px;
  border-top: 1px solid $lp-border;

  &__inner { max-width: 700px; margin: 0 auto; }
  &__list { display: flex; flex-direction: column; gap: 8px; }

  &__item {
    background: rgba($lp-bg-card, 0.6);
    border: 1px solid $lp-card-border;
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 0.3s;

    &:hover { border-color: rgba($lp-blue, 0.3); }

    &--open {
      border-color: rgba($lp-blue, 0.4);
      .lp-faq__chevron { transform: rotate(180deg); }
      .lp-faq__answer { max-height: 300px; padding: 0 20px 16px; opacity: 1; }
    }
  }

  &__question {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: none;
    border: none;
    color: $lp-ivory;
    font-family: $font-display;
    font-size: 1.0625rem;
    text-align: left;
    cursor: pointer;
    letter-spacing: 0.5px;
    gap: 12px;
  }

  &__chevron { font-size: 0.75rem; color: $lp-text-muted; transition: transform 0.3s; flex-shrink: 0; }

  &__answer {
    max-height: 0;
    padding: 0 20px;
    opacity: 0;
    overflow: hidden;
    transition: max-height 0.3s ease, padding 0.3s ease, opacity 0.3s ease;

    p { font-size: 0.875rem; color: $lp-text-muted; line-height: 1.6; }
  }
}

.lp-bottom-cta {
  padding: 56px 24px;
  border-top: 1px solid $lp-border;
  text-align: center;

  &__inner { max-width: 600px; margin: 0 auto; }
  &__title { font-family: $font-display; font-size: 2rem; color: $lp-ivory; margin-bottom: 12px; letter-spacing: 1px; }
  &__desc { font-size: 1rem; color: $lp-text-muted; margin-bottom: 28px; line-height: 1.5; }
}

.lp-email-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 24px;
  animation: overlayFadeIn 0.2s ease-out;
}

.lp-email-modal {
  background: $lp-bg-card;
  border: 1px solid rgba($lp-blue, 0.3);
  border-radius: 16px;
  padding: 40px 32px;
  max-width: 420px;
  width: 100%;
  text-align: center;
  position: relative;
  animation: modalSlideUp 0.3s ease-out;

  &__close {
    position: absolute; top: 12px; right: 16px;
    background: none; border: none; color: $lp-text-muted;
    font-size: 1.5rem; cursor: pointer; padding: 4px; line-height: 1;
    transition: color 0.2s;
    &:hover { color: $lp-ivory; }
  }

  &__icon { font-size: 2.5rem; margin-bottom: 12px; }
  &__title { font-family: $font-display; font-size: 1.5rem; color: $lp-ivory; margin-bottom: 8px; letter-spacing: 0.5px; }

  &__text {
    font-size: 0.9375rem; color: $lp-text; margin-bottom: 20px; line-height: 1.5;
    strong { color: $lp-ivory; font-family: $font-display; letter-spacing: 1px; }
  }

  &__address { font-family: $font-body; font-size: 1.125rem; color: $lp-blue; font-weight: 600; margin-bottom: 24px; word-break: break-all; }
  &__input { margin-bottom: 8px; }
  &__submit { width: 100%; margin-top: 16px; }

  &__change {
    background: none; border: none; color: $lp-text-muted;
    font-size: 0.875rem; cursor: pointer; margin-top: 12px;
    text-decoration: underline; transition: color 0.2s;
    &:hover { color: $lp-ivory; }
  }
}

/* ======================================================== */
/* SHARED ANIMATIONS                                        */
/* ======================================================== */
@keyframes heroSlideInLeft {
  from { opacity: 0; transform: translateX(-40px) perspective(800px) rotateY(-2deg) rotateX(1deg); }
  to { opacity: 1; transform: translateX(0) perspective(800px) rotateY(-2deg) rotateX(1deg); }
}

@keyframes heroFadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes rowReveal {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes overlayFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modalSlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
