<script setup lang="ts">
const props = defineProps<{
  show: boolean
}>()

useWhatsappOculto(() => props.show)

const emit = defineEmits<{
  close: []
  save: [email: string]
}>()

const { validateEmail } = useFormValidation()

const pwaEmail = ref('')
const pwaEmailError = ref('')
const emailRef = ref<HTMLInputElement | null>(null)

watch(() => props.show, (newValue) => {
  if (newValue) {
    nextTick(() => {
      emailRef.value?.focus()
    })
  }
})

function handleSave() {
  pwaEmailError.value = ''

  if (!validateEmail(pwaEmail.value)) {
    pwaEmailError.value = 'E-mail inválido.'
    return
  }

  localStorage.setItem('pwa_email', pwaEmail.value)
  emit('save', pwaEmail.value)
  pwaEmail.value = ''
}

function handleClose() {
  pwaEmailError.value = ''
  pwaEmail.value = ''
  emit('close')
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click="handleClose">
    <div class="win-window modal-window" @click.stop>
      <div class="win-window__titlebar">
        <span>📧 Salvar E-mail</span>
        <div class="win-window__titlebar-buttons">
          <button class="win-window__titlebar-btn" @click="handleClose">×</button>
        </div>
      </div>
      <div class="win-window__body">
        <p class="modal-text">
          Para usar o PWA, precisamos salvar seu e-mail para enviar os resultados das consultas.
        </p>

        <form @submit.prevent="handleSave">
          <div class="form-group">
            <label class="form-group__label" for="pwa-email">E-mail</label>
            <input
              id="pwa-email"
              ref="emailRef"
              v-model="pwaEmail"
              type="email"
              class="win-input"
              :class="{ 'win-input--error': pwaEmailError }"
              placeholder="seu@email.com"
              required
            />
            <span v-if="pwaEmailError" class="form-group__error">{{ pwaEmailError }}</span>
          </div>

          <div class="button-group">
            <button type="submit" class="win-btn win-btn--primary">
              Salvar
            </button>
            <button type="button" class="win-btn" @click="handleClose">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: $space-md;
}

.modal-window {
  max-width: 500px;
  width: 100%;
}

.modal-text {
  font-family: $font-body;
  font-size: 0.875rem;
  color: $graphite;
  margin-bottom: $space-md;
  line-height: 1.5;
}

.button-group {
  display: flex;
  gap: $space-sm;
  margin-top: $space-md;

  button {
    flex: 1;
  }
}
</style>
