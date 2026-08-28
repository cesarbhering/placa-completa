<script setup lang="ts">
definePageMeta({
  layout: false,
})

useSeoMeta({
  title: 'Dashboard',
  robots: 'noindex, nofollow',
})

const password = ref('')
const error = ref('')
const loading = ref(false)
const passwordRef = ref<HTMLInputElement | null>(null)

const LOOKER_URL = 'https://lookerstudio.google.com/reporting/8d735c12-980a-4594-8f5a-f5b5bec252ba'

useSeoMeta({
  title: 'Dashboard',
  robots: 'noindex, nofollow',
})

onMounted(() => {
  nextTick(() => {
    passwordRef.value?.focus()
  })
})

async function handleSubmit() {
  error.value = ''
  
  if (!password.value.trim()) {
    error.value = 'Digite a senha'
    return
  }

  loading.value = true

  try {
    const result = await $fetch<{ success: boolean; message?: string }>('/api/dash-auth', {
      method: 'POST',
      body: {
        password: password.value,
      },
    })

    if (result.success) {
      // Redirect to Looker Studio
      window.location.href = LOOKER_URL
    } else {
      error.value = result.message || 'Senha incorreta'
      password.value = ''
      nextTick(() => passwordRef.value?.focus())
    }
  } catch (err: any) {
    error.value = 'Erro ao verificar senha'
    password.value = ''
    nextTick(() => passwordRef.value?.focus())
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="desktop">
    <main>
      <div class="win-window">
        <div class="win-window__titlebar">
          <span>PlacaCompleta Dashboard</span>
          <div class="win-window__titlebar-buttons">
            <span class="win-window__titlebar-btn">_</span>
            <span class="win-window__titlebar-btn">&square;</span>
            <span class="win-window__titlebar-btn">&times;</span>
          </div>
        </div>
        <div class="win-window__body">
          <PlacaCompletaLogo class="logo" />

          <h1 class="page-title">Dashboard Analytics</h1>
          <p class="page-subtitle">
            Acesso restrito ao painel de análises
          </p>

          <hr class="win-separator" />

          <form @submit.prevent="handleSubmit" novalidate>
            <div class="form-group">
              <label class="form-group__label" for="password">Senha de Acesso</label>
              <input
                id="password"
                ref="passwordRef"
                v-model="password"
                type="password"
                class="win-input password-input"
                :class="{ 'win-input--error': error }"
                placeholder="Digite a senha"
                autocomplete="off"
                required
              />
              <span v-if="error" class="form-group__error">{{ error }}</span>
            </div>

            <button
              type="submit"
              class="win-btn win-btn--primary win-btn--block"
              :disabled="loading"
            >
              {{ loading ? 'Verificando...' : 'Acessar Dashboard' }}
            </button>

            <div v-if="loading" class="loading-bar">
              <div class="loading-bar__fill" />
            </div>
          </form>

          <p class="info-text">
            🔒 Área restrita para acesso ao Looker Studio Analytics
          </p>
        </div>
      </div>
    </main>

    <footer class="footer">
      <p>&copy; {{ new Date().getFullYear() }} PlacaCompleta: Dashboard de Analytics</p>
      <nav class="footer__links">
        <NuxtLink to="/">Voltar ao Site</NuxtLink>
      </nav>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
.page-title {
  font-family: $font-display;
  font-size: 2rem;
  color: $navy-electric;
  text-align: center;
  margin-bottom: $space-xs;
  letter-spacing: 1px;
}

.page-subtitle {
  font-family: $font-body;
  font-size: 0.8125rem;
  color: $graphite;
  text-align: center;
  margin-bottom: $space-md;
  line-height: 1.4;
}

.password-input {
  font-family: $font-body;
  font-size: 1.125rem;
  text-align: center;
  letter-spacing: 2px;
}

.info-text {
  font-family: $font-body;
  font-size: 0.75rem;
  color: $graphite;
  text-align: center;
  margin-top: $space-md;
  letter-spacing: 0.3px;
}

.desktop {
  text-align: center;
  padding: $space-sm $space-md;
  max-width: 580px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
}
</style>
