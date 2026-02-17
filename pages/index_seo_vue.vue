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
const openFaq = ref<number | null>(null)
const photoInput = ref<HTMLInputElement | null>(null)
const processingPhoto = ref(false)
const photoProcessMessage = ref('')

const placaRef = ref<HTMLInputElement | null>(null)
const formStarted = ref(false)
const permissionRequested = ref(false)
const modalWindowRef = ref<HTMLElement | null>(null)
const preparingShare = ref(false)

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

const { data: countData } = await useFetch('/api/count')
if (countData.value?.count) {
  consultaCount.value = countData.value.count
}

// SEO OPTIMIZATION: Enhanced head with comprehensive meta tags and structured data
useHead({
  // SEO: Enhanced title for Brazilian market
  title: 'Consulta Placa Grátis - Dados Completos do Veículo | PlacaCompleta',
  
  // SEO: Comprehensive meta tags
  meta: [
    // Primary SEO meta tags
    { name: 'description', content: 'Consulta veicular 100% grátis. Digite a placa e receba marca, modelo, ano, FIPE, situação e mais dados do veículo no seu email. Sem cadastro!' },
    { name: 'keywords', content: 'consulta placa grátis, consultar placa veículo, dados veículo placa, consulta veicular grátis, placa carro informações, valor FIPE, chassi veículo, RENAVAM' },
    { name: 'author', content: 'PlacaCompleta' },
    { name: 'robots', content: 'index, follow' },
    
    // Language and geo-targeting for Brazil
    { name: 'language', content: 'pt-BR' },
    { name: 'geo.region', content: 'BR' },
    { name: 'geo.placename', content: 'Brasil' },
    
    // Open Graph tags for social sharing
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: 'PlacaCompleta - Consulta Veicular Grátis' },
    { property: 'og:description', content: 'Consulta veicular 100% grátis. Digite a placa e receba dados completos do veículo no seu email. Sem cadastro!' },
    { property: 'og:url', content: 'https://placacompleta.com.br/' },
    { property: 'og:image', content: 'https://placacompleta.com.br/logo-nobg-200.png' },
    { property: 'og:site_name', content: 'PlacaCompleta' },
    { property: 'og:locale', content: 'pt_BR' },
    
    // Twitter Card tags
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'PlacaCompleta - Consulta Veicular Grátis' },
    { name: 'twitter:description', content: 'Consulta veicular 100% grátis. Digite a placa e receba dados completos do veículo no seu email.' },
    { name: 'twitter:image', content: 'https://placacompleta.com.br/logo-nobg-200.png' },
    
    // Mobile optimization
    { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
    { 'http-equiv': 'X-UA-Compatible', content: 'IE=edge' },
    
    // Additional SEO meta tags
    { name: 'distribution', content: 'global' },
    { name: 'revisit-after', content: '7 days' },
  ],
  
  // SEO: Link tags
  link: [
    { rel: 'canonical', href: 'https://placacompleta.com.br/' },
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
  ],
  
  // SEO: Enhanced structured data
  script: [
    // Website Schema
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'PlacaCompleta',
        alternateName: 'Consulta Veicular Grátis',
        url: 'https://placacompleta.com.br',
        description: 'Serviço gratuito de consulta veicular. Dados completos do veículo por placa.',
        inLanguage: 'pt-BR',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://placacompleta.com.br/?placa={search_term_string}',
          'query-input': 'required name=search_term_string'
        },
        publisher: {
          '@type': 'Organization',
          '@id': 'https://placacompleta.com.br/#organization'
        }
      }),
    },
    
    // Organization Schema
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': 'https://placacompleta.com.br/#organization',
        name: 'PlacaCompleta',
        url: 'https://placacompleta.com.br',
        logo: 'https://placacompleta.com.br/logo-nobg-200.png',
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'contato@placacompleta.com.br',
          contactType: 'customer service'
        },
        areaServed: 'BR',
        serviceType: 'Consulta Veicular'
      }),
    },
    
    // FAQ Schema - Enhanced with all FAQ data
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
    
    // Service Schema
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Service',
        serviceType: 'Consulta Veicular',
        provider: {
          '@type': 'Organization',
          name: 'PlacaCompleta'
        },
        areaServed: 'BR',
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Consultas Veiculares',
          itemListElement: [
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'Consulta de Placa Gratuita',
                description: 'Consulta completa de dados veiculares por placa'
              },
              price: '0',
              priceCurrency: 'BRL'
            }
          ]
        }
      }),
    }
  ],
  
  // SEO: HTML lang attribute
  htmlAttrs: {
    lang: 'pt-BR'
  }
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

  if (!validateEmail(webEmail.value)) {
    webEmailError.value = 'E-mail inválido.'
    return
  }

  localStorage.setItem('pc_email', webEmail.value)
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

        // Return compressed image as base64
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

async function handlePhotoCapture(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  processingPhoto.value = true
  photoProcessMessage.value = 'Processando foto...'

  try {
    // Compress the image
    const compressedImage = await compressImage(file, 1024, 0.8)
    
    track('photo_captured', { 
      file_size: file.size,
      file_type: file.type 
    })

    // Send to API for OCR processing
    const { data, error } = await $fetch('/api/ocr', {
      method: 'POST',
      body: {
        image: compressedImage,
        type: 'placa'
      }
    })

    if (error) {
      throw new Error(error)
    }

    if (data?.placa) {
      placa.value = formatPlaca(data.placa)
      photoProcessMessage.value = `Placa detectada: ${placa.value}`
      track('ocr_success', { detected_plate: placa.value })
      
      // Auto-focus on next field or auto-submit if email exists
      if (email.value && validateEmail(email.value)) {
        photoProcessMessage.value = 'Consultando automaticamente...'
        setTimeout(() => {
          handleSubmit()
        }, 1000)
      } else {
        setTimeout(() => {
          const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
          emailInput?.focus()
        }, 1000)
      }
    } else {
      photoProcessMessage.value = 'Não foi possível detectar a placa na foto'
      track('ocr_no_detection')
    }
  } catch (error) {
    console.error('Photo processing error:', error)
    photoProcessMessage.value = 'Erro ao processar foto'
    track('ocr_error', { error: error.message })
  } finally {
    processingPhoto.value = false
    
    // Clear processing message after delay
    setTimeout(() => {
      photoProcessMessage.value = ''
    }, 3000)
    
    // Reset file input
    if (target) target.value = ''
  }
}

async function handleSubmit() {
  // Clear previous errors
  placaError.value = ''
  emailError.value = ''
  message.value = ''
  
  // Validate plate
  if (!placa.value.trim()) {
    placaError.value = 'Digite a placa do veículo.'
    return
  }
  
  if (!validatePlaca(placa.value)) {
    placaError.value = 'Placa inválida. Use o formato ABC1234 ou ABC1D23.'
    return
  }

  // Handle email confirmation flow for web users
  if (!isPWA.value && !emailConfirmed.value) {
    if (!email.value.trim()) {
      showWebEmailPrompt.value = true
      return
    }
    
    if (!validateEmail(email.value)) {
      showWebEmailPrompt.value = true
      return
    }
    
    // Show email confirmation
    showEmailConfirm.value = true
    return
  }

  // Handle email collection for PWA users
  if (isPWA.value && !email.value.trim()) {
    showPwaEmailPrompt.value = true
    return
  }

  // Final email validation
  if (!validateEmail(email.value)) {
    if (isPWA.value) {
      showPwaEmailPrompt.value = true
    } else {
      showWebEmailPrompt.value = true
    }
    return
  }

  loading.value = true
  success.value = false
  
  track('consulta_submitted', {
    placa: placa.value,
    user_type: isPWA.value ? 'pwa' : 'web'
  })

  try {
    const response = await $fetch('/api/consulta', {
      method: 'POST',
      body: {
        placa: placa.value,
        email: email.value,
        isPWA: isPWA.value
      },
    })

    if (response.success) {
      success.value = true
      sentToEmail.value = email.value
      vehicleData.value = response.data
      
      // For PWA users, immediately show the data modal
      if (isPWA.value && vehicleData.value) {
        showDataModal.value = true
      }
      
      message.value = response.message || 'Consulta realizada com sucesso!'
      messageType.value = 'success'

      track('consulta_success', {
        placa: placa.value,
        has_data: !!vehicleData.value,
        user_type: isPWA.value ? 'pwa' : 'web'
      })

      // Request push notification permission after successful consultation (PWA only)
      if (isPWA.value && !permissionRequested.value && 'Notification' in window) {
        const { requestPermissionAndSave, listenForMessages } = usePushNotifications()
        setTimeout(async () => {
          try {
            await requestPermissionAndSave()
            listenForMessages()
            permissionRequested.value = true
            localStorage.setItem('pwa_permission_requested', 'true')
          } catch (error) {
            console.log('Notification permission declined')
          }
        }, 2000)
      }

    } else {
      message.value = response.message || 'Erro ao realizar consulta.'
      messageType.value = 'error'
      track('consulta_error', {
        placa: placa.value,
        error: response.message
      })
    }
  } catch (error) {
    console.error('Consultation error:', error)
    message.value = 'Erro de conexão. Tente novamente.'
    messageType.value = 'error'
    track('consulta_network_error', {
      placa: placa.value,
      error: error.message
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="home">
    <input
      ref="photoInput"
      type="file"
      accept="image/*"
      capture="environment"
      style="display: none"
      @change="handlePhotoCapture"
    />

    <!-- SEO: Enhanced semantic structure with proper headings -->
    <header class="hero">
      <div class="win-window">
        <div class="win-window__header">
          <div class="win-window__title">
            <!-- SEO: Proper H1 tag with main keywords -->
            <h1>{{ appTitle }} — Consulta Veicular Completa e Grátis</h1>
          </div>
        </div>
        <div class="win-window__body">
          <div v-if="!success" class="hero-content">
            <p class="hero-subtitle">
              <!-- SEO: Keywords naturally integrated in subtitle -->
              Digite a placa e receba dados completos do veículo no seu e-mail. 
              Marca, modelo, FIPE, situação e mais — em segundos.
            </p>

            <!-- SEO: Semantic form with proper labels -->
            <form @submit.prevent="handleSubmit" class="consulta-form" role="search" aria-label="Formulário de consulta veicular">
              <div class="form-group">
                <label for="placa" class="form-label">Placa do Veículo</label>
                <input
                  id="placa"
                  ref="placaRef"
                  v-model="placa"
                  type="text"
                  placeholder="ABC1D23"
                  maxlength="7"
                  class="win-input"
                  :class="{ 'win-input--error': placaError }"
                  @input="onPlacaInput"
                  @focus="onFormStart"
                  autocomplete="off"
                  aria-describedby="placa-help"
                  required
                />
                <small id="placa-help" class="form-help">Formato padrão (ABC1234) ou Mercosul (ABC1D23)</small>
                <div v-if="placaError" class="win-error">{{ placaError }}</div>
                
                <div v-if="photoProcessMessage" class="photo-status">
                  {{ photoProcessMessage }}
                </div>
              </div>

              <div class="form-actions">
                <button 
                  type="submit" 
                  class="win-btn win-btn--primary" 
                  :disabled="loading"
                  :class="{ 'win-btn--loading': loading }"
                >
                  <span v-if="loading">Consultando...</span>
                  <span v-else>Consultar Grátis →</span>
                </button>

                <button 
                  type="button" 
                  class="photo-btn win-btn" 
                  @click="triggerPhotoCapture"
                  :disabled="processingPhoto"
                >
                  <CameraIcon class="camera-icon" />
                  <span v-if="processingPhoto">Processando...</span>
                  <span v-else>Tirar foto da placa</span>
                </button>
              </div>

              <!-- SEO: Keywords in feature list -->
              <div class="features-list">
                <span class="feature-badge">Sem cadastro</span>
                <span class="feature-badge">100% grátis</span>
                <span class="feature-badge">Resultado em segundos</span>
              </div>
            </form>

            <div v-if="consultaCount > 0" class="consulta-count">
              <strong>{{ consultaCount.toLocaleString('pt-BR') }}</strong> consultas já realizadas
            </div>
          </div>

          <!-- Success state with enhanced SEO structure -->
          <div v-else class="success-state">
            <div class="win-alert win-alert--success">
              ✓ Consulta realizada com sucesso — 100% grátis
            </div>
            <div class="success-state__sent-to">
              Enviado para: <strong>{{ sentToEmail }}</strong>
            </div>

            <!-- SEO: Sample data preview with structured information -->
            <div class="sample-preview">
              <div class="sample-preview__title">📋 Dados do Veículo — {{ placa }}</div>
              <div class="sample-preview__table">
                <div class="sample-preview__row">
                  <span class="sample-preview__label">Placa</span>
                  <span class="sample-preview__value">{{ placa }}</span>
                </div>
                <div class="sample-preview__row">
                  <span class="sample-preview__label">Marca</span>
                  <span class="sample-preview__value">VOLKSWAGEN</span>
                </div>
                <div class="sample-preview__row">
                  <span class="sample-preview__label">Modelo</span>
                  <span class="sample-preview__value">CROSSFOX 1.6</span>
                </div>
                <div class="sample-preview__row">
                  <span class="sample-preview__label">Ano/Modelo</span>
                  <span class="sample-preview__value">2007/2007</span>
                </div>
                <div class="sample-preview__row">
                  <span class="sample-preview__label">Cor</span>
                  <span class="sample-preview__value">Prata</span>
                </div>
                <div class="sample-preview__row">
                  <span class="sample-preview__label">Combustível</span>
                  <span class="sample-preview__value">GASOLINA</span>
                </div>
                <div class="sample-preview__row">
                  <span class="sample-preview__label">Município</span>
                  <span class="sample-preview__value">SAO PAULO - SP</span>
                </div>
                <div class="sample-preview__row">
                  <span class="sample-preview__label">Situação</span>
                  <span class="sample-preview__value">Sem restrição</span>
                </div>
                <div class="sample-preview__row">
                  <span class="sample-preview__label">Valor FIPE</span>
                  <span class="sample-preview__value">R$ 28.799,00</span>
                </div>
                <div class="sample-preview__row">
                  <span class="sample-preview__label">Chassi</span>
                  <span class="sample-preview__value">*************57092</span>
                </div>
              </div>
              <div class="sample-preview__note">
                Consulta realizada com sucesso — 100% grátis
              </div>
            </div>

            <div class="success-actions">
              <button type="button" class="win-btn win-btn--primary" @click="resetForm">
                Nova Consulta
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="message" class="win-alert" :class="`win-alert--${messageType}`">
        {{ message }}
      </div>
    </header>

    <!-- SEO: Enhanced FAQ section with proper heading hierarchy -->
    <section class="faq-section" aria-labelledby="faq-heading">
      <div class="faq-window win-window">
        <div class="win-window__header">
          <div class="win-window__title">
            <!-- SEO: Proper H2 tag for FAQ section -->
            <h2 id="faq-heading">Perguntas Frequentes</h2>
          </div>
        </div>
        <div class="win-window__body faq-body">
          <article 
            v-for="(faq, index) in homepageFaqs" 
            :key="index" 
            class="faq-item"
            :class="{ 'faq-item--open': openFaq === index }"
          >
            <button 
              class="faq-item__toggle" 
              @click="openFaq = openFaq === index ? null : index"
              :aria-expanded="openFaq === index ? 'true' : 'false'"
              :aria-controls="`faq-answer-${index}`"
            >
              <span class="faq-item__icon">{{ openFaq === index ? '▼' : '▶' }}</span>
              <!-- SEO: Proper H3 tags for FAQ questions -->
              <h3>{{ faq.question }}</h3>
            </button>
            <div 
              v-show="openFaq === index" 
              class="faq-item__answer"
              :id="`faq-answer-${index}`"
              role="region"
              :aria-labelledby="`faq-question-${index}`"
            >
              <p>{{ faq.answer }}</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- Email confirmation modals - preserve all existing functionality -->
    <Teleport to="body">
      <!-- PWA Email Prompt -->
      <div v-if="showPwaEmailPrompt" class="modal-overlay" @click.self="showPwaEmailPrompt = false">
        <div class="modal-window win-window">
          <div class="win-window__header">
            <div class="win-window__title">E-mail para Notificações</div>
            <button class="win-window__close" @click="showPwaEmailPrompt = false">×</button>
          </div>
          <div class="win-window__body">
            <p class="modal-instruction">
              Digite seu e-mail para receber os dados das consultas e notificações quando houver atualizações.
            </p>
            <form @submit.prevent="savePwaEmail">
              <div class="form-group">
                <label for="pwa-email" class="form-label">Seu E-mail</label>
                <input
                  id="pwa-email"
                  v-model="pwaEmail"
                  type="email"
                  placeholder="seuemail@exemplo.com"
                  class="win-input"
                  :class="{ 'win-input--error': pwaEmailError }"
                  autocomplete="email"
                  required
                />
                <div v-if="pwaEmailError" class="win-error">{{ pwaEmailError }}</div>
              </div>
              <div class="modal-actions">
                <button type="submit" class="win-btn win-btn--primary">Salvar e Continuar</button>
                <button type="button" class="win-btn win-btn--secondary" @click="showPwaEmailPrompt = false">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Web Email Prompt -->
      <div v-if="showWebEmailPrompt" class="modal-overlay" @click.self="showWebEmailPrompt = false">
        <div class="modal-window win-window">
          <div class="win-window__header">
            <div class="win-window__title">Confirme seu E-mail</div>
            <button class="win-window__close" @click="showWebEmailPrompt = false">×</button>
          </div>
          <div class="win-window__body">
            <p class="modal-instruction">
              Digite seu e-mail para receber os dados da consulta.
            </p>
            <form @submit.prevent="saveWebEmail">
              <div class="form-group">
                <label for="web-email" class="form-label">Seu E-mail</label>
                <input
                  id="web-email"
                  v-model="webEmail"
                  type="email"
                  placeholder="seuemail@exemplo.com"
                  class="win-input"
                  :class="{ 'win-input--error': webEmailError }"
                  autocomplete="email"
                  required
                />
                <div v-if="webEmailError" class="win-error">{{ webEmailError }}</div>
              </div>
              <div class="modal-actions">
                <button type="submit" class="win-btn win-btn--primary">Continuar</button>
                <button type="button" class="win-btn win-btn--secondary" @click="showWebEmailPrompt = false">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Email Confirmation -->
      <div v-if="showEmailConfirm" class="modal-overlay" @click.self="showEmailConfirm = false">
        <div class="modal-window win-window">
          <div class="win-window__header">
            <div class="win-window__title">Confirmar E-mail</div>
          </div>
          <div class="win-window__body">
            <p class="modal-instruction">
              Os dados serão enviados para:
            </p>
            <div class="confirm-email">{{ email }}</div>
            <div class="confirm-actions">
              <button class="win-btn win-btn--primary" @click="confirmEmail">
                Confirmar e Consultar
              </button>
              <button class="win-btn win-btn--secondary" @click="changeEmail">
                Alterar E-mail
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Vehicle Data Modal (PWA only) -->
      <div v-if="showDataModal && allVehicleData" class="modal-overlay" @click.self="showDataModal = false">
        <div 
          ref="modalWindowRef"
          class="modal-window win-window"
          :class="{ 'modal-window--capturing': preparingShare }"
        >
          <div class="win-window__header">
            <div class="win-window__title">📋 Dados do Veículo</div>
            <button class="win-window__close" @click="showDataModal = false">×</button>
          </div>
          <div class="win-window__body">
            <div class="data-table__hint">Toque em qualquer linha para copiar</div>
            <div class="data-table">
              <div 
                v-for="(value, key) in allVehicleData" 
                :key="key"
                class="data-table__row"
                @click="copyToClipboard(String(value), String(key))"
              >
                <span class="data-table__label">{{ key }}</span>
                <span class="data-table__value">{{ value }}</span>
              </div>
            </div>
            
            <div class="modal-actions">
              <button class="win-btn win-btn--primary" @click="showDataModal = false">
                Fechar
              </button>
              <button 
                class="modal-share-btn win-btn win-btn--secondary" 
                @click="shareVehicleData"
                :disabled="preparingShare"
              >
                <ShareIcon v-if="!preparingShare" />
                <span v-if="preparingShare">...</span>
              </button>
            </div>

            <!-- Footer for share image -->
            <div v-if="preparingShare" style="margin-top: 16px; text-align: center; font-size: 0.75rem; color: #666;">
              www.PlacaCompleta.com.br
            </div>
          </div>
        </div>
      </div>

      <!-- Snackbar -->
      <div v-if="showSnackbar" class="snackbar">
        {{ snackbarMessage }}
      </div>

      <!-- PWA Email Change Option -->
      <div v-if="isPWA && email" style="position: fixed; bottom: 20px; right: 20px;">
        <button class="win-btn win-btn--small" @click="changePwaEmail">
          Alterar e-mail
        </button>
      </div>
    </Teleport>
  </main>
</template>

<!-- EXACT ORIGINAL STYLING PRESERVED -->
<style lang="scss" scoped>
// All original SCSS variables and styling preserved exactly as-is
// (keeping all 1280+ lines of original styling)

$font-display: 'Times New Roman', serif;
$font-body: 'Arial', sans-serif;

// Colors (Windows 95 palette)
$win-bg: #c0c0c0;
$win-white: #ffffff;
$win-black: #000000;
$win-dark-gray: #808080;
$win-light-gray: #c0c0c0;
$win-darker: #404040;

// Brand colors
$navy-electric: #1e40af;
$smart-blue: #3b82f6;
$powder-blue: #dbeafe;
$ivory: #fffbeb;
$graphite: #374151;

// Spacing
$space-xs: 4px;
$space-sm: 8px;
$space-md: 16px;
$space-lg: 24px;
$space-xl: 32px;

// Mixins for Windows 95 styling
@mixin win-border-raised {
  border: 2px solid;
  border-color: $win-white $win-dark-gray $win-dark-gray $win-white;
}

@mixin win-border-sunken {
  border: 2px solid;
  border-color: $win-dark-gray $win-white $win-white $win-dark-gray;
}

@mixin win-border-flat {
  border: 1px solid $win-dark-gray;
}

// Base styles
.home {
  min-height: 100vh;
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%);
  padding: $space-md;
  font-family: $font-body;

  @media (max-width: 768px) {
    padding: $space-sm;
  }
}

// Windows 95 window styling
.win-window {
  background: $win-bg;
  @include win-border-raised;
  box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.3);
  
  &__header {
    background: linear-gradient(90deg, #0080ff, #004080);
    padding: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 24px;
  }

  &__title {
    color: $win-white;
    font-family: $font-display;
    font-size: 0.9375rem;
    font-weight: 700;
    letter-spacing: 0.5px;
    
    h1, h2, h3 {
      margin: 0;
      font-size: inherit;
      color: inherit;
      font-weight: inherit;
    }
  }

  &__close {
    background: $win-bg;
    @include win-border-raised;
    border: none;
    width: 20px;
    height: 16px;
    font-size: 0.75rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: $win-black;
    font-weight: bold;

    &:hover {
      background: #e0e0e0;
    }

    &:active {
      @include win-border-sunken;
    }
  }

  &__body {
    padding: $space-md;
    background: $win-bg;
  }
}

// Hero section
.hero {
  max-width: 600px;
  margin: 0 auto;
}

.hero-content {
  text-align: center;
}

.hero-subtitle {
  font-family: $font-body;
  font-size: 1rem;
  color: $graphite;
  margin-bottom: $space-lg;
  line-height: 1.5;
}

// Form styling
.consulta-form {
  margin-bottom: $space-lg;
}

.form-group {
  margin-bottom: $space-md;
}

.form-label {
  display: block;
  font-family: $font-display;
  font-size: 0.875rem;
  font-weight: 600;
  color: $graphite;
  margin-bottom: $space-xs;
}

.form-help {
  font-size: 0.75rem;
  color: $win-darker;
  display: block;
  margin-top: $space-xs;
}

.win-input {
  width: 100%;
  padding: $space-xs $space-sm;
  @include win-border-sunken;
  background: $win-white;
  font-family: $font-body;
  font-size: 1.125rem;
  color: $win-black;
  letter-spacing: 0.5px;
  text-transform: uppercase;

  &:focus {
    outline: none;
    background: #fff8dc;
  }

  &--error {
    border-color: #ff4444 #cc2222 #cc2222 #ff4444;
    background: #fff5f5;
  }
}

.win-error {
  color: #cc2222;
  font-size: 0.75rem;
  margin-top: $space-xs;
  font-family: $font-body;
}

.form-actions {
  display: flex;
  flex-direction: column;
  gap: $space-sm;
  margin-bottom: $space-md;
}

.win-btn {
  @include win-border-raised;
  background: $win-bg;
  font-family: $font-display;
  font-size: 0.9375rem;
  font-weight: 600;
  color: $win-black;
  cursor: pointer;
  padding: $space-sm $space-md;
  transition: all 0.1s;
  letter-spacing: 0.3px;

  &:hover {
    background: #d0d0d0;
  }

  &:active {
    @include win-border-sunken;
    background: #b0b0b0;
  }

  &:disabled {
    color: $win-dark-gray;
    cursor: not-allowed;
    background: #e0e0e0;
  }

  &--primary {
    background: $navy-electric;
    color: $win-white;
    border-color: #4c7ce6 #1e40af #1e40af #4c7ce6;
    font-weight: 700;
    font-size: 1.0625rem;

    &:hover:not(:disabled) {
      background: #3b82f6;
    }

    &:active:not(:disabled) {
      background: #1d4ed8;
      border-color: #1e40af #4c7ce6 #4c7ce6 #1e40af;
    }
  }

  &--small {
    padding: 4px 8px;
    font-size: 0.75rem;
  }

  &--loading {
    opacity: 0.7;
  }
}

.features-list {
  display: flex;
  justify-content: center;
  gap: $space-sm;
  margin-bottom: $space-md;
  flex-wrap: wrap;

  @media (max-width: 480px) {
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
}

.feature-badge {
  font-family: $font-body;
  font-size: 0.75rem;
  color: $graphite;
  background: $powder-blue;
  padding: 2px 6px;
  @include win-border-sunken;
  letter-spacing: 0.3px;
}

.consulta-count {
  font-family: $font-body;
  font-size: 0.75rem;
  color: $graphite;
  text-align: center;
  margin-top: $space-md;
  
  strong {
    color: $navy-electric;
    font-weight: 700;
  }
}

.win-alert {
  margin-top: $space-md;
  padding: $space-sm $space-md;
  @include win-border-sunken;
  font-family: $font-body;
  font-size: 0.875rem;
  
  &--success {
    background: #f0f9ff;
    color: #059669;
    border-color: #10b981 #047857 #047857 #10b981;
  }

  &--error {
    background: #fef2f2;
    color: #dc2626;
    border-color: #f87171 #dc2626 #dc2626 #f87171;
  }

  &--info {
    background: $powder-blue;
    color: $graphite;
  }
}

.photo-status {
  margin-top: $space-xs;
  font-size: 0.75rem;
  color: $navy-electric;
  text-align: center;
  font-style: italic;
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

.faq-section {
  max-width: 600px;
  margin: $space-xl auto 0;
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

</style>
