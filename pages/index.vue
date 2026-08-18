<script setup lang="ts">
import { homepageFaqs } from '~/data/homepage-faqs'

const { isPWA, isMobile } = useAppMode()
const route = useRoute()
// Landing de intencao-app: anuncios do ad group "App Intent" chegam com ?app=1
// e trocam o contador de consultas pelo badge do Play. Fallback: contador normal.
const appIntent = computed(() => route.query.app === '1' && !isPWA.value)
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

// Modal de seguro pos-consulta (fluxo web): estimativa SUSEP + captura de lead
interface SeguroEstimado {
  premioAnual: number
  franquia: number
  regiao: { codigo: string; descricao: string }
  regiaoDoUsuario: boolean
  veiculo: { marca: string; modelo: string; ano: number }
}
const shareInfo = ref<{ marca: string; modelo: string; ano: string; fipe: string | null } | null>(null)

const seguroEstimado = ref<SeguroEstimado | null>(null)
const showSeguroModal = ref(false)
const seguroStep = ref<'oferta' | 'telefone' | 'confirmado'>('oferta')
const seguroPhone = ref('')
const seguroPhoneError = ref('')
const seguroSending = ref(false)
const seguroSendError = ref(false)

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function buildShareText(): string {
  const s = shareInfo.value
  const veiculo = s ? `${s.marca} ${s.modelo} ${s.ano}`.trim() : ''
  const fipe = s?.fipe ? ` (FIPE ${s.fipe})` : ''
  return `Consultei a placa ${placa.value} no PlacaCompleta: ${veiculo}${fipe}. Consulta grátis com FIPE e seguro médio: https://placacompleta.com.br`
}

async function shareWhatsApp() {
  const text = buildShareText()
  track('share_whatsapp', { origem: 'success_screen' })
  if (navigator.share) {
    try { await navigator.share({ text }); return } catch { /* usuario cancelou */ }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
}

function openSeguroModal() {
  seguroStep.value = 'oferta'
  seguroPhoneError.value = ''
  seguroSendError.value = false
  // pre-preenche se o usuario ja deixou telefone (canal whatsapp)
  if (channel.value === 'whatsapp' && phone.value) seguroPhone.value = phone.value
  showSeguroModal.value = true
  track('seguro_modal_shown', { premio: seguroEstimado.value?.premioAnual })
}

function dismissSeguroModal() {
  showSeguroModal.value = false
  if (seguroStep.value !== 'confirmado') {
    track('seguro_modal_dismissed', { step: seguroStep.value })
  }
}

async function submitCotacao() {
  seguroPhoneError.value = ''
  seguroSendError.value = false
  const digits = seguroPhone.value.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 13) {
    seguroPhoneError.value = 'Confira o DDD e o número (ex: 31 99999-9999).'
    return
  }
  seguroSending.value = true
  try {
    await $fetch('/api/cotacao-seguro', {
      method: 'POST',
      body: {
        phone: seguroPhone.value,
        email: email.value,
        placa: placa.value,
        veiculo: seguroEstimado.value?.veiculo,
        seguro: {
          premioAnual: seguroEstimado.value?.premioAnual,
          franquia: seguroEstimado.value?.franquia,
          regiao: seguroEstimado.value?.regiao,
        },
      },
    })
    seguroStep.value = 'confirmado'
    track('cotacao_solicitada', { premio: seguroEstimado.value?.premioAnual })
  } catch (err: any) {
    if (err?.statusCode === 400 || err?.status === 400) {
      seguroPhoneError.value = err?.data?.message || 'Telefone inválido.'
    } else {
      seguroSendError.value = true
    }
  } finally {
    seguroSending.value = false
  }
}
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

// v2.0 herói web (não-PWA): CTA primário abre o checkout premium inline (overlay).
// Reusa a mesma placa do input. O fluxo grátis (handleSubmit) vira link secundário.
const showPremiumCheckout = ref(false)
const premiumPlaca = ref('')

function openPremiumCheckout() {
  placaError.value = ''
  if (!validatePlaca(placa.value)) {
    placaError.value = 'Placa inválida. Use o formato ABC1D23 ou ABC1234.'
    track('form_validation_error', { error_field: 'placa', origin: 'premium_cta' })
    nextTick(() => placaRef.value?.focus())
    return
  }
  premiumPlaca.value = placa.value
  showPremiumCheckout.value = true
  track('premium_checkout_open', { origin: 'home_hero' })
}

// CTA "Consultar agora" do grid de Preço: leva o foco ao input do herói e
// abre o checkout premium (openPremiumCheckout valida/foca se a placa faltar).
function consultFromGrid() {
  placaRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  openPremiumCheckout()
}

// CTA "Fazer consulta grátis" (card básico do compare): leva o foco ao input do
// herói para o usuário digitar e disparar o fluxo grátis (handleSubmit) pelo form.
function scrollToPlaca() {
  placaRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  nextTick(() => placaRef.value?.focus())
}

const permissionRequested = ref(false)
const modalWindowRef = ref<HTMLElement | null>(null)
const preparingShare = ref(false)
const pwaFipeHistory = ref<{ label: string; price: number }[] | null>(null)
const emailSuggestion = ref('')
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

function getTrackOrigin(): Record<string, string> | undefined {
  try {
    const raw = sessionStorage.getItem('pc_origin')
    return raw ? JSON.parse(raw) : undefined
  } catch { return undefined }
}

function track(event: string, params?: Record<string, any>) {
  if (import.meta.client && window.gtag) {
    window.gtag('event', event, params)
  }
}

function trackAppIntentClick() {
  track('store_badge_click', { source: 'app_intent_hero', store: 'google_play' })
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

// OG proprio da home (novo momento: temos um produto pago a vender). O <title>
// segue otimizado pra busca ("gratis", traz o organico); o card social e a
// pagina e que vendem o relatorio completo. Sem revelar fonte dos dados.
useSeoMeta({
  ogTitle: 'PlacaCompleta · Relatório completo do veículo pela placa',
  ogDescription: 'Restrições, roubo/furto, gravame, leilão, recall, ficha completa, FIPE, seguro e custo em 5 anos. Pagamento único no Pix, resultado na hora. Consulta básica grátis por e-mail.',
  ogImage: 'https://placacompleta.com.br/og-home.png',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'PlacaCompleta: relatório completo do veículo pela placa',
  twitterCard: 'summary_large_image',
  twitterTitle: 'PlacaCompleta · Relatório completo do veículo pela placa',
  twitterDescription: 'Restrições, roubo/furto, gravame, leilão, recall, FIPE, seguro e custo em 5 anos. Pagamento único no Pix, resultado na hora.',
  twitterImage: 'https://placacompleta.com.br/og-home.png',
})

useHead({
  // Web: title com keyword pro SERP (a homepage ranqueia pra "consulta placa"
  // com CTR em disputa). PWA/TWA: título curto, melhor em contexto de app.
  title: computed(() => isPWA.value
    ? 'PlacaCompleta'
    : 'Consulta Placa Grátis: FIPE, Marca e Modelo'),
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
  emailSuggestion.value = ''
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
        origin: getTrackOrigin(),
      },
    })

    if (isPWA.value) {
      // Show modal with data in PWA mode
      pwaFipeHistory.value = result.fipeHistory || null
      vehicleData.value = result.data || {
        marca: 'Honda',
        modelo: 'HR-V EXL 1.8',
        ano: '2021/2021',
        cor: 'Branco',
        fipe: 'R$ 113.297,00',
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
        shareInfo.value = (result as any).share || null
        if (result.seguroEstimado) {
          seguroEstimado.value = result.seguroEstimado
          // a tela de sucesso assenta primeiro; o modal chega como proximo passo
          setTimeout(() => { if (success.value) openSeguroModal() }, 1200)
        }
      } else {
        track('consulta_success_no_delivery', { channel: channel.value, api_message: result.message })
      }
    }
    consultaCount.value++
  } catch (err: any) {
    const errMsg = err?.data?.message || err?.message || 'Erro inesperado. Tente novamente.'
    message.value = errMsg
    messageType.value = 'error'
    emailSuggestion.value = err?.data?.data?.suggestion || ''
    track('consulta_error', { error_message: errMsg, has_suggestion: Boolean(emailSuggestion.value) })
  } finally {
    stopStageCycle()
    loading.value = false
  }
}

function applyEmailSuggestion() {
  if (!emailSuggestion.value) return
  if (isPWA.value) {
    pwaEmail.value = emailSuggestion.value
  }
  email.value = emailSuggestion.value
  webEmail.value = emailSuggestion.value
  message.value = ''
  emailSuggestion.value = ''
  track('email_suggestion_applied')
}
</script>

<template>
  <main class="desktop" :class="{ 'desktop--hero-web': !isPWA, 'home-v2': !isPWA }">
    <span id="top" class="anchor-top" aria-hidden="true" />

    <!-- =======================================================
         WEB (combo 3): herói acolhedor + editorial. PWA intacto abaixo.
         ======================================================= -->
    <template v-if="!isPWA">
      <!-- utility-strip fino -->
      <div class="cb-utility">
        <div class="cb-utility__inner">Pagamento via Pix · resultado na hora · sem cadastro</div>
      </div>

      <!-- nav (slab navy) -->
      <HomeHeader @consult="consultFromGrid" />

      <!-- ===== HERO ===== -->
      <header id="hero" class="cb-hero">
        <div class="cb-hero__grid">
          <!-- LEFT: título + placa + CTA -->
          <div class="cb-hero__left">
            <h1 class="cb-h1">
              O anúncio mostra o carro.<br>
              <span class="cb-accent">O relatório mostra o resto.</span>
            </h1>
            <p class="cb-sub">
              Restrição, roubo, gravame, leilão, dívida. <b>O que o vendedor não conta, a placa revela.</b>
            </p>

            <form class="cb-plate-panel" @submit.prevent="handleSubmit" novalidate role="search" aria-label="Consulta veicular por placa">
              <label class="cb-plate-label" for="placa">Digite a placa do veículo</label>
              <div class="plate-field cb-plate" :class="{ 'plate-field--error': placaError }">
                <div class="plate-field__band cb-plate__band">
                  <span class="cb-plate__flag" aria-hidden="true">★ ★ ★</span>
                  <span class="plate-field__country cb-plate__country">BRASIL</span>
                </div>
                <input
                  id="placa"
                  ref="placaRef"
                  :value="placa"
                  type="text"
                  class="plate-field__input cb-plate__input"
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
              <small id="placa-help" class="cb-plate-help">Aceita placa antiga (ABC1234) e Mercosul (ABC1D23)</small>
              <span v-if="placaError" class="form-group__error cb-error" role="alert">{{ placaError }}</span>

              <template v-if="!loading">
                <button type="button" class="cb-btn cb-btn--blue cb-btn--lg cb-btn--block" @click="openPremiumCheckout">
                  Ver relatório completo · R$ 45
                </button>
                <div class="cb-cta-sub">Pix · na hora · sem cadastro</div>
                <button type="submit" class="cb-free-link">
                  ou faça a <u>consulta básica grátis por e-mail</u>
                </button>
              </template>

              <div v-if="loading" class="loading-bar"><div class="loading-bar__fill" /></div>
              <Transition name="stage" mode="out-in">
                <p v-if="loading && consultaStage" :key="consultaStage" class="loading-stage">{{ consultaStage }}</p>
              </Transition>

              <div v-if="message" class="win-alert cb-alert" :class="`win-alert--${messageType}`">
                {{ message }}
                <button
                  v-if="emailSuggestion"
                  type="button"
                  class="email-suggestion-btn"
                  @click="applyEmailSuggestion"
                >
                  Você quis dizer <strong>{{ emailSuggestion }}</strong>? Clique para corrigir.
                </button>
              </div>

              <div v-if="success" class="cb-success">
                <div class="win-alert win-alert--success">{{ message }}</div>
                <p class="success-state__sent-to">Enviado para <strong>{{ sentToEmail }}</strong></p>
                <button v-if="shareInfo" type="button" class="cb-btn cb-btn--ghost cb-btn--block" @click="shareWhatsApp">
                  Compartilhar no WhatsApp
                </button>
                <button type="button" class="cb-btn cb-btn--blue cb-btn--block" @click="resetForm">
                  Consultar outra placa
                </button>
              </div>

              <div class="cb-seal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                Estorno automático se não achar o veículo
              </div>
            </form>

            <div class="cb-trust">
              <span><i class="cb-dot" />Pix</span>
              <span><i class="cb-dot" />na hora</span>
              <span><i class="cb-dot" />link privado</span>
              <span><i class="cb-dot" />sem cadastro</span>
            </div>
          </div>

          <!-- RIGHT: prévia do relatório -->
          <aside class="cb-report-col" aria-label="Prévia do relatório">
            <HomeReportPreview />
          </aside>
        </div>
      </header>

      <!-- ===== COMPARE: grátis vs completo ===== -->
      <section id="o-que-inclui" class="cb-compare">
        <div class="cb-cmp-head">
          <h2>Duas formas de olhar a placa</h2>
          <p>A grátis te diz o que é o carro. A completa te diz se dá pra confiar.</p>
        </div>
        <div class="cb-cmp-grid">
          <div class="cb-cmp-card">
            <div class="cb-cmp-kick">Consulta básica</div>
            <div class="cb-cmp-price">Grátis <small>por e-mail</small></div>
            <div class="cb-cmp-note">O retrato do veículo, sem custo.</div>
            <ul class="cb-cmp-list">
              <li><span class="cb-tick cb-tick--green" aria-hidden="true" />Marca, modelo e ano</li>
              <li><span class="cb-tick cb-tick--green" aria-hidden="true" />Cor</li>
              <li><span class="cb-tick cb-tick--green" aria-hidden="true" />Valor FIPE</li>
              <li><span class="cb-tick cb-tick--green" aria-hidden="true" />Situação do veículo</li>
            </ul>
            <button type="button" class="cb-btn cb-btn--ghost cb-btn--block cb-cmp-cta" @click="scrollToPlaca">
              Fazer consulta grátis
            </button>
          </div>
          <div class="cb-cmp-card cb-cmp-card--hi">
            <div class="cb-cmp-kick">Relatório completo</div>
            <div class="cb-cmp-price">R$ 45 <small>Pix, uma vez</small></div>
            <div class="cb-cmp-note">Tudo da básica, mais o que decide a compra.</div>
            <ul class="cb-cmp-list">
              <li><span class="cb-tick cb-tick--blue" aria-hidden="true" />Restrições nacionais e estaduais</li>
              <li><span class="cb-tick cb-tick--blue" aria-hidden="true" />Roubo, furto, leilão e gravame</li>
              <li><span class="cb-tick cb-tick--blue" aria-hidden="true" />RENAJUD, recall e indicador de multas</li>
              <li><span class="cb-tick cb-tick--blue" aria-hidden="true" />Ficha técnica: chassi e Renavam</li>
              <li><span class="cb-tick cb-tick--blue" aria-hidden="true" />Seguro estimado e custo em 5 anos</li>
            </ul>
            <button type="button" class="cb-btn cb-btn--blue cb-btn--block cb-cmp-cta" @click="consultFromGrid">
              Ver relatório completo · R$ 45
            </button>
          </div>
        </div>
      </section>

      <!-- ===== STATEMENT ===== -->
      <section class="cb-statement">
        <p class="cb-big-decl">
          O carro parece perfeito. <span class="cb-mut">Até você olhar a</span> <span class="cb-accent">placa.</span>
        </p>
      </section>

      <!-- ===== COMO FUNCIONA (números gigantes) ===== -->
      <section id="como-funciona" class="cb-how">
        <h2>Como funciona</h2>
        <div class="cb-steps">
          <div class="cb-step">
            <div class="cb-num">01</div>
            <h3>Digite a placa</h3>
            <p>Sem cadastro, sem conta. Só a placa que está no anúncio.</p>
          </div>
          <div class="cb-step">
            <div class="cb-num">02</div>
            <h3>Pague no Pix</h3>
            <p>R$ 45, uma vez. Sem assinatura, sem pegadinha na renovação.</p>
          </div>
          <div class="cb-step">
            <div class="cb-num">03</div>
            <h3>Receba na hora</h3>
            <p>Link privado com o relatório completo, direto no seu aparelho.</p>
          </div>
        </div>
      </section>

      <!-- ===== DOCUMENTO REVELADO ===== -->
      <section class="cb-doc">
        <div class="cb-doc__in">
          <div class="cb-doc-kick">O documento revelado</div>
          <h2>Tudo que a placa carrega, num relatório só.</h2>
          <p class="cb-doc-lead">
            A grátis te diz o que é o carro. A completa te diz se dá pra confiar. R$ 45, uma vez. Não achou? Estorno.
          </p>
          <div class="cb-doc-tags">
            <span class="cb-doc-tag"><i class="cb-d2" />Restrições nacionais e estaduais</span>
            <span class="cb-doc-tag"><i class="cb-d2" />Roubo e furto</span>
            <span class="cb-doc-tag"><i class="cb-d2" />Leilão</span>
            <span class="cb-doc-tag"><i class="cb-d2" />Gravame</span>
            <span class="cb-doc-tag"><i class="cb-d2" />RENAJUD</span>
            <span class="cb-doc-tag"><i class="cb-d2" />Recall</span>
            <span class="cb-doc-tag"><i class="cb-d2" />Indicador de multas</span>
            <span class="cb-doc-tag"><i class="cb-d2" />Chassi e Renavam</span>
            <span class="cb-doc-tag"><i class="cb-d2" />FIPE</span>
            <span class="cb-doc-tag"><i class="cb-d2" />Seguro estimado</span>
            <span class="cb-doc-tag"><i class="cb-d2" />Custo em 5 anos</span>
          </div>
        </div>
      </section>

      <!-- ===== MANIFESTO ===== -->
      <section class="cb-manifesto">
        <p>A gente existe por um motivo: pra você <span class="cb-accent">não comprar problema.</span></p>
      </section>

      <!-- ===== PREÇO + GARANTIA ===== -->
      <section id="preco" class="cb-price">
        <div class="cb-price-card">
          <p class="cb-price-big">R$ 45 <span class="cb-mut">para não perder</span> R$ 45 mil.</p>
          <div class="cb-guar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            Não achou o veículo? Estorno automático no Pix.
          </div>
          <button type="button" class="cb-btn cb-btn--blue cb-btn--lg" @click="consultFromGrid">
            Consultar agora · R$ 45
          </button>
          <div class="cb-cta-sub">Pix · na hora · sem cadastro</div>
        </div>
      </section>

      <!-- Suas consultas: histórico local do navegador (não renderiza quando vazio) -->
      <ClientOnly>
        <ConsultasHistory style="display:block;margin:0 auto 40px;max-width:760px" />
      </ClientOnly>

      <!-- ===== FAQ ===== -->
      <section id="duvidas" class="cb-faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading">Perguntas diretas</h2>
        <article
          v-for="(faq, index) in homepageFaqs"
          :key="faq.question"
          class="cb-qa"
          :class="{ 'cb-qa--open': openFaq === index }"
        >
          <button
            class="cb-qa__toggle"
            :aria-expanded="openFaq === index ? 'true' : 'false'"
            :aria-controls="`faq-answer-${index}`"
            @click="openFaq = openFaq === index ? null : index"
          >
            <h3>{{ faq.question }}</h3>
            <span class="cb-qa__icon" aria-hidden="true">{{ openFaq === index ? '−' : '+' }}</span>
          </button>
          <div v-show="openFaq === index" :id="`faq-answer-${index}`" class="cb-qa__answer" role="region">
            <p>{{ faq.answer }}</p>
          </div>
        </article>
      </section>

      <!-- ===== CTA FINAL ===== -->
      <section class="cb-final">
        <h2>Antes de fechar negócio, olhe a placa.</h2>
        <p>O que o vendedor não conta, o relatório revela. R$ 45, na hora, no Pix.</p>
        <button type="button" class="cb-btn cb-btn--blue cb-btn--lg" @click="consultFromGrid">
          Ver relatório completo · R$ 45
        </button>
        <div class="cb-cta-sub">ou faça a consulta básica grátis por e-mail</div>
      </section>
    </template>

    <!-- =======================================================
         PWA (inalterado): fluxo grátis direto.
         ======================================================= -->
    <div v-else class="hero-split">
      <div class="win-window hero-split__action">
      <div class="win-window__titlebar">
        <span>{{ appTitle }}</span>
        <div class="win-window__titlebar-buttons">
          <span v-if="email" class="win-window__titlebar-btn win-window__titlebar-btn--active" @click="changePwaEmail" title="Alterar e-mail">✉</span>
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

        <a
          v-if="appIntent"
          href="https://play.google.com/store/apps/details?id=br.com.placacompleta&utm_source=google&utm_medium=cpc&utm_campaign=app_intent_hero"
          target="_blank"
          rel="noopener"
          class="app-intent-badge"
          aria-label="Baixe o app PlacaCompleta na Google Play"
          @click="trackAppIntentClick"
        >
          <img src="/badges/google-play-pt-br.png" alt="Disponível no Google Play" width="180" height="70">
        </a>
        <p v-else-if="consultaCount > 0" class="counter">
          <svg class="counter__check" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor" opacity="0.15"/><path d="M4.5 8.5L7 11L11.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {{ consultaCount.toLocaleString('pt-BR') }} consultas realizadas
        </p>

        <form v-if="!success" @submit.prevent="handleSubmit" novalidate role="search" aria-label="Consulta veicular por placa">
          <div v-if="!processingPhoto && !loading" class="form-group">
            <label class="form-group__label visually-hidden" for="placa-pwa">Placa do Veículo</label>
            <div class="plate-field" :class="{ 'plate-field--error': placaError }">
              <div class="plate-field__band">
                <span class="plate-field__country">BRASIL</span>
              </div>
              <input
                id="placa-pwa"
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
                aria-describedby="placa-help-pwa"
                @focus="onFormStart"
                @input="onPlacaInput"
              />
            </div>
            <small id="placa-help-pwa" class="form-group__help">Aceita placa antiga (ABC1234) e Mercosul (ABC1D23)</small>
            <span v-if="placaError" class="form-group__error" role="alert">{{ placaError }}</span>
          </div>

          <template v-if="!processingPhoto && !loading">
            <button
              type="submit"
              class="win-btn win-btn--primary win-btn--block cta-main"
              :disabled="loading"
            >
              Consultar Placa Grátis
            </button>

            <p class="trust-line trust-line--cta">
              100% grátis &middot; Sem cadastro &middot; Resultado em segundos
            </p>
          </template>

          <!-- Photo Capture for PWA -->
          <div v-if="!processingPhoto && !loading">
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
            <button
              v-if="emailSuggestion"
              type="button"
              class="email-suggestion-btn"
              @click="applyEmailSuggestion"
            >
              Você quis dizer <strong>{{ emailSuggestion }}</strong>? Clique para corrigir.
            </button>
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
            v-if="shareInfo"
            type="button"
            class="win-btn win-btn--block share-whatsapp-btn"
            @click="shareWhatsApp"
          >
            Compartilhar no WhatsApp
          </button>
          <button
            type="button"
            class="win-btn win-btn--primary win-btn--block"
            @click="resetForm"
          >
            Consultar Outra Placa
          </button>
        </div>
      </div>
    </div>
    </div>

    <!-- Data Modal for PWA -->
    <div v-if="showSeguroModal && seguroEstimado" class="modal-overlay" @click="dismissSeguroModal">
      <div class="modal-window" @click.stop>
        <div class="win-window">
          <div class="win-window__titlebar">
            <span>Seguro do seu carro</span>
            <div class="win-window__titlebar-buttons">
              <span class="win-window__titlebar-btn win-window__titlebar-btn--active" @click="dismissSeguroModal">×</span>
            </div>
          </div>
          <div class="win-window__body seguro-modal">
            <template v-if="seguroStep === 'oferta'">
              <p class="seguro-modal__lead">
                Carros como o seu (<strong>{{ seguroEstimado.veiculo.marca }} {{ seguroEstimado.veiculo.modelo }} {{ seguroEstimado.veiculo.ano }}</strong>)
                pagam em média
              </p>
              <p class="seguro-modal__premio">R$ {{ formatBRL(seguroEstimado.premioAnual) }}<span>/ano</span></p>
              <p class="seguro-modal__detalhe">
                <template v-if="seguroEstimado.regiaoDoUsuario">de seguro na sua região ({{ seguroEstimado.regiao.descricao }}). </template>
                <template v-else>de seguro. </template>
                <template v-if="(seguroEstimado as any).percentualFipe">Isso é {{ (seguroEstimado as any).percentualFipe }}% do valor FIPE do carro. </template>
                Franquia média: R$ {{ formatBRL(seguroEstimado.franquia) }}.
              </p>
              <button type="button" class="win-btn win-btn--primary win-btn--block" @click="seguroStep = 'telefone'">
                Quero uma cotação real
              </button>
              <button type="button" class="win-btn win-btn--block seguro-modal__later" @click="dismissSeguroModal">
                Agora não
              </button>
              <p class="seguro-modal__fonte">Estimativa com base em dados oficiais SUSEP, corrigida pelo IPCA.</p>
            </template>

            <template v-else-if="seguroStep === 'telefone'">
              <p class="seguro-modal__lead">
                Deixe seu telefone e um corretor entra em contato com uma cotação de verdade.
              </p>
              <div class="form-group">
                <label class="form-group__label" for="seguro-phone">Telefone com DDD</label>
                <input
                  id="seguro-phone"
                  v-model="seguroPhone"
                  type="tel"
                  inputmode="tel"
                  class="win-input"
                  placeholder="(31) 99999-9999"
                  :disabled="seguroSending"
                  @keyup.enter="submitCotacao"
                >
                <p v-if="seguroPhoneError" class="seguro-modal__erro">{{ seguroPhoneError }}</p>
                <p v-if="seguroSendError" class="seguro-modal__erro">Não conseguimos enviar. Tente de novo.</p>
              </div>
              <button type="button" class="win-btn win-btn--primary win-btn--block" :disabled="seguroSending" @click="submitCotacao">
                {{ seguroSending ? 'Enviando...' : 'Receber contato' }}
              </button>
              <p class="seguro-modal__fonte">Ao enviar, você autoriza o contato telefônico sobre sua cotação.</p>
            </template>

            <template v-else>
              <p class="seguro-modal__confirmado">✅ Recebido!</p>
              <p class="seguro-modal__lead">Um corretor entrará em contato.</p>
              <button type="button" class="win-btn win-btn--primary win-btn--block" @click="dismissSeguroModal">
                Fechar
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

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
    <div v-if="showPwaEmailPrompt" class="modal-overlay">
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
    <div v-if="showEmailConfirm" class="modal-overlay">
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
    <div v-if="showWebEmailPrompt" class="modal-overlay">
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

    <!-- Checkout premium inline (overlay): roda o fluxo pago sem sair da home -->
    <PremiumInlineCheckout
      v-if="showPremiumCheckout"
      :placa="premiumPlaca"
      @close="showPremiumCheckout = false"
    />

  </main>
</template>

<style lang="scss" scoped>
// ============================================================
// home-v2: escopo do visual do MOCKUP aprovado (só na home web).
// Hexes hardcoded do mockup; NÃO altera tokens globais nem outras páginas.
// Overrides de .win-window / .win-btn / FAQ ficam sob .home-v2 via :deep().
// ============================================================
.home-v2 {
  // ---- Paleta combo 3 (clara/quente). Hexes hardcoded do mockup; NÃO altera
  // tokens globais nem o body. Escopado sob .home-v2 (só a home web). ----
  $c-bg: #FBFAF8;
  $c-card: #ffffff;
  $c-ink: #1B2430;
  $c-gray: #6B7280;
  $c-blue: #1f6feb;
  $c-green: #1e9e4a;
  $c-red: #d33a3a;
  $c-hair: #E7E5E1;
  $c-navy: #0B1F3A;

  $c-font: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

  // A home vira uma "folha" clara sobre o body. Full-bleed, sem cartão arredondado.
  max-width: none;
  width: 100%;
  margin: 0;
  padding: 0;
  background: $c-bg;
  color: $c-ink;
  font-family: $c-font;
  line-height: 1.6;
  text-align: left;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;

  @media (min-width: 860px) { max-width: none; }
  @media (max-width: 520px) { border-radius: 0; padding: 0; margin: 0; }

  // Wrapper de largura padrão de cada seção
  %wrap { max-width: 1160px; margin: 0 auto; padding: 0 24px; }

  // ---------- BOTÕES ----------
  .cb-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: $c-font;
    font-weight: 700;
    border-radius: 10px;
    cursor: pointer;
    border: 0;
    font-size: 15px;
    line-height: 1.15;
    padding: 13px 20px;
    transition: filter 0.15s ease;
    text-decoration: none;

    &:hover { filter: brightness(1.05); }
    &:focus-visible { outline: 2px solid $c-blue; outline-offset: 2px; }

    &--blue { background: $c-blue; color: #fff; }
    &--ghost { background: #fff; color: $c-ink; border: 1px solid $c-hair; }
    &--lg { padding: 17px 26px; font-size: 16.5px; border-radius: 11px; }
    &--block { display: flex; width: 100%; }
  }

  // ---------- UTILITY STRIP ----------
  .cb-utility {
    background: $c-navy;
    color: rgba(255, 255, 255, 0.9);
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: 0.02em;

    &__inner { @extend %wrap; padding-top: 9px; padding-bottom: 9px; text-align: center; }
  }

  // ---------- NAV (HomeHeader reestilizado combo 3) ----------
  :deep(.home-header) {
    max-width: 1160px;
    margin: 0 auto;
    background: $c-navy;
    border-radius: 0;
    box-shadow: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding: 16px 24px;
  }
  :deep(.home-header__nav) { gap: 26px; }
  :deep(.home-header__link) { font-size: 15px; font-weight: 600; }

  // ---------- HERO ----------
  .cb-hero {
    @extend %wrap;
    padding-top: 58px;
    padding-bottom: 68px;

    &__grid {
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 52px;
      align-items: start;
    }
  }

  .cb-h1 {
    font-size: clamp(34px, 4.6vw, 54px);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.04;
    margin-bottom: 20px;
    color: $c-ink;
  }

  .cb-accent { color: $c-blue; }
  .cb-mut { color: $c-gray; }

  .cb-sub {
    font-size: 19px;
    color: $c-gray;
    max-width: 520px;
    margin-bottom: 28px;

    b { color: $c-ink; font-weight: 600; }
  }

  // Painel da placa (card branco)
  .cb-plate-panel {
    background: $c-card;
    border: 1px solid $c-hair;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(27, 36, 48, 0.05), 0 8px 26px rgba(27, 36, 48, 0.05);
    padding: 22px;
    max-width: 520px;
  }

  .cb-plate-label {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: $c-gray;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 10px;
  }

  // Placa Mercosul: reusa .plate-field mas com o visual combo 3 (banda navy)
  .cb-plate {
    max-width: none;
    margin: 0;
    border: 2px solid $c-navy;
    border-radius: 9px;
    box-shadow: none;

    &:focus-within {
      border-color: $c-blue;
      box-shadow: 0 0 0 3px rgba(31, 111, 235, 0.18);
    }

    &.plate-field--error { border-color: $c-red; }

    &__band {
      background: $c-navy;
      flex-direction: column;
      padding: 0 12px;
    }

    &__flag {
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.14em;
    }

    &__country { color: #fff; font-size: 13px; font-weight: 800; letter-spacing: 0.1em; }

    &__input {
      font-family: $c-font;
      font-size: 30px;
      font-weight: 800;
      letter-spacing: 0.14em;
      color: $c-navy;
      padding: 16px 8px;

      &::placeholder { color: #c8cdd4; letter-spacing: 0.14em; }
    }
  }

  .cb-plate-help { display: block; font-size: 12px; color: $c-gray; margin-top: 8px; }
  .cb-error { display: block; color: $c-red; font-size: 13px; margin-top: 6px; }

  .cb-plate-panel .cb-btn--block { margin-top: 16px; }
  .cb-cta-sub { font-size: 13.5px; color: $c-gray; text-align: center; margin-top: 8px; }

  .cb-free-link {
    display: block;
    width: 100%;
    margin-top: 12px;
    padding: 4px 0;
    background: transparent;
    border: 0;
    font-family: $c-font;
    font-size: 15px;
    font-weight: 600;
    color: $c-blue;
    text-align: center;
    cursor: pointer;

    u { text-decoration-thickness: 1px; text-underline-offset: 2px; }
    &:focus-visible { outline: 2px solid $c-blue; outline-offset: 2px; }
  }

  .cb-alert { margin-top: 14px; }
  .cb-success { margin-top: 14px; text-align: center; }

  .cb-seal {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(30, 158, 74, 0.09);
    color: $c-green;
    border: 1px solid rgba(30, 158, 74, 0.25);
    border-radius: 999px;
    padding: 8px 14px;
    font-size: 13.5px;
    font-weight: 700;
    margin-top: 16px;

    svg { width: 16px; height: 16px; }
  }

  .cb-trust {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 18px;
    margin-top: 22px;
    font-size: 13.5px;
    color: $c-gray;
    font-weight: 500;

    span { display: inline-flex; align-items: center; gap: 7px; }
  }

  .cb-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: $c-green;
    display: inline-block;
    flex-shrink: 0;
  }

  // Coluna direita: prévia do relatório (HomeReportPreview) num card branco
  .cb-report-col {
    background: $c-card;
    border: 1px solid $c-hair;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(27, 36, 48, 0.05), 0 10px 30px rgba(27, 36, 48, 0.06);
    padding: 20px;
  }

  // ---------- COMPARE ----------
  .cb-compare {
    @extend %wrap;
    padding-top: 12px;
    padding-bottom: 76px;
  }

  .cb-cmp-head {
    text-align: center;
    max-width: 640px;
    margin: 0 auto 34px;

    h2 { font-size: clamp(26px, 3.2vw, 34px); font-weight: 800; letter-spacing: -0.02em; }
    p { color: $c-gray; font-size: 17px; margin-top: 8px; }
  }

  .cb-cmp-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px;
    max-width: 920px;
    margin: 0 auto;
  }

  .cb-cmp-card {
    background: $c-card;
    border: 1px solid $c-hair;
    border-radius: 12px;
    padding: 26px;
    box-shadow: 0 1px 3px rgba(27, 36, 48, 0.04);
    display: flex;
    flex-direction: column;

    &--hi {
      border-color: rgba(31, 111, 235, 0.5);
      box-shadow: 0 1px 3px rgba(27, 36, 48, 0.05), 0 14px 34px rgba(31, 111, 235, 0.1);

      .cb-cmp-kick { color: $c-blue; }
    }
  }

  .cb-cmp-kick {
    font-size: 12.5px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $c-gray;
  }

  .cb-cmp-price {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin: 6px 0 4px;

    small { font-size: 14px; font-weight: 600; color: $c-gray; }
  }

  .cb-cmp-note { font-size: 13.5px; color: $c-gray; margin-bottom: 16px; }

  .cb-cmp-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 11px;
    margin: 0 0 20px;
    padding: 0;

    li { display: flex; gap: 10px; font-size: 14.5px; align-items: flex-start; }
  }

  .cb-tick {
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
    margin-top: 2px;
    background: no-repeat center / 14px 14px;
    // Checkmark inline (data-uri) tingido por cor via mask
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E") no-repeat center / contain;

    &--green { background-color: $c-green; }
    &--blue { background-color: $c-blue; }
  }

  .cb-cmp-cta { margin-top: auto; }

  // ---------- STATEMENT ----------
  .cb-statement {
    padding: 82px 0;
    border-top: 1px solid $c-hair;
    background: #fff;

    .cb-big-decl {
      @extend %wrap;
      max-width: 960px;
      font-size: clamp(34px, 5.6vw, 66px);
      font-weight: 800;
      letter-spacing: -0.035em;
      line-height: 1.02;
      color: $c-ink;
    }
  }

  // ---------- COMO FUNCIONA (números gigantes) ----------
  .cb-how {
    @extend %wrap;
    padding-top: 80px;
    padding-bottom: 80px;

    h2 {
      font-size: clamp(26px, 3.4vw, 38px);
      font-weight: 800;
      letter-spacing: -0.025em;
      margin-bottom: 44px;
    }
  }

  .cb-steps {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 34px;
  }

  .cb-step {
    border-top: 2px solid $c-ink;
    padding-top: 14px;

    h3 { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; margin: 14px 0 8px; }
    p { color: $c-gray; font-size: 15.5px; }
  }

  .cb-num {
    font-size: clamp(56px, 7vw, 84px);
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 0.9;
    color: $c-ink;
  }

  // ---------- DOCUMENTO REVELADO (slab navy) ----------
  .cb-doc {
    padding: 80px 0;
    background: $c-navy;
    color: #fff;

    &__in { @extend %wrap; max-width: 980px; }
  }

  .cb-doc-kick {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #8fb4ff;
  }

  .cb-doc h2 {
    font-size: clamp(30px, 4.4vw, 52px);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.03;
    margin: 12px 0 22px;
  }

  .cb-doc-lead { font-size: 19px; color: #c3ccdb; max-width: 640px; }

  .cb-doc-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 34px;
  }

  .cb-doc-tag {
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.04);
    border-radius: 999px;
    padding: 11px 18px;
    font-size: 14.5px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 9px;
  }

  .cb-d2 {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: #8fb4ff;
    display: inline-block;
    flex-shrink: 0;
  }

  // ---------- MANIFESTO ----------
  .cb-manifesto {
    padding: 88px 24px;
    text-align: center;

    p {
      max-width: 900px;
      margin: 0 auto;
      font-size: clamp(30px, 4.6vw, 54px);
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.05;
      color: $c-ink;
    }
  }

  // ---------- PREÇO + GARANTIA ----------
  .cb-price {
    @extend %wrap;
    padding-top: 24px;
    padding-bottom: 84px;
  }

  .cb-price-card {
    max-width: 760px;
    margin: 0 auto;
    background: $c-card;
    border: 1px solid $c-hair;
    border-radius: 16px;
    box-shadow: 0 1px 3px rgba(27, 36, 48, 0.05), 0 18px 44px rgba(27, 36, 48, 0.07);
    padding: 44px 40px;
    text-align: center;
  }

  .cb-price-big {
    font-size: clamp(30px, 4.4vw, 46px);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.08;
    color: $c-ink;
  }

  .cb-guar {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    margin: 22px 0 26px;
    background: rgba(30, 158, 74, 0.09);
    border: 1px solid rgba(30, 158, 74, 0.25);
    color: $c-green;
    border-radius: 999px;
    padding: 10px 18px;
    font-size: 14.5px;
    font-weight: 700;

    svg { width: 17px; height: 17px; }
  }

  .cb-price-card .cb-btn { margin: 0 auto; }
  .cb-price-card .cb-cta-sub { margin-top: 12px; }

  // ---------- FAQ ----------
  .cb-faq {
    @extend %wrap;
    max-width: 820px;
    padding-top: 12px;
    padding-bottom: 84px;

    h2 {
      font-size: clamp(26px, 3.2vw, 36px);
      font-weight: 800;
      letter-spacing: -0.025em;
      margin-bottom: 30px;
    }
  }

  .cb-qa {
    border-top: 1px solid $c-hair;

    &:last-child { border-bottom: 1px solid $c-hair; }

    &__toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      padding: 22px 0;
      background: transparent;
      border: 0;
      cursor: pointer;
      text-align: left;

      h3 { font-size: 18px; font-weight: 800; letter-spacing: -0.01em; color: $c-ink; margin: 0; }
      &:focus-visible { outline: 2px solid $c-blue; outline-offset: 2px; }
    }

    &__icon { font-size: 22px; font-weight: 700; color: $c-gray; flex-shrink: 0; }

    &__answer {
      padding: 0 0 22px;

      p { color: $c-gray; font-size: 15.5px; margin: 0; }
    }
  }

  // ---------- CTA FINAL ----------
  .cb-final {
    @extend %wrap;
    max-width: 820px;
    padding-top: 78px;
    padding-bottom: 78px;
    text-align: center;
    border-top: 1px solid $c-hair;
    background: #fff;

    h2 {
      font-size: clamp(30px, 4.4vw, 50px);
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.04;
      margin-bottom: 10px;
      color: $c-ink;
    }

    p { color: $c-gray; font-size: 18px; margin-bottom: 26px; }
  }

  // ---------- RESPONSIVO ----------
  @media (max-width: 860px) {
    .cb-hero__grid { grid-template-columns: 1fr; gap: 38px; }
    .cb-cmp-grid { grid-template-columns: 1fr; }
    .cb-steps { grid-template-columns: 1fr; gap: 30px; }
    .cb-plate-panel { max-width: none; }
  }
}

// v2.0 herói web: split de 2 colunas. No mobile (e no PWA) empilha em coluna
// única — a "tira" de sempre. O split só ganha largura extra no desktop web.
.hero-split {
  width: 100%;

  &__preview {
    // No mobile a prévia aparece abaixo do card de consulta.
    .win-window__body { padding: $space-md; }
  }
}

// Desktop web: quebra o teto de 580px do .desktop pra caber as 2 colunas.
.desktop--hero-web {
  @media (min-width: 860px) {
    max-width: 1080px;
  }
}

.hero-split--web {
  @media (min-width: 860px) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-lg;
    align-items: stretch;

    .hero-split__action,
    .hero-split__preview {
      margin-top: $space-xl;
      margin-bottom: 0;
      max-width: none;
      width: 100%;
    }

    // No split o texto do card de ação fica alinhado à esquerda (como no mockup).
    .hero-split__action {
      .page-title,
      .page-subtitle { text-align: left; margin-left: 0; }
      .page-subtitle { max-width: none; }
      .logo { margin-left: 0; }
      .plate-field { margin-left: 0; }
    }
  }
}

.page-title--hero {
  em {
    color: $smart-blue;
    font-style: normal;
  }
}

// CTA primário premium (subtexto do preço embaixo)
.cta-premium {
  display: block;

  small {
    display: block;
    font-weight: 600;
    font-size: 0.75rem;
    opacity: 0.9;
    margin-top: 2px;
  }
}

// Link secundário: fluxo grátis por e-mail (é um <button type="submit">
// estilizado como link, pra disparar o handleSubmit sem sair do <form>)
.cta-free {
  display: block;
  width: 100%;
  margin-top: $space-sm;
  padding: $space-xs 0;
  background: transparent;
  border: none;
  color: $blue-slate;
  font-family: $font-body;
  font-size: 0.8125rem;
  text-align: center;
  cursor: pointer;

  strong { color: $regal-navy; }

  &:hover { text-decoration: underline; }
  &:focus-visible { outline: 2px solid $smart-blue; outline-offset: 2px; }
}

// Linha de garantias sob o CTA
.assur {
  display: flex;
  gap: 14px;
  margin-top: $space-md;
  flex-wrap: wrap;
  justify-content: center;
  color: $blue-slate;
  font-size: 0.75rem;

  span { display: flex; align-items: center; gap: 5px; }

  &__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: $success-green;
    display: inline-block;
    flex-shrink: 0;
  }
}

.hero-split--web {
  @media (min-width: 860px) {
    .assur { justify-content: flex-start; }
  }
}

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

.email-suggestion-btn {
  display: block;
  width: 100%;
  margin-top: $space-xs;
  padding: $space-xs $space-sm;
  background: $win-white;
  color: $navy-electric;
  font-family: $font-body;
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
  @include win-border-raised;

  strong {
    text-decoration: underline;
  }

  &:hover {
    background: $powder-blue;
  }
}

.app-intent-badge {
  display: flex;
  justify-content: center;
  margin: 0 0 $space-sm;

  img {
    height: 48px;
    width: auto;
  }
}

.seguro-modal {
  text-align: center;

  &__lead {
    margin: 0 0 $space-sm;
  }

  &__premio {
    font-size: 2rem;
    font-weight: 700;
    color: $navy-electric;
    margin: 0 0 $space-xs;

    span {
      font-size: 1rem;
      font-weight: 400;
      color: $graphite;
    }
  }

  &__detalhe {
    font-size: 0.875rem;
    color: $graphite;
    margin: 0 0 $space-md;
  }

  &__later {
    margin-top: $space-xs;
  }

  &__fonte {
    font-size: 0.72rem;
    color: $slate-grey;
    margin: $space-sm 0 0;
  }

  &__erro {
    color: $error-red;
    font-size: 0.82rem;
    margin: $space-xs 0 0;
  }

  &__confirmado {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0 0 $space-xs;
  }

  .form-group {
    text-align: left;
    margin-bottom: $space-sm;
  }
}

.share-whatsapp-btn {
  background: #25d366;
  color: #fff;
  border-color: #1faa52;
  margin-bottom: $space-xs;

  &:hover { background: #1faa52; }
}
</style>
