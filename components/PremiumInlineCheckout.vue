<script setup lang="ts">
// Checkout premium inline: roda o fluxo pago SEM sair da home, num overlay.
// Espelha a logica de pages/premium/index.vue (gate -> preview -> checkout ->
// poll status -> navega pro relatorio). Recebe a placa ja digitada no herbi da
// home. Mantem o gate por senha do homolog (cookie httpOnly seta pelo server;
// so pede a senha uma vez, quando o preview volta 401).
//
// Nao revela fonte dos dados em nenhum texto.

const props = defineProps<{ placa: string }>()
const emit = defineEmits<{ close: [] }>()

type Step = 'loading' | 'gate' | 'confirm' | 'pending' | 'erro'
const step = ref<Step>('loading')
const loading = ref(false)
const msg = ref('')

const senha = ref('')
const email = ref('')
const telefone = ref('')
const preview = ref<any>(null)

const pix = ref<{ brCode: string; brCodeBase64: string; token: string; valor: number } | null>(null)
const pendingStatus = ref('aguardando_pagamento')
let poll: ReturnType<typeof setInterval> | null = null

// historico local: religar/retomar consultas sem login
const { add: histAdd, updateStatus: histUpdate } = useConsultaHistory()

const reais = (c: number) => 'R$ ' + (c / 100).toFixed(2).replace('.', ',')

const placaClean = computed(() =>
  String(props.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7),
)

// Pre-preenche email salvo do fluxo grativo (mesmo navegador)
onMounted(() => {
  if (import.meta.client) {
    const saved = localStorage.getItem('pc_email')
    if (saved) email.value = saved
  }
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
    // 401 => precisa passar pelo gate de homologacao
    if (e?.statusCode === 401 || e?.status === 401 || e?.response?.status === 401) {
      step.value = 'gate'
    } else {
      msg.value = e?.data?.message || 'Não foi possível consultar esta placa.'
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

async function pagar() {
  if (!email.value.includes('@')) {
    msg.value = 'Informe um e-mail válido.'
    return
  }
  loading.value = true
  msg.value = ''
  try {
    pix.value = await $fetch('/api/premium/checkout', {
      method: 'POST',
      body: {
        placa: preview.value.placa,
        email: email.value,
        telefone: telefone.value,
        preview: preview.value.raw,
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
  } catch (e: any) {
    msg.value = e?.data?.message || 'Falha ao gerar o Pix.'
  } finally {
    loading.value = false
  }
}

async function checarStatus() {
  if (!pix.value) return
  try {
    const r: any = await $fetch('/api/premium/status', { query: { token: pix.value.token } })
    pendingStatus.value = r.status
    histUpdate(pix.value.token, r.status)
    if (r.status === 'entregue') {
      if (poll) clearInterval(poll)
      navigateTo(`/premium/${pix.value.token}`)
    }
    if (['expirado', 'falha', 'reembolsado'].includes(r.status) && poll) clearInterval(poll)
  } catch {
    /* segue tentando */
  }
}

function copiar() {
  if (pix.value) navigator.clipboard?.writeText(pix.value.brCode)
}

function fechar() {
  emit('close')
}

onUnmounted(() => {
  if (poll) clearInterval(poll)
})
</script>

<template>
  <div class="modal-overlay" @click="fechar">
    <div class="modal-window" @click.stop>
      <div class="win-window">
        <div class="win-window__titlebar">
          <span>Relatório completo · {{ placaClean }}</span>
          <div class="win-window__titlebar-buttons">
            <span
              class="win-window__titlebar-btn win-window__titlebar-btn--active"
              role="button"
              aria-label="Fechar"
              @click="fechar"
            >×</span>
          </div>
        </div>
        <div class="win-window__body pic-body">
          <!-- Carregando preview -->
          <div v-if="step === 'loading'" class="pic-center">
            <div class="loading-bar"><div class="loading-bar__fill" /></div>
            <p class="pic-hint">Consultando a placa {{ placaClean }}...</p>
          </div>

          <!-- Gate por senha (homologacao) -->
          <div v-else-if="step === 'gate'" class="pic-stack">
            <p class="pic-lead">Área em homologação. Informe a senha de acesso para continuar.</p>
            <div class="form-group">
              <label class="form-group__label" for="pic-senha">Senha</label>
              <input
                id="pic-senha"
                v-model="senha"
                type="password"
                class="win-input"
                placeholder="Senha"
                @keyup.enter="entrar"
              >
            </div>
            <button type="button" class="win-btn win-btn--primary win-btn--block" :disabled="loading" @click="entrar">
              {{ loading ? 'Entrando...' : 'Entrar' }}
            </button>
          </div>

          <!-- Confirmar veiculo + coletar contato -->
          <div v-else-if="step === 'confirm'" class="pic-stack">
            <h3 class="pic-h">É este veículo?</h3>
            <div v-if="preview?.encontrado" class="pic-veiculo">
              <strong>{{ preview.marca }} {{ preview.modelo }}</strong>
              <span>{{ preview.ano }} · {{ preview.cor }} · placa {{ preview.placa }}</span>
            </div>
            <div v-else class="pic-veiculo">
              Não achamos os dados básicos, mas você pode seguir com a placa {{ preview?.placa }}.
            </div>
            <p class="pic-inclui">
              O relatório completo inclui restrições, roubo/furto, gravame, leilão, recall, RENAJUD,
              a ficha completa do veículo, valor FIPE, seguro estimado e o custo em 5 anos.
            </p>
            <div class="form-group">
              <label class="form-group__label" for="pic-email">Seu e-mail (para receber o relatório)</label>
              <input
                id="pic-email"
                v-model="email"
                type="email"
                class="win-input"
                placeholder="seu@email.com"
                autocomplete="email"
                inputmode="email"
              >
            </div>
            <div class="form-group">
              <label class="form-group__label form-group__label--optional" for="pic-tel">WhatsApp</label>
              <input
                id="pic-tel"
                v-model="telefone"
                type="tel"
                class="win-input"
                placeholder="(11) 91234-5678"
                autocomplete="tel"
                inputmode="tel"
              >
            </div>
            <button type="button" class="win-btn win-btn--primary win-btn--block" :disabled="loading" @click="pagar">
              {{ loading ? 'Gerando Pix...' : `Pagar ${reais(4500)} via Pix` }}
            </button>
            <button type="button" class="win-btn win-btn--block" @click="fechar">Cancelar</button>
          </div>

          <!-- Pagamento Pix + polling -->
          <div v-else-if="step === 'pending'" class="pic-stack pic-center">
            <template v-if="pendingStatus === 'aguardando_pagamento'">
              <h3 class="pic-h">Pague com Pix para liberar</h3>
              <img v-if="pix?.brCodeBase64" :src="pix.brCodeBase64" alt="QR Code Pix" class="pic-qr">
              <button type="button" class="win-btn win-btn--block" @click="copiar">
                Copiar código Pix (copia e cola)
              </button>
              <p class="pic-brcode">{{ pix?.brCode }}</p>
              <p class="pic-hint">Assim que o pagamento cair, o relatório é liberado automaticamente.</p>
            </template>
            <template v-else-if="['pago', 'consultando'].includes(pendingStatus)">
              <h3 class="pic-h">Pagamento confirmado ✓</h3>
              <div class="loading-bar"><div class="loading-bar__fill" /></div>
              <p class="pic-hint">Preparando seu relatório completo...</p>
            </template>
            <template v-else-if="pendingStatus === 'expirado'">
              <h3 class="pic-h">Pix expirou</h3>
              <button type="button" class="win-btn win-btn--primary win-btn--block" @click="step = 'confirm'">
                Gerar novo Pix
              </button>
            </template>
            <template v-else-if="pendingStatus === 'reembolsado'">
              <h3 class="pic-h">Não foi possível concluir</h3>
              <p class="pic-hint">O valor foi reembolsado no seu Pix.</p>
              <button type="button" class="win-btn win-btn--block" @click="fechar">Fechar</button>
            </template>
            <template v-else>
              <h3 class="pic-h">Algo deu errado</h3>
              <p class="pic-hint">{{ pendingStatus }}</p>
              <button type="button" class="win-btn win-btn--block" @click="fechar">Fechar</button>
            </template>
          </div>

          <!-- Erro no preview -->
          <div v-else class="pic-stack pic-center">
            <h3 class="pic-h">Não deu certo</h3>
            <p class="pic-hint">{{ msg }}</p>
            <button type="button" class="win-btn win-btn--primary win-btn--block" @click="consultarPreview">
              Tentar de novo
            </button>
            <button type="button" class="win-btn win-btn--block" @click="fechar">Fechar</button>
          </div>

          <p v-if="msg && step !== 'erro'" class="pic-err">{{ msg }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Reaproveita .modal-overlay / .modal-window / .win-window (globais em main.scss).
.pic-body {
  text-align: left;
}

.pic-stack {
  display: flex;
  flex-direction: column;
  gap: $space-sm;
}

.pic-center {
  text-align: center;
  align-items: center;
}

.pic-h {
  font-family: $font-display;
  font-size: 1.0625rem;
  font-weight: 700;
  color: $prussian-blue;
  margin: 0 0 $space-xs;
}

.pic-lead {
  font-size: 0.875rem;
  color: $graphite;
  margin: 0;
}

.pic-veiculo {
  @include win-border-sunken;
  background: $surface-alt;
  padding: 12px;
  font-size: 0.9375rem;
  color: $prussian-blue-3;

  strong { display: block; }
  span { color: $blue-slate; font-size: 0.8125rem; }
}

.pic-inclui {
  color: $blue-slate;
  font-size: 0.8125rem;
  margin: 0;
  line-height: 1.5;
}

.pic-qr {
  width: 220px;
  height: 220px;
  align-self: center;
  background: #fff;
  border-radius: 8px;
}

.pic-brcode {
  color: $slate-grey;
  font-size: 0.6875rem;
  word-break: break-all;
  margin: 0;
  font-family: $font-mono;
}

.pic-hint {
  color: $blue-slate;
  font-size: 0.8125rem;
  margin: 0;
}

.pic-err {
  color: $error-red;
  font-size: 0.8125rem;
  margin: $space-sm 0 0;
}
</style>
