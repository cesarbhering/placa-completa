<script setup lang="ts">
// Acesso de parceiro (chassi completo na consulta gratis). Pagina fora do
// indice e do sitemap, sem link em nenhuma outra pagina. A resposta do pedido
// de link e sempre a mesma: nao revela quem esta na lista.
// O codigo do e-mail serve pro app Android, cuja WebView nao le o cookie do Chrome.
useHead({ title: 'Acesso de parceiro | PlacaCompleta', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const email = ref('')
const codigo = ref('')
const enviando = ref(false)
const mensagem = ref('')
const erroCodigo = ref('')
const ativando = ref(false)

async function pedirLink() {
  if (!email.value.trim() || enviando.value) return
  enviando.value = true
  try {
    const r: any = await $fetch('/api/parceiro/link', { method: 'POST', body: { email: email.value } })
    mensagem.value = r?.mensagem || ''
  } catch {
    mensagem.value = 'Não deu para enviar agora. Tente de novo em alguns minutos.'
  } finally {
    enviando.value = false
  }
}

async function usarCodigo() {
  if (!email.value.trim() || !codigo.value.trim() || ativando.value) return
  ativando.value = true
  erroCodigo.value = ''
  try {
    const r: any = await $fetch('/api/parceiro/entrar', { method: 'POST', body: { email: email.value, codigo: codigo.value } })
    if (r?.ok) return navigateTo('/?parceiro=ativo')
    erroCodigo.value = 'Código inválido ou vencido. Peça um novo link.'
  } catch {
    erroCodigo.value = 'Não deu para ativar agora. Tente de novo em alguns minutos.'
  } finally {
    ativando.value = false
  }
}
</script>

<template>
  <main class="pa">
    <section class="pa__card">
      <h1 class="pa__titulo">Acesso de parceiro</h1>
      <p class="pa__texto">Informe o e-mail cadastrado. Enviamos um link para ativar o acesso neste aparelho.</p>
      <form @submit.prevent="pedirLink">
        <label class="pa__rotulo" for="pa-email">E-mail</label>
        <input id="pa-email" v-model="email" class="pa__campo" type="email" autocomplete="email" inputmode="email" required>
        <button type="submit" class="pa__botao" :disabled="enviando || !email.trim()">{{ enviando ? 'Enviando…' : 'Receber o link' }}</button>
      </form>
      <p v-if="mensagem" class="pa__ok" role="status">{{ mensagem }}</p>

      <form class="pa__codigo" @submit.prevent="usarCodigo">
        <p class="pa__texto">No app, digite o código que veio no e-mail.</p>
        <label class="pa__rotulo" for="pa-codigo">Código</label>
        <input id="pa-codigo" v-model="codigo" class="pa__campo" type="text" autocomplete="one-time-code" autocapitalize="characters" maxlength="12">
        <button type="submit" class="pa__botao pa__botao--sec" :disabled="ativando || !email.trim() || !codigo.trim()">{{ ativando ? 'Ativando…' : 'Ativar com o código' }}</button>
        <p v-if="erroCodigo" class="pa__erro" role="alert">{{ erroCodigo }}</p>
      </form>
    </section>
  </main>
</template>

<style scoped>
.pa { background: #f7f7f7; display: flex; justify-content: center; padding: 24px 16px 56px; }
.pa__card { width: 100%; max-width: 480px; background: #fff; border: 1px solid #e8e8e8; border-radius: 16px; padding: 28px 24px 24px; box-sizing: border-box; }
.pa__titulo { margin: 0 0 12px; font-size: 26px; line-height: 1.2; font-weight: 600; color: #1a1a1a; }
.pa__texto { margin: 0 0 16px; color: #3d3d3d; line-height: 1.55; }
.pa__rotulo { display: block; margin: 0 0 6px; font-size: 14px; font-weight: 600; color: #1a1a1a; }
.pa__campo { width: 100%; min-height: 48px; padding: 0 12px; border: 1px solid #c2c2c2; border-radius: 4px; font: inherit; font-size: 16px; color: #1a1a1a; box-sizing: border-box; }
.pa__campo:focus-visible { outline: 2px solid #024ad8; outline-offset: 1px; border-color: #024ad8; }
.pa__botao { width: 100%; min-height: 52px; margin-top: 12px; border: 0; border-radius: 4px; background: #024ad8; color: #fff; font-size: 16px; font-weight: 600; cursor: pointer; }
.pa__botao:hover { background: #0e3191; }
.pa__botao:disabled { background: #c2c2c2; cursor: not-allowed; }
.pa__botao--sec { background: #fff; color: #024ad8; border: 1px solid #024ad8; }
.pa__botao--sec:hover { background: #f0f5ff; }
.pa__botao:focus-visible { outline: 2px solid #024ad8; outline-offset: 2px; }
.pa__ok { margin: 16px 0 0; color: #1d6b3a; line-height: 1.5; }
.pa__erro { margin: 12px 0 0; color: #b3262b; }
.pa__codigo { margin-top: 28px; padding-top: 24px; border-top: 1px solid #e8e8e8; }
</style>
