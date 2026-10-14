<script setup lang="ts">
import { BASE_LEILAO_TEXTO } from '~/shared/base-leilao'
import { PLANOS } from '~/shared/planos'
import { origemDaSessao } from '~/shared/origem-trafego'
// v2.0 Consulta Premium. Nos ambientes protegidos (homolog/staging) a pagina e
// gated por senha; em prod fica aberta.
useHead({ title: 'Consulta Premium', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const cfg = useRuntimeConfig()

type Step = 'gate' | 'placa' | 'confirm' | 'pending' | 'erro'
// A pagina sempre comeca na placa. Em homolog/staging o gate por senha e feito
// pelo overlay sitewide (HomologGate), que ja seta o cookie premium antes daqui;
// em prod a area e aberta (server no-op). O passo 'gate' segue como fallback do
// handler de 401 (sessao expirada), inofensivo em prod.
const step = ref<Step>('placa')
// Confirmacao e Pix pendente sao checkout: sem WhatsApp flutuante por cima.
useWhatsappOculto(() => step.value === 'confirm' || step.value === 'pending')

const { itens, sync: histSync } = useConsultaHistory()
const modalConsultas = useState('pc-consultas-aberto', () => false)
const route = useRoute()

// Placa pela URL (/premium?placa=ABC1D23): o e-mail de recuperacao de Pix
// abandonado manda a pessoa de volta com a placa que ela ja tinha digitado.
// Sem isto ela caia num campo em branco e tinha que lembrar o que consultou.
// Query invalida e simplesmente ignorada: o fluxo normal continua igual.
function placaDaQuery(): string {
  const bruto = Array.isArray(route.query.placa) ? route.query.placa[0] : route.query.placa
  const limpa = String(bruto || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
  return limpa.length === 7 ? limpa : ''
}

// A /premium crua e a tela de checkout Pix sem a home em volta. No app ela nao
// pode existir: a compra ali passa obrigatoriamente pelo Google Play, e esta
// pagina nao tem esse caminho. Manda pra home, que tem o fluxo certo.
const { isCapacitor } = useAppMode()

onMounted(() => {
  if (isCapacitor.value) { navigateTo('/'); return }
  histSync()
  const daQuery = placaDaQuery()
  if (daQuery) {
    placa.value = daQuery
    consultarPreview()
  }
})
const loading = ref(false)
const msg = ref('')

const senha = ref('')
const placa = ref('')
const email = ref('')
const telefone = ref('')
// WhatsApp oculto ate a feature existir; ref telefone segue vivo (API opcional).
const mostraWhatsapp = false
// So o build de homolog tem o dropdown e comeca em 'homolog'; qualquer outro
// build (staging espelha prod; prod e prod) cai em 'producao'. O server ainda
// faz o clamp final. Ver PremiumInlineCheckout.
const ambiente = ref(cfg.public.homolog ? 'homolog' : 'producao')
const preview = ref<any>(null)

const pix = ref<{ brCode: string; brCodeBase64: string; token: string; valor: number } | null>(null)
const pendingStatus = ref('aguardando_pagamento')
const trace = ref<any[] | null>(null)
const erroMsg = ref('')
let poll: any = null

// historico local: religar/retomar consultas sem login (ver useConsultaHistory)
const { add: histAdd, updateStatus: histUpdate } = useConsultaHistory()
const { trackAddPaymentInfo, trackConversionPaga } = useAnalytics()

async function entrar() {
  loading.value = true; msg.value = ''
  try { await $fetch('/api/premium/gate', { method: 'POST', body: { password: senha.value } }); step.value = 'placa' }
  catch { msg.value = 'Senha incorreta.' }
  finally { loading.value = false }
}

async function consultarPreview() {
  loading.value = true; msg.value = ''
  try {
    preview.value = await $fetch('/api/premium/preview', { method: 'POST', body: { placa: placa.value } })
    step.value = 'confirm'
  } catch (e: any) {
    // 401: sessao do gate expirou. No homolog volta pro overlay do home; fora
    // dele cai no gate local (mesma logica do checkout inline).
    if (e?.statusCode === 401 || e?.status === 401) {
      if (cfg.public.gated && import.meta.client) {
        try { localStorage.removeItem('homolog_ok') } catch { /* modo privado */ }
        window.location.reload()
      } else { step.value = 'gate' }
    } else { msg.value = e?.data?.message || 'Falha na consulta básica.' }
  }
  finally { loading.value = false }
}

async function pagar() {
  if (!email.value.includes('@')) { msg.value = 'Informe um email válido.'; return }
  loading.value = true; msg.value = ''
  // Passo do meio do funil (mesmo evento do checkout inline), antes do POST.
  // Esta pagina so vende a completa.
  trackAddPaymentInfo('completa', placa.value)
  try {
    pix.value = await $fetch('/api/premium/checkout', {
      method: 'POST',
      body: {
        placa: preview.value.placa, email: email.value, telefone: telefone.value,
        preview: preview.value.raw, ambiente: ambiente.value,
        // Mesma marca de anuncio que o checkout da home manda.
        origin: origemDaSessao(),
        // Chegou pelo link do e-mail de recuperacao de Pix (/premium?placa=...).
        origem_checkout: route.query.placa ? 'pix_recovery' : 'outro',
      },
    })
    step.value = 'pending'
    histAdd({
      token: pix.value!.token,
      placa: preview.value.placa,
      veiculo: preview.value?.encontrado ? [preview.value.marca, preview.value.modelo].filter(Boolean).join(' ') : null,
      status: 'aguardando_pagamento',
    })
    poll = setInterval(checarStatus, 4000)
  } catch (e: any) { msg.value = e?.data?.message || 'Falha ao gerar o Pix.' }
  finally { loading.value = false }
}

// Piso de ~40s quando o registro traz recall e/ou multa: segura a navegacao pra
// os enriquecimentos rodarem, mostrando o que esta sendo buscado. So no fluxo
// recem-entregue (nunca revisita de link antigo).
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

async function checarStatus() {
  if (!pix.value) return
  try {
    const r: any = await $fetch('/api/premium/status', { query: { token: pix.value.token, debug: 1 } })
    pendingStatus.value = r.status
    if (r.debug_trace) trace.value = r.debug_trace
    if (r.erro) erroMsg.value = r.erro
    histUpdate(pix.value.token, r.status)
    // Esta pagina so vende a completa (o checkout nao manda plano -> o server
    // cai em 'completa'), entao a conversao reporta o valor da completa.
    if (['pago', 'consultando', 'entregue'].includes(r.status)) trackConversionPaga(pix.value.token, 'completa', r.valorCentavos ?? undefined)
    if (r.status === 'entregue') {
      clearInterval(poll)
      const entregueMs = r.entregue_em ? new Date(r.entregue_em).getTime() : 0
      const recem = entregueMs > 0 && Date.now() - entregueMs < PISO_MS
      if ((r.temRecall || r.temMultaSP) && recem) {
        const ate = entregueMs + PISO_MS
        piso.value = { ate, msg: mensagemPiso(!!r.temRecall, !!r.temMultaSP) }
        pisoTimer = setTimeout(() => navigateTo(`/premium/${pix.value!.token}`), Math.max(0, ate - Date.now()))
      } else {
        navigateTo(`/premium/${pix.value.token}`)
      }
    }
    if (['expirado', 'falha', 'reembolsado'].includes(r.status)) clearInterval(poll)
  } catch { /* segue tentando */ }
}

function copiar() { if (pix.value) navigator.clipboard?.writeText(pix.value.brCode) }

// Homolog: confirma o pagamento sem Pix real (AbacatePay dev).
async function simular() {
  if (!pix.value) return
  loading.value = true; msg.value = ''
  try {
    await $fetch('/api/premium/simular-pagamento', { method: 'POST', body: { token: pix.value.token } })
    await checarStatus()
  } catch (e: any) { msg.value = e?.data?.message || 'Falha ao simular pagamento.' }
  finally { loading.value = false }
}
onUnmounted(() => { if (poll) clearInterval(poll); if (pisoTimer) clearTimeout(pisoTimer) })
const reais = (c: number) => 'R$ ' + (c / 100).toFixed(2).replace('.', ',')
</script>

<template>
  <div class="premium">
    <div class="card">
      <h1>Consulta Veicular Completa</h1>
      <p class="mote">Com histórico de leilão, cruzado por placa e chassi com uma base de {{ BASE_LEILAO_TEXTO }}.</p>
      <p v-if="cfg.public.gated" class="tag">Homologação · acesso restrito</p>

      <!-- Atalho pro historico: quem esta aqui pra comprar de novo costuma
           querer o relatorio que ja pagou, e sem isto so chegava nele pela home.
           So aparece quando ha algo salvo neste navegador. -->
      <button v-if="itens.length" type="button" class="hist-link" @click="modalConsultas = true">
        Suas consultas ({{ itens.length }})
      </button>

      <div v-if="step === 'gate'" class="stepbox">
        <p>Área restrita. Informe a senha de acesso.</p>
        <input v-model="senha" type="password" placeholder="Senha" @keyup.enter="entrar" />
        <button :disabled="loading" @click="entrar">Entrar</button>
      </div>

      <div v-else-if="step === 'placa'" class="stepbox">
        <p>Digite a placa do veículo.</p>
        <input v-model="placa" placeholder="ABC1D23" maxlength="7" autofocus style="text-transform:uppercase" @keyup.enter="consultarPreview" />
        <button :disabled="loading" @click="consultarPreview">Continuar</button>
      </div>

      <div v-else-if="step === 'confirm'" class="stepbox">
        <h2>É este veículo?</h2>
        <div v-if="preview?.encontrado" class="veiculo">
          <strong>{{ preview.marca }} {{ preview.modelo }}</strong><br />
          <span>{{ preview.ano }} · {{ preview.cor }} · placa {{ preview.placa }}</span>
        </div>
        <div v-else class="veiculo">Não achamos os dados básicos, mas você pode seguir com a placa {{ preview?.placa }}.</div>
        <p class="inclui">A consulta completa inclui: restrições, roubo/furto, recall, RENAJUD, registro de leilão, débitos, a ficha cadastral completa e o histórico de leilão, cruzado com uma base de {{ BASE_LEILAO_TEXTO }}.</p>
        <input v-model="email" type="email" placeholder="Seu email (para receber o relatório)" />
        <!-- WhatsApp oculto ate a feature existir (ref telefone segue vivo). -->
        <input v-if="mostraWhatsapp" v-model="telefone" placeholder="WhatsApp (opcional)" />
        <div class="ambiente">
          <label for="ambiente-sel">Ambiente SERPRO/GCC (controle de teste)</label>
          <select id="ambiente-sel" v-model="ambiente">
            <option value="homolog">Homologação</option>
            <option value="producao">Produção</option>
          </select>
          <p v-if="ambiente === 'producao'" class="aviso">Atenção: Produção dispara consulta real no SERPRO.</p>
        </div>
        <button :disabled="loading" @click="pagar">Pagar {{ reais(PLANOS.completa.valorCentavos) }} via Pix</button>
        <button class="ghost" @click="step = 'placa'">Voltar</button>
      </div>

      <div v-else-if="step === 'pending'" class="stepbox">
        <template v-if="pendingStatus === 'aguardando_pagamento'">
          <h2>Pague com Pix para liberar</h2>
          <img v-if="pix?.brCodeBase64" :src="pix.brCodeBase64" alt="QR Code Pix" class="qr" />
          <button class="ghost" @click="copiar">Copiar código Pix (copia e cola)</button>
          <p class="small">{{ pix?.brCode }}</p>
          <p class="small">Assim que o pagamento cair, a consulta roda automaticamente.</p>
          <button v-if="cfg.public.homolog" :disabled="loading" @click="simular">{{ loading ? 'Confirmando...' : 'Confirmar pagamento (simular)' }}</button>
        </template>
        <template v-else-if="['pago', 'consultando'].includes(pendingStatus)">
          <h2>Pagamento confirmado ✓</h2>
          <p>Rodando sua consulta completa...</p>
        </template>
        <template v-else-if="pendingStatus === 'expirado'"><h2>Pix expirou</h2><button @click="step = 'confirm'">Gerar novo</button></template>
        <template v-else-if="pendingStatus === 'reembolsado'"><h2>Não foi possível concluir</h2><p>O valor foi reembolsado.</p></template>
        <template v-else-if="piso"><h2>Quase lá</h2><p>{{ piso.msg }}</p></template>
        <template v-else><h2>Algo deu errado</h2><p>{{ pendingStatus }}</p></template>

        <div v-if="trace?.length" class="debug">
          <p class="debug-title">Chamadas (debug)</p>
          <p v-if="erroMsg" class="debug-erro">{{ erroMsg }}</p>
          <div v-for="(t, i) in trace" :key="i" class="debug-item">
            <div class="debug-head">
              <span class="debug-etapa">{{ t.etapa }}</span>
              <span v-if="t.metodo" class="debug-metodo">{{ t.metodo }}</span>
              <span v-if="t.http != null" class="debug-http" :class="{ bad: t.ok === false }">HTTP {{ t.http }}</span>
              <span v-if="t.ok != null" class="debug-ok">{{ t.ok ? 'ok' : 'falhou' }}</span>
            </div>
            <div v-if="t.url" class="debug-url">{{ t.url }}</div>
            <pre v-if="t.resumo || t.erro" class="debug-body">{{ t.erro || t.resumo }}</pre>
          </div>
        </div>
      </div>

      <p v-if="msg" class="err">{{ msg }}</p>
    </div>

  </div>
</template>

<style scoped>
.premium { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0b1220; padding: 20px; }
.card { background: #111a2e; color: #dbe4f4; border: 1px solid #24324d; border-radius: 12px; padding: 26px; max-width: 420px; width: 100%; font-family: system-ui; }
h1 { font-size: 20px; margin: 0; } h2 { font-size: 17px; margin: 0 0 10px; }
.tag { color: #8296b8; font-size: 12px; margin: 4px 0 18px; }
/* Atalho discreto: e navegacao, nao a acao da tela. */
.hist-link { background: transparent; border: 1px solid #24324d; color: #9db8e8; width: 100%; margin-bottom: 16px; font-weight: 500; }
.stepbox { display: flex; flex-direction: column; gap: 10px; }
input { background: #0b1424; border: 1px solid #24324d; color: #dbe4f4; border-radius: 7px; padding: 11px; font-size: 15px; }
button { background: #0466c8; color: #fff; border: 0; border-radius: 7px; padding: 12px; font-size: 15px; font-weight: 600; cursor: pointer; }
button.ghost { background: transparent; border: 1px solid #24324d; color: #9db8e8; }
button:disabled { opacity: .5; }
.veiculo { background: #0b1424; border: 1px solid #24324d; border-radius: 8px; padding: 12px; }
.inclui { color: #8296b8; font-size: 13px; }
.mote { color: #cfe0ff; font-size: 14px; line-height: 1.45; margin: 6px 0 0; }
.ambiente { display: flex; flex-direction: column; gap: 6px; background: #0b1424; border: 1px solid #24324d; border-radius: 8px; padding: 12px; }
.ambiente label { color: #8296b8; font-size: 12px; }
.ambiente select { background: #0b1424; border: 1px solid #24324d; color: #dbe4f4; border-radius: 7px; padding: 10px; font-size: 15px; }
.ambiente .aviso { color: #fbbf24; font-size: 12px; margin: 2px 0 0; }
.qr { width: 220px; height: 220px; align-self: center; background: #fff; border-radius: 8px; }
.small { color: #8296b8; font-size: 11px; word-break: break-all; }
.err { color: #f87171; font-size: 13px; margin-top: 12px; }
.debug { margin-top: 16px; border: 1px solid #24324d; border-radius: 8px; background: #0b1424; padding: 12px; }
.debug-title { color: #8296b8; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; margin: 0 0 8px; }
.debug-erro { color: #f87171; font-size: 12px; margin: 0 0 10px; word-break: break-word; }
.debug-item { border-top: 1px solid #1a263c; padding: 8px 0; }
.debug-item:first-of-type { border-top: 0; }
.debug-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 12px; }
.debug-etapa { color: #dbe4f4; font-weight: 600; }
.debug-metodo { color: #9db8e8; font-family: ui-monospace, monospace; }
.debug-http { color: #34d399; font-family: ui-monospace, monospace; }
.debug-http.bad { color: #f87171; }
.debug-ok { color: #8296b8; }
.debug-url { color: #8296b8; font-size: 11px; font-family: ui-monospace, monospace; word-break: break-all; margin: 4px 0; }
.debug-body { color: #cbd5e8; font-size: 11px; font-family: ui-monospace, monospace; background: #060c17; border: 1px solid #1a263c; border-radius: 6px; padding: 8px; margin: 4px 0 0; max-height: 220px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
</style>
