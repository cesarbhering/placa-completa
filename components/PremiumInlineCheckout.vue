<script setup lang="ts">
import { PLANOS, RECURSOS } from '~/shared/planos'
import { origemDaSessao } from '~/shared/origem-trafego'
import { enfileirarEventoFunil, enviarFunil } from '~/composables/useAnalytics'

// Checkout premium inline: roda o fluxo pago SEM sair da home, num overlay.
// Espelha a logica de pages/premium/index.vue (gate -> preview -> checkout ->
// poll status -> navega pro relatorio). Recebe a placa ja digitada no herbi da
// home. Mantem o gate por senha do homolog (cookie httpOnly seta pelo server;
// so pede a senha uma vez, quando o preview volta 401).
//
// Nao revela fonte dos dados em nenhum texto.

// `plano` decide o preco e o que o relatorio vai liberar. O servidor recalcula
// o valor pela tabela dele, entao aqui e so apresentacao — nada de confiar no
// numero que sai do cliente.
const props = withDefaults(defineProps<{
  placa: string
  plano?: 'basica' | 'completa'
  /**
   * A placa ja passou por uma consulta nesta sessao, entao o veiculo ja foi
   * mostrado na tela. Perguntar "e este veiculo?" de novo so adiciona um
   * passo: aqui vai direto pro pagamento, e a confirmacao acontece depois,
   * junto com o relatorio.
   */
  jaConsultada?: boolean
  /**
   * Variante do teste A/B (layout da consulta gratis) que a pessoa viu. Vai no
   * corpo do checkout pra carimbar a atribuicao de venda por variante no pedido
   * (coluna ab_bloco), em vez do join fragil por placa.
   */
  abBloco?: 'A' | 'B' | null
}>(), {
  plano: 'completa',
  jaConsultada: false,
  abBloco: null,
})
const emit = defineEmits<{ close: [] }>()

const cfg = useRuntimeConfig()

// Dentro do app Android quem cobra e o Google Play, nao o Pix: a loja exige
// que todo produto digital passe pela cobranca dela. Entao, e SO ali, o
// checkout perde cupom, perde a opcao de plano e perde qualquer palavra sobre
// Pix, e o botao vira uma compra na loja. Na web nada muda.
const { isCapacitor } = useAppMode()
// Cartao (Stripe) so aparece na WEB e so quando o ambiente tem as chaves do
// Stripe (NUXT_PUBLIC_CARTAO_HABILITADO). No app quem cobra e o Google Play.
const cartaoHabilitado = computed(() => !isCapacitor.value && !!cfg.public.cartaoHabilitado)
const playBilling = usePlayBilling()

type Step = 'loading' | 'gate' | 'confirm' | 'pending' | 'erro'
const step = ref<Step>('loading')
const loading = ref(false)
const msg = ref('')

const senha = ref('')
const email = ref('')
const telefone = ref('')

// Cupom de desconto (v1): campo expansivel, valida no blur do input E de novo
// ao clicar pagar (o preco pode ter mudado entre uma coisa e outra — cupom
// esgotado, expirado etc). O servidor SEMPRE recalcula tudo de novo no
// checkout.post.ts; o que roda aqui e so pra mostrar o preco certo na tela.
const cupomAberto = ref(false)
const cupomCodigo = ref('')
const cupomValidando = ref(false)
const cupomMsg = ref('')
const cupomDescontoCentavos = ref(0)
const cupomValido = computed(() => cupomDescontoCentavos.value > 0)
const emailErro = ref('')

// O servidor responde sem acento e em linguagem interna; aqui vira copy.
function mensagemCupom(motivo?: string): string {
  if (!motivo) return 'Cupom inválido.'
  // "venceu em DD/MM as HHhMM" e "e pessoal" vem prontos do servidor: sao os
  // unicos motivos com dado dentro (a data, e a regra do dono). Repetir a
  // frase aqui so criaria duas versoes da mesma copy pra sair de sincronia.
  if (/venceu em/i.test(motivo)) return motivo.replace(' as ', ' às ')
  if (/pessoal/i.test(motivo)) return 'Este cupom é válido apenas para o e-mail que o recebeu.'
  if (/ja foi utilizado|ja usou/i.test(motivo)) return 'Este cupom já foi utilizado.'
  if (/esgotado/i.test(motivo)) return 'Este cupom já foi totalmente utilizado.'
  if (/expirado/i.test(motivo)) return 'Este cupom está expirado.'
  if (/nao encontrado|inativo/i.test(motivo)) return 'Cupom inválido.'
  if (/nao vale para este plano/i.test(motivo)) return 'Este cupom não vale para este plano.'
  return motivo
}

// Valida o cupom. Sem e-mail (a pessoa digitou o cupom primeiro) o servidor
// pula so o limite por pessoa e ja aplica o desconto na tela; o check por
// e-mail acontece de novo no clique final, quando o e-mail existe.
async function validarCupom(): Promise<boolean> {
  const codigo = cupomCodigo.value.trim()
  cupomMsg.value = ''
  if (!codigo) { cupomDescontoCentavos.value = 0; return false }
  const temEmail = email.value.includes('@')
  cupomValidando.value = true
  try {
    const r: any = await $fetch('/api/premium/coupon', {
      method: 'POST',
      body: { codigo, plano: props.plano, email: temEmail ? email.value : undefined },
    })
    if (r?.ok) {
      cupomDescontoCentavos.value = r.descontoCentavos || 0
      cupomMsg.value = cupomDescontoCentavos.value > 0
        // Cupom pessoal aberto pelo link antes de a pessoa digitar o e-mail:
        // o desconto ja vale, mas so pra ela. Melhor dizer agora do que deixar
        // o preco subir de surpresa no clique de pagar.
        ? (r.exigeEmail ? 'Cupom aplicado. Use o mesmo e-mail que recebeu o cupom.' : 'Cupom aplicado!')
        : ''
      return true
    }
    cupomDescontoCentavos.value = 0
    cupomMsg.value = mensagemCupom(r?.motivo)
    return false
  } catch (e: any) {
    cupomDescontoCentavos.value = 0
    cupomMsg.value = 'Não conseguimos validar o cupom agora.'
    if (import.meta.dev) console.warn('[checkout] cupom falhou:', e?.data?.message || e)
    return false
  } finally {
    cupomValidando.value = false
  }
}
// WhatsApp oculto ate a feature de notificacao por WhatsApp existir. O ref
// telefone segue vivo (API aceita opcional); so nao aparece na UI.
const mostraWhatsapp = false
// Controle de teste: SO o build de homolog mostra o dropdown e comeca em
// 'homolog'. Qualquer outro build (staging espelha prod; prod e prod) nao tem
// dropdown e precisa cair em 'producao' — senao o front mandaria 'homolog' e a
// consulta bateria no SENATRAN de homologacao (que so tem placas de teste, 404
// pra placa real). O server ainda faz o clamp final por seguranca.
const ambiente = ref<'homolog' | 'producao'>(cfg.public.homolog ? 'homolog' : 'producao')
const preview = ref<any>(null)

const pix = ref<{ brCode?: string; brCodeBase64?: string; token: string; valor: number; gratis?: boolean; expiresAt?: string | null } | null>(null)

// Contagem regressiva do Pix: a cobranca expira em 15 minutos e ate agora a
// tela nao dizia isso. Prazo visivel evita tanto a pressa ansiosa ("vai
// sumir?") quanto o abandono de quem acha que pode voltar amanha.
const agora = ref(Date.now())
let tickRestante: ReturnType<typeof setInterval> | null = null
const segundosRestantes = computed(() => {
  const fim = pix.value?.expiresAt ? new Date(pix.value.expiresAt).getTime() : 0
  if (!fim) return null
  return Math.max(0, Math.floor((fim - agora.value) / 1000))
})
const tempoRestante = computed(() => {
  const s = segundosRestantes.value
  if (s === null) return null
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})

// O que este plano libera, na ordem em que a pessoa pensa no problema. Sai da
// fonte unica de recursos (shared/planos.ts), entao muda junto com o produto.
const oQueLibera = computed(() => {
  const rotulos = RECURSOS
    .filter((r) => r.planos.includes(props.plano as any))
    .map((r) => r.label)
  const destaque = [
    'Roubo e furto',
    'Registro de leilão no documento',
    'Gravame e alienação',
    'Restrições nacionais e estaduais',
    'Indicador de multas (RENAINF)',
    'Valor FIPE',
  ]
  const escolhidos = destaque.filter((d) => rotulos.some((r) => r.startsWith(d)))
  return (escolhidos.length ? escolhidos : rotulos).slice(0, 5)
})
const pendingStatus = ref('aguardando_pagamento')
let poll: ReturnType<typeof setInterval> | null = null

// historico local: religar/retomar consultas sem login
const { add: histAdd, updateStatus: histUpdate } = useConsultaHistory()
const { trackBeginCheckout, trackAddPaymentInfo, trackPixGerado, trackConversionPaga } = useAnalytics()

// Contexto que acompanha toda etapa do funil medida aqui.
function ctxFunil() {
  return { placa: placaClean.value, plano: props.plano }
}

// A tela de confirmacao apareceu. E o ponto onde mais gente desiste, e ate
// agora so existia no gtag: sem isto nao da pra separar "nem abriu o checkout"
// de "abriu e parou na confirmacao".
watch(step, (novo) => {
  if (novo === 'confirm') enfileirarEventoFunil('checkout_confirm_visto', ctxFunil())
})

// Informou e-mail (no checkout ou na tela do Pix). SO a marca de que informou:
// o endereco em si nunca sai daqui.
let emailJaReportado = false
function marcarEmailInformado(onde: string) {
  if (emailJaReportado) return
  emailJaReportado = true
  enfileirarEventoFunil('email_informado', { ...ctxFunil(), extra: { onde } })
}

const reais = (c: number) => 'R$ ' + (c / 100).toFixed(2).replace('.', ',')

const planoInfo = computed(() => PLANOS[props.plano])
// O botao carrega SO o desfecho, nao o preco: o preco ja aparece no resumo
// logo acima, e repeti-lo no botao so reforca o frame de custo na hora do
// clique. A linha-helper abaixo do botao cuida da reasseguranca (Pix, estorno,
// prazo), tirando esse peso de cima da CTA.
const rotuloPagar = computed(() => {
  if (isCapacitor.value) {
    return loading.value
      ? 'Abrindo o Google Play...'
      : `Comprar ${PLANOS.completa.nome} ${reais(PLANOS.completa.valorCentavos)} pelo Google Play`
  }
  if (loading.value) return cupomGratis.value ? 'Liberando...' : 'Gerando Pix...'
  if (cupomGratis.value) return 'Liberar relatório grátis'
  return props.plano === 'completa' ? 'Pagar e liberar o relatório' : 'Liberar minha consulta'
})
const precoExibidoCentavos = computed(() =>
  Math.max(0, planoInfo.value.valorCentavos - cupomDescontoCentavos.value),
)
// So pra rotular o botao: o preco final real (gratis ou nao) sai sempre do
// server, isto e so cosmetico. Cupom parcial que so encosta no piso (ex.:
// R$9,90) NAO conta como gratis — so quando zera de verdade.
const cupomGratis = computed(() => cupomValido.value && precoExibidoCentavos.value === 0)

// A placa comeca na prop mas pode ser corrigida aqui dentro (o lapis na linha
// do resumo), entao vira estado local em vez de derivar so da prop.
const placaLocal = ref(String(props.placa || ''))
watch(() => props.placa, (v) => { placaLocal.value = String(v || '') })

const placaClean = computed(() =>
  placaLocal.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7),
)

// Correcao da placa, inline na linha do resumo do checkout.
const editandoPlaca = ref(false)
const placaRascunho = ref('')

function abrirEdicao() {
  placaRascunho.value = placaClean.value
  editandoPlaca.value = true
}

async function salvarPlaca() {
  const nova = placaRascunho.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
  if (nova.length < 7) { msg.value = 'Placa incompleta. Use ABC1D23 ou ABC1234.' ; return }
  msg.value = ''
  editandoPlaca.value = false
  placaLocal.value = nova
  step.value = 'loading'
  await consultarPreview()   // o veiculo muda junto com a placa (volta em 'confirm')
}

// Pre-preenche email salvo do fluxo grativo (mesmo navegador)
onMounted(() => {
  if (import.meta.client) {
    // pc_email vem da consulta gratis; pwa_email vem do fluxo do app. Os dois
    // sao a mesma pessoa no mesmo aparelho, e quem ja digitou o e-mail uma vez
    // nao devia digitar de novo pra pagar.
    const saved = localStorage.getItem('pc_email') || localStorage.getItem('pwa_email')
    if (saved && saved.includes('@')) email.value = saved
  }
  // Cupom pela URL (?cupom=CUPOM10ABCDE): o e-mail de recuperacao de Pix manda
  // a pessoa de volta com o desconto pronto. Sem isto ela teria que copiar o
  // codigo do e-mail e achar o campo, que fica fechado por padrao.
  const daUrl = String(useRoute().query.cupom || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20)
  if (daUrl) {
    cupomCodigo.value = daUrl
    cupomAberto.value = true
    // Valida sozinho: a pessoa clicou num link com desconto, ver o preco velho
    // por um instante e ruim. Roda depois do preview, que traz o veiculo.
    nextTick(() => validarCupom())
  }
  trackBeginCheckout(props.plano, placaClean.value)
  consultarPreview()
})

async function consultarPreview() {
  loading.value = true
  msg.value = ''
  try {
    preview.value = await $fetch('/api/premium/preview', {
      method: 'POST',
      body: { placa: placaClean.value },
    })
    step.value = 'confirm'
  } catch (e: any) {
    if (e?.statusCode === 401 || e?.status === 401 || e?.response?.status === 401) {
      // No homolog o gate e pedido SO no acesso a home (overlay), nunca no meio
      // da compra: se a sessao expirou aqui, voltamos pro gate do home (limpa a
      // flag e recarrega -> o overlay reaparece). Fora do homolog nao ha overlay,
      // entao mantemos o gate local pra nao entrar em loop de reload.
      if (cfg.public.gated && import.meta.client) {
        try { localStorage.removeItem('homolog_ok') } catch { /* modo privado */ }
        window.location.reload()
      } else {
        step.value = 'gate'
      }
    } else {
      // Nunca ecoar a mensagem do servidor: coisas como "Premium nao
      // configurado" sao recado de infraestrutura e nao dizem nada pra quem
      // esta tentando comprar. O detalhe tecnico fica no console.
      if (import.meta.dev) console.warn('[checkout] preview falhou:', e?.data?.message || e)
      // 429 = teto de consultas gratis: a mensagem e nossa (ip-wdapi-limit),
      // diz quanto falta e que comprar zera o limite. So ela e ecoada.
      const status = e?.statusCode ?? e?.status ?? e?.response?.status
      msg.value = status === 429 && e?.data?.message
        ? String(e.data.message)
        : status === 404
        ? 'Não encontramos essa placa. Confira os caracteres e tente de novo.'
        : 'Não conseguimos abrir o pagamento agora. Tente de novo em instantes.'
      step.value = 'erro'
    }
  } finally {
    loading.value = false
  }
}

async function entrar() {
  loading.value = true
  msg.value = ''
  try {
    await $fetch('/api/premium/gate', { method: 'POST', body: { password: senha.value } })
    await consultarPreview()
  } catch {
    msg.value = 'Senha incorreta.'
  } finally {
    loading.value = false
  }
}

// Porta de entrada do pagamento: valida o que precisa ser validado e so
// entao gera o Pix. A tela dedicada de reconferencia da placa saiu do fluxo
// (um degrau a mais entre o checkout e o Pix, com dado que a tela de
// confirmacao ja mostra); a correcao da placa continua existindo, agora como
// lapis na propria linha do resumo.
// Validacao comum aos dois meios de pagamento (Pix e cartao): e-mail digitado
// errado nao passa (melhor corrigir agora do que depois de pagar) e cupom exige
// e-mail (o limite por pessoa e por e-mail). Devolve false e foca/abre o campo
// problematico; true = pode seguir pra cobranca.
async function validarCheckout(): Promise<boolean> {
  emailErro.value = ''
  const preencheu = email.value.trim().length > 0
  if (preencheu && !email.value.includes('@')) {
    emailErro.value = 'Este e-mail parece incompleto. Confira antes de pagar.'
    msg.value = ''
    if (import.meta.client) (document.getElementById('pic-email') as HTMLInputElement | null)?.focus()
    return false
  }
  if (!preencheu && cupomCodigo.value.trim()) {
    emailErro.value = 'Para usar um cupom, informe o e-mail que o recebeu.'
    msg.value = ''
    if (import.meta.client) (document.getElementById('pic-email') as HTMLInputElement | null)?.focus()
    return false
  }
  msg.value = ''
  // Revalida o cupom AGORA com o e-mail (limite por pessoa) e espera terminar
  // antes de cobrar — senao a pessoa cobraria com um preco que ja mudou. Se o
  // cupom cair aqui, nao cobra: ela precisa ver o preco cheio antes de confirmar.
  if (cupomCodigo.value.trim()) {
    loading.value = true
    const ok = await validarCupom()
    loading.value = false
    if (!ok) {
      cupomAberto.value = true
      return false
    }
  }
  editandoPlaca.value = false
  return true
}

async function confirmarEPagar() {
  // O e-mail NAO trava mais a geracao do Pix. Quase metade de quem abria o
  // checkout sumia antes da cobranca existir. Ele e pedido na tela do Pix,
  // enquanto a pessoa paga, e continua obrigatorio pra entrega durar.
  if (!(await validarCheckout())) return
  // Passo do meio do funil: registra a intencao ANTES da chamada do checkout,
  // pra falha de rede na geracao do Pix nao virar "ninguem clicou".
  trackAddPaymentInfo(props.plano, placaClean.value, precoExibidoCentavos.value)
  await pagar()
}

// E-mail que o pedido ja levou (preenchido na primeira tela do modal).
const emailNoPedido = ref('')

/**
 * Compra dentro do app: a loja cobra, o servidor confere o comprovante com a
 * Google e o resto do fluxo (status, entrega, relatorio) e exatamente o mesmo
 * do Pix. Nenhum preco sai daqui: quem define e a tabela no servidor.
 */
async function comprarPeloPlay() {
  loading.value = true
  msg.value = ''
  emailNoPedido.value = email.value.trim().includes('@') ? email.value.trim() : ''
  try {
    const compra = await playBilling.comprar(preview.value.placa)
    const r: any = await $fetch('/api/premium/google-play/verificar', {
      method: 'POST',
      body: {
        placa: preview.value.placa,
        email: email.value.trim() || undefined,
        preview: preview.value.raw,
        purchaseToken: compra.purchaseToken,
        orderId: compra.orderId,
        productId: compra.productId,
        ambiente: ambiente.value,
        origin: origemDaSessao(),
      },
    })
    // Daqui pra frente e igual ao Pix pago: o token_entrega e a credencial do
    // relatorio e a tela acompanha pelo mesmo polling.
    pix.value = { token: r.token_entrega, valor: PLANOS.completa.valorCentavos }
    step.value = 'pending'
    pendingStatus.value = 'pago'
    trackConversionPaga(r.token_entrega, 'completa', PLANOS.completa.valorCentavos)
    histAdd({
      token: r.token_entrega,
      placa: preview.value.placa,
      veiculo: preview.value?.encontrado
        ? [preview.value.marca, preview.value.modelo].filter(Boolean).join(' ')
        : null,
      status: 'pago',
    })
    poll = setInterval(checarStatus, 4000)
    await checarStatus()
  } catch (e: any) {
    // Fechar a tela da loja e desistir, nao falhar: sem esta distincao a
    // pessoa que so olhou o preco veria uma mensagem de erro.
    if (playBilling.foiCancelado(e)) {
      msg.value = ''
    } else if (e?.statusCode === 402 || e?.response?.status === 402) {
      msg.value = e?.data?.message || 'Não conseguimos confirmar sua compra agora.'
    } else {
      if (import.meta.dev) console.warn('[checkout] compra no Play falhou:', e?.data?.message || e)
      msg.value = 'Não conseguimos concluir a compra agora. Tente de novo em instantes.'
    }
  } finally {
    loading.value = false
  }
}

async function pagar() {
  loading.value = true
  msg.value = ''
  // Revalida o cupom bem antes de pagar (pode ter esgotado/expirado desde o
  // blur). Se cair, segue a compra sem cupom em vez de travar o pagamento.
  if (cupomCodigo.value.trim()) await validarCupom()
  try {
    // Guarda o que foi mandado no checkout: e isso que decide se a tela do Pix
    // precisa pedir o e-mail.
    emailNoPedido.value = email.value.trim().includes('@') ? email.value.trim() : ''
    if (emailNoPedido.value) marcarEmailInformado('checkout')
    pix.value = await $fetch('/api/premium/checkout', {
      method: 'POST',
      body: {
        placa: preview.value.placa,
        // Vazio e permitido: vira null no pedido e a tela do Pix pede logo em
        // seguida. O servidor recusa e-mail malformado e exige e-mail quando
        // ha cupom.
        email: email.value.trim() || undefined,
        telefone: telefone.value,
        preview: preview.value.raw,
        plano: props.plano,
        ambiente: ambiente.value,
        // Manda o codigo digitado mesmo se a validacao local achou invalido/
        // vazio-de-desconto: quem decide de verdade e o servidor (checkout.post.ts
        // revalida do zero). Antes so mandava quando cupomValido, entao um cupom
        // que ficou stale (ex: esgotou por outra aba enquanto a pessoa reconferia
        // a placa, cupomDescontoCentavos ainda positivo de um validarCupom antigo)
        // podia cobrar o preco errado sem o servidor nem saber que havia cupom.
        cupom: cupomCodigo.value.trim() || undefined,
        // Marca de anuncio da sessao (gclid/msclkid/utm), pra origem da venda
        // ficar gravada no proprio pedido.
        origin: origemDaSessao(),
        // Variante do A/B que a pessoa viu (carimba a atribuicao de venda).
        ab_bloco: props.abBloco ?? undefined,
      },
    })
    step.value = 'pending'
    // So conta como Pix gerado quando a cobranca existe de verdade (ou quando
    // o caminho gratis dispensa a cobranca).
    if (pix.value?.brCode || pix.value?.gratis) {
      trackPixGerado(props.plano, placaClean.value, pix.value?.valor, !!emailNoPedido.value)
    }
    histAdd({
      token: pix.value!.token,
      placa: preview.value.placa,
      veiculo: preview.value?.encontrado
        ? [preview.value.marca, preview.value.modelo].filter(Boolean).join(' ')
        : null,
      status: 'aguardando_pagamento',
    })
    poll = setInterval(checarStatus, 4000)
    agora.value = Date.now()
    if (!tickRestante) tickRestante = setInterval(() => { agora.value = Date.now() }, 1000)
    // Gratis: o server ja processou a entrega ANTES de responder (sem Pix pra
    // esperar). Confere o status na hora em vez de deixar a pessoa olhando
    // pra tela de "aguardando pagamento" ate o proximo tick do poll (4s).
    if (pix.value?.gratis) await checarStatus()
  } catch (e: any) {
    if (import.meta.dev) console.warn('[checkout] pagar falhou:', e?.data?.message || e)
    msg.value = 'Não conseguimos gerar o Pix agora. Tente de novo em instantes.'
  } finally {
    loading.value = false
  }
}

// ---------- Cartao v2: Stripe Elements EMBUTIDO (sem redirect) ----------
// Aba "Cartao" com os campos do Stripe montados DENTRO do modal. O dado do
// cartao so passa pelos iframes do Stripe (nunca pelo nosso servidor). O
// PaymentIntent nasce no server (valor server-authoritative) e a confirmacao
// (com 3DS quando o banco pedir) acontece aqui.
const metodo = ref<'pix' | 'cartao'>('pix')
const nomeCartao = ref('')
const erroCartao = ref('')
const processandoCartao = ref(false)
const stripePronto = ref(false)
let stripe: any = null
let elements: any = null
let cardNumber: any = null
let cartaoMontado = false

function carregarStripeJs(): Promise<any> {
  const w = window as any
  if (w.Stripe) return Promise.resolve(w.Stripe)
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://js.stripe.com/v3/'
    s.async = true
    s.onload = () => resolve((window as any).Stripe)
    s.onerror = () => reject(new Error('falha ao carregar stripe.js'))
    document.head.appendChild(s)
  })
}

// Clicou na aba Cartao: troca de aba e, na PRIMEIRA vez, carrega o Stripe.js e
// monta os campos. Idempotente (cartaoMontado).
async function selecionarCartao() {
  metodo.value = 'cartao'
  if (cartaoMontado || !import.meta.client) return
  const pk = String(cfg.public.stripePublishableKey || '')
  if (!pk) { erroCartao.value = 'Cartão indisponível no momento. Use o Pix.'; return }
  try {
    const Stripe = await carregarStripeJs()
    stripe = Stripe(pk, { locale: 'pt-BR' })
    elements = stripe.elements()
    const style = { base: { fontSize: '16px', color: '#1a1a1a', fontFamily: 'inherit', '::placeholder': { color: '#9aa3ad' } }, invalid: { color: '#c0392b' } }
    cardNumber = elements.create('cardNumber', { style, showIcon: true, placeholder: '1234 1234 1234 1234' })
    const cardExpiry = elements.create('cardExpiry', { style })
    const cardCvc = elements.create('cardCvc', { style })
    await nextTick()
    cardNumber.mount('#pic-card-number')
    cardExpiry.mount('#pic-card-expiry')
    cardCvc.mount('#pic-card-cvc')
    const onChange = (e: any) => { erroCartao.value = e?.error?.message || '' }
    cardNumber.on('change', onChange); cardExpiry.on('change', onChange); cardCvc.on('change', onChange)
    cartaoMontado = true
    stripePronto.value = true
  } catch {
    erroCartao.value = 'Não conseguimos carregar o pagamento com cartão. Use o Pix.'
  }
}

function mensagemErroCartao(error: any): string {
  const m = String(error?.message || '')
  if (error?.code === 'card_declined' || /declin|recusad/i.test(m)) return 'Cartão recusado. Confira os dados ou tente outro cartão.'
  if (error?.code === 'expired_card') return 'Cartão vencido. Tente outro cartão.'
  if (error?.code === 'incorrect_cvc') return 'CVV incorreto. Confira o código de segurança.'
  return m || 'Não foi possível processar o cartão.'
}

// Paga com cartao: cria o PaymentIntent no server e confirma aqui (3DS quando o
// banco pedir). Sucesso -> vai pra pagina do relatorio, que polla ate entregar.
async function pagarComCartao() {
  if (!stripe || !cardNumber) { erroCartao.value = 'Aguarde o pagamento carregar.'; return }
  erroCartao.value = ''
  if (!(await validarCheckout())) return
  processandoCartao.value = true
  try {
    emailNoPedido.value = email.value.trim().includes('@') ? email.value.trim() : ''
    if (emailNoPedido.value) marcarEmailInformado('checkout')
    trackAddPaymentInfo(props.plano, placaClean.value, precoExibidoCentavos.value)
    const r: any = await $fetch('/api/premium/cartao-intent', {
      method: 'POST',
      body: {
        placa: preview.value.placa,
        email: email.value.trim() || undefined,
        telefone: telefone.value,
        preview: preview.value.raw,
        plano: props.plano,
        ambiente: ambiente.value,
        cupom: cupomCodigo.value.trim() || undefined,
        origin: origemDaSessao(),
        ab_bloco: props.abBloco ?? undefined,
      },
    })
    if (!r?.clientSecret) { erroCartao.value = 'Não conseguimos iniciar o pagamento. Use o Pix.'; return }
    const { error, paymentIntent } = await stripe.confirmCardPayment(r.clientSecret, {
      payment_method: {
        card: cardNumber,
        billing_details: { name: nomeCartao.value.trim() || undefined, email: email.value.trim() || undefined },
      },
    })
    if (error) { erroCartao.value = mensagemErroCartao(error); return }
    if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
      histAdd({
        token: r.token,
        placa: preview.value.placa,
        veiculo: preview.value?.encontrado ? [preview.value.marca, preview.value.modelo].filter(Boolean).join(' ') : null,
        status: 'consultando',
      })
      trackConversionPaga(r.token, props.plano, r.valor)
      // Vai pra pagina do relatorio: ela mostra "Confirmando o pagamento do
      // cartao..." e polla o /status ate a entrega.
      if (import.meta.client) window.location.assign(`/premium/${r.token}`)
      return
    }
    erroCartao.value = 'Pagamento não confirmado. Tente novamente ou use o Pix.'
  } catch (e: any) {
    if (import.meta.dev) console.warn('[checkout] cartao v2 falhou:', e?.data?.message || e)
    erroCartao.value = 'Não conseguimos processar o cartão agora. Use o Pix.'
  } finally {
    processandoCartao.value = false
  }
}

/**
 * Leva pro relatorio depois que ele fica pronto.
 *
 * Isto e chamado de dentro de um setInterval, onde o contexto do Nuxt pode nao
 * estar disponivel — e navigateTo(), que depende dele, falha calada. Era o
 * cenario que deixava a pessoa parada na home depois de pagar.
 *
 * Entao: tenta a navegacao do router e, se em meio segundo a URL nao mudou,
 * cai pra navegacao dura. Recarregar a pagina aqui nao custa nada (o destino e
 * outra rota) e garante que ninguem fica preso.
 */
// Piso de ~40s: quando o registro traz recall e/ou multa, segura a navegacao
// pra o relatorio por no minimo 40s a partir da entrega, mostrando o que esta
// sendo buscado. So no fluxo recem-entregue (nunca revisita de link antigo).
const PISO_MS = 40_000
const piso = ref<{ ate: number; msg: string } | null>(null)
let pisoTimer: any = null
function mensagemPiso(temRecall: boolean, temMulta: boolean): string {
  if (temRecall && temMulta)
    return 'Encontramos um recall e multas vinculadas a este veículo. Estamos reunindo os detalhes, leva alguns segundos.'
  if (temRecall)
    return 'Encontramos um recall em aberto para este veículo. Estamos buscando os detalhes da campanha, leva alguns segundos.'
  return 'Encontramos multas e débitos vinculados a este veículo. Estamos levantando os valores, leva alguns segundos.'
}

function irParaRelatorio(token: string) {
  const destino = `/premium/${token}`
  try { navigateTo(destino) } catch { /* cai no fallback abaixo */ }
  if (import.meta.client) {
    setTimeout(() => {
      if (!window.location.pathname.startsWith('/premium/')) {
        window.location.assign(destino)
      }
    }, 500)
  }
}

async function checarStatus() {
  if (!pix.value) return
  try {
    const r: any = await $fetch('/api/premium/status', { query: { token: pix.value.token } })
    pendingStatus.value = r.status
    histUpdate(pix.value.token, r.status)
    if (['pago', 'consultando', 'entregue'].includes(r.status)) trackConversionPaga(pix.value.token, props.plano, pix.value.valor)
    if (r.status === 'entregue') {
      if (poll) clearInterval(poll)
      // Piso so vale pra quem ACABOU de receber (entregue ha < 40s); revisita de
      // link antigo (entregue_em velho) navega na hora, sem segurar.
      const entregueMs = r.entregue_em ? new Date(r.entregue_em).getTime() : 0
      const recem = entregueMs > 0 && Date.now() - entregueMs < PISO_MS
      if ((r.temRecall || r.temMultaSP) && recem) {
        const ate = entregueMs + PISO_MS
        piso.value = { ate, msg: mensagemPiso(!!r.temRecall, !!r.temMultaSP) }
        pisoTimer = setTimeout(() => irParaRelatorio(pix.value!.token), Math.max(0, ate - Date.now()))
      } else {
        irParaRelatorio(pix.value.token)
      }
    }
    if (['expirado', 'falha', 'falha_google_play', 'reembolsado'].includes(r.status) && poll) clearInterval(poll)
  } catch {
    /* segue tentando */
  }
}

// O copia e cola cru fica escondido atras de um toque: sao mais de cem
// caracteres que empurravam o resto da tela pra baixo e que quase ninguem le,
// porque o botao acima ja copia.
const mostrarCodigo = ref(false)
const copiado = ref(false)
function copiar() {
  if (!pix.value?.brCode) return
  navigator.clipboard?.writeText(pix.value.brCode)
  // Confirmacao no proprio botao: sem ela a pessoa clica de novo achando que
  // nao funcionou, e no celular nem da pra ver a area de transferencia.
  copiado.value = true
  setTimeout(() => { copiado.value = false }, 2500)
}

// Homolog: confirma o pagamento sem Pix real (AbacatePay dev). Depois o poll de
// checarStatus detecta "pago" e o fluxo segue sozinho.
async function simular() {
  if (!pix.value) return
  loading.value = true
  try {
    await $fetch('/api/premium/simular-pagamento', { method: 'POST', body: { token: pix.value.token } })
    await checarStatus()
  } catch (e: any) {
    if (import.meta.dev) console.warn('[checkout] simular falhou:', e?.data?.message || e)
    msg.value = 'Falha ao simular o pagamento.'
  } finally {
    loading.value = false
  }
}

function fechar() {
  // Saiu antes de existir cobranca: e a desistencia que queremos medir. Com
  // Pix ja gerado o abandono e outro problema (pagou depois, ou nao pagou), e
  // esse ja tem dado proprio no pedido.
  if (!pix.value) {
    enfileirarEventoFunil('checkout_fechado_sem_pagar', { ...ctxFunil(), extra: { step: step.value } })
    enviarFunil()
  }
  emit('close')
}

// No desktop, clique fora NAO fecha. Quem esta com o Pix na tela costuma
// clicar fora ao voltar do app do banco, e fechar ali significa perder a
// cobranca de vista no meio do pagamento. No celular o gesto de tocar fora e a
// forma natural de sair, entao la continua fechando.
function fecharPeloFundo() {
  if (import.meta.client && window.innerWidth >= 1024) return
  fechar()
}

// ESC fecha em qualquer largura: e o atalho que todo mundo espera de modal, e
// no desktop passa a ser a saida junto com o X.
function aoTeclar(e: KeyboardEvent) {
  if (e.key === 'Escape') fechar()
}
onMounted(() => { if (import.meta.client) window.addEventListener('keydown', aoTeclar) })
onUnmounted(() => { if (import.meta.client) window.removeEventListener('keydown', aoTeclar) })

onUnmounted(() => {
  if (poll) clearInterval(poll)
  if (tickRestante) clearInterval(tickRestante)
  if (pisoTimer) clearTimeout(pisoTimer)
})
</script>

<template>
  <div class="pic-overlay" role="dialog" aria-modal="true" aria-labelledby="pic-titulo" @click="fecharPeloFundo">
    <!-- Na etapa do Pix o cartao fica mais largo no desktop: e a unica tela
         em duas colunas, e nos 460px de sempre elas ficariam espremidas. -->
    <div class="pic-card" :class="{ 'pic-card--largo': step === 'pending' && pendingStatus === 'aguardando_pagamento' }" @click.stop>
      <div class="pic-topo">
        <span id="pic-titulo" class="pic-titulo">{{ planoInfo.nome }} · {{ placaClean }}</span>
        <button type="button" class="pic-x" aria-label="Fechar" @click="fechar">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      <div class="pic-body">
          <!-- Carregando preview -->
          <div v-if="step === 'loading'" class="pic-center">
            <div class="loading-bar"><div class="loading-bar__fill" /></div>
            <p class="pic-hint">Consultando a placa {{ placaClean }}...</p>
          </div>

          <!-- Gate por senha (homologacao) -->
          <div v-else-if="step === 'gate'" class="pic-stack">
            <p class="pic-lead">Área em homologação. Informe a senha de acesso para continuar.</p>
            <div class="pic-campo">
              <label class="pic-label" for="pic-senha">Senha</label>
              <input
                id="pic-senha"
                v-model="senha"
                type="password"
                class="pic-input"
                placeholder="Senha"
                @keyup.enter="entrar"
              >
            </div>
            <button type="button" class="pic-btn pic-btn--primary" :disabled="loading" @click="entrar">
              {{ loading ? 'Entrando...' : 'Entrar' }}
            </button>
          </div>

          <!-- Confirmar veiculo + coletar contato -->
          <div v-else-if="step === 'confirm'" class="pic-stack">
            <!-- Faixa de resumo (opcao 04): sem titulo. Uma faixa cinza de duas
                 colunas — carro a esquerda (marca/modelo + ano·placa com lapis),
                 preco + "Relatorio completo" a direita. Le tudo de uma olhada. -->
            <div class="pic-faixa">
              <strong class="pic-faixa__veic">
                <template v-if="preview?.encontrado">{{ preview.marca }} {{ preview.modelo }}</template>
                <template v-else>Placa {{ placaClean }}</template>
              </strong>
              <span class="pic-faixa__preco">
                <s v-if="cupomValido" class="pic-faixa__de">{{ reais(planoInfo.valorCentavos) }}</s>
                <b>{{ reais(precoExibidoCentavos) }}</b>
              </span>
              <span class="pic-faixa__sub">
                <template v-if="preview?.encontrado">{{ preview.ano }} · </template>
                <span class="pic-faixa__placa">{{ placaClean }}</span>
                <button type="button" class="pic-lapis pic-lapis--faixa" aria-label="Corrigir a placa" @click="abrirEdicao">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </button>
              </span>
              <span class="pic-faixa__plano">{{ planoInfo.nome }}</span>
            </div>
            <div v-if="editandoPlaca" class="pic-campo">
              <label class="pic-label" for="pic-placa-edit">Digite a placa correta</label>
              <input
                id="pic-placa-edit"
                v-model="placaRascunho"
                class="pic-input pic-input--placa"
                type="text"
                maxlength="7"
                autocomplete="off"
                autocapitalize="characters"
                placeholder="ABC1D23"
                @keyup.enter="salvarPlaca"
              >
              <button type="button" class="pic-btn" @click="salvarPlaca">Usar esta placa</button>
            </div>
            <!-- Campo de cupom, expansivel: some por padrao pra nao poluir o
                 checkout de quem nao tem cupom. No app ele nem existe: a loja
                 cobra o preco dela, e um desconto que nao pode ser aplicado so
                 frustraria quem digitasse. -->
            <div v-if="!isCapacitor" class="pic-cupom">
              <button
                v-if="!cupomAberto"
                type="button"
                class="pic-link pic-link--cupom"
                @click="cupomAberto = true"
              >
                Tem um cupom de desconto?
              </button>
              <div v-else class="pic-campo">
                <label class="pic-label" for="pic-cupom">Cupom de desconto</label>
                <input
                  id="pic-cupom"
                  v-model="cupomCodigo"
                  type="text"
                  class="pic-input"
                  placeholder="CODIGO"
                  autocapitalize="characters"
                  autocomplete="off"
                  @blur="validarCupom"
                >
                <p v-if="cupomValidando" class="pic-hint">Validando cupom...</p>
                <p v-else-if="cupomMsg" :class="cupomValido ? 'pic-cupom__ok' : 'pic-cupom__erro'">{{ cupomMsg }}</p>
              </div>
            </div>
            <div v-if="cfg.public.homolog" class="pic-campo">
              <label class="pic-label" for="pic-ambiente">Ambiente SERPRO/GCC (teste)</label>
              <select id="pic-ambiente" v-model="ambiente" class="pic-input">
                <option value="homolog">Homologação</option>
                <option value="producao">Produção</option>
              </select>
              <p v-if="ambiente === 'producao'" class="pic-aviso">Atenção: Produção dispara consulta real no SERPRO.</p>
            </div>
            <!-- E-mail (opcional) de volta ao modal a pedido do Cesar (24/set):
                 vale a pena o cliente receber o link do relatorio por e-mail,
                 evita dor de cabeca de suporte. Continua OPCIONAL (o checkout
                 nao exige e-mail; a excecao e cupom, cujo limite e contado por
                 e-mail). Antes ficava so na tela do Pix, mas la ele sumia pra
                 quem ja tinha e-mail salvo no navegador -> muita gente nao via
                 em lugar nenhum. -->
            <div class="pic-campo">
              <label class="pic-label" for="pic-email">Seu e-mail (opcional, para receber o relatório)</label>
              <input
                id="pic-email"
                v-model="email"
                type="email"
                class="pic-input"
                placeholder="seu@email.com"
                autocomplete="email"
                inputmode="email"
                :aria-invalid="emailErro ? 'true' : undefined"
                @input="emailErro = ''"
              >
              <p v-if="emailErro" class="pic-cupom__erro">{{ emailErro }}</p>
            </div>
            <!-- WhatsApp oculto ate a feature de notificacao por WhatsApp existir.
                 A logica (ref telefone, envio opcional pra API) fica intacta. -->
            <div v-if="mostraWhatsapp" class="pic-campo">
              <label class="form-group__label form-group__label--optional" for="pic-tel">WhatsApp</label>
              <input
                id="pic-tel"
                v-model="telefone"
                type="tel"
                class="pic-input"
                placeholder="(11) 91234-5678"
                autocomplete="tel"
                inputmode="tel"
              >
            </div>
            <!-- Abas de pagamento: Pix | Cartao. So aparecem quando o cartao esta
                 habilitado (chaves do Stripe no ambiente); senao o Pix segue sem
                 abas, exatamente como antes. Pix vem selecionado. -->
            <div v-if="cartaoHabilitado" class="pic-tabs" role="tablist" aria-label="Forma de pagamento">
              <button type="button" role="tab" :aria-selected="metodo === 'pix'" class="pic-tab" :class="{ 'pic-tab--on': metodo === 'pix' }" @click="metodo = 'pix'">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2 8 6l4 4 4-4-4-4Zm-6 6-4 4 4 4 4-4-4-4Zm12 0-4 4 4 4 4-4-4-4Zm-6 6-4 4 4 4 4-4-4-4Z" /></svg>
                Pix
              </button>
              <button type="button" role="tab" :aria-selected="metodo === 'cartao'" class="pic-tab" :class="{ 'pic-tab--on': metodo === 'cartao' }" @click="selecionarCartao">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
                Cartão de crédito
              </button>
            </div>

            <!-- Painel PIX (fica montado; a aba so troca a visibilidade). -->
            <div v-show="metodo === 'pix'">
              <!-- Faixa de confianca enxuta: so as duas duvidas que de fato travam
                   o clique (e se o carro nao aparecer? vai virar assinatura?). -->
              <ul class="pic-conf">
                <li v-if="!isCapacitor" class="pic-conf__item pic-conf__item--forte">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 3 20 6v6c0 4.5-3.3 7.9-8 9-4.7-1.1-8-4.5-8-9V6Z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <span><strong>Estorno automático no Pix</strong> se não conseguirmos gerar seu relatório.</span>
                </li>
                <li class="pic-conf__item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <rect x="4" y="10" width="16" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  <span>Pagamento único. Sem assinatura e sem cadastro.</span>
                </li>
              </ul>
              <button
                type="button"
                class="pic-btn pic-btn--primary"
                :disabled="loading || editandoPlaca"
                @click="isCapacitor ? comprarPeloPlay() : confirmarEPagar()"
              >
                {{ rotuloPagar }}
              </button>
              <p v-if="!isCapacitor" class="pic-hint pic-hint--cta">Pagamento por Pix · estorno se não acharmos o veículo · entrega em até 5 min</p>
            </div>

            <!-- Painel CARTAO: Stripe Elements montado nos divs abaixo. v-show (nao
                 v-if) mantem os pontos de montagem no DOM entre as trocas de aba. -->
            <div v-if="cartaoHabilitado" v-show="metodo === 'cartao'" class="pic-cartao-form">
              <div class="pic-campo">
                <label class="pic-label" for="pic-card-number">Número do cartão</label>
                <div id="pic-card-number" class="pic-input pic-stripe-el" />
              </div>
              <div class="pic-card-linha">
                <div class="pic-campo">
                  <label class="pic-label" for="pic-card-expiry">Validade</label>
                  <div id="pic-card-expiry" class="pic-input pic-stripe-el" />
                </div>
                <div class="pic-campo">
                  <label class="pic-label" for="pic-card-cvc">CVV</label>
                  <div id="pic-card-cvc" class="pic-input pic-stripe-el" />
                </div>
              </div>
              <div class="pic-campo">
                <label class="pic-label" for="pic-card-nome">Nome no cartão</label>
                <input id="pic-card-nome" v-model="nomeCartao" type="text" class="pic-input" placeholder="Como aparece no cartão" autocomplete="cc-name">
              </div>
              <p v-if="erroCartao" class="pic-cupom__erro">{{ erroCartao }}</p>
              <button
                type="button"
                class="pic-btn pic-btn--primary"
                :disabled="processandoCartao || !stripePronto || editandoPlaca"
                @click="pagarComCartao"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                {{ processandoCartao ? 'Processando...' : `Pagar ${reais(precoExibidoCentavos)}` }}
              </button>
              <p v-if="!stripePronto && !erroCartao" class="pic-hint pic-hint--cta">Carregando pagamento seguro...</p>
              <p class="pic-hint pic-cartao-seguro">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                Pagamento processado com segurança pelo Stripe. Não armazenamos os dados do seu cartão.
              </p>
            </div>
            <!-- Sem "Cancelar" no rodape: o X do cabecalho (pic-x, sempre visivel)
                 ja fecha o modal. Um botao a mais so competia com a CTA. -->
          </div>

          <!-- Pagamento Pix + polling -->
          <div v-else-if="step === 'pending'" class="pic-stack pic-center">
            <template v-if="pix?.gratis && pendingStatus === 'aguardando_pagamento'">
              <!-- Gratis: nao ha Pix pra mostrar. O server ja disparou a
                   entrega antes de responder; este trecho so aparece por uma
                   fracao de segundo, ate o checarStatus() imediato do pagar()
                   atualizar pendingStatus. -->
              <h3 class="pic-h">Liberando seu relatório grátis</h3>
              <div class="loading-bar"><div class="loading-bar__fill" /></div>
              <p class="pic-hint">Só um instante...</p>
            </template>
            <!-- No app nao ha Pix pra mostrar: quando a loja confirma, a
                 compra ja esta paga e a tela so espera o relatorio. -->
            <template v-else-if="isCapacitor && pendingStatus === 'aguardando_pagamento'">
              <h3 class="pic-h">Compra confirmada ✓</h3>
              <div class="loading-bar"><div class="loading-bar__fill" /></div>
              <p class="pic-hint">Preparando seu relatório...</p>
            </template>
            <template v-else-if="pendingStatus === 'aguardando_pagamento'">
              <!-- Tela do Pix, enxuta de proposito: ela tinha 1.136px de altura
                   numa janela de 900 e mais ainda no celular, entao a pessoa
                   pagava rolando. Tudo que o cabecalho ja diz (plano e placa)
                   saiu daqui, e o que sobrou cabe sem scroll. No desktop vira
                   duas colunas: o que ela precisa TOCAR de um lado, o que ela
                   precisa LER do outro. -->
              <!-- Titulo, QR e texto vivem no MESMO grid pra o topo do QR
                   alinhar exatamente com o topo do titulo no desktop. Com o
                   titulo fora do grid, ele empurrava as duas colunas pra baixo
                   e elas comecavam em alturas diferentes. No celular o grid
                   vira uma coluna so e a ordem natural (titulo, QR, texto)
                   e a mesma de antes. -->
              <div class="pic-pix">
                <h3 class="pic-h pic-h--pix">Pague {{ reais(pix?.valor ?? planoInfo.valorCentavos) }} com Pix</h3>
                <div class="pic-pix__acao">
                  <img v-if="pix?.brCodeBase64" :src="pix.brCodeBase64" alt="QR Code Pix" class="pic-qr">
                  <button type="button" class="pic-btn" @click="copiar">
                    {{ copiado ? 'Código copiado' : 'Copiar código Pix' }}
                  </button>
                  <p v-if="tempoRestante" class="pic-prazo">Vale por <strong>{{ tempoRestante }}</strong></p>
                </div>
                <div class="pic-pix__info">
                  <p class="pic-hint pic-hint--forte">Deixe esta tela aberta: quando o pagamento cair, o relatório abre aqui.</p>

                  <!-- O campo "Receber por e-mail (opcional)" saiu daqui: o e-mail
                       opcional ja e pedido na primeira tela, antes de pagar. Menos
                       uma coisa entre o QR e o "pagar", o QR sobe e cabe sem rolar. -->

                  <!-- Uma linha em vez de lista: ela ja decidiu comprar, isto
                       aqui e so lembrete enquanto abre o app do banco. -->
                  <p class="pic-libera">Libera {{ oQueLibera.slice(0, 3).join(', ').toLowerCase() }} e o resto do relatório.</p>
                  <!-- O nome que aparece no app do banco nao e o nosso: e o da
                       empresa que processa o Pix. Sem este aviso, a pessoa ve
                       um nome desconhecido na hora de confirmar e desiste,
                       achando que errou de cobranca.
                       O nome vem do servidor, do provedor DESTA cobranca: com
                       dois adquirentes convivendo, uma constante aqui viraria
                       mentira pra metade das cobrancas. Sem nome confirmado, a
                       linha nao aparece, em vez de chutar. -->
                  <p v-if="pix?.recebedor" class="pic-recebedor">No app do banco, o recebedor aparece como <strong>{{ pix.recebedor }}</strong>, a empresa que processa o Pix para a PlacaCompleta.</p>
                  <p class="pic-selo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <rect x="4" y="10" width="16" height="10" rx="2" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    </svg>
                    <span>Cobrança única via Pix, processada com segurança. Se não conseguirmos gerar o relatório, o estorno é automático.</span>
                  </p>
                  <!-- O copia e cola fica a vista: quem paga do computador
                       precisa dele na tela pra colar no internet banking, e
                       esconder atras de um toque so criava um passo. No
                       celular ele continua atras do toque, porque la o espaco
                       e o que decide se a tela rola ou nao, e o botao de
                       copiar ja resolve. -->
                  <button type="button" class="pic-link pic-link--codigo" @click="mostrarCodigo = !mostrarCodigo">
                    {{ mostrarCodigo ? 'Ocultar o código' : 'Ver o código para colar' }}
                  </button>
                  <div class="pic-codigo" :class="{ 'pic-codigo--aberto': mostrarCodigo }">
                    <p class="pic-brcode">{{ pix?.brCode }}</p>
                    <button type="button" class="pic-codigo__copiar" @click="copiar">
                      {{ copiado ? 'Copiado' : 'Copiar' }}
                    </button>
                  </div>
                </div>
              </div>
              <!-- Homolog: confirma o pagamento sem Pix real (AbacatePay dev). -->
              <button
                v-if="cfg.public.homolog"
                type="button"
                class="pic-btn pic-btn--sim"
                :disabled="loading"
                @click="simular"
              >
                {{ loading ? 'Confirmando...' : 'Confirmar pagamento (simular)' }}
              </button>
            </template>
            <template v-else-if="['pago', 'consultando'].includes(pendingStatus)">
              <h3 class="pic-h">{{ pix?.gratis ? 'Relatório liberado ✓' : 'Pagamento confirmado ✓' }}</h3>
              <!-- Confirmacao do veiculo depois do pagamento: e aqui que a
                   pessoa ve modelo, cor e cidade e tem a chance de dizer que
                   errou a placa, antes de o relatorio virar o assunto. -->
              <div v-if="preview?.encontrado" class="pic-veiculo pic-veiculo--check">
                <strong>{{ preview.marca }} {{ preview.modelo }}</strong>
                <span>
                  {{ [preview.ano, preview.cor, preview.municipio, preview.uf].filter(Boolean).join(' · ') }}
                </span>
                <span class="pic-veiculo__placa">Placa {{ preview.placa }}</span>
              </div>
              <div class="loading-bar"><div class="loading-bar__fill" /></div>
              <p class="pic-hint">Preparando seu relatório...</p>
            </template>
            <!-- Piso de ~40s: recall/multa no registro. Mostra o que esta sendo
                 buscado antes de abrir o relatorio (a navegacao e agendada). -->
            <template v-else-if="piso">
              <h3 class="pic-h">Quase lá ✓</h3>
              <div class="loading-bar"><div class="loading-bar__fill" /></div>
              <p class="pic-hint">{{ piso.msg }}</p>
            </template>
            <!-- 'entregue' precisa de ramo proprio: checarStatus seta o estado e
                 so depois navega, entao o Vue re-renderiza antes da navegacao.
                 Sem isto o status caia no v-else e piscava "Algo deu errado"
                 justo no momento do sucesso. -->
            <template v-else-if="pendingStatus === 'entregue'">
              <h3 class="pic-h">Relatório pronto ✓</h3>
              <div class="loading-bar"><div class="loading-bar__fill" /></div>
              <p class="pic-hint">Abrindo seu relatório...</p>
            </template>
            <!-- Compra no app que nao virou relatorio: o dinheiro esta com a
                 loja, e a devolucao passa por ela. Prometer estorno automatico
                 aqui seria prometer o que nao controlamos. -->
            <template v-else-if="pendingStatus === 'falha_google_play'">
              <h3 class="pic-h">Não conseguimos concluir</h3>
              <p class="pic-hint">
                Sua compra foi registrada, mas não conseguimos gerar o relatório. Já
                fomos avisados e vamos devolver o valor pelo Google Play e falar com
                você. Qualquer coisa, fale com a gente pelo contato do rodapé.
              </p>
              <button type="button" class="pic-btn" @click="fechar">Fechar</button>
            </template>
            <template v-else-if="pendingStatus === 'falha'">
              <h3 class="pic-h">Não conseguimos concluir</h3>
              <p class="pic-hint">
                Não conseguimos concluir a consulta. Se o pagamento foi feito, vamos
                devolver o valor e falar com você pelo e-mail. Qualquer coisa, fale com
                a gente pelo contato do rodapé.
              </p>
              <button type="button" class="pic-btn" @click="fechar">Fechar</button>
            </template>
            <template v-else-if="pendingStatus === 'expirado'">
              <h3 class="pic-h">Pix expirou</h3>
              <button type="button" class="pic-btn pic-btn--primary" @click="step = 'confirm'">
                Gerar novo Pix
              </button>
            </template>
            <template v-else-if="pendingStatus === 'reembolsado'">
              <h3 class="pic-h">Não foi possível concluir</h3>
              <p class="pic-hint">O valor foi reembolsado no seu Pix.</p>
              <button type="button" class="pic-btn" @click="fechar">Fechar</button>
            </template>
            <template v-else>
              <h3 class="pic-h">Algo deu errado</h3>
              <!-- pendingStatus e nome de estado interno; nao vai pra tela. -->
              <p class="pic-hint">Se você já pagou, o relatório libera sozinho. Guarde esta aba ou fale com a gente.</p>
              <button type="button" class="pic-btn" @click="fechar">Fechar</button>
            </template>
          </div>

          <!-- Erro no preview -->
          <div v-else class="pic-stack pic-center">
            <h3 class="pic-h">Não conseguimos continuar</h3>
            <p class="pic-hint">{{ msg }}</p>
            <button type="button" class="pic-btn pic-btn--primary" @click="consultarPreview">
              Tentar de novo
            </button>
            <button type="button" class="pic-btn" @click="fechar">Fechar</button>
          </div>

          <p v-if="msg && step !== 'erro'" class="pic-err">{{ msg }}</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// ============================================================
// Checkout inline, na linguagem visual do .agents/DESIGN-hp.md (a mesma da
// home v2): superficie branca, tinta near-black, um acento azul so, raio 4px
// no interativo e 16px no container, hairline no lugar de sombra pesada.
// Antes herdava a "janela XP" navy do v1, que destoava da pagina inteira.
// ============================================================
$c-canvas: #ffffff;
$c-cloud: #f7f7f7;
$c-hair: #e8e8e8;
$c-steel: #c2c2c2;
$c-ink: #1a1a1a;
$c-charcoal: #3d3d3d;
$c-graphite: #636363;
$c-blue: #1f6feb;
$c-blue-deep: #17539f;
$c-green: #1e9e4a;
$c-red: #d33a3a;
$fonte: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

.pic-overlay {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(26, 26, 26, 0.55);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  overflow-y: auto;
}

.pic-card {
  width: 100%;
  max-width: 460px;

  &--largo {
    @media (min-width: 900px) { max-width: 720px; }
  }
  background: $c-canvas;
  border: 1px solid $c-hair;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(26, 26, 26, 0.12);
  font-family: $fonte;
  color: $c-ink;
  line-height: 1.4;
  overflow: hidden;
  margin: auto;
}

.pic-topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 12px 14px 20px;
  border-bottom: 1px solid $c-hair;
}

.pic-titulo {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: $c-graphite;
}

.pic-x {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 0;
  color: $c-ink;
  cursor: pointer;
  border-radius: 4px;

  svg { width: 20px; height: 20px; }
  &:hover { background: $c-cloud; }
  &:focus-visible { outline: 2px solid $c-blue; outline-offset: -2px; }
}

.pic-body { padding: 20px; }
.pic-stack { display: flex; flex-direction: column; gap: 14px; }
.pic-center { text-align: center; display: flex; flex-direction: column; gap: 14px; }

.pic-h {
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1.17;
  color: $c-ink;
  margin: 0;
}

.pic-hint { font-size: 14px; line-height: 1.45; color: $c-charcoal; margin: 0; }
// Frase que tira o medo de pagar e perder a tela: precisa pesar mais que uma
// dica comum, por isso vem depois de .pic-hint (mesma especificidade, ganha).
.pic-hint--forte { color: $c-ink; font-weight: 600; }
// Linha-helper logo abaixo da CTA: reasseguranca discreta e centrada, colada
// no botao (o stack tem gap, por isso o margin-top negativo aproxima).
.pic-hint--cta { text-align: center; font-size: 13px; margin-top: -4px; }
.pic-aviso { font-size: 13px; line-height: 1.4; color: #b45309; margin: 6px 0 0; }
.pic-btn--sim { border: 1px dashed #b45309; color: #b45309; background: #fff7ed; }
.pic-lead { font-size: 15px; line-height: 1.45; color: $c-charcoal; margin: 0; }

// veiculo confirmado
.pic-veiculo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: $c-cloud;
  border: 1px solid $c-hair;
  border-radius: 8px;
  padding: 12px 14px;
  text-align: left;

  strong { font-size: 16px; font-weight: 500; color: $c-ink; }
  span { font-size: 13px; color: $c-graphite; }
}
.pic-veiculo--check { border-left: 3px solid $c-green; }
.pic-veiculo__placa { font-size: 12px; letter-spacing: 0.06em; }

// Faixa de resumo (opcao 04): 2 colunas, carro x preco/plano. Le de uma olhada.
.pic-faixa {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 12px;
  align-items: center;
  background: $c-cloud;
  border: 1px solid $c-hair;
  border-radius: 12px;
  padding: 10px 12px;
}
.pic-faixa__veic {
  font-size: 14px;
  font-weight: 600;
  color: $c-ink;
  min-width: 0;
  line-height: 1.3;
  // Ate 2 linhas em vez de reticencia: "CHEVROLET S10 LTZ 2.8 4X4" inteiro.
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.pic-faixa__preco {
  display: inline-flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 6px;
  text-align: right;

  b { font-size: 18px; font-weight: 800; color: $c-ink; font-variant-numeric: tabular-nums; }
}
.pic-faixa__de { font-size: 12px; color: $c-steel; text-decoration: line-through; }
.pic-faixa__sub {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: $c-graphite;
}
.pic-faixa__placa { font-weight: 600; letter-spacing: 0.04em; color: $c-ink; }
.pic-faixa__plano { text-align: right; font-size: 12px; color: $c-graphite; }
// Seletor duplo de proposito: o .pic-lapis base vem DEPOIS no arquivo e, com a
// mesma especificidade, ganhava (40px/18px). O alvo de toque continua ~40px
// pelo ::after invisivel, sem inflar a linha.
.pic-lapis.pic-lapis--faixa {
  position: relative;
  width: 20px;
  height: 20px;
  border-radius: 4px;

  svg { width: 12px; height: 12px; }
  &::after { content: ''; position: absolute; inset: -10px; }
}

// resumo do pedido: o que, pra qual placa, por quanto
// ---- confianca ----
// Regra do bloco: hairline e tinta, nunca um mural de selos coloridos. O unico
// desvio de cor e o escudo do estorno, que e a garantia mais forte e a unica
// que merece peso visual.
.pic-conf {
  list-style: none;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid $c-hair;
  border-radius: 8px;
  background: $c-cloud;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 13px;
    line-height: 1.45;
    color: $c-graphite;

    svg {
      width: 17px;
      height: 17px;
      flex-shrink: 0;
      margin-top: 1px;
      color: $c-steel;
    }

    strong { color: $c-ink; font-weight: 700; }
  }

  &__item--forte {
    color: $c-charcoal;
    svg { color: $c-green; }
  }
}

// ---- tela do Pix ----
.pic-prazo {
  margin: 0;
  font-size: 13px;
  color: $c-graphite;

  strong {
    font-variant-numeric: tabular-nums;
    color: $c-ink;
  }
}

.pic-libera {
  width: 100%;
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: $c-charcoal;
  text-align: left;
}

.pic-recebedor {
  width: 100%;
  margin: 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: $c-graphite;
  text-align: left;

  strong { color: $c-ink; font-weight: 600; }
}

.pic-selo {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  text-align: left;
  color: $c-graphite;

  svg {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
    margin-top: 1px;
    color: $c-steel;
  }
}

.pic-lapis {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: $c-cloud;
  border: 1px solid $c-hair;
  border-radius: 4px;
  color: $c-blue;
  cursor: pointer;

  svg { width: 18px; height: 18px; }
  &:hover { background: $c-canvas; border-color: $c-blue; }
  &:focus-visible { outline: 2px solid $c-blue; outline-offset: 2px; }
}
.pic-input--placa {
  text-align: center;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

// A placa e o que a pessoa mais precisa reconferir antes de pagar: ganha
// tratamento de placa mesmo, nao de linha de tabela.
.pic-placa-destaque {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px;
  border: 2px solid $c-ink;
  border-radius: 8px;

  span { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: $c-graphite; }
  strong { font-size: 28px; font-weight: 800; letter-spacing: 0.12em; color: $c-ink; }
}

// campos
.pic-campo { display: flex; flex-direction: column; gap: 6px; text-align: left; }
.pic-label { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: $c-graphite; }
.pic-input {
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  font-family: $fonte;
  font-size: 16px;
  color: $c-ink;
  background: $c-canvas;
  border: 1px solid $c-steel;
  border-radius: 4px;

  &::placeholder { color: $c-steel; }
  // guia: foco troca a borda por tinta, sem halo
  &:focus { outline: none; border-color: $c-ink; }
  &:focus-visible { outline: 2px solid $c-blue; outline-offset: 2px; }
}

// botoes: raio 4px, caixa alta, 0.7px de tracking, 44px de altura
.pic-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 44px;
  padding: 12px 24px;
  font-family: $fonte;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.7px;
  text-transform: uppercase;
  color: $c-ink;
  background: $c-canvas;
  border: 1px solid $c-ink;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover { background: $c-cloud; }
  &:focus-visible { outline: 2px solid $c-blue; outline-offset: 2px; }
  &:disabled { border-color: $c-steel; color: $c-steel; cursor: default; }

  &--primary {
    background: $c-blue;
    border-color: $c-blue;
    color: #fff;

    &:hover { background: $c-blue-deep; border-color: $c-blue-deep; }
    &:disabled { background: $c-steel; border-color: $c-steel; color: #fff; }
  }

  svg { flex-shrink: 0; }
}

// Abas de pagamento (Pix | Cartao), no nosso estilo (azul da marca, nada roxo).
.pic-tabs {
  display: flex;
  gap: 8px;
  margin: 4px 0 14px;
}
.pic-tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 46px;
  padding: 10px 12px;
  font-family: $fonte;
  font-size: 14px;
  font-weight: 600;
  color: $c-charcoal;
  background: $c-canvas;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover { border-color: $c-steel; }
  &:focus-visible { outline: 2px solid $c-blue; outline-offset: 2px; }

  // Aba ativa: preenchida com o azul da marca.
  &--on {
    color: #fff;
    background: $c-blue;
    border-color: $c-blue;
    &:hover { border-color: $c-blue; }
  }
}

// Formulario do cartao (Stripe Elements montado nos .pic-stripe-el).
.pic-cartao-form { display: flex; flex-direction: column; }
.pic-card-linha {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
// O Stripe monta um iframe dentro; a caixa precisa da MESMA cara do input, com
// padding vertical que centre o campo (o iframe nao herda o line-height).
.pic-stripe-el {
  display: block;
  padding-top: 13px;
  padding-bottom: 13px;
}
.pic-cartao-seguro {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  text-align: center;
  font-size: 12px;
  color: $c-steel;
  margin-top: 12px;

  svg { flex-shrink: 0; color: $c-steel; }
}

.pic-link {
  background: transparent;
  border: 0;
  color: $c-blue;
  font-family: $fonte;
  font-size: 14px;
  text-decoration: underline;
  cursor: pointer;
  padding: 8px;
  min-height: 44px;
}

.pic-cupom { display: flex; flex-direction: column; }
.pic-link--cupom { align-self: flex-start; padding: 4px 0; min-height: auto; }
.pic-cupom__ok { font-size: 13px; color: $c-green; margin: 2px 0 0; }
.pic-cupom__erro { font-size: 13px; color: $c-red; margin: 2px 0 0; }

.pic-err { font-size: 14px; line-height: 1.4; color: $c-red; margin: 12px 0 0; }
.pic-qr {
  width: 170px;
  height: 170px;
  align-self: center;
  border-radius: 8px;
  border: 1px solid $c-hair;

  // No desktop ha espaco pra um QR que se le de longe, com o celular na mao.
  @media (min-width: 900px) {
    width: 220px;
    height: 220px;
    align-self: stretch;
  }
}

// Duas colunas no desktop: o que a pessoa TOCA (QR e copiar) de um lado, o que
// ela LE (aviso, e-mail, garantia) do outro. Empilhado, isso passava de mil
// pixels de altura e obrigava a rolar no meio do pagamento.
.pic-pix {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;

  &__acao,
  &__info {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  @media (min-width: 900px) {
    display: grid;
    // Coluna esquerda com a largura do QR: assim o botao de copiar e o prazo
    // ficam do tamanho dele, em vez de flutuarem soltos.
    grid-template-columns: 220px 1fr;
    grid-template-areas:
      "acao titulo"
      "acao info";
    align-items: start;
    column-gap: 22px;
    row-gap: 12px;

    .pic-h--pix { grid-area: titulo; align-self: start; margin: 0; }
    &__acao { grid-area: acao; }
    &__info { grid-area: info; text-align: left; }
  }
}

.pic-h--pix { margin-bottom: 10px; }

.pic-link--codigo {
  align-self: flex-start;
  font-size: 12.5px;

  // No desktop o codigo ja esta na tela, entao o link nao tem o que revelar.
  @media (min-width: 900px) { display: none; }
}

// Caixa do copia e cola. No celular so aparece quando a pessoa pede; no
// desktop esta sempre visivel.
.pic-codigo {
  display: none;
  gap: 8px;
  align-items: flex-start;
  width: 100%;

  &--aberto { display: flex; }

  @media (min-width: 900px) { display: flex; }

  &__copiar {
    flex: 0 0 auto;
    align-self: stretch;
    padding: 0 12px;
    border: 1px solid $c-ink;
    border-radius: 4px;
    background: $c-canvas;
    font-family: $fonte;
    font-size: 12px;
    font-weight: 600;
    color: $c-ink;
    cursor: pointer;

    &:hover { background: $c-cloud; }
    &:focus-visible { outline: 2px solid $c-blue; outline-offset: 2px; }
  }
}

// Telas baixas (o 780 de altura do pedido): tudo encolhe um degrau em vez de
// virar scroll. Um QR de 140px ainda le bem em qualquer camera.
@media (max-height: 800px) {
  .pic-qr { width: 140px; height: 140px; }
  .pic-pix { gap: 10px; }
  .pic-pix__acao, .pic-pix__info { gap: 8px; }
}
.pic-brcode {
  flex: 1 1 auto;
  min-width: 0;
  // Monoespacada: o codigo e pra ser conferido caractere a caractere quando
  // alguem cola no internet banking, e fonte proporcional confunde 0 com O.
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.4;
  color: $c-graphite;
  word-break: break-all;
  background: $c-cloud;
  border: 1px solid $c-hair;
  border-radius: 8px;
  padding: 10px;
  margin: 0;
  text-align: left;
}

// barra de progresso do "preparando o relatorio"
.loading-bar {
  height: 4px;
  border-radius: 999px;
  background: $c-hair;
  overflow: hidden;
}
.loading-bar__fill {
  height: 100%;
  width: 40%;
  border-radius: 999px;
  background: $c-blue;
  animation: pic-desliza 1.1s ease-in-out infinite;
}
@keyframes pic-desliza {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
@media (prefers-reduced-motion: reduce) {
  .loading-bar__fill { animation: none; width: 100%; }
}
</style>
