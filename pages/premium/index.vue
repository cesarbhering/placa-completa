<script setup lang="ts">
// v2.0 Consulta Premium (homologacao). Pagina gated por senha.
useHead({ title: 'Consulta Premium (homologação)', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

type Step = 'gate' | 'placa' | 'confirm' | 'pending' | 'erro'
const step = ref<Step>('gate')

const { itens, sync: histSync } = useConsultaHistory()
const modalConsultas = useState('pc-consultas-aberto', () => false)
onMounted(() => histSync())
const loading = ref(false)
const msg = ref('')

const senha = ref('')
const placa = ref('')
const email = ref('')
const telefone = ref('')
const preview = ref<any>(null)

const pix = ref<{ brCode: string; brCodeBase64: string; token: string; valor: number } | null>(null)
const pendingStatus = ref('aguardando_pagamento')
let poll: any = null

// historico local: religar/retomar consultas sem login (ver useConsultaHistory)
const { add: histAdd, updateStatus: histUpdate } = useConsultaHistory()

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
  } catch (e: any) { msg.value = e?.data?.message || 'Falha na consulta básica.' }
  finally { loading.value = false }
}

async function pagar() {
  if (!email.value.includes('@')) { msg.value = 'Informe um email válido.'; return }
  loading.value = true; msg.value = ''
  try {
    pix.value = await $fetch('/api/premium/checkout', {
      method: 'POST',
      body: { placa: preview.value.placa, email: email.value, telefone: telefone.value, preview: preview.value.raw },
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

async function checarStatus() {
  if (!pix.value) return
  try {
    const r: any = await $fetch('/api/premium/status', { query: { token: pix.value.token } })
    pendingStatus.value = r.status
    histUpdate(pix.value.token, r.status)
    if (r.status === 'entregue') { clearInterval(poll); navigateTo(`/premium/${pix.value.token}`) }
    if (['expirado', 'falha', 'reembolsado'].includes(r.status)) clearInterval(poll)
  } catch { /* segue tentando */ }
}

function copiar() { if (pix.value) navigator.clipboard?.writeText(pix.value.brCode) }
onUnmounted(() => poll && clearInterval(poll))
const reais = (c: number) => 'R$ ' + (c / 100).toFixed(2).replace('.', ',')
</script>

<template>
  <div class="premium">
    <div class="card">
      <h1>Consulta Veicular Completa</h1>
      <p class="tag">Homologação · acesso restrito</p>

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
        <p class="inclui">A consulta completa inclui: restrições, roubo/furto, recall, RENAJUD, leilão, débitos e a ficha cadastral completa (dados oficiais SENATRAN).</p>
        <input v-model="email" type="email" placeholder="Seu email (para receber o relatório)" />
        <input v-model="telefone" placeholder="WhatsApp (opcional)" />
        <button :disabled="loading" @click="pagar">Pagar {{ reais(4500) }} via Pix</button>
        <button class="ghost" @click="step = 'placa'">Voltar</button>
      </div>

      <div v-else-if="step === 'pending'" class="stepbox">
        <template v-if="pendingStatus === 'aguardando_pagamento'">
          <h2>Pague com Pix para liberar</h2>
          <img v-if="pix?.brCodeBase64" :src="pix.brCodeBase64" alt="QR Code Pix" class="qr" />
          <button class="ghost" @click="copiar">Copiar código Pix (copia e cola)</button>
          <p class="small">{{ pix?.brCode }}</p>
          <p class="small">Assim que o pagamento cair, a consulta roda automaticamente.</p>
        </template>
        <template v-else-if="['pago', 'consultando'].includes(pendingStatus)">
          <h2>Pagamento confirmado ✓</h2>
          <p>Rodando sua consulta completa...</p>
        </template>
        <template v-else-if="pendingStatus === 'expirado'"><h2>Pix expirou</h2><button @click="step = 'confirm'">Gerar novo</button></template>
        <template v-else-if="pendingStatus === 'reembolsado'"><h2>Não foi possível concluir</h2><p>O valor foi reembolsado.</p></template>
        <template v-else><h2>Algo deu errado</h2><p>{{ pendingStatus }}</p></template>
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
.qr { width: 220px; height: 220px; align-self: center; background: #fff; border-radius: 8px; }
.small { color: #8296b8; font-size: 11px; word-break: break-all; }
.err { color: #f87171; font-size: 13px; margin-top: 12px; }
</style>
