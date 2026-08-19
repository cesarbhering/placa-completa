<script setup lang="ts">
// "Suas consultas": modal com as consultas premium salvas neste navegador
// (localStorage). Antes era uma section fixa no meio da home, que aparecia pra
// quem ja tinha consultado e empurrava o resto da pagina pra baixo. Agora vive
// atras de um item do header e so abre quando a pessoa pede.
//
// Vai pro body via Teleport pelo mesmo motivo da gaveta do menu: o .cb-navband
// tem backdrop-filter, e isso vira bloco de contencao pro position:fixed.
const props = defineProps<{ aberto: boolean }>()
const emit = defineEmits<{ fechar: [] }>()

const { itens, sync } = useConsultaHistory()
onMounted(sync)

// Reler ao abrir: outra aba pode ter concluido um pagamento nesse meio tempo.
watch(() => props.aberto, (v) => {
  if (v) sync()
  if (import.meta.client) document.body.style.overflow = v ? 'hidden' : ''
})
onUnmounted(() => { if (import.meta.client) document.body.style.overflow = '' })

const pago = (s: string) => s === 'entregue' || s === 'pago' || s === 'consultando'

function rotuloStatus(s: string) {
  if (s === 'entregue') return 'Pronto'
  if (s === 'pago' || s === 'consultando') return 'Processando'
  if (s === 'expirado') return 'Pix expirou'
  if (s === 'reembolsado') return 'Reembolsado'
  return 'Pagamento pendente'
}

function fmtData(iso: string) {
  try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return '' }
}
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <!-- Transition em vez de v-if seco: o modal entra e sai com um fade no
           veu e um leve deslize no cartao, em vez de aparecer de estalo. -->
      <Transition name="pch">
        <div v-if="aberto" class="pch-overlay" role="dialog" aria-modal="true" aria-labelledby="pch-titulo" @click="emit('fechar')">
        <div class="pch-card" @click.stop>
          <div class="pch-topo">
            <span id="pch-titulo" class="pch-titulo">Suas consultas</span>
            <button type="button" class="pch-x" aria-label="Fechar" @click="emit('fechar')">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <div class="pch-body">
            <p class="pch-cap">
              Salvas só neste navegador. Serve pra voltar a um relatório que você já pagou
              ou concluir um pagamento que ficou pela metade.
            </p>

            <p v-if="!itens.length" class="pch-vazio">
              Nenhuma consulta paga por aqui ainda.
            </p>

            <ul v-else class="pch-lista">
              <li v-for="it in itens" :key="it.token" class="pch-item">
                <span class="pch-placa">{{ it.placa }}</span>
                <span class="pch-info">
                  <strong>{{ it.veiculo || 'Consulta veicular' }}</strong>
                  <small>
                    {{ pago(it.status) ? 'Consultada' : 'Iniciada' }} em {{ fmtData(it.criadoEm) }}
                    · <span :class="pago(it.status) ? 'pch-st--ok' : 'pch-st--pend'">{{ rotuloStatus(it.status) }}</span>
                  </small>
                </span>
                <NuxtLink
                  class="pch-acao"
                  :class="{ 'pch-acao--primaria': it.status !== 'entregue' }"
                  :to="`/premium/${it.token}`"
                  @click="emit('fechar')"
                >
                  {{ it.status === 'entregue' ? 'Ver relatório' : 'Concluir' }}
                </NuxtLink>
              </li>
            </ul>
          </div>

          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<style lang="scss" scoped>
// Entrada e saida do modal: o veu faz fade e o cartao sobe um pouco. Curto de
// proposito — passou de ~200ms, um modal que abre e fecha o tempo todo comeca
// a parecer lento.
.pch-enter-active,
.pch-leave-active { transition: opacity 0.18s ease; }
.pch-enter-from,
.pch-leave-to { opacity: 0; }

.pch-enter-active .pch-card,
.pch-leave-active .pch-card { transition: transform 0.22s cubic-bezier(0.22, 0.61, 0.36, 1); }
.pch-enter-from .pch-card { transform: translateY(12px) scale(0.98); }
.pch-leave-to .pch-card { transform: translateY(6px) scale(0.99); }

@media (prefers-reduced-motion: reduce) {
  .pch-enter-active,
  .pch-leave-active,
  .pch-enter-active .pch-card,
  .pch-leave-active .pch-card { transition: none; }
}

// Mesma linguagem da home v2 (guia HP): canvas branco, tinta near-black, um
// acento azul, 4px no interativo e 16px no container, hairline no lugar de
// sombra pesada.
$c-canvas: #ffffff;
$c-cloud: #f7f7f7;
$c-hair: #e8e8e8;
$c-ink: #1a1a1a;
$c-charcoal: #3d3d3d;
$c-graphite: #636363;
$c-blue: #1f6feb;
$c-blue-deep: #17539f;
$c-green: #1e9e4a;
$c-amber: #9a6400;
$c-slab: #0B1F3A;
$fonte: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

.pch-overlay {
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
  // O veu nao rola. Antes ele e que ganhava a barra quando a lista crescia, o
  // que na tela parecia a PAGINA rolando atras do modal, com o titulo subindo
  // junto. Quem rola agora e so o corpo do cartao.
  overflow: hidden;
}

.pch-card {
  width: 100%;
  max-width: 560px;
  // dvh acompanha a barra de URL do celular, que o vh nao enxerga; o vh fica
  // como reserva pra quem nao tem a unidade.
  max-height: calc(100vh - 40px);
  max-height: calc(100dvh - 40px);
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

// Cabecalho preso: e o que da o ponto de referencia e onde fica o fechar.
.pch-topo {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 12px 14px 20px;
  border-bottom: 1px solid $c-hair;
}

.pch-titulo {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: $c-graphite;
}

.pch-x {
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

// min-height:0 e obrigatorio: sem ele o item flex usa o conteudo como altura
// minima, nunca encolhe, e o overflow-y nao chega a acontecer.
.pch-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 20px;
}

.pch-cap {
  font-size: 13px;
  line-height: 1.45;
  color: $c-graphite;
  margin: 0 0 16px;
}

.pch-vazio {
  font-size: 15px;
  color: $c-charcoal;
  text-align: center;
  margin: 24px 0;
}

.pch-lista { list-style: none; margin: 0; padding: 0; }

.pch-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid $c-hair;

  &:first-child { border-top: 0; }

  // No estreito a acao desce pra linha propria em vez de espremer o texto.
  @media (max-width: 520px) {
    flex-wrap: wrap;
    .pch-info { flex-basis: calc(100% - 92px); }
    .pch-acao { margin-left: auto; }
  }
}

.pch-placa {
  background: $c-slab;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  border-radius: 4px;
  padding: 6px 8px;
  white-space: nowrap;
  flex-shrink: 0;
}

.pch-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;

  strong { font-size: 15px; font-weight: 500; color: $c-ink; }
  small { font-size: 12.5px; color: $c-graphite; }
}

.pch-st--ok { color: $c-green; font-weight: 700; }
.pch-st--pend { color: $c-amber; font-weight: 700; }

.pch-acao {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.7px;
  text-transform: uppercase;
  color: $c-ink;
  background: $c-canvas;
  border: 1px solid $c-ink;
  border-radius: 4px;
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover { background: $c-cloud; }

  &--primaria {
    background: $c-blue;
    border-color: $c-blue;
    color: #fff;
    &:hover { background: $c-blue-deep; border-color: $c-blue-deep; }
  }
}

.pch-rodape {
  padding: 12px 20px;
  border-top: 1px solid $c-hair;
  background: $c-cloud;
  text-align: right;
}

.pch-limpar {
  background: transparent;
  border: 0;
  color: $c-graphite;
  font-family: $fonte;
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
  padding: 8px;
  min-height: 44px;

  &:hover { color: $c-ink; }
}
</style>
