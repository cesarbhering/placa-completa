<script setup lang="ts">
import { PLANOS, PLANOS_PAGOS, RECURSOS, RECURSOS_BLOQUEADOS, inclui, isPlanoPago, precoBRL } from '~/shared/planos'

import { homepageFaqs } from '~/data/homepage-faqs'

// A consulta feita passa a viver num endereco proprio, /placa/ABC1D23, que
// aponta pra esta mesma pagina. O registro da rota fica em app/router.options.ts.

// A home e /placa/:placa sao a MESMA pagina (registro clonado em
// router.options.ts). Sem uma key fixa, o NuxtPage usa o path como key: navegar
// de "/" pra "/placa/ABC1D23" remontava a pagina, resetando o resultado (piscava
// a home) e disparando o onMounted que re-consultava (piscava o resultado de
// novo) — alem de uma segunda chamada a API. Key constante = a instancia e
// reaproveitada, sem remount, sem flicker, sem consulta dupla.
definePageMeta({ key: () => 'home' })

const { isPWA, isMobile } = useAppMode()
const route = useRoute()
const router = useRouter()

// Theming por dominio (hibrido de dominios): hero/copy/meta trocam conforme
// o Host (olhonamoto.com.br / olhonocaminhao.com.br), placacompleta segue
// default. So apresentacao — o canonical NAO muda (ver useSiteVariant.ts).
const siteVariant = useSiteVariantContent()

// Placa que veio na URL, por qualquer um dos dois caminhos.
const placaDaRota = computed(() => {
  const bruto = String(route.params.placa || route.query.placa || '')
  return bruto.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
})
// Landing de intencao-app: anuncios do ad group "App Intent" chegam com ?app=1
// e trocam o contador de consultas pelo badge do Play. Fallback: contador normal.
const appIntent = computed(() => route.query.app === '1' && !isPWA.value)

// Volta do relatorio basico querendo o upgrade: /?placa=ABC1D23&plano=completa
// pre-preenche a placa e ja abre o checkout no plano pedido.
onMounted(() => {
  const qPlaca = placaDaRota.value
  if (!qPlaca) return
  placa.value = qPlaca
  if (isPlanoPago(route.query.plano)) {
    nextTick(() => openPremiumCheckout(route.query.plano))
    return
  }
  // Chegou por /placa/ABC1D23 (link compartilhado, recarga, favorito): a
  // consulta e refeita, porque o resultado nunca foi guardado nesta URL.
  if (route.params.placa) nextTick(() => handleSubmit())
})
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
const shareInfo = ref<{ marca: string; modelo: string; ano: string } | null>(null)

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
  return `Consultei a placa ${placa.value} no PlacaCompleta: ${veiculo}. Consulta grátis, sem cadastro: https://placacompleta.com.br`
}

async function shareWhatsApp() {
  const text = buildShareText()
  track('share_whatsapp', { origem: 'success_screen' })
  if (navigator.share) {
    try { await navigator.share({ text }); return } catch { /* usuario cancelou */ }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
}

// seguro (desativado) — abre o modal. Sem chamador enquanto a oferta estiver
// fora; mantido inteiro pra religar sem reescrever.
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

const placaRef = ref<HTMLInputElement | null>(null)
const formStarted = ref(false)

// v2.0 herói web (não-PWA): CTA primário abre o checkout premium inline (overlay).
// Reusa a mesma placa do input. O fluxo grátis (handleSubmit) vira link secundário.
const showPremiumCheckout = ref(false)

// Scroll cue do herói: rola suave pro primeiro bloco de conteúdo (cb-ganhos).
function rolarParaConteudo() {
  if (import.meta.client) {
    document.querySelector('.cb-ganhos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
const premiumPlaca = ref('')
const premiumPlano = ref<'basica' | 'completa'>('completa')

// A placa desta sessao ja passou por uma consulta? Se sim, o CTA pago pula a
// pergunta "e este veiculo?" (o veiculo ja apareceu na tela) e vai direto pro
// pagamento; a confirmacao acontece depois, junto com o relatorio.
const placaJaConsultada = ref(false)

// "Suas consultas": historico local, agora atras de um item do header em vez
// de uma section fixa no meio da home.

// Clicou num CTA pago sem ter placa: o proximo envio do formulario vai pro
// fluxo PAGO, nao pro gratuito.
const aguardandoPlacaPaga = ref(false)

// ---------------------------------------------------------------
// Header reativo ao scroll.
//
// Dois IntersectionObserver em vez de listener de scroll (mais barato e sem
// throttle na mao):
//   - .cb-plate-panel -> o formulario do herói ainda esta na tela?
//   - .cb-eyebrow     -> o "consulta veicular por placa" ja chegou no header?
//
// Regras:
//   * o campo de placa do header so aparece quando o formulario do herói sai
//     de vista (senao seriam dois campos iguais disputando a mesma acao);
//   * o header recolhe quando o formulario ainda esta visivel E o eyebrow esta
//     prestes a passar por baixo dele. Antes o gatilho era uma sentinela de 1px
//     no topo, que saia de vista com qualquer rolagem minima e fazia o header
//     sumir cedo demais.
// ---------------------------------------------------------------
const formHeroVisivel = ref(true)
// true = o eyebrow ainda esta abaixo do header, sem encostar nele
const eyebrowLivre = ref(true)

const headerRecolhido = computed(() => formHeroVisivel.value && !eyebrowLivre.value)
const mostrarBuscaHeader = computed(() => !formHeroVisivel.value)

let obsForm: IntersectionObserver | null = null
let obsEyebrow: IntersectionObserver | null = null

function observarHero() {
  obsForm?.disconnect()
  obsEyebrow?.disconnect()

  // Sem formulario na tela (ex.: depois da consulta, quando ele da lugar ao
  // resultado) o header fica visivel, com o selo da placa.
  const form = document.querySelector('.cb-plate-panel')
  if (!form) {
    formHeroVisivel.value = false
  } else {
    obsForm = new IntersectionObserver(
      ([e]) => { formHeroVisivel.value = e.isIntersecting },
      { rootMargin: '-72px 0px 0px 0px' },
    )
    obsForm.observe(form)
  }

  const eyebrow = document.querySelector('.cb-eyebrow')
  if (!eyebrow) {
    eyebrowLivre.value = true
  } else {
    // -100px encolhe o topo da raiz um pouco alem da altura do header (80px):
    // o eyebrow deixa de intersectar quando esta a poucos pixels de passar por
    // baixo dele, que e o "prestes a atingir".
    obsEyebrow = new IntersectionObserver(
      ([e]) => { eyebrowLivre.value = e.isIntersecting },
      { rootMargin: '-100px 0px 0px 0px' },
    )
    obsEyebrow.observe(eyebrow)
  }
}

onMounted(() => {
  if (!('IntersectionObserver' in window)) return
  observarHero()
})

// O herói da lugar a tela de resultado (v-if), entao os alvos antigos morrem
// e os observers precisam ser refeitos.
watch(success, () => nextTick(observarHero))

onUnmounted(() => { obsForm?.disconnect(); obsEyebrow?.disconnect() })

// Bloco livre mostrado na tela depois da consulta gratis (o "o que e o carro").
// Vem de /api/consulta; nada aqui e SENATRAN.
const resultadoBasico = ref<Record<string, any> | null>(null)

// `plano` chega tanto de um clique direto (`@click="abrir('basica')"`) quanto
// de um handler sem argumento, que passaria o MouseEvent. isPlanoPago filtra.
function openPremiumCheckout(plano?: unknown) {
  placaError.value = ''
  if (!validatePlaca(placa.value)) {
    // Sem placa nao da pra cobrar. Em vez de erro seco, leva pro campo com a
    // instrucao e marca que o proximo envio e do fluxo PAGO.
    premiumPlano.value = isPlanoPago(plano) ? plano : 'completa'
    aguardandoPlacaPaga.value = true
    placaError.value = ''
    track('premium_cta_sem_placa', { plano: premiumPlano.value })
    nextTick(() => {
      placaRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      placaRef.value?.focus()
    })
    return
  }
  premiumPlano.value = isPlanoPago(plano) ? plano : 'completa'
  premiumPlaca.value = placa.value
  aguardandoPlacaPaga.value = false
  showPremiumCheckout.value = true
  track('premium_checkout_open', { origin: 'home_hero', plano: premiumPlano.value, ja_consultada: placaJaConsultada.value })
}

// O bloco bloqueado sai da matriz de recursos: mover um item entre planos
// atualiza a tela de resultado junto, sem lista paralela pra esquecer.
// Os RÓTULOS sao reais (dizem o que voce leva); os VALORES sao marcadores — o
// dado so e consultado depois do pagamento, entao nao ha nada escondido aqui.
// Nunca colocar alarme falso: afirmar "ATENÇÃO" sobre um carro que nao
// consultamos seria inventar defeito pra forcar a venda.
const camposBloqueados = RECURSOS_BLOQUEADOS

// Alertas colados na ilustracao do carro. Posicao em % da caixa da imagem,
// mirando partes do veiculo (teto, traseira, roda, frente). Sao EXEMPLOS do
// que o relatorio mostra, nunca dados de um carro real.
// Callouts do carro. `y` e a altura da linha (e do rotulo, que fica centrado
// nela); `ax` e onde a linha encosta no veiculo. Os dois lados se alternam em
// alturas diferentes pra nenhum par de rotulos disputar a mesma faixa, o que
// no celular seria colisao na certa.
//
// As coordenadas miram partes reais da arte: para-brisa, grade, para-choque,
// coluna traseira, porta e roda de tras. Se a imagem trocar, isto precisa ser
// remirado.
// Callouts do carro. Cada um sai de uma borda da caixa, corre reto ate o
// cotovelo (`ex`, `ey`) e so entao vira em diagonal ate o ponto (`ax`, `ay`).
//
// Regra do cotovelo: a diagonal tem que CONTINUAR no sentido do trecho reto.
// Rotulo da esquerda anda pra direita, entao `ax` > `ex`; o da direita anda pra
// esquerda, entao `ax` < `ex`. Quebrar isso faz a linha avancar e voltar, um
// recuo que parece erro de desenho.
//
// Nenhum rotulo encosta no carro: os de cima e de baixo ficam nas faixas
// vazias que a proporcao 5/4 abre, e os do meio so existem na altura em que a
// silhueta e estreita. As ancoras miram onde a coisa acontece: placa
// dianteira, freio da roda, lugar do motorista, teto. Se a arte trocar, tudo
// isto precisa ser remirado.
// A entrada roda UMA vez, quando o bloco aparece na tela. Sem observer, no
// celular ela aconteceria fora de vista (o carro fica abaixo do formulario) e a
// pessoa chegaria depois do fim, achando que nao ha animacao nenhuma.
const carroRef = ref<HTMLElement | null>(null)
const carroEntrou = ref(false)

onMounted(() => {
  const alvo = carroRef.value
  if (!alvo) return
  if (!('IntersectionObserver' in window)) { carroEntrou.value = true; return }
  const obs = new IntersectionObserver((entradas) => {
    if (entradas.some((e) => e.isIntersecting)) {
      carroEntrou.value = true
      obs.disconnect()   // uma vez so: nao reanima a cada rolagem
    }
  }, { threshold: 0.25 })
  obs.observe(alvo)
  onUnmounted(() => obs.disconnect())
})

const alertasIlustrativos = [
  // teto
  { label: 'Já foi leiloado',    lado: 'esq',   y: '7%',  ex: '38%', ey: '7%',  ax: '52%', ay: '23%' },
  { label: 'Histórico de furto', lado: 'dir',   y: '7%',  ex: '84%', ey: '7%',  ax: '70%', ay: '24%' },
  // grade
  { label: 'Gravame ativo',      lado: 'esq',   y: '34%', ex: '24%', ey: '34%', ax: '32%', ay: '48%' },
  // onde ficaria a placa dianteira (a arte nao tem placa, por motivos obvios)
  { label: 'Documento atrasado', lado: 'esq',   y: '92%', ex: '19%', ey: '92%', ax: '25%', ay: '67%' },
  // freio, atras dos raios da roda dianteira: rotulo debaixo do pneu, linha
  // subindo reto antes de virar
  // Rotulo deslocado pra esquerda do ponto de proposito: alinhado com ele, a
  // linha subia quase reta e o joelho nao aparecia.
  { label: 'Recall pendente',    lado: 'baixo', y: '92%', cx: '50%', ex: '50%', ey: '81%', ax: '57%', ay: '72%' },
  // lugar do motorista
  { label: 'Multa em aberto',    lado: 'dir',   y: '92%', ex: '76%', ey: '92%', ax: '51%', ay: '35%' },
]

// O que a consulta gratis efetivamente devolveu, so com o que veio preenchido.
const camposLivres = computed(() => {
  const b = resultadoBasico.value
  if (!b) return []
  return [
    ['Placa', b.placa],
    ['Marca', b.marca],
    ['Modelo', b.modelo],
    ['Valor FIPE', b.fipe],
    ['Ano de fabricação', b.anoFabricacao],
    ['Ano do modelo', b.ano],
    ['Cor', b.cor],
    ['Combustível', b.combustivel],
    ['Origem', b.origem],
    ['Chassi', b.chassiParcial],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '')
})

// CTA "Consultar agora" do grid de Preço: leva o foco ao input do herói e
// abre o checkout premium (openPremiumCheckout valida/foca se a placa faltar).
function consultFromGrid(plano?: unknown) {
  placaRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  openPremiumCheckout(plano)
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
// Uma URL por placa daria infinitas paginas quase identicas, com dado de
// veiculo dentro. Nao entra em indice.
useSeoMeta({
  robots: () => (route.params.placa ? 'noindex, nofollow' : 'index, follow'),
  ogTitle: siteVariant.ogTitle,
  ogDescription: siteVariant.ogDescription,
  // Imagem OG segue a do placacompleta ate ter uma por dominio (mesmo
  // placeholder do hero: nao existe asset de moto/caminhao ainda).
  ogImage: 'https://placacompleta.com.br/og-home.png',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: `${siteVariant.siteName}: relatório completo do veículo pela placa`,
  twitterCard: 'summary_large_image',
  twitterTitle: siteVariant.ogTitle,
  twitterDescription: siteVariant.ogDescription,
  twitterImage: 'https://placacompleta.com.br/og-home.png',
})

useHead({
  // Web: title com keyword pro SERP (a homepage ranqueia pra "consulta placa"
  // com CTR em disputa) e ja no idioma do dominio (moto/caminhao/carro).
  // PWA/TWA: título curto, melhor em contexto de app — sempre PlacaCompleta,
  // o app nunca abre nos dominios tematicos.
  title: computed(() => isPWA.value
    ? 'PlacaCompleta'
    : siteVariant.metaTitle),
  // Os JSON-LD abaixo (FAQPage/WebSite/Organization) ficam SEMPRE com a
  // identidade do PlacaCompleta, de proposito: e a entidade canonica pra
  // onde o canonical desta pagina aponta nos 3 dominios (ver
  // composables/useSiteVariant.ts). Nao trocar por dominio.
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
  resultadoBasico.value = null
  placaJaConsultada.value = false
  aguardandoPlacaPaga.value = false
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

  // A consulta gratis da web nao coleta mais contato: o resultado aparece na
  // propria tela (canal 'tela' na API). Sairam daqui o modal de e-mail, o de
  // confirmar destinatario e a validacao de e-mail/telefone. O PWA segue com o
  // fluxo antigo (acima), porque la o e-mail ja e do proprio app.

  if (!isPWA.value) {
    if (channel.value === 'whatsapp') {
      localStorage.setItem('pc_phone', phone.value)
      localStorage.setItem('pc_channel', 'whatsapp')
    } else {
      localStorage.setItem('pc_email', email.value)
      localStorage.setItem('pc_channel', 'email')
    }
  }
  // Chegou aqui por um CTA pago (clicou em comprar sem ter placa): a placa
  // agora existe, entao o destino e o checkout, nao a consulta gratis.
  if (aguardandoPlacaPaga.value && !isPWA.value) {
    aguardandoPlacaPaga.value = false
    premiumPlaca.value = placa.value
    showPremiumCheckout.value = true
    track('premium_checkout_open', { origin: 'hero_apos_cta', plano: premiumPlano.value, ja_consultada: false })
    return
  }

  loading.value = true
  startStageCycle()
  track('form_submit', { form_name: 'plate_consultation', pwa_mode: isPWA.value })

  try {
    const result = await $fetch<{ success: boolean; emailSent: boolean; whatsappSent?: boolean; channel?: 'email' | 'whatsapp'; message: string; data?: any }>('/api/consulta', {
      method: 'POST',
      body: {
        // Web: canal 'tela', sem destinatario. PWA mantem o e-mail do app.
        email: isPWA.value ? email.value : null,
        phone: null,
        channel: isPWA.value ? 'email' : 'tela',
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
      // No canal 'tela' nao ha envio: o sucesso e ter vindo o bloco basico.
      const delivered = Boolean(result.basico)
      message.value = result.message
      messageType.value = delivered ? 'success' : 'info'
      success.value = delivered
      sentToEmail.value = channel.value === 'whatsapp' ? phone.value : email.value

      if (delivered) {
        track('consulta_success', { channel: channel.value })
        shareInfo.value = (result as any).share || null
        // resultado na tela (padrao dos concorrentes): o que e o carro aparece
        // na hora; o que decide a compra fica atras do pagamento.
        resultadoBasico.value = (result as any).basico || null
        // A partir daqui o CTA pago pula a pergunta "e este veiculo?".
        placaJaConsultada.value = true
        // O endereco passa a dizer o que esta na tela. `push` e nao `replace`:
        // voltar tem que devolver a home limpa, que e de onde a pessoa veio.
        // Como e alias da mesma pagina, isto nao remonta nada.
        const alvoUrl = `/placa/${placa.value.replace(/[^A-Z0-9]/gi, '').toUpperCase()}`
        if (route.path !== alvoUrl) router.push(alvoUrl)
        // Oferta de seguro desativada por ora: o modal disputava com a
        // tela de resultado, que agora e o momento de venda do relatorio.
        // O dado continua chegando e ja aparece como "Seguro estimado" no
        // bloco livre; o que saiu de cena foi a abordagem em modal.
        // Pra religar, e so descomentar as tres partes marcadas com
        // "seguro (desativado)".
        //
        // seguro (desativado) — gatilho
        // if (result.seguroEstimado) {
        //   seguroEstimado.value = result.seguroEstimado
        //   setTimeout(() => { if (success.value) openSeguroModal() }, 1200)
        // }
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
      <!-- nav full-bleed; o header para na coluna do %wrap -->
      <div class="cb-navband" :class="{ 'cb-navband--oculto': headerRecolhido }">
        <HomeHeader
          logo-variant="default"
          :placa="placa"
          :consultada="success"
          :mostrar-busca="mostrarBuscaHeader"
          @consult="consultFromGrid"
          @update:placa="(v) => { placa = formatPlaca(v); placaError = '' }"
          @submit="handleSubmit"
        />
      </div>

      <!-- ===== HERO ===== -->
      <!-- Antes da consulta: pitch curto + placa em destaque. O exemplo de
           relatorio saiu daqui pra uma section propria; o espaco livre e o que
           deixa o formulario dominar a dobra. -->
      <header id="hero" class="cb-hero" :class="{ 'cb-hero--resultado': success }">
        <div v-if="!success" class="cb-hero__grid">
          <div class="cb-hero__left">
            <p class="cb-eyebrow">{{ siteVariant.eyebrow }}</p>
            <h1 class="cb-h1">
              {{ siteVariant.h1Line1 }}<br>
              <span class="cb-accent">{{ siteVariant.h1Accent }}</span>
            </h1>
            <p class="cb-sub">
              Restrição, roubo, gravame, leilão, dívida. <b>O que o vendedor não conta, a placa revela.</b>
            </p>

            <form class="cb-plate-panel" @submit.prevent="handleSubmit" novalidate role="search" aria-label="Consulta veicular por placa">
              <label class="cb-plate-label" for="placa">Digite a placa do veículo</label>
              <PlacaMercosul :erro="!!placaError">
                <input
                  id="placa"
                  ref="placaRef"
                  :value="placa"
                  type="text"
                  class="cb-plate__input"
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
              </PlacaMercosul>
              <small v-if="aguardandoPlacaPaga" class="cb-plate-help cb-plate-help--cta">
                Consulte a placa primeiro. Digite acima para seguir com o
                {{ PLANOS[premiumPlano].nome.toLowerCase() }}.
              </small>
              <small v-else id="placa-help" class="cb-plate-help">Aceita placa antiga (ABC1234) e Mercosul (ABC1D23)</small>
              <span v-if="placaError" class="form-group__error cb-error" role="alert">{{ placaError }}</span>

              <!-- O CTA primario e a consulta gratis: e ela que abre o resultado
                   na tela. O pago aparece depois, em cima do que ficou bloqueado. -->
              <template v-if="!loading">
                <button type="submit" class="cb-btn cb-btn--blue cb-btn--lg cb-btn--block">
                  Consultar placa
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
            </form>

            <div class="cb-trust">
              <span><i class="cb-dot" />Pix</span>
              <span><i class="cb-dot" />na hora</span>
              <span><i class="cb-dot" />link privado</span>
              <span><i class="cb-dot" />sem cadastro</span>
            </div>
          </div>

          <!-- Coluna da direita: o que a placa entrega. Enche a metade que
               estava vazia com argumento, nao com enfeite. -->
          <aside class="cb-hero__side" aria-label="O que o relatório responde">
            <div class="cb-panel">
              <p class="cb-panel__kick">O que a placa revela</p>
              <p class="cb-panel__h">O vendedor conta a versão dele.<br>A placa conta a oficial.</p>

              <!-- Veiculo com os alertas saindo dele: o mesmo argumento da lista,
                   so que a pessoa ve o problema colado no objeto. No default
                   (carro) e ilustracao generica, decorativa (alt vazio +
                   aria-hidden, pra ninguem ler como laudo de um carro
                   especifico). Nos variants moto/caminhao e foto real de um
                   modelo especifico (Honda CB600F Hornet / Volvo FH), entao
                   leva alt descritivo de verdade — nao e mais decorativo. -->
              <div ref="carroRef" class="cb-carro" :class="{ 'is-entrando': carroEntrou }">
                <img
                  :src="siteVariant.heroImage"
                  :alt="siteVariant.heroImageAlt"
                  :aria-hidden="siteVariant.heroImageAlt ? undefined : 'true'"
                  class="cb-carro__img"
                  width="1024"
                  height="1024"
                >

                <!-- Linhas e pontos numa camada SVG so: como sao todas
                     horizontais, o rotulo opaco por cima esconde o comeco da
                     linha e ela parece nascer da borda da pilula. Sem viewBox
                     de proposito, pra 1 unidade continuar sendo 1px e o ponto
                     nao virar elipse quando a caixa muda de proporcao. -->
                <svg class="cb-carro__linhas" aria-hidden="true">
                  <!-- pathLength=1 normaliza o comprimento: o traco pode ser
                       desenhado com dasharray 1 sem medir cada linha. -->
                  <g v-for="(a, i) in alertasIlustrativos" :key="'l-' + a.label" :style="{ '--d': `${i * 0.09}s` }">
                    <line pathLength="1" :x1="a.lado === 'esq' ? '0%' : a.lado === 'dir' ? '100%' : a.cx" :y1="a.y" :x2="a.ex" :y2="a.ey" />
                    <line pathLength="1" :x1="a.ex" :y1="a.ey" :x2="a.ax" :y2="a.ay" />
                    <circle :cx="a.ax" :cy="a.ay" r="4" />
                  </g>
                </svg>

                <span
                  v-for="(a, i) in alertasIlustrativos"
                  :key="a.label"
                  class="cb-carro__pin"
                  :class="`cb-carro__pin--${a.lado}`"
                  :style="a.lado === 'baixo' ? { top: a.y, left: a.cx, '--d': `${i * 0.09}s` } : { top: a.y, '--d': `${i * 0.09}s` }"
                >{{ a.label }}</span>
              </div>

              <!-- Piso de mil: numero baixo (banco local, ou um reset) vira
                   prova social contra nos. Abaixo disso, some. -->
              <p v-if="consultaCount >= 1000" class="cb-panel__foot">
                <strong>{{ consultaCount.toLocaleString('pt-BR') }}</strong> consultas já realizadas
              </p>
            </div>
          </aside>
        </div>

        <!-- ===== RESULTADO NA TELA ===== -->
        <div v-else class="cb-result">
          <p class="cb-result__kick">Consulta grátis concluída</p>
          <h1 class="cb-result__h">Encontramos o veículo da placa {{ resultadoBasico?.placa || placa }}.</h1>
          <p class="cb-result__lead">
            Grátis e sem cadastro. Isto é o que a placa diz sobre o carro.
            <strong>O que ela diz sobre o negócio está logo abaixo.</strong>
          </p>

          <div v-if="camposLivres.length" class="cb-result__card">
            <div class="cb-result__grid">
              <div v-for="([k, val]) in camposLivres" :key="k" class="cb-field">
                <span class="cb-field__k">{{ k }}</span>
                <span class="cb-field__v">{{ val }}</span>
              </div>
            </div>
          </div>

          <div class="cb-locked">
            <!-- "Faltam" jogava a falta pra cima da gente, como se nao
                 tivessemos os dados. "Disponíveis" inverte pro que interessa:
                 existem mais verificacoes e nos entregamos.
                 O que NAO da pra escrever e "já temos essas informações": a
                 consulta oficial deste veiculo so roda depois do pagamento, e
                 afirmar que o dado ja esta na mao seria mentira. Por isso a
                 promessa aqui e de entrega ("sai na hora"), nao de posse. -->
            <p class="cb-locked__kick">Atenção: tem mais nessa placa</p>
            <h2 class="cb-locked__h">
              Mais <strong>{{ camposBloqueados.length }}</strong> verificações disponíveis para este veículo
            </h2>
            <p class="cb-locked__sub">
              Restrições, roubo e furto, leilão, gravame, bloqueio judicial, multas e mais.
              Entram no relatório completo, liberado em até 5 minutos depois do pagamento.
            </p>

            <div class="cb-locked__box">
              <div class="cb-locked__grid">
                <div v-for="c in camposBloqueados" :key="c.label" class="cb-locked__item">
                  <span class="cb-locked__k">{{ c.label }}</span>
                  <span class="cb-locked__v" aria-hidden="true">••••••••</span>
                  <span class="visually-hidden">não incluído na consulta grátis</span>
                </div>
              </div>

              <div class="cb-locked__over">
                <div class="cb-locked__cta">
                  <button type="button" class="cb-btn cb-btn--blue" @click="openPremiumCheckout('completa')">
                    Relatório completo · {{ precoBRL(PLANOS.completa.valorCentavos) }}
                  </button>
                  <!-- Oferta da basica desativada aqui: duas opcoes no mesmo
                       ponto dividiam a decisao. A basica segue viva no
                       comparativo de precos. Pra voltar, e so descomentar.
                  <button type="button" class="cb-btn cb-btn--ghost" @click="openPremiumCheckout('basica')">
                    Só a ficha técnica · {{ precoBRL(PLANOS.basica.valorCentavos) }}
                  </button>
                  -->
                </div>
              </div>
            </div>
          </div>

          <div class="cb-result__foot">
            <button v-if="shareInfo" type="button" class="cb-btn cb-btn--ghost" @click="shareWhatsApp">
              Compartilhar no WhatsApp
            </button>
            <button type="button" class="cb-free-link" @click="resetForm">consultar outra placa</button>
          </div>
        </div>

        <!-- Scroll cue: mata o "false bottom". So no estado inicial (sem
             resultado), sinaliza que ha mais conteudo abaixo do herói. -->
        <button
          v-if="!success"
          type="button"
          class="cb-scrollcue"
          aria-label="Rolar para ver o que entra no relatório"
          @click="rolarParaConteudo"
        >
          <span class="cb-scrollcue__txt">o que entra no relatório</span>
          <svg class="cb-scrollcue__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </header>

      <!-- ===== POR QUE CONSULTAR =====
           Subiu pra logo depois do herói: e o argumento que faz a pessoa
           querer o relatorio, entao vem antes dos precos, nao depois. Os
           quatro itens seguem a linha do tempo de quem compra. -->
      <section class="cb-ganhos">
  <div class="cb-ganhos__grid">
              <div class="cb-ganho">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7" />
                  <path d="M12 6.6V12l3.4 2.2" fill="none" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <h3>Você não perde a viagem</h3>
                <p>
                  Consulte antes de sair de casa. Se a placa já mostra gravame, leilão ou
                  restrição, você economiza a tarde, a gasolina e a conversa de ir ver uma
                  bomba que não ia dar em nada.
                </p>
              </div>

              <div class="cb-ganho">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.8 20 6v6c0 4.5-3.3 7.9-8 9.2C7.3 19.9 4 16.5 4 12V6Z"
                        fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
                  <path d="M8.6 12.2l2.4 2.4 4.4-4.8" fill="none" stroke="currentColor"
                        stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <h3>Você não leva o problema pra casa</h3>
                <p>
                  Roubo, furto, passagem por leilão e bloqueio judicial aparecem antes de
                  você entregar o dinheiro. Depois de assinado, o problema já é seu.
                </p>
              </div>

              <div class="cb-ganho">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 12h4l2.5 5 5-14 2.5 9h4" fill="none" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <h3>Você negocia com dado na mão</h3>
                <p>
                  Multa em aberto, financiamento não quitado ou custo de manutenção alto
                  derrubam o preço. Saber disso antes vira desconto na conversa, ou motivo
                  pra sair fora a tempo.
                </p>
              </div>

              <div class="cb-ganho">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" fill="none" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" />
                  <path d="M20.8 3.6v4.2h-4.2" fill="none" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <h3>Você não toma susto na revenda</h3>
                <p>
                  Restrição que trava a transferência não some sozinha. Descobrir hoje é
                  assunto do vendedor; descobrir na hora de vender é prejuízo seu.
                </p>
              </div>
            </div>
      </section>

      <!-- ===== COMPARE: os tres niveis ===== -->
      <!-- Comparativo dos tres niveis. TODOS os cards listam TODOS os itens:
           check no que entra, X vermelho no que nao. Esconder as linhas
           ausentes deixaria os cards incomparaveis — e o que falta e
           justamente o que explica o degrau de preco.
           Rotulos, precos e a matriz saem de shared/planos.ts, a mesma fonte
           que o servidor usa pra cobrar e filtrar os campos do relatorio. -->
      <section id="o-que-inclui" class="cb-compare">
        <div class="cb-cmp-head">
          <h2>Três formas de olhar a placa</h2>
          <p>A grátis diz o que é o carro. A básica prova quem ele é.</p>
          <p style="font-weight: 700;">A completa diz se dá pra confiar.</p>
        </div>
        <div class="cb-cmp-grid">
          <div
            v-for="p in [PLANOS.gratis, PLANOS.basica, PLANOS.completa]"
            :key="p.id"
            class="cb-cmp-card"
            :class="{ 'cb-cmp-card--hi': p.id === 'completa' }"
          >
            <span v-if="p.destaque" class="cb-cmp-flag">{{ p.destaque }}</span>
            <div class="cb-cmp-kick">{{ p.nome }}</div>
            <div class="cb-cmp-price">
              <template v-if="p.valorCentavos === 0">Grátis <small>na tela</small></template>
              <template v-else>{{ precoBRL(p.valorCentavos) }} <small>Pix, uma vez</small></template>
            </div>
            <div class="cb-cmp-note">{{ p.chamada }}</div>

            <ul class="cb-cmp-list">
              <li
                v-for="r in RECURSOS.filter((x) => !(x.ocultarEm || []).includes(p.id))"
                :key="r.label"
                :class="{ 'cb-cmp-item--off': !inclui(r, p.id) }"
              >
                <svg v-if="inclui(r, p.id)" class="cb-ico cb-ico--yes" viewBox="0 0 20 20" aria-hidden="true">
                  <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="1.5" />
                  <path d="M6 10.2l2.6 2.6L14 7.4" fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <svg v-else class="cb-ico cb-ico--no" viewBox="0 0 20 20" aria-hidden="true">
                  <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="1.5" />
                  <path d="M7 7l6 6M13 7l-6 6" fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" />
                </svg>
                <span>{{ r.label }}</span>
                <span class="visually-hidden">{{ inclui(r, p.id) ? 'incluído' : 'não incluído' }}</span>
              </li>
            </ul>

            <button
              v-if="p.id === 'gratis'"
              type="button"
              class="cb-btn cb-btn--ghost cb-btn--block cb-cmp-cta"
              @click="scrollToPlaca"
            >
              Fazer consulta grátis
            </button>
            <button
              v-else
              type="button"
              class="cb-btn cb-btn--block cb-cmp-cta"
              :class="p.id === 'completa' ? 'cb-btn--blue' : 'cb-btn--ghost'"
              @click="consultFromGrid(p.id)"
            >
              {{ p.nome }} · {{ precoBRL(p.valorCentavos) }}
            </button>
          </div>
        </div>
      </section>

      <!-- ===== EXEMPLO DE RELATÓRIO =====
           Saiu do herói (onde disputava atencao com o formulario) e virou uma
           section propria, onde tem espaco pra ser lido de verdade. -->
      <section id="exemplo" class="cb-exemplo">
        <div class="cb-exemplo__head">
          <p class="cb-eyebrow">Exemplo de relatório</p>
          <h2>É assim que o relatório completo fica.</h2>
          <p class="cb-exemplo__sub">
            Um exemplo real do que você recebe: cada verificação com resultado, sem jargão.
          </p>
        </div>
        <div class="cb-exemplo__card">
          <HomeReportPreview />
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
            <p>Uma vez. Sem assinatura, sem pegadinhas.</p>
          </div>
          <div class="cb-step">
            <div class="cb-num">03</div>
            <h3>Receba na hora</h3>
            <p>Link privado com o relatório completo, direto no seu aparelho. De fácil compartilhamento.</p>
          </div>
        </div>
      </section>

      <!-- ===== DOCUMENTO REVELADO ===== -->
      <section class="cb-doc">
        <div class="cb-doc__in">
          <div class="cb-doc-kick">O documento revelado</div>
          <h2>Tudo que a placa carrega, num relatório só.</h2>
          <p class="cb-doc-lead">
            A grátis te diz o que é o carro. A completa te diz se dá pra confiar.
            {{ precoBRL(PLANOS.completa.valorCentavos) }}, uma vez.
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
        <!-- Ordem: manchete -> botao -> garantia. Os dois eram inline-flex e
             caiam lado a lado na mesma linha. -->
        <div class="cb-price-card">
          <p class="cb-price-big">
            {{ precoBRL(PLANOS.completa.valorCentavos) }}
            <span class="cb-mut">para não perder</span> R$ 45 mil.
          </p>
          <div class="cb-price-card__cta">
            <button type="button" class="cb-btn cb-btn--blue cb-btn--lg" @click="consultFromGrid('completa')">
              Consultar agora · {{ precoBRL(PLANOS.completa.valorCentavos) }}
            </button>
          </div>
          <div class="cb-guar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            Não achou o veículo? Estorno automático no Pix.
          </div>
          <div class="cb-cta-sub">Pix · na hora · sem cadastro</div>
        </div>
      </section>


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
            <span class="cb-qa__icon" aria-hidden="true" />
          </button>
          <div v-show="openFaq === index" :id="`faq-answer-${index}`" class="cb-qa__answer" role="region">
            <p>{{ faq.answer }}</p>
          </div>
        </article>
      </section>

      <!-- ===== CTA FINAL ===== -->
      <section class="cb-final">
        <h2>Antes de fechar negócio, olhe a placa.</h2>
        <p>O que o vendedor não conta, o relatório revela. Na hora, no Pix.</p>
        <button type="button" class="cb-btn cb-btn--on-slab cb-btn--lg" @click="consultFromGrid('completa')">
          Ver relatório completo · {{ precoBRL(PLANOS.completa.valorCentavos) }}
        </button>
        <div class="cb-cta-sub">ou faça a consulta grátis, sem cadastro</div>
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
          <div v-if="!loading" class="form-group">
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

          <template v-if="!loading">
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

          <div v-if="loading" class="loading-bar">
            <div class="loading-bar__fill" />
          </div>

          <Transition name="stage" mode="out-in">
            <p
              v-if="loading && consultaStage"
              :key="consultaStage"
              class="loading-stage"
            >
              {{ consultaStage }}
            </p>
          </Transition>

          <div v-if="message" class="win-alert" :class="`win-alert--${messageType}`">
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
    <!-- seguro (desativado) — markup do modal. showSeguroModal nunca vira true
         enquanto o gatilho em handleSubmit estiver comentado, entao isto nao
         renderiza; fica aqui pra voltar sem reescrever. -->
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
    <!-- O modal de consultas vive no app.vue, uma vez so pro site inteiro; o
         header abre por estado compartilhado. -->

    <PremiumInlineCheckout
      v-if="showPremiumCheckout"
      :placa="premiumPlaca"
      :plano="premiumPlano"
      :ja-consultada="placaJaConsultada"
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
// HOME v2.1 — revamp sob o guia .agents/DESIGN-hp.md
//
// Adotado do guia: vocabulario fechado de superficies (canvas / cloud /
// fog / slab escuro), escala tipografica com display em peso 500 e
// line-height 1.0 (inclusive no herói — e a decisao mais caracteristica do
// sistema), dois niveis de raio (4px interativo x 16px container),
// elevacao quase toda plana (hairline; Soft Lift so em card), ritmo de
// 80px entre faixas e a disciplina de um acento so, no maximo 2x por tela.
//
// NAO adotado, de proposito: o #024ad8 e o chevron derivado do wordmark da
// HP — sao marca deles. O acento aqui e o azul da casa e os slabs escuros
// ficam no navy do projeto (o rodape global ja e navy; o near-black do guia
// abriria uma emenda visivel entre a faixa de fecho e o rodape).
//
// Tudo escopado em .home-v2: nao encosta em tokens globais nem em outras
// paginas.
// ============================================================
.home-v2 {
  // ---- Superficies: o vocabulario inteiro, so isso ----
  $c-canvas:   #ffffff;  // fundo universal
  $c-cloud:    #f7f7f7;  // faixa alternada
  $c-fog:      #e8e8e8;  // painel utilitario
  $c-slab:     #0B1F3A;  // faixa escura (navy da casa no lugar do ink do guia)
  $c-hair:     #e8e8e8;  // hairline
  $c-steel:    #c2c2c2;  // borda de input, estado desabilitado

  // ---- Tinta ----
  $c-ink:      #1a1a1a;  // titulo e corpo sobre branco
  $c-charcoal: #3d3d3d;  // descricao secundaria
  $c-graphite: #636363;  // letra miuda, metadado
  $c-on-slab:  #ffffff;

  // ---- Acento: um so, e escasso ----
  $c-blue:        #1f6feb;
  $c-blue-deep:   #17539f;  // pressed
  $c-blue-bright: #4d8bf5;  // variante clara, so dentro de slab escuro

  // ---- Semantico (guia: erro; verde fica so no icone da garantia) ----
  $c-green: #1e9e4a;
  $c-red:   #d33a3a;

  $c-font: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

  // ---- Espacamento: base 8, meio-passo 4 ----
  $s-xxs: 4px;  $s-xs: 8px;   $s-sm: 12px;  $s-md: 16px;
  $s-lg: 20px;  $s-xl: 24px;  $s-xxl: 32px;

  // ---- Raio: dois niveis. E a assinatura do sistema. ----
  $r-md: 4px;    // botao, input — quase retilineo
  $r-lg: 8px;    // badge, linha de FAQ
  $r-xl: 16px;   // card, moldura de conteudo
  $r-pill: 9999px;

  // ---- Elevacao: Soft Lift e o unico nivel com sombra ----
  $e-lift: 0 2px 8px rgba(26, 26, 26, 0.08);

  // hairline sobre a faixa cloud (o #e8e8e8 sumiria contra o #f7f7f7)
  $c-hairline-locked: #dcdcdc;

  // Ritmo entre faixas. O guia HP usa 80px como constante; aqui fica em 55px
  // por decisao de densidade — a pagina e longa e o respiro de 80px empurrava
  // conteudo de venda pra fora da dobra. Custom property porque variavel Sass
  // nao muda dentro de media query.
  --band-y: 55px;
  @media (max-width: 860px) { --band-y: 40px; }

  max-width: none;
  width: 100%;
  margin: 0;
  padding: 0;
  background: $c-canvas;
  color: $c-ink;
  font-family: $c-font;
  line-height: 1.4;
  text-align: left;
  -webkit-font-smoothing: antialiased;
  // `clip` e nao `hidden`: hidden cria um contexto de rolagem e anula o
  // position:sticky do .cb-navband. Corta igual, sem virar scroll container.
  overflow-x: clip;

  // .desktop e flex-column com align-items:center, entao cada filho direto
  // (as faixas) dimensionava por fit-content. Stretch faz cada faixa ocupar
  // a largura inteira; o recuo de leitura fica no %wrap dentro de cada uma.
  align-items: stretch;
  justify-content: flex-start;

  // O .desktop--hero-web (resquicio do heroi v1, mais abaixo neste arquivo)
  // impoe max-width:1080px de 860px pra cima. Mesma especificidade que
  // .home-v2 e declarado depois, entao vencia por ordem de cascata. Ancorar
  // nas duas classes (sempre juntas: ambas dependem de !isPWA) desempata.
  &.desktop--hero-web { max-width: none; }

  @media (max-width: 520px) { border-radius: 0; padding: 0; margin: 0; }

  // Coluna de conteudo. So largura — o respiro vertical fica em cada secao,
  // pra faixa full-bleed e coluna usarem a mesma regra sem conflito.
  //
  // O `width: 100%` nao e decorativo: margem auto no eixo CRUZADO cancela o
  // align-items:stretch do flex container, entao sem ele cada secao passa a
  // dimensionar por conteudo. Era isso que fazia o FAQ pular de 426px pra
  // 820px ao abrir uma resposta — a secao crescia junto com o texto.
  %wrap { width: 100%; max-width: 1366px; margin-left: auto; margin-right: auto; }

  // ---------- BOTOES ----------
  // Guia: label em CAIXA ALTA com 0.7px de tracking — o unico lugar do
  // sistema que espaceja letra. Raio 4px: "um botao de 8px+ ja le como
  // outra marca".
  .cb-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: $s-xs;
    min-height: 44px;
    padding: $s-sm $s-xl;
    font-family: $c-font;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    border-radius: $r-md;
    border: 1px solid transparent;
    cursor: pointer;
    text-decoration: none;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

    &:focus-visible { outline: 2px solid $c-blue; outline-offset: 2px; }

    // button-primary: o unico preenchimento azul da pagina
    &--blue {
      background: $c-blue;
      color: #fff;

      &:hover  { background: $c-blue-deep; }
      &:active { background: $c-blue-deep; }
      &:disabled { background: $c-steel; color: #fff; cursor: default; }
    }

    // button-outline-ink: acao secundaria, neutra contra o azul
    &--ghost {
      background: $c-canvas;
      color: $c-ink;
      border-color: $c-ink;

      &:hover { background: $c-cloud; }
    }

    // Dentro de slab escuro o azul profundo encardiria; guia manda subir
    // pro tom claro.
    &--on-slab {
      background: $c-blue-bright;
      color: #06122a;

      &:hover { background: #6ba0f8; }
    }

    &--lg { min-height: 52px; padding: $s-md $s-xxl; }
    &--block { display: flex; width: 100%; }
  }

  // ---------- NAV ----------
  // Guia: a nav e branca com hairline embaixo, nao um slab. A faixa escura
  // do topo e so a utility strip. .cb-navband pinta a faixa de ponta a ponta
  // e o HomeHeader para na coluna do %wrap.
  // Fixo no topo: o slot central so faz sentido se acompanhar a rolagem.
  // z-index abaixo do overlay do checkout (que usa 1000+).
  //
  // So a partir de 1024px: no celular a barra tem 178px (logo + nav em duas
  // linhas) e, fixa, comeria um quinto da tela. Um menu hamburguer resolveria,
  // mas ai e outro trabalho.
  .cb-navband {
    // Translucido: deixa entrever o que passa atras em vez de tapar. O
    // saturate compensa a lavagem que o blur causa nas cores por baixo.
    background: rgba(255, 255, 255, 0.72);
    -webkit-backdrop-filter: blur(14px) saturate(160%);
    backdrop-filter: blur(14px) saturate(160%);
    border-bottom: 1px solid $c-hair;

    // Sem suporte a backdrop-filter o fundo tem que voltar a ser opaco, senao
    // o texto do header fica ilegivel sobre o conteudo rolando por tras.
    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      background: $c-canvas;
    }

    @media (min-width: 1024px) {
      position: sticky;
      top: 0;
      z-index: 50;
      // Mais lento e com curva suave: some e reaparece com calma, em vez de
      // piscar. A opacidade fecha antes do movimento terminar, senao o header
      // "desliza visivel" por cima do conteudo.
      transition: transform 0.42s cubic-bezier(0.22, 0.61, 0.36, 1),
                  opacity 0.28s ease;

      // Recolhido enquanto o formulario do herói esta na tela: nao faz sentido
      // uma barra fixa competindo com o campo principal.
      &--oculto {
        transform: translateY(-100%);
        opacity: 0;
        pointer-events: none;
      }
    }

    // Quem prefere menos movimento nao ganha o slide; so aparece e some.
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }

  // ---------- HERO ----------
  .cb-hero {
    @extend %wrap;
    padding: var(--band-y) $s-xl;

    // Na tela de resultado o respiro de faixa (80px) so empurra o bloco de
    // venda pra fora da dobra. Aqui o topo encolhe: o que importa e o box
    // aparecer junto com o resumo.
    &--resultado { padding-top: $s-lg; padding-bottom: $s-xxl; }

    // Duas colunas: copy + formulario na esquerda, o que a placa entrega na
    // direita. Coluna unica desperdicava dois tercos da tela no desktop.
    &__grid {
      display: grid;
      grid-template-columns: 1.02fr 0.98fr;
      // Calha enxuta: os 56px de antes abriam um vao morto entre os dois cards
      // e ainda espremiam a ilustracao. Recuperado, o espaco vira largura pro
      // carro (max-width abaixo), que e o que espalha os rotulos de baixo.
      gap: 32px;
      align-items: center;
    }

    &__left { display: block; text-align: left; }

    &__side { display: block; }
  }

  // Anti "false bottom": em telas onde o herói preenchia a dobra (ex: MacBook
  // Air, ~812px de altura util), o herói inicial encolhe o suficiente pra caber
  // e deixar a próxima seção espiar (~60px), com um scroll cue compacto no fim.
  // So o estado inicial (sem resultado); a tela de resultado mantem o proprio
  // respiro. Especificidade 0,2,0 pra vencer as regras base independente da ordem.
  .cb-hero:not(.cb-hero--resultado) { padding-top: 24px; padding-bottom: 8px; }
  // A lateral era o teto de altura por causa da ilustracao (552x442). Limitada,
  // ela deixa de ser o piso e a dobra abre espaco pro peek — sem mexer na copy.
  .cb-hero__side .cb-carro { max-width: 460px; margin-left: auto; margin-right: auto; }

  .cb-scrollcue {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 8px auto 0;
    padding: 4px 10px;
    background: none;
    border: 0;
    cursor: pointer;
    color: #6b7280;

    &__txt { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
    // So o chevron pulsa (bounce no botao inteiro empurrava layout e chamava
    // atencao demais). Move so o icone, sinal discreto de "role pra baixo".
    &__chev { width: 20px; height: 20px; animation: cb-cue-bounce 1.9s ease-in-out infinite; }

    &:hover, &:focus-visible { color: #1f6feb; }
    &:focus-visible { outline: 2px solid #1f6feb; outline-offset: 4px; border-radius: 6px; }
  }
  @keyframes cb-cue-bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(5px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .cb-scrollcue__chev { animation: none; }
  }

  // Pulsacao discreta dos pontos: chama o olho sem virar enfeite piscante. Fica
  // na opacidade, nao no tamanho, pra nao empurrar layout nem competir com o
  // CTA. Quem pediu menos movimento no sistema nao ve nada disso.
  @keyframes cb-pulso {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  // Entrada, na ordem que a leitura pede: o ponto marca o lugar no carro, a
  // linha sai dele em direcao a borda, e so entao o rotulo diz o que e.
  @keyframes cb-ponto-entra {
    from { opacity: 0; transform: scale(0); }
    to   { opacity: 1; transform: scale(1); }
  }

  // dashoffset NEGATIVO desenha de x2 pra x1, ou seja, do fim da linha pro
  // comeco. E o que faz o traco nascer no ponto e correr ate a borda, e nao o
  // contrario.
  @keyframes cb-traco-entra {
    from { stroke-dashoffset: -1; }
    to   { stroke-dashoffset: 0; }
  }

  @keyframes cb-rotulo-entra {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .cb-carro__linhas circle,
    .cb-carro.is-entrando .cb-carro__linhas circle,
    .cb-carro.is-entrando .cb-carro__linhas line,
    .cb-carro.is-entrando .cb-carro__pin { animation: none; }
  }

  // Carro ilustrativo com os alertas em volta.
  .cb-carro {
    position: relative;
    margin: $s-lg 0 $s-sm;
    // 5/4 em vez de 4/3: com cover a partir de uma arte quadrada, a caixa mais
    // alta deixa aparecer mais da margem transparente, e sao essas faixas
    // vazias em cima e embaixo que dao lugar aos rotulos fora do carro.
    aspect-ratio: 5 / 4;
    overflow: visible;

    &__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 42%;
      display: block;
    }

    &__linhas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;

      line {
        stroke: $c-graphite;
        stroke-width: 1;
        stroke-linecap: round;
      }

      circle {
        fill: $c-red;
        stroke: #fff;
        stroke-width: 2;
        transform-origin: center;
        transform-box: fill-box;   // sem isso o scale gira em torno do 0,0 do SVG
        // atraso escalonado: pulsando junto virava pisca-alerta
        animation: cb-pulso 2.8s ease-in-out infinite;
        animation-delay: var(--d, 0s);
      }
    }

    // A animacao de entrada so existe depois que o JS marca a classe. Assim, se
    // ela nao rodar, nada fica escondido: o estado normal e tudo visivel.
    // Classes escritas por extenso, sem `&__x`: em posicao de descendente o `&`
    // expande a cadeia INTEIRA do pai (.home-v2 .cb-carro), e o seletor sai
    // como `.cb-carro.is-entrando .home-v2 .cb-carro__linhas`, que nunca casa.
    &.is-entrando .cb-carro__linhas {
      circle {
        animation:
          cb-ponto-entra 0.4s cubic-bezier(0.34, 1.3, 0.64, 1) backwards,
          cb-pulso 2.8s ease-in-out infinite;
        animation-delay: var(--d, 0s), calc(var(--d, 0s) + 1.5s);
      }

      line {
        stroke-dasharray: 1;
        animation: cb-traco-entra 0.5s ease-out both;
      }

      // o trecho colado no ponto sai primeiro; o que vai ate a borda vem depois
      line:nth-of-type(2) { animation-delay: calc(var(--d, 0s) + 0.3s); }
      line:nth-of-type(1) { animation-delay: calc(var(--d, 0s) + 0.7s); }
    }

    // So opacidade: o rotulo ja usa transform pra se centrar na linha, e animar
    // transform aqui atropelaria o posicionamento.
    &.is-entrando .cb-carro__pin {
      animation: cb-rotulo-entra 0.35s ease-out both;
      animation-delay: calc(var(--d, 0s) + 1.15s);
    }

    // Pilula neutra: o guia reserva o acento pra acao, entao o alerta vem do
    // ponto vermelho na ponta da linha, nao do fundo do rotulo.
    &__pin {
      position: absolute;
      transform: translateY(-50%);
      background: #fff;
      border: 1px solid $c-hair;
      border-radius: 4px;
      padding: 5px 9px;
      font-size: 12px;
      font-weight: 600;
      color: $c-ink;
      white-space: nowrap;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.07);

      &--esq { left: 0; }
      &--dir { right: 0; }
      // centrado no proprio x: a linha sobe do meio do rotulo
      &--baixo { transform: translate(-50%, -50%); }
    }

    // Numa coluna so, seis rotulos de 12px num box de ~260px cobrem o carro
    // inteiro e as linhas somem atras deles. Aqui o desenho vira outro: carro
    // limpo em cima, alertas como lista logo abaixo. Media query DEPOIS das
    // regras base de proposito, senao perde por ordem de cascata.
    @media (max-width: 1023px) {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      aspect-ratio: auto;

      &__img {
        width: 100%;
        height: auto;
        aspect-ratio: 4 / 3;
      }

      &__linhas { display: none; }

      &__pin {
        position: static;
        transform: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;

        &::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: $c-red;
          flex-shrink: 0;
        }
      }
    }
  }

  // Painel da direita: argumento, nao enfeite — lista o que so o relatorio
  // completo responde, com a contagem real de consultas como prova social.
  .cb-panel {
    background: $c-cloud;
    border: 1px solid $c-hair;
    border-radius: $r-xl;
    // Menos padding lateral (32→20): a moldura sozinha nao precisa de tanto
    // recuo e os 12px de cada lado sao largura util pra ilustracao respirar.
    padding: $s-xxl $s-lg;

    &__kick {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: $c-graphite;
      margin-bottom: $s-sm;
    }

    &__h {
      font-size: 24px;
      font-weight: 500;
      letter-spacing: 0;
      line-height: 1.17;
      color: $c-ink;
      margin-bottom: $s-xl;
    }

    &__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: $s-sm;

      li {
        display: flex;
        align-items: center;
        gap: $s-sm;
        font-size: 16px;
        line-height: 1.38;
        color: $c-ink;
      }
    }

    &__foot {
      margin: $s-xl 0 0;
      padding-top: $s-md;
      border-top: 1px solid $c-hairline-locked;
      font-size: 14px;
      line-height: 1.5;
      color: $c-graphite;

      strong { color: $c-ink; font-weight: 700; }
    }
  }

  // Icones de inclusao. Circulo + marca: legivel em 20px e nao depende de cor
  // sozinha pra dizer sim/nao (o desenho ja diferencia).
  .cb-ico {
    width: 20px;
    height: 20px;
    flex: 0 0 20px;

    &--yes { color: $c-blue; }
    &--check { color: $c-blue; }
    &--no { color: $c-red; }
  }

  .cb-eyebrow {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $c-graphite;
    margin-bottom: $s-sm;
  }

  // Guia: peso 500 em TODO tamanho de display, ate no maior. A maioria dos
  // sistemas editoriais sobe pra 700 no herói; este nao — e o que faz o
  // resultado ler como aberto em vez de imperativo. Tracking 0.
  // Antes ia a 72px e dominava a tela inteira. O guia so pede peso 500 e
  // lh 1.0 — nao pede tamanho maximo. Em display-lg a chamada informa e o
  // formulario comanda, que e o equilibrio dos concorrentes.
  .cb-h1 {
    font-size: clamp(30px, 3.6vw, 44px);
    font-weight: 500;
    letter-spacing: 0;
    line-height: 1.0;
    margin-bottom: $s-lg;
    color: $c-ink;
  }

  // O azul e escasso: no herói ele fica no CTA e no link de texto. O titulo
  // vai inteiro em tinta e a hierarquia vem do contraste com o grafite.
  .cb-accent { color: $c-ink; }
  .cb-mut { color: $c-graphite; }

  .cb-sub {
    font-size: 18px;
    line-height: 1.33;
    color: $c-charcoal;
    max-width: 520px;
    margin: 0 0 $s-xxl;

    b { color: $c-ink; font-weight: 500; }
  }

  // ---------- PAINEL DA PLACA ----------
  // card: raio 16px + Soft Lift (o guia reserva sombra pra card, e so).
  .cb-plate-panel {
    background: $c-canvas;
    border: 1px solid $c-hair;
    border-radius: $r-xl;
    box-shadow: $e-lift;
    padding: $s-xxl;
    max-width: 520px;
    text-align: left;
  }

  .cb-plate-label {
    display: block;
    font-size: 12px;
    font-weight: 700;
    color: $c-graphite;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: $s-sm;
  }

  // ---------- PLACA MERCOSUL ----------
  // Reproduz a placa fisica: moldura preta, tarja azul com selo do Mercosul +
  // BRASIL + bandeira, corpo branco e "BR" no canto inferior esquerdo.
  //
  // A proporcao e travada em 400x130mm (~3,08:1) por `aspect-ratio`. Antes a
  // largura seguia o container e a altura seguia um clamp de fonte, entao o
  // formato variava de 2,17:1 a 4,58:1 conforme o breakpoint — ora quadrada,
  // ora achatada.
  //
  // Todo o conteudo e medido em `cqw` (% da largura da propria placa), nao em
  // px: assim tarja, letras, selo e bandeira crescem juntos e a placa fica
  // igual em qualquer tamanho. Cada regra tem um valor em px antes, que vale
  // como fallback onde container query nao existe.
  // .cb-plate vive em components/PlacaMercosul.vue
  .cb-plate-help {
    display: block;
    font-size: 12px;
    line-height: 1.33;
    color: $c-graphite;
    margin-top: $s-xs;

    // Quando o campo virou pre-requisito de uma compra, a instrucao deixa de
    // ser rodape e vira aviso.
    &--cta { color: $c-blue; font-weight: 500; font-size: 13px; }
  }
  .cb-error { display: block; color: $c-red; font-size: 14px; margin-top: 6px; }

  .cb-plate-panel .cb-btn--block { margin-top: $s-md; }
  .cb-cta-sub { font-size: 14px; line-height: 1.5; color: $c-graphite; text-align: center; margin-top: $s-sm; }

  // button-text-link
  .cb-free-link {
    // display:block de proposito: com flex o texto e o <u> viram itens
    // separados e o espaco entre "a" e "consulta" some. Os 44px de alvo de
    // toque do guia saem do padding (22px de linha + 11px em cima e embaixo).
    display: block;
    width: 100%;
    margin-top: $s-xxs;
    padding: 11px 0;
    background: transparent;
    border: 0;
    font-family: $c-font;
    font-size: 16px;
    font-weight: 500;
    line-height: 1.38;
    color: $c-blue;
    text-align: center;
    cursor: pointer;

    u { text-decoration-thickness: 1px; text-underline-offset: 2px; }
    &:hover { color: $c-blue-deep; }
    &:focus-visible { outline: 2px solid $c-blue; outline-offset: 2px; }
  }

  .cb-alert { margin-top: $s-md; }
  .cb-success { margin-top: $s-md; text-align: center; }

  // badge-pill-outline: sem bloco tingido — a hairline sustenta. O verde
  // sobra so no icone, como sinal semantico.
  .cb-seal {
    display: inline-flex;
    align-items: center;
    gap: $s-xs;
    background: $c-canvas;
    color: $c-ink;
    border: 1px solid $c-hair;
    border-radius: $r-lg;
    padding: 6px $s-sm;
    font-size: 14px;
    font-weight: 400;
    margin-top: $s-md;

    svg { width: 16px; height: 16px; color: $c-green; flex-shrink: 0; }
  }

  .cb-trust {
    display: flex;
    flex-wrap: wrap;
    gap: $s-sm $s-lg;
    margin-top: $s-xl;
    font-size: 14px;
    line-height: 1.5;
    color: $c-graphite;
    font-weight: 400;
    max-width: 520px;
    align-items: center; justify-content: space-around;

    span { display: inline-flex; align-items: center; gap: 7px; }
  }

  .cb-dot {
    width: 5px;
    height: 5px;
    border-radius: $r-pill;
    background: $c-green;
    display: inline-block;
    flex-shrink: 0;
  }

  // ---------- TELA DE RESULTADO ----------
  // Padrao dos concorrentes: o que e o carro aparece na hora; o que decide a
  // compra fica atras do pagamento, com os rotulos visiveis pra pessoa saber
  // exatamente o que esta comprando.
  .cb-result {
    @extend %wrap;
    max-width: 820px;
    text-align: center;

    &__kick {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: $c-graphite;
      margin-bottom: $s-sm;
    }

    &__h {
      font-size: clamp(24px, 2.6vw, 32px);
      font-weight: 500;
      letter-spacing: 0;
      line-height: 1.05;
      color: $c-ink;
      margin-bottom: $s-xs;
    }

    &__lead {
      font-size: 16px;
      line-height: 1.38;
      color: $c-charcoal;
      margin-bottom: $s-lg;

      strong { color: $c-ink; font-weight: 500; }
    }

    &__card {
      background: $c-canvas;
      border: 1px solid $c-hair;
      border-radius: $r-xl;
      box-shadow: $e-lift;
      padding: $s-lg;
      text-align: left;
    }

    &__grid {
      display: grid;
      // minmax menor cabe mais colunas: os 11 campos passam de 4 linhas
      // para 3, e o box de venda sobe junto.
      grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
      gap: $s-sm $s-md;
    }

    &__foot {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: $s-xs;
      margin-top: $s-xxl;
    }

  }

  .cb-field {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding-bottom: 6px;
    border-bottom: 1px solid $c-hair;

    &__k { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: $c-graphite; }
    &__v { font-size: 15px; line-height: 1.3; color: $c-ink; }
  }

  // ---------- BLOCO BLOQUEADO ----------
  .cb-locked {
    // Respiro menor que o ritmo padrao de faixa: aqui o objetivo e o box
    // caber na tela junto com o resumo, nao separar duas secoes.
    margin-top: $s-xxl;

    &__kick {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: $c-blue;
      margin-bottom: $s-xs;
    }

    &__h {
      font-size: clamp(21px, 2.2vw, 28px);
      font-weight: 500;
      letter-spacing: 0;
      line-height: 1.05;
      color: $c-ink;
      margin-bottom: $s-xxs;

      strong { font-weight: 500; color: $c-blue; }
    }

    &__sub { font-size: 15px; line-height: 1.38; color: $c-charcoal; margin-bottom: $s-md; max-width: 620px; margin-left: auto; margin-right: auto; }

    &__box {
      position: relative;
      border: 1px solid $c-hair;
      border-radius: $r-xl;
      background: $c-cloud;
      padding: $s-lg;
      overflow: hidden;
    }

    &__grid {
      display: grid;
      // minmax menor rende mais colunas no desktop (menos linhas, box mais
      // baixo) e ainda quebra o mobile em 2 colunas, cortando pela metade a
      // altura do box no celular.
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: $s-xs $s-sm;
      text-align: left;
    }

    &__item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-bottom: 6px;
      border-bottom: 1px solid $c-hairline-locked;
    }

    &__k { font-size: 13px; font-weight: 500; line-height: 1.3; color: $c-charcoal; }

    // O valor e um marcador, nao um dado escondido: nao existe resposta no DOM
    // pra vazar. O borrao aqui e so a linguagem visual do "ainda bloqueado".
    &__v {
      font-size: 16px;
      color: $c-steel;
      filter: blur(5px);
      user-select: none;
      letter-spacing: 0.1em;
    }

    // Sobreposicao: o CTA fica EM CIMA do bloqueado, nao depois dele.
    &__over {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      // Leve de proposito: o rotulo e o argumento de venda ("Roubo e furto",
      // "Gravame") e precisa ser lido. Quem some e o valor, que nao existe.
      background: linear-gradient(180deg, rgba(247, 247, 247, 0.25) 0%, rgba(247, 247, 247, 0.82) 45%, rgba(247, 247, 247, 0.6) 100%);
    }

    // Os dois CTAs com a mesma caixa: mesma largura e mesma altura. Antes um
    // era --lg (52px) e o outro 44px, e cada um tinha a largura do proprio
    // texto, o que fazia a dupla parecer desalinhada.
    &__cta {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: $s-sm;
      padding: $s-md;
      width: min(340px, 100%);

      .cb-btn {
        width: 100%;
        min-height: 52px;
        padding-left: $s-md;
        padding-right: $s-md;
      }
    }

    &__pix { font-size: 13px; line-height: 1.5; color: $c-graphite; margin: 0; }
  }

  // ---------- EXEMPLO DE RELATÓRIO ----------
  .cb-exemplo {
    background: $c-cloud;
    padding: var(--band-y) $s-xl;

    // 640px (mesma largura do cb-cmp-head vizinho) apertava demais AQUI: o
    // titulo desta secao e mais longo ("É assim que o relatório completo
    // fica.") e quebrava em 2 linhas mesmo em monitor largo, com a fonte no
    // teto do clamp (44px). 960px da espaco pra caber numa linha so nas
    // telas largas sem esticar demais nas estreitas (o clamp/vw ja cuida
    // da fonte encolher antes de precisar quebrar).
    &__head {
      max-width: 960px;
      margin: 0 auto $s-xxl;
      text-align: center;

      h2 { font-size: clamp(28px, 3.4vw, 44px); font-weight: 500; letter-spacing: 0; line-height: 1.0; }
    }

    &__sub { color: $c-charcoal; font-size: 18px; line-height: 1.33; margin-top: $s-sm; }

    &__card {
      max-width: 720px;
      margin: 0 auto;
      background: $c-canvas;
      border: 1px solid $c-hair;
      border-radius: $r-xl;
      box-shadow: $e-lift;
      padding: $s-lg;
    }
  }

  // ---------- COMPARE (faixa cloud) ----------
  .cb-compare {
    background: $c-cloud;
    padding: var(--band-y) $s-xl;
  }

  .cb-cmp-head {
    text-align: center;
    max-width: 640px;
    margin: 0 auto $s-xxl;

    h2 { font-size: clamp(28px, 3.4vw, 44px); font-weight: 500; letter-spacing: 0; line-height: 1.0; }
    p { color: $c-charcoal; font-size: 18px; line-height: 1.33; margin-top: $s-sm; }
  }

  .cb-cmp-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: $s-xl;
    max-width: 1080px;
    margin: 0 auto;
    align-items: stretch;

    // Empilhado, a ordem se inverte: o completo (que e o produto) vem
    // primeiro, depois a basica, e a gratis por ultimo. Em coluna unica quem
    // esta no topo leva a atencao.
    @media (max-width: 1023px) {
      grid-template-columns: 1fr;
      max-width: 520px;

      .cb-cmp-card:nth-child(1) { order: 3; }   // grátis
      .cb-cmp-card:nth-child(2) { order: 2; }   // básica
      .cb-cmp-card:nth-child(3) { order: 1; }   // completa
    }
  }

  // card-pricing-tier
  .cb-cmp-card {
    position: relative;
    background: $c-canvas;
    border: 1px solid $c-hair;
    border-radius: $r-xl;
    padding: $s-xl;
    box-shadow: $e-lift;
    display: flex;
    flex-direction: column;

    // Guia: a coluna em destaque ganha o azul no carimbo de preco e um fio
    // azul — nunca um fundo colorido nem inversao pra escuro. O selo e a
    // elevacao dao o destaque extra sem quebrar essa regra.
    &--hi {
      border: 2px solid $c-blue;
      box-shadow: 0 8px 24px rgba(31, 111, 235, 0.16);

      .cb-cmp-price { color: $c-blue; }

      // Sobe o card em relacao aos vizinhos, so onde as tres colunas convivem.
      @media (min-width: 1024px) {
        margin-top: -$s-lg;
        margin-bottom: -$s-lg;
        padding-top: calc(#{$s-xl} + #{$s-lg});
        padding-bottom: calc(#{$s-xl} + #{$s-lg});
      }
    }
  }

  // Selo do card em destaque. Fica a cavaleiro da borda superior.
  .cb-cmp-flag {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translate(-50%, -50%);
    background: $c-blue;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    padding: 6px $s-md;
    border-radius: $r-md;
    white-space: nowrap;
  }

  .cb-cmp-kick {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $c-graphite;
  }

  // price-md
  .cb-cmp-price {
    font-size: 32px;
    font-weight: 500;
    letter-spacing: 0;
    line-height: 1.17;
    margin: 6px 0 $s-xxs;

    small { font-size: 14px; font-weight: 400; color: $c-graphite; }
  }

  .cb-cmp-note { font-size: 14px; line-height: 1.5; color: $c-charcoal; margin-bottom: $s-md; }

  .cb-cmp-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: $s-sm;
    margin: 0 0 $s-lg;
    padding: 0;

    li {
      display: flex;
      gap: $s-sm;
      font-size: 15px;
      line-height: 1.33;
      align-items: flex-start;
    }

    // Item ausente: cinza + X. A cor sozinha nao carrega o significado — o
    // desenho do icone ja diferencia, e ha texto so pra leitor de tela.
    .cb-cmp-item--off {
      color: $c-graphite;

      span:first-of-type { text-decoration: line-through; text-decoration-thickness: 1px; }
    }

    .cb-ico { margin-top: 1px; }
  }

  // Marcador legado (usado fora do comparativo).
  .cb-tick {
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
    margin-top: 2px;
    background: no-repeat center / 14px 14px;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E") no-repeat center / contain;

    &--green { background-color: $c-ink; }
    &--blue  { background-color: $c-ink; }
  }

  .cb-cmp-cta { margin-top: auto; }

  // ---------- STATEMENT (faixa canvas) ----------
  .cb-statement {
    padding: var(--band-y) $s-xl;
    background: $c-canvas;

    .cb-big-decl {
      @extend %wrap;
      max-width: 960px;
      font-size: clamp(36px, 5.6vw, 72px);
      font-weight: 500;
      letter-spacing: 0;
      line-height: 1.0;
      color: $c-ink;
    }
  }

  // ---------- COMO FUNCIONA ----------
  .cb-how {
    @extend %wrap;
    padding: var(--band-y) $s-xl;
    border-top: 1px solid $c-hair;

    h2 {
      font-size: clamp(28px, 3.4vw, 44px);
      font-weight: 500;
      letter-spacing: 0;
      line-height: 1.0;
      margin-bottom: $s-xxl;
    }
  }

  .cb-steps {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: $s-xxl;
  }

  .cb-step {
    border-top: 1px solid $c-ink;
    padding-top: $s-md;

    h3 { font-size: 20px; font-weight: 500; letter-spacing: 0; line-height: 1.0; margin: $s-md 0 $s-xs; }
    p { color: $c-charcoal; font-size: 16px; line-height: 1.38; }
  }

  .cb-num {
    font-size: clamp(48px, 6vw, 72px);
    font-weight: 500;
    letter-spacing: 0;
    line-height: 1.0;
    color: $c-ink;
  }

  // ---------- DOCUMENTO REVELADO (slab escuro) ----------
  .cb-doc {
    padding: var(--band-y) $s-xl;
    background: $c-slab;
    color: $c-on-slab;

    &__in { @extend %wrap; max-width: 980px; }
  }

  .cb-doc-kick {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $c-blue-bright;
  }

  .cb-doc h2 {
    font-size: clamp(32px, 4.4vw, 56px);
    font-weight: 500;
    letter-spacing: 0;
    line-height: 1.0;
    margin: $s-sm 0 $s-lg;
  }

  .cb-doc-lead { font-size: 18px; line-height: 1.33; color: rgba(255, 255, 255, 0.72); max-width: 640px; }

  .cb-doc-tags {
    display: flex;
    flex-wrap: wrap;
    gap: $s-sm;
    margin-top: $s-xxl;
  }

  // badge-pill-outline sobre slab: raio 8px, nao pill — mantem o sistema
  // nos dois niveis de raio.
  .cb-doc-tag {
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.04);
    border-radius: $r-lg;
    padding: 6px $s-sm;
    font-size: 16px;
    font-weight: 400;
    display: inline-flex;
    align-items: center;
    gap: $s-xs;
  }

  // ---------- ganhos (o que o relatorio evita) ----------
  // ---------- POR QUE CONSULTAR ----------
  // Quatro razoes, na ordem em que a pessoa vive a compra: antes de sair de
  // casa, na hora de fechar, na negociacao e la na frente, na revenda.
  // Saiu do slab escuro pra ca, entao a tinta volta pro par ink/charcoal.
  .cb-ganhos {
    @extend %wrap;
    padding: var(--band-y) $s-xl;
    border-top: 1px solid $c-hair;

    &__grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: $s-xxl $s-xl;

      // 2x2 no meio do caminho: com quatro colunas a coluna fica estreita
      // demais e as linhas quebram em duas palavras.
      @media (max-width: 1199px) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 640px) { grid-template-columns: 1fr; }
    }
  }

  .cb-ganho {
    svg {
      width: 28px;
      height: 28px;
      color: $c-blue;
      display: block;
      margin-bottom: $s-sm;
    }

    h3 {
      font-size: 20px;
      font-weight: 500;
      letter-spacing: 0;
      line-height: 1.17;
      color: $c-ink;
      margin: 0 0 $s-xs;
    }

    p {
      font-size: 16px;
      line-height: 1.45;
      color: $c-charcoal;
      margin: 0;
    }
  }

  .cb-d2 {
    width: 5px;
    height: 5px;
    border-radius: $r-pill;
    background: $c-green;
    display: inline-block;
    flex-shrink: 0;
  }

  // ---------- MANIFESTO (faixa canvas) ----------
  .cb-manifesto {
    padding: var(--band-y) $s-xl;
    text-align: center;

    p {
      max-width: 900px;
      margin: 0 auto;
      font-size: clamp(32px, 4.6vw, 56px);
      font-weight: 500;
      letter-spacing: 0;
      line-height: 1.0;
      color: $c-ink;
    }
  }

  // ---------- PRECO + GARANTIA (faixa cloud) ----------
  .cb-price {
    background: $c-cloud;
    padding: var(--band-y) $s-xl;
  }

  .cb-price-card {
    max-width: 760px;
    margin: 0 auto;
    background: $c-canvas;
    border: 1px solid $c-hair;
    border-radius: $r-xl;
    box-shadow: $e-lift;
    padding: $s-xxl;
    text-align: center;
  }

  .cb-price-big {
    font-size: clamp(32px, 4.4vw, 44px);
    font-weight: 500;
    letter-spacing: 0;
    line-height: 1.0;
    color: $c-ink;
  }

  .cb-guar {
    display: inline-flex;
    align-items: center;
    gap: $s-xs;
    margin: 0 0 $s-sm;
    background: $c-canvas;
    border: 1px solid $c-hair;
    color: $c-ink;
    border-radius: $r-lg;
    padding: 6px $s-sm;
    font-size: 14px;
    font-weight: 400;

    svg { width: 16px; height: 16px; color: $c-green; flex-shrink: 0; }
  }

  // Botao numa linha propria: antes ele e a garantia eram inline-flex e
  // dividiam a mesma linha.
  .cb-price-card__cta { margin: $s-xl 0 $s-md; }
  .cb-price-card .cb-btn { margin: 0 auto; }
  .cb-price-card .cb-guar { margin: 0 0 $s-sm; }
  .cb-price-card .cb-cta-sub { margin-top: $s-sm; }

  // ---------- FAQ ----------
  // faq-row do guia: linha em canvas, raio 8px, divisor hairline, chevron
  // a direita (pra baixo fechado, pra cima aberto).
  .cb-faq {
    @extend %wrap;
    max-width: 820px;
    padding: var(--band-y) $s-xl;

    h2 {
      font-size: clamp(28px, 3.2vw, 44px);
      font-weight: 500;
      letter-spacing: 0;
      line-height: 1.0;
      margin-bottom: $s-xxl;
    }
  }

  .cb-qa {
    border-bottom: 1px solid $c-hair;

    &:first-of-type { border-top: 1px solid $c-hair; }

    &__toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: $s-sm;
      width: 100%;
      padding: $s-lg $s-xl;
      background: $c-canvas;
      border: 0;
      border-radius: $r-lg;
      cursor: pointer;
      text-align: left;

      h3 { font-size: 16px; font-weight: 500; line-height: 1.38; letter-spacing: 0; color: $c-ink; margin: 0; }
      &:hover { background: $c-cloud; }
      &:focus-visible { outline: 2px solid $c-blue; outline-offset: -2px; }
    }

    // Chevron em CSS puro (o markup passou a nao ter glifo).
    &__icon {
      width: 9px;
      height: 9px;
      flex-shrink: 0;
      margin: -3px $s-xxs 0 $s-xs;
      border-right: 2px solid $c-graphite;
      border-bottom: 2px solid $c-graphite;
      transform: rotate(45deg);
      transition: transform 0.18s ease;
    }

    &--open &__icon { transform: rotate(-135deg); }

    &__answer {
      padding: 0 $s-xl $s-lg;

      p { color: $c-charcoal; font-size: 16px; line-height: 1.38; margin: 0; }
    }
  }

  // ---------- CTA FINAL (slab escuro fecha o ritmo) ----------
  // Guia: toda pagina fecha em faixa escura antes do rodape.
  .cb-final {
    padding: var(--band-y) $s-xl;
    text-align: center;
    background: $c-slab;
    color: $c-on-slab;

    > * { max-width: 820px; margin-left: auto; margin-right: auto; }

    h2 {
      font-size: clamp(32px, 4.4vw, 56px);
      font-weight: 500;
      letter-spacing: 0;
      line-height: 1.0;
      margin-bottom: $s-sm;
      color: $c-on-slab;
    }

    p { color: rgba(255, 255, 255, 0.72); font-size: 18px; line-height: 1.33; margin-bottom: $s-xl; }

    .cb-cta-sub { color: rgba(255, 255, 255, 0.6); }
  }

  // ---------- RESPONSIVO ----------
  @media (max-width: 1023px) {
    .cb-hero__grid { grid-template-columns: 1fr; gap: 40px; }
    // No estreito o painel vem depois do formulario: quem chegou pra
    // consultar nao precisa rolar por argumento antes de digitar a placa.
    .cb-hero__side { order: 2; }
  }

  @media (max-width: 860px) {
    .cb-steps { grid-template-columns: 1fr; gap: $s-xxl; }
    .cb-plate-panel { max-width: none; }
  }

  // No celular a barra de URL do navegador ja come ~200px da tela. Com header
  // de 80px e o respiro de faixa inteiro, o botao de consultar caia abaixo da
  // dobra: a acao principal do site nascia escondida. Aqui a barra encolhe e o
  // topo do herói aperta, so no telefone.
  //
  // Fica no FIM do bloco de proposito: as regras base de .cb-hero, .cb-h1 e
  // .cb-sub vem depois do header no arquivo, e media query com a mesma
  // especificidade perde por ordem de cascata se vier antes delas.
  @media (max-width: 640px) {
    // As regras do header sairam daqui: vivem no parcial global, junto com o
    // resto da barra.
    .cb-hero { padding-top: $s-lg; }
    .cb-h1 { margin-bottom: $s-sm; }
    .cb-sub { margin-bottom: $s-lg; }
    .cb-eyebrow { margin-bottom: $s-xxs; }

    // Os selos repetem o que o proprio formulario ja diz e ficam abaixo dele,
    // fora da dobra: no telefone so custam altura.
    .cb-trust { display: none; }
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

// Link secundário: fluxo grátis na tela (é um <button type="submit">
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
