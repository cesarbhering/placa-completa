<script setup lang="ts">
// Gate de acesso ao homolog. Pede a senha UMA vez (no primeiro acesso), antes
// de usar o site; quando aceita, salva em localStorage e nao pede mais neste
// navegador. Liga SO quando public.homolog=true (o container de homolog seta a
// env); em prod/main a flag nao existe, entao o overlay nunca aparece. A senha
// e validada no servidor (/api/premium/gate, que tambem seta o cookie premium),
// entao a senha nunca vive no bundle e o /premium ja fica liberado junto.
const cfg = useRuntimeConfig()
const ativo = ref(false)
const senha = ref('')
const erro = ref('')
const loading = ref(false)

onMounted(() => {
  if (!cfg.public.homolog) return
  try { if (localStorage.getItem('homolog_ok') === '1') return } catch { /* modo privado */ }
  ativo.value = true
  document.body.style.overflow = 'hidden'
})

async function entrar() {
  loading.value = true; erro.value = ''
  try {
    await $fetch('/api/premium/gate', { method: 'POST', body: { password: senha.value } })
    try { localStorage.setItem('homolog_ok', '1') } catch { /* modo privado */ }
    ativo.value = false
    document.body.style.overflow = ''
  } catch {
    erro.value = 'Senha incorreta.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <ClientOnly>
    <div v-if="ativo" class="hg" role="dialog" aria-modal="true" aria-label="Acesso ao homolog">
      <div class="hg__card">
        <p class="hg__tag">Ambiente de homologação</p>
        <h2 class="hg__t">Acesso restrito</h2>
        <p class="hg__p">Informe a senha para ver o homolog. É pedida só uma vez neste navegador.</p>
        <input
          v-model="senha"
          type="password"
          placeholder="Senha"
          autofocus
          autocomplete="off"
          @keyup.enter="entrar"
        >
        <button type="button" :disabled="loading" @click="entrar">
          {{ loading ? 'Entrando...' : 'Entrar' }}
        </button>
        <p v-if="erro" class="hg__err">{{ erro }}</p>
      </div>
    </div>
  </ClientOnly>
</template>

<style scoped>
.hg {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #0b1220;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
.hg__card {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #111a2e;
  color: #dbe4f4;
  border: 1px solid #24324d;
  border-radius: 12px;
  padding: 28px;
}
.hg__tag { margin: 0; color: #8296b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
.hg__t { margin: 0; font-size: 20px; }
.hg__p { margin: 0 0 6px; color: #8296b8; font-size: 13px; line-height: 1.5; }
.hg input { background: #0b1424; border: 1px solid #24324d; color: #dbe4f4; border-radius: 7px; padding: 12px; font-size: 15px; }
.hg input:focus { outline: none; border-color: #0466c8; }
.hg button { background: #0466c8; color: #fff; border: 0; border-radius: 7px; padding: 12px; font-size: 15px; font-weight: 600; cursor: pointer; }
.hg button:disabled { opacity: 0.5; }
.hg__err { margin: 0; color: #f87171; font-size: 13px; }
</style>
