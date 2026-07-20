<script setup lang="ts">
import { homepageFaqs } from '~/data/homepage-faqs'

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
const showWebEmailPrompt = ref(false)
const webEmail = ref('')
const webEmailError = ref('')
const showEmailConfirm = ref(false)
const emailConfirmed = ref(false)

// WhatsApp delivery (web only — PWA always uses inline data).
// Hidden behind a public runtime flag so we can land the wiring
// without flipping the UI on for end users.
const channel = ref<'email' | 'whatsapp'>('email')
const phone = ref('')
const webPhone = ref('')
const webPhoneError = ref('')
const whatsappEnabled = computed(() => Boolean(useRuntimeConfig().public.whatsappEnabled))
const openFaq = ref<number | null>(null)
const photoInput = ref<HTMLInputElement | null>(null)
const processingPhoto = ref(false)
const photoProcessMessage = ref('')

const placaRef = ref<HTMLInputElement | null>(null)
const formStarted = ref(false)
const permissionRequested = ref(false)
const modalWindowRef = ref<HTMLElement | null>(null)
const preparingShare = ref(false)
const pwaFipeHistory = ref<{ label: string; price: number }[] | null>(null)
const includeFipeChart = ref(true)
const includeIcv5 = ref(true)
const icv5Uf = ref('')

const consultaStage = ref('')
let stageTimer: ReturnType<typeof setInterval> | null = null

function computeStages(): string[] {
  if (isPWA.value) {
    return [
      'Consultando placa no banco de dados...',
      'Buscando preço na tabela FIPE...',
      'Preparando resultado...',
    ]
  }
  const stages = [
    'Consultando placa no banco de dados...',
    'Buscando preço na tabela FIPE...',
  ]
  if (includeFipeChart.value) stages.push('Gerando gráfico de preços...')
  if (includeIcv5.value) stages.push('Calculando custo de manutenção em 5 anos...')
  stages.push('Enviando e-mail com o resultado...')
  return stages
}

function startStageCycle() {
  const stages = computeStages()
  let i = 0
  consultaStage.value = stages[0]
  stageTimer = setInterval(() => {
    if (i < stages.length - 1) {
      i++
      consultaStage.value = stages[i]
    }
  }, 1500)
}

function stopStageCycle() {
  if (stageTimer) {
    clearInterval(stageTimer)
    stageTimer = null
  }
  consultaStage.value = ''
}

onBeforeUnmount(() => {
  stopStageCycle()
})

const ufOptions = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

const appTitle = computed(() => {
  return 'PlacaCompleta'
})

const allVehicleData = computed(() => {
  if (!vehicleData.value) return null
  const data = vehicleData.value
  const extra = data.extra || {}

  // Find FIPE entry with highest score (best match)
  const fipeData = data.fipe?.dados?.reduce((max, item) =>
    (item.score > (max?.score || 0)) ? item : max
  , null)

  // PWA: Show full chassis from extra if available, fallback to obfuscated
  // Web: Always show obfuscated chassis
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

// SSR fetch: gives an instant value on first paint (Netlify edge-cached for ~60s).
const { data: countData } = await useFetch('/api/count')
if (countData.value?.count) {
  consultaCount.value = countData.value.count
}

// Client refresh: after hydration, fetch the latest count so the number is
// always fresh — independent of Netlify's HTML cache / build time.
if (import.meta.client) {
  onMounted(() => {
    $fetch<{ count: number }>('/api/count')
      .then((res) => { if (res?.count) consultaCount.value = res.count })
      .catch(() => { /* keep SSR value */ })
  })
}

useHead({
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
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'PlacaCompleta',
        alternateName: 'Consulta Veicular Grátis',
        url: 'https://placacompleta.com.br',
        inLanguage: 'pt-BR',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://placacompleta.com.br/?placa={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      }),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'PlacaCompleta',
        url: 'https://placacompleta.com.br',
        logo: 'https://placacompleta.com.br/logo-horizontal-600.png',
        areaServed: 'BR',
      }),
    },
  ],
})

onMounted(async () => {
  if (isPWA.value) {
    // For PWA, load persistent email
    const savedPwaEmail = localStorage.getItem('pwa_email')
    if (savedPwaEmail) {
      email.value = savedPwaEmail
    }

    // Check if permission was already requested
    const wasRequested = localStorage.getItem('pwa_permission_requested')
    if (wasRequested) {
      permissionRequested.value = true
    }

    // Auto-register for push notifications if permission already granted
    if ('Notification' in window && Notification.permission === 'granted') {
      const { requestPermissionAndSave, listenForMessages } = usePushNotifications()
      await requestPermissionAndSave()
      listenForMessages()
    }
  } else {
    // Restore web channel choice + recipient
    const savedChannel = localStorage.getItem('pc_channel')
    if (whatsappEnabled.value && savedChannel === 'whatsapp') {
      channel.value = 'whatsapp'
      const savedPhone = localStorage.getItem('pc_phone')
      if (savedPhone) phone.value = savedPhone
    } else {
      const saved = localStorage.getItem('pc_email')
      if (saved) email.value = saved
    }

    // Pre-select UF via IP geolocation
    $fetch<{ uf: string }>('/api/geo')
      .then((res) => { if (res?.uf) icv5Uf.value = res.uf })
      .catch(() => { icv5Uf.value = 'SP' })
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


function validateEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
}

function validatePlaca(val: string): boolean {
  const clean = val.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(clean)
}

function validatePhone(val: string): boolean {
  if (!val) return false
  const d = val.replace(/\D/g, '')
  return d.length >= 10 && d.length <= 13
}

function formatPhone(val: string): string {
  const d = val.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function onWebPhoneInput(e: Event) {
  const t = e.target as HTMLInputElement
  webPhone.value = formatPhone(t.value)
  webPhoneError.value = ''
}

function resetForm() {
  placa.value = ''
  pwaFipeHistory.value = null
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

function formatChartPrice(value: number): string {
  return `R$ ${(value / 1000).toFixed(0)}k`
}

function chartBarHeight(price: number): number {
  if (!pwaFipeHistory.value?.length) return 0
  const prices = pwaFipeHistory.value.map(p => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min
  if (range === 0) return 80
  return 25 + ((price - min) / range) * 75
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
    // Import html2canvas dynamically
    const html2canvas = (await import('html2canvas')).default

    // Set flag to modify modal for screenshot
    preparingShare.value = true

    // Wait for DOM update and ensure footer with URL is rendered
    await nextTick()
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    await new Promise(resolve => setTimeout(resolve, 300))

    // Capture screenshot with high quality settings
    // html2canvas clones the ENTIRE document including parent elements.
    // The modal-overlay (rgba(0,0,0,0.7)) was bleeding through causing
    // a non-deterministic fog/haze effect. onclone strips those backgrounds.
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
        // Remove parent overlay background from cloned DOM
        const overlay = clonedElement.closest('.modal-overlay')
        if (overlay) {
          ;(overlay as HTMLElement).style.background = 'transparent'
        }
        // Remove body background (navy gradient) from clone
        _clonedDoc.body.style.background = '#c0c0c0'
        // Disable animations that may interfere with capture
        clonedElement.style.animation = 'none'
      },
    })

    // Convert to blob with maximum quality
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png', 1.0)
    })

    // Create file
    const file = new File([blob], `placacompleta-${placa.value}.png`, { type: 'image/png' })

    // Check if Web Share API is available
    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `Dados do Veículo - ${placa.value}`,
        text: `Consulta realizada em www.PlacaCompleta.com.br`,
        files: [file],
      })
      track('vehicle_data_shared', { placa: placa.value })
    } else {
      // Fallback: download the image
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
    // Restore modal to normal state
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
  
  // After saving email, proceed with the query
  handleSubmit()
}

function saveWebEmail() {
  webEmailError.value = ''
  webPhoneError.value = ''

  if (channel.value === 'whatsapp') {
    if (!validatePhone(webPhone.value)) {
      webPhoneError.value = 'Telefone inválido. Use DDD + número, ex.: (11) 91234-5678.'
      return
    }
    localStorage.setItem('pc_phone', webPhone.value)
    localStorage.setItem('pc_channel', 'whatsapp')
    phone.value = webPhone.value
    showWebEmailPrompt.value = false
    emailConfirmed.value = true
    track('web_phone_saved')
    handleSubmit()
    return
  }

  if (!validateEmail(webEmail.value)) {
    webEmailError.value = 'E-mail inválido.'
    return
  }

  localStorage.setItem('pc_email', webEmail.value)
  localStorage.setItem('pc_channel', 'email')
  email.value = webEmail.value
  showWebEmailPrompt.value = false
  track('web_email_saved')

  emailConfirmed.value = true
  handleSubmit()
}

function confirmEmail() {
  showEmailConfirm.value = false
  emailConfirmed.value = true
  handleSubmit()
}

function changeEmail() {
  showEmailConfirm.value = false
  if (channel.value === 'whatsapp') {
    webPhone.value = phone.value
  } else {
    webEmail.value = email.value
  }
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

  // PWA: Request push notification permission on first submit
  if (isPWA.value && !permissionRequested.value) {
    permissionRequested.value = true
    localStorage.setItem('pwa_permission_requested', 'true')

    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission()
        // Let the composable handle registration on next app open
      } catch (error) {
        // Continue even if permission fails
      }
    }
  }

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

  // Web: missing recipient for the selected channel → open the modal
  const webRecipientMissing = !isPWA.value && (
    (channel.value === 'email' && !email.value) ||
    (channel.value === 'whatsapp' && !phone.value)
  )
  if (webRecipientMissing) {
    if (channel.value === 'whatsapp') webPhone.value = phone.value
    else webEmail.value = email.value
    showWebEmailPrompt.value = true
    return
  }

  // Web: confirm the saved recipient before billing the API
  if (!isPWA.value && !emailConfirmed.value) {
    showEmailConfirm.value = true
    return
  }
  emailConfirmed.value = false

  // Web validation (PWA validated email when stored)
  if (!isPWA.value) {
    if (channel.value === 'whatsapp') {
      if (!validatePhone(phone.value)) {
        webPhoneError.value = 'Telefone inválido.'
        track('form_validation_error', { error_field: 'phone' })
        return
      }
    } else if (!validateEmail(email.value)) {
      emailError.value = 'E-mail inválido.'
      track('form_validation_error', { error_field: 'email' })
      return
    }
  }

  if (!isPWA.value) {
    if (channel.value === 'whatsapp') {
      localStorage.setItem('pc_phone', phone.value)
      localStorage.setItem('pc_channel', 'whatsapp')
    } else {
      localStorage.setItem('pc_email', email.value)
      localStorage.setItem('pc_channel', 'email')
    }
  }
  loading.value = true
  startStageCycle()
  track('form_submit', { form_name: 'plate_consultation', pwa_mode: isPWA.value })

  try {
    const result = await $fetch<{ success: boolean; emailSent: boolean; whatsappSent?: boolean; channel?: 'email' | 'whatsapp'; message: string; data?: any }>('/api/consulta', {
      method: 'POST',
      body: {
        email: channel.value === 'email' ? email.value : null,
        phone: channel.value === 'whatsapp' ? phone.value : null,
        channel: channel.value,
        placa: placa.value,
        isPWA: isPWA.value,
        includeFipeChart: includeFipeChart.value,
        includeIcv5: includeIcv5.value,
        icv5Uf: icv5Uf.value,
      },
    })

    if (isPWA.value) {
      // Show modal with data in PWA mode
      pwaFipeHistory.value = result.fipeHistory || null
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
      const delivered = channel.value === 'whatsapp'
        ? Boolean(result.whatsappSent)
        : Boolean(result.emailSent)
      message.value = result.message
      messageType.value = delivered ? 'success' : 'info'
      success.value = delivered
      sentToEmail.value = channel.value === 'whatsapp' ? phone.value : email.value

      if (delivered) {
        track('consulta_success', { channel: channel.value })
      } else {
        track('consulta_success_no_delivery', { channel: channel.value, api_message: result.message })
      }
    }
    consultaCount.value++
  } catch (err: any) {
    const errMsg = err?.data?.message || err?.message || 'Erro inesperado. Tente novamente.'
    message.value = errMsg
    messageType.value = 'error'
    track('consulta_error', { error_message: errMsg })
  } finally {
    stopStageCycle()
    loading.value = false
  }
}
</script>

<template>
  <main class="desktop">
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
        <PlacaCompletaLogo class="logo" />

        <h1 class="page-title">Consulta Veicular Grátis</h1>
        <p class="page-subtitle">
          Digite a placa e receba <strong>marca, modelo, ano, valor FIPE e situação</strong> do veículo em segundos.
        </p>

        <p v-if="consultaCount > 0" class="counter">
          <svg class="counter__check" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor" opacity="0.15"/><path d="M4.5 8.5L7 11L11.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {{ consultaCount.toLocaleString('pt-BR') }} consultas realizadas
        </p>

        <form v-if="!success" @submit.prevent="handleSubmit" novalidate role="search" aria-label="Consulta veicular por placa">
          <div v-if="!processingPhoto && !loading" class="form-group">
            <label class="form-group__label visually-hidden" for="placa">Placa do Veículo</label>
            <div class="plate-field" :class="{ 'plate-field--error': placaError }">
              <div class="plate-field__band">
                <span class="plate-field__country">BRASIL</span>
              </div>
              <input
                id="placa"
                ref="placaRef"
                :value="placa"
                type="text"
                class="plate-field__input"
                placeholder="ABC1D23"
                maxlength="7"
                autocomplete="off"
                autocapitalize="characters"
                inputmode="text"
                required
                aria-describedby="placa-help"
                @focus="onFormStart"
                @input="onPlacaInput"
              />
            </div>
            <small id="placa-help" class="form-group__help">Aceita placa antiga (ABC1234) e Mercosul (ABC1D23)</small>
            <span v-if="placaError" class="form-group__error" role="alert">{{ placaError }}</span>
          </div>

          <button
            v-if="!processingPhoto && !loading"
            type="submit"
            class="win-btn win-btn--primary win-btn--block cta-main"
            :disabled="loading"
          >
            Consultar Placa Grátis
          </button>

          <p v-if="!processingPhoto && !loading" class="trust-line trust-line--cta">
            100% grátis &middot; Sem cadastro &middot; Resultado em segundos
          </p>

          <div v-if="!isPWA && !processingPhoto && !loading" class="options-row">
            <span class="options-row__caption">Incluir no resultado:</span>

            <label class="fipe-chart-option">
              <input
                type="checkbox"
                v-model="includeFipeChart"
                class="fipe-chart-option__checkbox"
              />
              <span class="fipe-chart-option__label">Gráfico FIPE</span>
              <span class="fipe-chart-option__tooltip" data-tip="Inclui no e-mail um gráfico com a evolução do preço FIPE do veículo nos últimos meses">?</span>
            </label>

            <label class="fipe-chart-option">
              <input
                type="checkbox"
                v-model="includeIcv5"
                class="fipe-chart-option__checkbox"
              />
              <span class="fipe-chart-option__label">Custo 5 anos (ICV5)</span>
              <span class="fipe-chart-option__tooltip" data-tip="Calcula uma estimativa do custo total para manter este veículo nos próximos 5 anos, incluindo manutenção e IPVA">?</span>
            </label>

            <div v-if="includeIcv5" class="uf-select-group">
              <label class="uf-select-group__label" for="icv5-uf">UF</label>
              <select
                id="icv5-uf"
                v-model="icv5Uf"
                class="win-input uf-select-group__select"
              >
                <option v-for="u in ufOptions" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>
          </div>

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

          <Transition name="stage" mode="out-in">
            <p
              v-if="loading && consultaStage && !photoProcessMessage"
              :key="consultaStage"
              class="loading-stage"
            >
              {{ consultaStage }}
            </p>
          </Transition>

          <div v-if="photoProcessMessage" class="win-alert win-alert--info">
            {{ photoProcessMessage }}
          </div>

          <div v-if="message && !photoProcessMessage" class="win-alert" :class="`win-alert--${messageType}`">
            {{ message }}
          </div>
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
          <p class="sample-preview__title">O que você recebe na consulta:</p>
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

    <!-- FAQ Section (web only) - separate win-window -->
    <section v-if="!isPWA" class="win-window faq-window" aria-labelledby="faq-heading">
      <div class="win-window__titlebar">
        <h2 id="faq-heading" class="win-window__titlebar-text">Perguntas Frequentes</h2>
        <div class="win-window__titlebar-buttons">
          <span class="win-window__titlebar-btn">_</span>
          <span class="win-window__titlebar-btn">&square;</span>
          <span class="win-window__titlebar-btn">&times;</span>
        </div>
      </div>
      <div class="win-window__body faq-body">
        <article
          v-for="(faq, index) in homepageFaqs"
          :key="faq.question"
          class="faq-item"
          :class="{ 'faq-item--open': openFaq === index }"
        >
          <button
            class="faq-item__toggle"
            :aria-expanded="openFaq === index ? 'true' : 'false'"
            :aria-controls="`faq-answer-${index}`"
            @click="openFaq = openFaq === index ? null : index"
          >
            <span class="faq-item__icon">{{ openFaq === index ? '−' : '+' }}</span>
            <h3>{{ faq.question }}</h3>
          </button>
          <div v-show="openFaq === index" :id="`faq-answer-${index}`" class="faq-item__answer" role="region">
            <p>{{ faq.answer }}</p>
          </div>
        </article>
      </div>
    </section>

    <!-- Data Modal for PWA -->
    <div v-if="showDataModal" class="modal-overlay" @click="showDataModal = false">
      <div class="modal-window" :class="{ 'modal-window--capturing': preparingShare }" ref="modalWindowRef" @click.stop>
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

            <!-- FIPE price history chart (PWA) -->
            <div v-if="pwaFipeHistory && pwaFipeHistory.length > 1" class="pwa-chart">
              <p class="pwa-chart__title">Histórico FIPE</p>
              <div class="pwa-chart__bars">
                <div
                  v-for="(point, i) in pwaFipeHistory"
                  :key="i"
                  class="pwa-chart__col"
                >
                  <span class="pwa-chart__value">{{ formatChartPrice(point.price) }}</span>
                  <div class="pwa-chart__bar" :style="{ height: chartBarHeight(point.price) + '%' }" />
                  <span class="pwa-chart__label">{{ point.label }}</span>
                </div>
              </div>
            </div>

            <!-- Show hint only when not preparing share -->
            <p v-if="!preparingShare" class="data-table__hint">Clique nos valores para copiar</p>

            <!-- Show site URL as button when preparing share -->
            <button
              v-if="preparingShare"
              type="button"
              class="win-btn win-btn--primary win-btn--block"
              disabled
              style="cursor: default; opacity: 1; color: #ffffff !important;"
            >
              www.placacompleta.com.br
            </button>

            <!-- Buttons (hide when preparing share) -->
            <div v-if="!preparingShare" class="modal-actions">
              <button
                type="button"
                class="win-btn win-btn--primary"
                @click="showDataModal = false; resetForm()"
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

    <!-- Email/WhatsApp Confirmation Modal -->
    <div v-if="showEmailConfirm" class="modal-overlay" @click="showEmailConfirm = false">
      <div class="modal-window" @click.stop>
        <div class="win-window">
          <div class="win-window__titlebar">
            <span>{{ channel === 'whatsapp' ? 'Confirmar WhatsApp' : 'Confirmar E-mail' }}</span>
            <div class="win-window__titlebar-buttons">
              <span class="win-window__titlebar-btn win-window__titlebar-btn--active" @click="showEmailConfirm = false">&times;</span>
            </div>
          </div>
          <div class="win-window__body">
            <p class="modal-instruction">Enviar resultado da consulta para:</p>
            <p class="confirm-email">{{ channel === 'whatsapp' ? phone : email }}</p>
            <div class="confirm-actions">
              <button
                type="button"
                class="win-btn win-btn--primary win-btn--block"
                @click="confirmEmail"
              >
                {{ channel === 'whatsapp' ? 'Enviar para este WhatsApp' : 'Enviar para este e-mail' }}
              </button>
              <button
                type="button"
                class="win-btn win-btn--block"
                @click="changeEmail"
              >
                {{ channel === 'whatsapp' ? 'Usar outro número' : 'Usar outro e-mail' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Web delivery prompt (Email/WhatsApp choice) -->
    <div v-if="showWebEmailPrompt" class="modal-overlay" @click="showWebEmailPrompt = false">
      <div class="modal-window" @click.stop>
        <div class="win-window">
          <div class="win-window__titlebar">
            <span>{{ channel === 'whatsapp' ? 'Informe seu WhatsApp' : 'Informe seu E-mail' }}</span>
            <div class="win-window__titlebar-buttons">
              <span class="win-window__titlebar-btn win-window__titlebar-btn--active" @click="showWebEmailPrompt = false">×</span>
            </div>
          </div>
          <div class="win-window__body">
            <!-- Channel toggle (only when whatsappEnabled) -->
            <div v-if="whatsappEnabled" class="channel-toggle">
              <button
                type="button"
                class="channel-toggle__btn"
                :class="{ 'channel-toggle__btn--active': channel === 'email' }"
                @click="channel = 'email'; webEmailError = ''; webPhoneError = ''"
              >
                E-mail
              </button>
              <button
                type="button"
                class="channel-toggle__btn"
                :class="{ 'channel-toggle__btn--active': channel === 'whatsapp' }"
                @click="channel = 'whatsapp'; webEmailError = ''; webPhoneError = ''"
              >
                WhatsApp
              </button>
            </div>

            <template v-if="channel === 'whatsapp'">
              <p class="modal-instruction">Informe seu WhatsApp para receber os dados do veículo.</p>
              <div class="form-group">
                <label class="form-group__label" for="web-phone">Seu WhatsApp</label>
                <input
                  id="web-phone"
                  :value="webPhone"
                  type="tel"
                  class="win-input"
                  :class="{ 'win-input--error': webPhoneError }"
                  placeholder="(11) 91234-5678"
                  autocomplete="tel-national"
                  inputmode="tel"
                  @input="onWebPhoneInput"
                  @keyup.enter="saveWebEmail"
                />
                <span v-if="webPhoneError" class="form-group__error">{{ webPhoneError }}</span>
              </div>
              <button
                type="button"
                class="win-btn win-btn--primary win-btn--block"
                @click="saveWebEmail"
              >
                Receber Dados no WhatsApp
              </button>
            </template>

            <template v-else>
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
            </template>
          </div>
        </div>
      </div>
    </div>

  </main>
</template>

<style lang="scss" scoped>
.page-title {
  font-family: $font-display;
  font-size: 1.75rem;
  font-weight: 800;
  color: $prussian-blue;
  text-align: center;
  margin-bottom: $space-sm;
  letter-spacing: -0.3px;
  line-height: 1.2;
}

.page-subtitle {
  font-family: $font-body;
  font-size: 0.9375rem;
  color: $blue-slate;
  text-align: center;
  margin-bottom: $space-md;
  line-height: 1.55;
  max-width: 360px;
  margin-left: auto;
  margin-right: auto;

  strong {
    color: $regal-navy;
    font-weight: 600;
  }
}

.counter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: $font-body;
  font-size: 0.8125rem;
  font-weight: 600;
  color: $success-green;
  background: #eef9f1;
  border-radius: 99px;
  padding: 5px 14px;
  margin-bottom: $space-lg;

  &__check {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
  }
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

// Mercosul-style plate input
.plate-field {
  max-width: 290px;
  margin: 0 auto;
  border: 2.5px solid $prussian-blue-3;
  border-radius: 10px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 4px 14px rgba(0, 18, 51, 0.12);
  transition: box-shadow 0.15s ease, border-color 0.15s ease;

  &:focus-within {
    border-color: $smart-blue;
    box-shadow: 0 0 0 4px rgba(4, 102, 200, 0.18), 0 4px 14px rgba(0, 18, 51, 0.12);
  }

  &--error {
    border-color: $error-red;
  }

  &__band {
    background: linear-gradient(180deg, #0353a4 0%, #023e7d 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3px 10px;
  }

  &__country {
    color: #ffffff;
    font-family: $font-body;
    font-weight: 700;
    font-size: 0.625rem;
    letter-spacing: 4px;
  }

  &__input {
    width: 100%;
    border: none;
    outline: none;
    font-family: $font-plate;
    font-weight: 700;
    font-size: 2rem;
    text-align: center;
    letter-spacing: 6px;
    text-transform: uppercase;
    color: $prussian-blue-3;
    padding: 8px 10px 10px;
    background: transparent;

    &::placeholder {
      color: #c8cedd;
      letter-spacing: 6px;
    }
  }
}

.cta-main {
  margin-top: $space-md;
  font-size: 1.0625rem;
  min-height: 52px;
}

.options-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px 14px;
  margin-top: $space-md;
  padding-top: $space-md;
  border-top: 1px solid $border-light;

  &__caption {
    font-size: 0.75rem;
    color: $slate-grey;
    width: 100%;
    text-align: center;
    margin-bottom: 2px;
  }
}

.form-group__help {
  display: block;
  font-size: 0.6875rem;
  color: $win-darker;
  margin-top: $space-xs;
}

.win-window__titlebar-text {
  font-size: inherit;
  font-weight: inherit;
  color: inherit;
  margin: 0;
}

.fipe-chart-option {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: $space-sm;
  cursor: pointer;
  user-select: none;

  &__checkbox {
    width: 14px;
    height: 14px;
    cursor: pointer;
    accent-color: $smart-blue;
  }

  &__label {
    font-family: $font-body;
    font-size: 0.75rem;
    color: $graphite;
  }

  &__tooltip {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: $win-darker;
    color: $win-white;
    font-size: 0.625rem;
    font-weight: 700;
    cursor: help;
    flex-shrink: 0;

    &::after {
      content: attr(data-tip);
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background: $navy-electric;
      color: $ivory;
      font-size: 0.6875rem;
      font-weight: 400;
      padding: 6px 10px;
      border-radius: 4px;
      white-space: normal;
      width: 220px;
      line-height: 1.4;
      text-align: center;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      z-index: 10;
    }

    &::before {
      content: '';
      position: absolute;
      bottom: calc(100% + 4px);
      left: 50%;
      transform: translateX(-50%);
      border: 4px solid transparent;
      border-top-color: $navy-electric;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      z-index: 10;
    }

    &:hover::after,
    &:hover::before {
      opacity: 1;
    }
  }
}

.uf-select-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: $space-sm;

  &__label {
    font-family: $font-body;
    font-size: 0.75rem;
    color: $graphite;
    white-space: nowrap;
  }

  &__select {
    font-family: $font-body;
    font-size: 0.75rem;
    padding: 2px 4px;
    width: auto;
    min-width: 60px;
  }
}

.trust-line {
  font-family: $font-body;
  font-size: 0.75rem;
  color: $slate-grey;
  text-align: center;
  margin-top: $space-md;
  letter-spacing: 0.3px;

  &--cta {
    margin-top: $space-sm;
  }
}

.loading-stage {
  font-family: $font-body;
  font-size: 0.75rem;
  color: $xp-text;
  text-align: center;
  margin-top: $space-xs;
  opacity: 0.85;
  font-style: italic;
}

.stage-enter-active,
.stage-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.stage-enter-from { opacity: 0; transform: translateY(-3px); }
.stage-leave-to   { opacity: 0; transform: translateY(3px); }

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

// Remove height restrictions when capturing screenshot
// This ensures the footer with site URL is included in the share image
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

.channel-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $space-xs;
  margin-bottom: $space-md;

  &__btn {
    font-family: $font-body;
    font-size: 0.8125rem;
    padding: $space-xs $space-sm;
    border: 1px solid $graphite;
    background: #fff;
    color: $graphite;
    cursor: pointer;
    transition: background-color 0.1s, color 0.1s;

    &:hover {
      background: rgba(0, 0, 0, 0.04);
    }

    &--active {
      background: $navy-electric;
      color: #fff;
      border-color: $navy-electric;
    }
  }
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


.pwa-chart {
  margin: $space-md 0 $space-sm;
}

.pwa-chart__title {
  font-family: $font-display;
  font-size: 0.8125rem;
  font-weight: 600;
  color: $graphite;
  margin: 0 0 $space-xs;
}

.pwa-chart__bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 110px;
  padding: $space-xs;
  background: $win-white;
  @include win-border-sunken;
  overflow-x: auto;
}

.pwa-chart__col {
  flex: 1;
  min-width: 34px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}

.pwa-chart__value {
  font-family: $font-mono;
  font-size: 0.5625rem;
  color: $graphite;
  white-space: nowrap;
  margin-bottom: 2px;
}

.pwa-chart__bar {
  width: 100%;
  max-width: 26px;
  background: $navy-electric;
  min-height: 4px;
}

.pwa-chart__label {
  font-family: $font-mono;
  font-size: 0.5625rem;
  color: $win-dark;
  margin-top: 2px;
  white-space: nowrap;
}
</style>
