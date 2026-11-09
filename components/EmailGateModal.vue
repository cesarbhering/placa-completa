<script setup lang="ts">
// E-mail obrigatorio a partir da terceira consulta gratis (gate do
// /api/consulta). A placa digitada fica onde estava: o modal so pede o e-mail
// e devolve pro chamador reenviar a mesma consulta.
import { emailGateSalvo } from '~/composables/useGateEmail'
const props = defineProps<{
  show: boolean
  /** Erro vindo do servidor (e-mail invalido, descartavel...). */
  erroServidor?: string
  /** Sugestao de correcao de digitacao vinda do servidor. */
  sugestao?: string
}>()

const emit = defineEmits<{
  close: []
  enviar: [email: string]
}>()

useWhatsappOculto(() => props.show)

const { validateEmail } = useFormValidation()
const email = ref('')
const erro = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(() => props.show, (v) => {
  if (!v) return
  erro.value = ''
  if (!email.value) email.value = emailGateSalvo()
  nextTick(() => inputRef.value?.focus())
}, { immediate: true })

watch(() => props.erroServidor, (v) => { if (v) erro.value = v })

function enviar() {
  erro.value = ''
  const v = email.value.trim()
  if (!validateEmail(v)) {
    erro.value = 'E-mail inválido.'
    return
  }
  emit('enviar', v)
}

function aplicarSugestao() {
  if (!props.sugestao) return
  email.value = props.sugestao
  erro.value = ''
}
</script>

<template>
  <div v-if="show" class="egm-overlay" @click="emit('close')">
    <div class="egm" role="dialog" aria-modal="true" aria-labelledby="egm-titulo" @click.stop>
      <button type="button" class="egm__fechar" aria-label="Fechar" @click="emit('close')">×</button>
      <h2 id="egm-titulo" class="egm__titulo">Informe seu e-mail</h2>
      <p class="egm__texto">Para continuar consultando grátis, informe seu e-mail.</p>
      <form novalidate @submit.prevent="enviar">
        <label class="egm__label" for="egm-email">Seu e-mail</label>
        <input
          id="egm-email"
          ref="inputRef"
          v-model="email"
          type="email"
          class="egm__input"
          :class="{ 'egm__input--erro': erro }"
          placeholder="seu@email.com"
          autocomplete="email"
          inputmode="email"
          required
          :aria-invalid="!!erro"
          aria-describedby="egm-erro egm-nota"
        />
        <p v-if="erro" id="egm-erro" class="egm__erro" role="alert">{{ erro }}</p>
        <button v-if="sugestao" type="button" class="egm__sugestao" @click="aplicarSugestao">
          Você quis dizer <strong>{{ sugestao }}</strong>?
        </button>
        <button type="submit" class="egm__btn">Continuar consulta</button>
        <p id="egm-nota" class="egm__nota">
          Usamos o e-mail só para identificar suas consultas. Veja a
          <NuxtLink to="/politica-de-privacidade" target="_blank">política de privacidade</NuxtLink>.
        </p>
      </form>
    </div>
  </div>
</template>

<style scoped>
.egm-overlay {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  padding: 16px; background: rgba(0, 0, 0, 0.55);
}
.egm {
  position: relative; width: 100%; max-width: 400px;
  padding: 24px 20px 20px; border-radius: 12px;
  background: #fff; color: #1a1a1a; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
}
.egm__fechar {
  position: absolute; top: 8px; right: 10px; border: 0; background: none;
  font-size: 1.5rem; line-height: 1; color: #555; cursor: pointer;
}
.egm__titulo { margin: 0 0 6px; font-size: 1.15rem; }
.egm__texto { margin: 0 0 14px; font-size: 0.95rem; color: #333; }
.egm__label { display: block; margin-bottom: 4px; font-size: 0.85rem; font-weight: 600; }
.egm__input {
  width: 100%; box-sizing: border-box; padding: 12px; font-size: 1rem;
  border: 1px solid #b5b5b5; border-radius: 8px;
}
.egm__input--erro { border-color: #c62828; }
.egm__erro { margin: 6px 0 0; color: #c62828; font-size: 0.85rem; }
.egm__sugestao {
  margin-top: 6px; padding: 0; border: 0; background: none;
  color: #1565c0; font-size: 0.85rem; text-decoration: underline; cursor: pointer;
}
.egm__btn {
  width: 100%; margin-top: 14px; padding: 12px; border: 0; border-radius: 8px;
  background: #1565c0; color: #fff; font-size: 1rem; font-weight: 700; cursor: pointer;
}
.egm__nota { margin: 10px 0 0; font-size: 0.75rem; color: #666; }
</style>
