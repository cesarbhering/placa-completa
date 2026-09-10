<script setup lang="ts">
// Pagina de teste do Pix da Woovi. Existe SO no homolog e SO com o provedor
// woovi ligado (a regra mora em server/utils/woovi-teste-guard.ts, e os
// endpoints usam a mesma). Ela cria cobranca de verdade no sandbox, entao em
// producao nao pode existir: qualquer outro ambiente devolve 404.
//
// O objetivo dela e olhar pra resposta crua da Woovi: o que a doc nao respondeu
// (nome do recebedor, chave usada, formato da expiracao) esta ali.
const { data: liberado } = await useFetch<{ ok: boolean }>('/api/woovi-teste/liberado')
if (!liberado.value?.ok) {
  throw createError({ statusCode: 404, statusMessage: 'Página não encontrada', fatal: true })
}

useHead({ title: 'Teste Woovi', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const carregando = ref(false)
const erro = ref('')
const cobranca = ref<any>(null)
const status = ref<string | null>(null)
const cru = ref<any>(null)
const statusCru = ref<any>(null)
const copiado = ref(false)
let poll: ReturnType<typeof setInterval> | null = null

// QR desenhado do copia e cola. A Woovi devolve uma URL de imagem no dominio
// dela, que o CSP do site bloqueia; o link cru fica logo abaixo pra quem
// quiser abrir e comparar.
const qr = ref('')
watch(cobranca, async (c) => {
  qr.value = ''
  if (!c?.brCode) return
  const { renderSVG } = await import('uqr')
  qr.value = renderSVG(c.brCode, { border: 1 })
})

async function gerar() {
  carregando.value = true
  erro.value = ''
  status.value = null
  try {
    const r: any = await $fetch('/api/woovi-teste/cobranca', { method: 'POST', body: { centavos: 100 } })
    cobranca.value = r
    cru.value = r.cru
    status.value = r.status
    iniciarPoll()
  } catch (e: any) {
    erro.value = e?.data?.message || 'Falhou ao criar a cobrança.'
  } finally {
    carregando.value = false
  }
}

function iniciarPoll() {
  if (poll) clearInterval(poll)
  poll = setInterval(checar, 4000)
}

async function checar() {
  const id = cobranca.value?.identifier || cobranca.value?.correlationID
  if (!id) return
  const r: any = await $fetch('/api/woovi-teste/status', { query: { id } }).catch(() => null)
  if (!r) return
  status.value = r.status
  statusCru.value = r.cru
  if (String(r.status).toUpperCase() === 'COMPLETED' && poll) clearInterval(poll)
}

async function pagar() {
  const id = cobranca.value?.identifier
  if (!id) return
  carregando.value = true
  try {
    await $fetch('/api/woovi-teste/pagar', { method: 'POST', body: { id } })
    await checar()
  } finally {
    carregando.value = false
  }
}

function copiar() {
  if (!cobranca.value?.brCode) return
  navigator.clipboard?.writeText(cobranca.value.brCode)
  copiado.value = true
  setTimeout(() => { copiado.value = false }, 2500)
}

onUnmounted(() => { if (poll) clearInterval(poll) })
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">Teste do Pix da Woovi</h1>

      <div class="pc-prose">
        <p class="pc-lead">
          Cria uma cobrança de R$ 1,00 no ambiente de teste da Woovi. Nada aqui é dinheiro de
          verdade, e esta página só existe no homolog.
        </p>

        <div class="pc-cta">
          <button type="button" class="pc-btn pc-btn--primary" :disabled="carregando" @click="gerar">
            {{ carregando ? 'Gerando...' : 'Gerar Pix de R$ 1,00' }}
          </button>
        </div>

        <p v-if="erro" class="wt-erro">{{ erro }}</p>

        <template v-if="cobranca">
          <h2>Como fica para quem paga</h2>
          <div class="wt-cobranca">
            <div class="wt-qr" v-html="qr" />
            <div class="wt-dados">
              <p>
                <strong>Status:</strong>
                <span class="wt-status" :class="{ 'wt-status--pago': String(status).toUpperCase() === 'COMPLETED' }">
                  {{ status || 'consultando...' }}
                </span>
              </p>
              <p><strong>identifier:</strong> <code>{{ cobranca.identifier }}</code></p>
              <p><strong>correlationID:</strong> <code>{{ cobranca.correlationID }}</code></p>
              <p><strong>Expira em:</strong> {{ cobranca.expiresDate || 'não informado' }}</p>
              <p v-if="cobranca.qrCodeImage">
                <strong>QR da Woovi:</strong>
                <a :href="cobranca.qrCodeImage" target="_blank" rel="noopener">abrir a imagem original</a>
              </p>
              <div class="pc-cta wt-cta">
                <button type="button" class="pc-btn" @click="copiar">
                  {{ copiado ? 'Código copiado' : 'Copiar copia e cola' }}
                </button>
                <button type="button" class="pc-btn pc-btn--primary" :disabled="carregando" @click="pagar">
                  Simular pagamento
                </button>
              </div>
            </div>
          </div>

          <p class="wt-nota">
            O QR acima é desenhado a partir do copia e cola, porque a imagem que a Woovi devolve
            fica no domínio deles e o navegador bloqueia. O link abre a original para comparar.
          </p>

          <h2>Copia e cola</h2>
          <pre class="wt-pre">{{ cobranca.brCode }}</pre>

          <h2>Resposta crua da criação</h2>
          <pre class="wt-pre">{{ JSON.stringify(cru, null, 2) }}</pre>

          <template v-if="statusCru">
            <h2>Resposta crua do status</h2>
            <pre class="wt-pre">{{ JSON.stringify(statusCru, null, 2) }}</pre>
          </template>
        </template>
      </div>
    </main>
  </div>
</template>

<style scoped>
.wt-cobranca { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
.wt-qr { width: 220px; flex: 0 0 220px; }
.wt-qr :deep(svg) { width: 100%; height: auto; }
.wt-dados { flex: 1 1 260px; min-width: 0; font-size: 14px; }
.wt-dados p { margin: 0 0 8px; }
.wt-dados code { word-break: break-all; }
.wt-cta { display: flex; gap: 10px; flex-wrap: wrap; text-align: left; margin-top: 12px; }
.wt-status { font-weight: 600; }
.wt-status--pago { color: #1e9e4a; }
.wt-erro { color: #b3262b; }
.wt-nota { font-size: 13px; color: #636363; }
.wt-pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-all;
  background: #f7f7f7;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 12px;
  max-height: 420px;
  overflow: auto;
}
</style>
