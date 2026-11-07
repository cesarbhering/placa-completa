<script setup lang="ts">
// Aviso "Seu relatorio esta pronto": relatorio pago que a pessoa ainda nao
// abriu neste aparelho (historico local, useConsultaHistory). Pedido do Cesar
// (nov/2026): compra feita, relatorio entregue, e a pessoa nunca voltou pra ver.
//
// Onde: app (Capacitor) e site no celular. Desktop e tablet nao. Nunca nas
// paginas /premium (inclusive a do proprio relatorio).
// Quando: uma vez por sessao da pagina para cada relatorio (sessionStorage),
// de novo quando o app volta do segundo plano, ate a pessoa abrir. Sem "nao
// mostrar mais". Item que chega depois (rodada da recuperacao do Google Play)
// reabre o aviso na hora.
import { ehCelular } from '~/shared/ab-checkout'
import { EVENTO_RESUME } from '~/composables/useRecuperacaoPlay'
import {
  aConferir, gravarMostrados, lerMostrados, relatoriosPendentes, rotaSemAviso, tokensParaAvisar,
} from '~/shared/relatorio-pendente'

const { itens, sync, updateStatus, marcarAberto } = useConsultaHistory()
const { isCapacitor } = useAppMode()
const { aviso, checkoutAberto } = useRecuperacaoPlay()
const modalConsultas = useState('pc-consultas-aberto', () => false)
const route = useRoute()
const { t } = useIdioma()

const celular = ref(false)
const mostrados = ref<string[]>([])
const aberto = ref(false)

const sessao = () => { try { return window.sessionStorage } catch { return null } }

const pendentes = computed(() => relatoriosPendentes(itens.value))
const visivel = computed(() => aberto.value && pendentes.value.length > 0 && !rotaSemAviso(route.path))
const varios = computed(() => pendentes.value.length > 1)

const novos = computed(() => tokensParaAvisar({
  itens: itens.value,
  path: route.path,
  elegivel: isCapacitor.value || celular.value,
  checkoutAberto: checkoutAberto.value || modalConsultas.value,
  jaMostrados: mostrados.value,
}))

watch(novos, (tokens) => {
  if (!tokens.length) return
  mostrados.value = [...mostrados.value, ...tokens]
  gravarMostrados(sessao(), mostrados.value)
  aberto.value = true
})

// O toast da recuperacao do Play diria a mesma coisa por baixo do modal.
watch(visivel, (v) => {
  if (v && aviso.value && pendentes.value.some((p) => p.token === aviso.value?.token)) aviso.value = null
})

// Pedido pago que a pessoa largou antes de ficar pronto: o status local parou
// em pago/consultando. Uma pergunta leve ao servidor (/api/premium/status so
// le nesses estados) e, se ja ficou pronto, ele entra no aviso.
async function conferirStatus() {
  for (const it of aConferir(itens.value).slice(0, 3)) {
    try {
      const r: any = await $fetch('/api/premium/status', { query: { token: it.token } })
      if (r?.status && r.status !== it.status) updateStatus(it.token, r.status)
    } catch { /* sem rede: fica pra proxima visita */ }
  }
}

// App de volta do segundo plano: vale como nova abertura.
let escondido = false
function aoVoltar() {
  mostrados.value = []
  gravarMostrados(sessao(), [])
  sync()
  conferirStatus()
}
function aoMudarVisibilidade() {
  if (!isCapacitor.value) return
  if (document.visibilityState === 'hidden') { escondido = true; return }
  if (escondido) { escondido = false; aoVoltar() }
}
function aoResume() { if (isCapacitor.value) aoVoltar() }

onMounted(() => {
  const nav: any = window.navigator
  celular.value = ehCelular(String(nav?.userAgent || ''), nav?.userAgentData?.mobile)
  mostrados.value = lerMostrados(sessao())
  sync()
  if (isCapacitor.value || celular.value) conferirStatus()
  document.addEventListener('visibilitychange', aoMudarVisibilidade)
  window.addEventListener(EVENTO_RESUME, aoResume)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', aoMudarVisibilidade)
  window.removeEventListener(EVENTO_RESUME, aoResume)
  if (aberto.value) document.body.style.overflow = ''
})

// ---------- acessibilidade: foco preso no cartao, Esc fecha, foco volta ----------
const cartao = ref<HTMLElement | null>(null)
let focoAntes: HTMLElement | null = null

function focaveis(): HTMLElement[] {
  return Array.from(cartao.value?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') || [])
}

function tecla(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); fechar(); return }
  if (e.key !== 'Tab') return
  const f = focaveis()
  if (!f.length) return
  const primeiro = f[0]
  const ultimo = f[f.length - 1]
  if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus() }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus() }
}

watch(visivel, (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
  if (v) {
    focoAntes = document.activeElement as HTMLElement | null
    nextTick(() => focaveis()[0]?.focus())
  } else {
    focoAntes?.focus?.()
    focoAntes = null
  }
})

function fechar() {
  aberto.value = false
}

function abrir(token: string) {
  marcarAberto(token)
  aberto.value = false
  navigateTo(`/premium/${token}`)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="rpr">
      <div v-if="visivel" class="rpr-overlay" @click.self="fechar">
        <div
          ref="cartao"
          class="rpr-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rpr-titulo"
          aria-describedby="rpr-texto"
          @keydown="tecla"
        >
          <div class="rpr-topo">
            <span id="rpr-titulo" class="rpr-titulo">{{ varios ? t('relatoriosProntos.tituloVarios') : t('relatoriosProntos.tituloUm') }}</span>
            <button type="button" class="rpr-x" :aria-label="t('relatoriosProntos.fechar')" @click="fechar">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <div class="rpr-body">
            <p id="rpr-texto" class="rpr-cap">
              {{ varios ? t('relatoriosProntos.textoVarios', { n: pendentes.length }) : t('relatoriosProntos.textoUm') }}
            </p>
            <ul class="rpr-lista">
              <li v-for="it in pendentes" :key="it.token" class="rpr-item">
                <span class="rpr-placa" :aria-label="`${t('relatoriosProntos.placa')} ${it.placa}`">{{ it.placa }}</span>
                <span v-if="it.veiculo" class="rpr-veiculo">{{ it.veiculo }}</span>
                <button
                  type="button"
                  class="rpr-acao"
                  :aria-label="t('relatoriosProntos.abrirPlaca', { placa: it.placa })"
                  @click="abrir(it.token)"
                >
                  {{ t('relatoriosProntos.abrir') }}
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
// Mesma linguagem do modal "Suas consultas" (ConsultasHistory.vue).
$c-canvas: #ffffff;
$c-cloud: #f7f7f7;
$c-hair: #e8e8e8;
$c-ink: #1a1a1a;
$c-graphite: #636363;
$c-blue: #1f6feb;
$c-blue-deep: #17539f;
$c-slab: #0B1F3A;
$fonte: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

.rpr-enter-active,
.rpr-leave-active { transition: opacity 0.18s ease; }
.rpr-enter-from,
.rpr-leave-to { opacity: 0; }
.rpr-enter-active .rpr-card,
.rpr-leave-active .rpr-card { transition: transform 0.22s cubic-bezier(0.22, 0.61, 0.36, 1); }
.rpr-enter-from .rpr-card { transform: translateY(12px) scale(0.98); }
.rpr-leave-to .rpr-card { transform: translateY(6px) scale(0.99); }
@media (prefers-reduced-motion: reduce) {
  .rpr-enter-active,
  .rpr-leave-active,
  .rpr-enter-active .rpr-card,
  .rpr-leave-active .rpr-card { transition: none; }
}

.rpr-overlay {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(26, 26, 26, 0.55);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  overflow: hidden;
}

.rpr-card {
  width: 100%;
  max-width: 440px;
  max-height: calc(100vh - 32px);
  max-height: calc(100dvh - 32px);
  display: flex;
  flex-direction: column;
  background: $c-canvas;
  border: 1px solid $c-hair;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(26, 26, 26, 0.12);
  font-family: $fonte;
  color: $c-ink;
  line-height: 1.4;
  overflow: hidden;
}

.rpr-topo {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 8px 12px 20px;
  border-bottom: 1px solid $c-hair;
}

.rpr-titulo {
  font-size: 17px;
  font-weight: 700;
  color: $c-ink;
}

.rpr-x {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 0;
  border-radius: 4px;
  color: $c-ink;
  cursor: pointer;

  svg { width: 20px; height: 20px; }
  &:hover { background: $c-cloud; }
  &:focus-visible { outline: 2px solid $c-blue; outline-offset: -2px; }
}

.rpr-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px 20px 20px;
}

.rpr-cap {
  font-size: 14px;
  line-height: 1.45;
  color: $c-graphite;
  margin: 0 0 16px;
}

.rpr-lista { list-style: none; margin: 0; padding: 0; }

.rpr-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 12px 0;
  border-top: 1px solid $c-hair;

  &:first-child { border-top: 0; padding-top: 0; }
}

.rpr-placa {
  background: $c-slab;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  border-radius: 4px;
  padding: 6px 8px;
  white-space: nowrap;
}

.rpr-veiculo {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: $c-ink;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rpr-acao {
  flex-basis: 100%;
  min-height: 48px;
  border: 0;
  border-radius: 4px;
  background: $c-blue;
  color: #fff;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;

  &:hover { background: $c-blue-deep; }
  &:focus-visible { outline: 2px solid $c-blue-deep; outline-offset: 2px; }
}
</style>
