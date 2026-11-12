<script setup lang="ts">
// Destino do link do e-mail de parceiro. O token so e gasto no clique (POST):
// leitores de link do provedor de e-mail que so buscam a pagina nao ativam nada.
useHead({ title: 'Ativar acesso de parceiro | PlacaCompleta', meta: [{ name: 'robots', content: 'noindex,nofollow' }, { name: 'referrer', content: 'no-referrer' }] })

const route = useRoute()
const token = String(route.query.t || '')
const ativando = ref(false)
const erro = ref('')

async function ativar() {
  if (!token || ativando.value) return
  ativando.value = true
  erro.value = ''
  try {
    const r: any = await $fetch('/api/parceiro/entrar', { method: 'POST', body: { t: token } })
    if (r?.ok) return navigateTo('/?parceiro=ativo')
    erro.value = 'Este link já foi usado ou venceu. Peça um novo.'
  } catch {
    erro.value = 'Não deu para ativar agora. Tente de novo em alguns minutos.'
  } finally {
    ativando.value = false
  }
}
</script>

<template>
  <main class="pe">
    <section class="pe__card">
      <h1 class="pe__titulo">Ativar acesso de parceiro</h1>
      <p class="pe__texto">O acesso fica ativo neste navegador. Cada aparelho precisa ativar uma vez.</p>
      <button type="button" class="pe__botao" :disabled="!token || ativando" @click="ativar">{{ ativando ? 'Ativando…' : 'Ativar neste aparelho' }}</button>
      <p v-if="erro || !token" class="pe__erro" role="alert">
        {{ erro || 'Link incompleto.' }} <NuxtLink to="/parceiro" class="pe__link">Pedir um novo link</NuxtLink>
      </p>
    </section>
  </main>
</template>

<style scoped>
.pe { background: #f7f7f7; display: flex; justify-content: center; padding: 24px 16px 56px; }
.pe__card { width: 100%; max-width: 480px; background: #fff; border: 1px solid #e8e8e8; border-radius: 16px; padding: 28px 24px 24px; box-sizing: border-box; text-align: center; }
.pe__titulo { margin: 0 0 12px; font-size: 26px; line-height: 1.2; font-weight: 600; color: #1a1a1a; }
.pe__texto { margin: 0 0 20px; color: #3d3d3d; line-height: 1.55; }
.pe__botao { width: 100%; min-height: 52px; border: 0; border-radius: 4px; background: #024ad8; color: #fff; font-size: 16px; font-weight: 600; cursor: pointer; }
.pe__botao:hover { background: #0e3191; }
.pe__botao:disabled { background: #c2c2c2; cursor: not-allowed; }
.pe__botao:focus-visible { outline: 2px solid #024ad8; outline-offset: 2px; }
.pe__erro { margin: 16px 0 0; color: #b3262b; line-height: 1.5; }
.pe__link { color: #024ad8; font-weight: 600; }
</style>
