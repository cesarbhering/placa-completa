<script setup lang="ts">
const title = ref('')
const message = ref('')
const sending = ref(false)
const result = ref('')

async function sendNotification() {
  if (!title.value || !message.value) {
    result.value = '❌ Preencha título e mensagem'
    return
  }

  sending.value = true
  result.value = ''

  try {
    const response = await $fetch<{
      success: boolean
      sent: number
      failed: number
      total: number
    }>('/api/send-notification', {
      method: 'POST',
      body: {
        title: title.value,
        message: message.value,
        targetAll: true
      }
    })

    result.value = `✅ Notificação enviada para ${response.sent}/${response.total} dispositivos`
    title.value = ''
    message.value = ''
  } catch (error: any) {
    result.value = `❌ Erro: ${error.message}`
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="desktop">
    <main>
      <div class="win-window">
        <div class="win-window__titlebar">
          <span>🔔 Admin - Push Notifications</span>
          <div class="win-window__titlebar-buttons">
            <NuxtLink to="/" class="win-window__titlebar-btn win-window__titlebar-btn--active">×</NuxtLink>
          </div>
        </div>
        <div class="win-window__body">
          <h1 class="admin-title">Enviar Notificação Push</h1>

          <form @submit.prevent="sendNotification">
            <div class="form-group">
              <label class="form-group__label" for="title">Título</label>
              <input
                id="title"
                v-model="title"
                type="text"
                class="win-input"
                placeholder="Ex: Nova consulta disponível"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-group__label" for="message">Mensagem</label>
              <textarea
                id="message"
                v-model="message"
                class="win-input"
                rows="4"
                placeholder="Ex: Confira os dados da placa ABC1234"
                required
              ></textarea>
            </div>

            <button
              type="submit"
              class="win-btn win-btn--primary win-btn--block"
              :disabled="sending"
            >
              {{ sending ? 'Enviando...' : 'Enviar para Todos' }}
            </button>

            <div v-if="result" class="win-alert" :class="result.startsWith('✅') ? 'win-alert--success' : 'win-alert--error'">
              {{ result }}
            </div>
          </form>

          <div class="admin-info">
            <p><strong>Como funciona:</strong></p>
            <ul>
              <li>Notificação será enviada para <strong>todos</strong> os dispositivos com PWA instalado</li>
              <li>Funciona mesmo com o app fechado</li>
              <li>Tokens são salvos automaticamente quando usuário instala PWA</li>
            </ul>
          </div>

          <NuxtLink to="/" class="back-link">← Voltar para home</NuxtLink>
        </div>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.admin-title {
  font-family: $font-display;
  font-size: 1.5rem;
  color: $navy-electric;
  text-align: center;
  margin-bottom: $space-md;
  letter-spacing: 1px;
}

textarea.win-input {
  resize: vertical;
  font-family: $font-body;
}

.admin-info {
  margin-top: $space-lg;
  padding: $space-sm;
  background: $powder-blue;
  @include win-border-sunken;

  p {
    font-family: $font-display;
    font-size: 0.875rem;
    color: $graphite;
    margin-bottom: $space-xs;
  }

  ul {
    list-style: none;
    padding-left: 0;

    li {
      font-family: $font-body;
      font-size: 0.75rem;
      color: $graphite;
      margin-bottom: $space-xs;
      padding-left: $space-sm;
      position: relative;

      &::before {
        content: '→';
        position: absolute;
        left: 0;
        color: $navy-electric;
      }
    }
  }
}

.back-link {
  display: inline-block;
  margin-top: $space-md;
  font-family: $font-display;
  font-size: 0.875rem;
  color: $smart-blue;
  text-decoration: underline;

  &:hover {
    color: $navy-electric;
  }
}
</style>
