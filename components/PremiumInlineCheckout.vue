<script setup lang="ts">
import { PLANOS, RECURSOS } from '~/shared/planos'
import { origemDaSessao } from '~/shared/origem-trafego'

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
}>(), {
  plano: 'completa',
  jaConsultada: false,
})
const emit = defineEmits<{ close: [] }>()

const cfg = useRuntimeConfig()

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
  if (/ja usou/i.test(motivo)) return 'Este cupom já foi utilizado por este e-mail.'
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
      body: { codigo, plano: props.plano, email: temEmail ? email.value : undefined, placa: placaClean.value },
    })
    if (r?.ok) {
      cupomDescontoCentavos.value = r.descontoCentavos || 0
      cupomMsg.value = cupomDescontoCentavos.value > 0 ? 'Cupom aplicado!' : ''
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
const { trackBeginCheckout, trackAddPaymentInfo, trackConversionPaga } = useAnalytics()

const reais = (c: number) => 'R$ ' + (c / 100).toFixed(2).replace('.', ',')

const planoInfo = computed(() => PLANOS[props.plano])
// O botao diz o que a pessoa leva, nao so o que ela paga: o preco sozinho e
// custo puro; com o desfecho junto, o clique tem um motivo.
const rotuloPagar = computed(() => {
  if (loading.value) return cupomGratis.value ? 'Liberando...' : 'Gerando Pix...'
  if (cupomGratis.value) return 'Liberar relatório grátis'
  return `Pagar ${reais(precoExibidoCentavos.value)} e ver o ${planoInfo.value.nome.toLowerCase()}`
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
    const saved = localStorage.getItem('pc_email')
    if (saved) email.value = saved
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
      msg.value = e?.statusCode === 404
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
async function confirmarEPagar() {
  // E-mail so vira obrigatorio aqui, no clique final: quem digita o cupom
  // antes do e-mail nao leva erro no meio do caminho.
  emailErro.value = ''
  if (!email.value.includes('@')) {
    emailErro.value = 'Informe um e-mail válido para receber o relatório.'
    msg.value = ''
    if (import.meta.client) {
      const campo = document.getElementById('pic-email') as HTMLInputElement | null
      campo?.focus()
    }
    return
  }
  msg.value = ''
  // Revalida o cupom AGORA com o e-mail (limite por pessoa) e espera terminar
  // antes de cobrar — senao a pessoa geraria um Pix com um preco que ja mudou.
  // Se o cupom cair aqui, nao cobra: ela precisa ver que o preco voltou ao
  // cheio antes de confirmar. Nada que ela digitou se perde.
  if (cupomCodigo.value.trim()) {
    loading.value = true
    const ok = await validarCupom()
    loading.value = false
    if (!ok) {
      cupomAberto.value = true
      return
    }
  }
  editandoPlaca.value = false
  // Passo do meio do funil: registra a intencao ANTES da chamada do checkout,
  // pra falha de rede na geracao do Pix nao virar "ninguem clicou".
  trackAddPaymentInfo(props.plano, placaClean.value, precoExibidoCentavos.value)
  await pagar()
}

async function pagar() {
  if (!email.value.includes('@')) {
    msg.value = 'Informe um e-mail válido.'
    return
  }
  loading.value = true
  msg.value = ''
  // Revalida o cupom bem antes de pagar (pode ter esgotado/expirado desde o
  // blur). Se cair, segue a compra sem cupom em vez de travar o pagamento.
  if (cupomCodigo.value.trim()) await validarCupom()
  try {
    pix.value = await $fetch('/api/premium/checkout', {
      method: 'POST',
      body: {
        placa: preview.value.placa,
        email: email.value,
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
      },
    })
    step.value = 'pending'
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
      irParaRelatorio(pix.value.token)
    }
    if (['expirado', 'falha', 'reembolsado'].includes(r.status) && poll) clearInterval(poll)
  } catch {
    /* segue tentando */
  }
}

function copiar() {
  if (pix.value?.brCode) navigator.clipboard?.writeText(pix.value.brCode)
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
  emit('close')
}

onUnmounted(() => {
  if (poll) clearInterval(poll)
  if (tickRestante) clearInterval(tickRestante)
})
</script>

<template>
  <div class="pic-overlay" role="dialog" aria-modal="true" aria-labelledby="pic-titulo" @click="fechar">
    <div class="pic-card" @click.stop>
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
            <h3 class="pic-h">{{ jaConsultada ? 'Pagar e liberar o relatório' : 'É este veículo?' }}</h3>
            <div v-if="preview?.encontrado" class="pic-veiculo">
              <strong>{{ preview.marca }} {{ preview.modelo }}</strong>
              <span>{{ preview.ano }} · {{ preview.cor }} · placa {{ preview.placa }}</span>
            </div>
            <div v-else class="pic-veiculo">
              Não achamos os dados básicos, mas você pode seguir com a placa {{ preview?.placa }}.
            </div>
            <!-- Sem a lista item a item: quem chegou aqui ja viu o que entra
                 no comparativo e no bloco bloqueado. Aqui basta dizer o que
                 esta sendo comprado, por quanto e pra qual placa. -->
            <div class="pic-resumo">
              <span class="pic-resumo__linha">
                <span>Relatório</span><strong>{{ planoInfo.nome }}</strong>
              </span>
              <span class="pic-resumo__linha">
                <span>Placa</span>
                <!-- Unico dado que a pessoa digitou, e o unico que, errado,
                     faz ela pagar pelo carro de outro: a correcao mora aqui,
                     na propria linha, em vez de ocupar uma tela inteira. -->
                <span class="pic-resumo__placa-linha">
                  <strong class="pic-resumo__placa">{{ placaClean }}</strong>
                  <button type="button" class="pic-lapis" aria-label="Corrigir a placa" @click="abrirEdicao">
                    <!-- lapis do Feather (edit-2) -->
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </button>
                </span>
              </span>
              <span v-if="cupomValido" class="pic-resumo__linha">
                <span>Cupom</span><strong>-{{ reais(cupomDescontoCentavos) }}</strong>
              </span>
              <span class="pic-resumo__linha pic-resumo__linha--total">
                <span>Total</span><strong>{{ reais(precoExibidoCentavos) }}</strong>
              </span>
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
                 checkout de quem nao tem cupom. -->
            <div class="pic-cupom">
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
            <div class="pic-campo">
              <label class="pic-label" for="pic-email">Seu e-mail (para receber o relatório)</label>
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
            <!-- Faixa de confianca: as tres duvidas que travam o clique
                 (e se o carro nao aparecer? vai virar assinatura? quem
                 processa o Pix?), respondidas com o que o produto ja
                 faz de verdade. Nada de prova social inventada. -->
            <ul class="pic-conf">
              <li class="pic-conf__item pic-conf__item--forte">
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
              <li class="pic-conf__item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 2 3 6v5c0 5 3.8 9.4 9 11 5.2-1.6 9-6 9-11V6Z" />
                </svg>
                <span>Pix processado pela Woovi. Seus dados trafegam protegidos.</span>
              </li>
              <li v-if="props.plano === 'completa'" class="pic-conf__item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4 20h16" />
                  <path d="M6 20V9l6-4 6 4v11" />
                  <path d="M10 20v-5h4v5" />
                </svg>
                <span>Inclui o histórico de leilão, cruzado com uma base de <strong>mais de 1 milhão de veículos leiloados</strong>.</span>
              </li>
            </ul>
            <button type="button" class="pic-btn pic-btn--primary" :disabled="loading || editandoPlaca" @click="confirmarEPagar">
              {{ rotuloPagar }}
            </button>
            <button type="button" class="pic-btn" @click="fechar">Cancelar</button>
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
            <template v-else-if="pendingStatus === 'aguardando_pagamento'">
              <h3 class="pic-h">Pague com Pix para liberar</h3>
              <!-- Na hora de pagar a pessoa precisa reconferir o que esta
                   levando: tipo de relatorio, valor e, sobretudo, a placa. -->
              <div class="pic-resumo">
                <span class="pic-resumo__linha">
                  <span>Relatório</span><strong>{{ planoInfo.nome }}</strong>
                </span>
                <span class="pic-resumo__linha pic-resumo__linha--total">
                  <span>Total</span><strong>{{ reais(pix?.valor ?? planoInfo.valorCentavos) }}</strong>
                </span>
              </div>
              <div class="pic-placa-destaque">
                <span>Consultando a placa</span>
                <strong>{{ placaClean }}</strong>
              </div>
              <img v-if="pix?.brCodeBase64" :src="pix.brCodeBase64" alt="QR Code Pix" class="pic-qr">
              <p v-if="tempoRestante" class="pic-prazo">
                Este Pix vale por <strong>{{ tempoRestante }}</strong>. Depois disso é só gerar outro.
              </p>
              <button type="button" class="pic-btn" @click="copiar">
                Copiar código Pix (copia e cola)
              </button>
              <p class="pic-hint pic-hint--forte">Pode deixar esta tela aberta: assim que o pagamento cair, o relatório abre sozinho aqui.</p>

              <!-- Enquanto ela abre o app do banco, a tela lembra o que esta
                   comprando. Os itens saem da lista de recursos do plano, nao
                   de uma promessa escrita a mao aqui. -->
              <div class="pic-libera">
                <p class="pic-libera__tit">Assim que o pagamento cair, você vê</p>
                <ul class="pic-libera__lista">
                  <li v-for="item in oQueLibera" :key="item">{{ item }}</li>
                </ul>
              </div>
              <p class="pic-brcode">{{ pix?.brCode }}</p>
              <p class="pic-selo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <span>Cobrança única de {{ reais(pix?.valor ?? planoInfo.valorCentavos) }} via Pix, processada pela Woovi. Se não conseguirmos gerar seu relatório, o estorno é automático.</span>
              </p>
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
            <!-- 'entregue' precisa de ramo proprio: checarStatus seta o estado e
                 so depois navega, entao o Vue re-renderiza antes da navegacao.
                 Sem isto o status caia no v-else e piscava "Algo deu errado"
                 justo no momento do sucesso. -->
            <template v-else-if="pendingStatus === 'entregue'">
              <h3 class="pic-h">Relatório pronto ✓</h3>
              <div class="loading-bar"><div class="loading-bar__fill" /></div>
              <p class="pic-hint">Abrindo seu relatório...</p>
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
  border: 1px solid $c-hair;
  border-radius: 8px;
  padding: 12px 14px;
  text-align: left;

  &__tit {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: $c-graphite;
  }

  &__lista {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;

    li {
      position: relative;
      padding-left: 20px;
      font-size: 14px;
      line-height: 1.4;
      color: $c-charcoal;

      &::before {
        content: '';
        position: absolute;
        left: 4px;
        top: 8px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: $c-blue;
      }
    }
  }
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

.pic-resumo {
  display: flex;
  flex-direction: column;
  border: 1px solid $c-hair;
  border-radius: 8px;
  overflow: hidden;
  text-align: left;

  &__linha {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid $c-hair;
    font-size: 14px;
    color: $c-graphite;

    &:last-child { border-bottom: 0; }
    strong { font-size: 15px; font-weight: 500; color: $c-ink; text-align: right; }
  }

  &__placa { letter-spacing: 0.08em; }

  // Placa + lapis na mesma linha do resumo: o botao encolhe pra caber na
  // altura da linha, em vez do alvo de 40px que ele tinha na tela dedicada.
  &__placa-linha {
    display: inline-flex;
    align-items: center;
    gap: 8px;

    .pic-lapis { width: 30px; height: 30px; }
    .pic-lapis svg { width: 15px; height: 15px; }
  }

  &__linha--total {
    background: $c-cloud;
    strong { font-size: 20px; font-weight: 500; color: $c-ink; }
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
.pic-qr { width: 190px; height: 190px; align-self: center; border-radius: 8px; border: 1px solid $c-hair; }
.pic-brcode {
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
