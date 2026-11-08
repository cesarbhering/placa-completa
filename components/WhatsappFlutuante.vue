<script setup lang="ts">
import { tipoDePagina, whatsappVisivel } from '~/shared/contato'

// Floating contact button (bottom right). It used to open the company
// WhatsApp; since 07/11/2026 the number is offline, so it opens a short form
// (e-mail + phone + optional message) that POSTs to /api/contato/mensagem,
// which e-mails Cesar through Resend. It still hides on checkout, modals and
// the Pix screen, and rises above the fixed buy bar on mobile.
const route = useRoute()
const { ocultos, acimaPx } = useWhatsappEstado()
const visivel = computed(() => whatsappVisivel(route.path, ocultos.value))
const { track } = useAnalytics()
const { t } = useI18n()

const aberto = ref(false)
const enviando = ref(false)
const enviado = ref(false)
const erro = ref('')
const campoErro = ref('')
const form = reactive({ email: '', telefone: '', mensagem: '', site: '' })
const emailRef = ref<HTMLInputElement | null>(null)

function abrir() {
  aberto.value = true
  erro.value = ''
  campoErro.value = ''
  track('contato_form_open', { pagina: tipoDePagina(route.path) })
  nextTick(() => emailRef.value?.focus())
}

function fechar() {
  aberto.value = false
  if (enviado.value) {
    enviado.value = false
    form.mensagem = ''
  }
}

async function enviar() {
  if (enviando.value) return
  erro.value = ''
  campoErro.value = ''
  enviando.value = true
  try {
    await $fetch('/api/contato/mensagem', {
      method: 'POST',
      body: { ...form, pagina: tipoDePagina(route.path) },
    })
    enviado.value = true
    track('contato_form_sent', { pagina: tipoDePagina(route.path) })
  } catch (e: any) {
    erro.value = e?.data?.message || e?.statusMessage || t('contatoForm.erro')
    campoErro.value = e?.data?.data?.campo || ''
  } finally {
    enviando.value = false
  }
}

function tecla(e: KeyboardEvent) {
  if (e.key === 'Escape' && aberto.value) fechar()
}
onMounted(() => window.addEventListener('keydown', tecla))
onBeforeUnmount(() => window.removeEventListener('keydown', tecla))
</script>

<template>
  <div>
    <button
      v-show="visivel && !aberto"
      type="button"
      class="ct-flutuante"
      :aria-label="t('contatoForm.aria')"
      :style="{ '--ct-acima': acimaPx + 'px' }"
      @click="abrir"
    >
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
        <path fill="#fff" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2Zm2 4v2h12V8H6Zm0 4v2h8v-2H6Z" />
      </svg>
    </button>

    <div v-if="aberto" class="ct-fundo" @click.self="fechar">
      <div class="ct-caixa" role="dialog" aria-modal="true" aria-labelledby="ct-titulo">
        <button type="button" class="ct-x" :aria-label="t('contatoForm.fechar')" @click="fechar">×</button>

        <template v-if="enviado">
          <h2 id="ct-titulo" class="ct-titulo">{{ t('contatoForm.okTitulo') }}</h2>
          <p class="ct-sub">{{ t('contatoForm.okTexto') }}</p>
          <button type="button" class="pc-btn pc-btn--primary ct-enviar" @click="fechar">{{ t('contatoForm.fechar') }}</button>
        </template>

        <form v-else class="ct-form" novalidate @submit.prevent="enviar">
          <h2 id="ct-titulo" class="ct-titulo">{{ t('contatoForm.titulo') }}</h2>
          <p class="ct-sub">{{ t('contatoForm.sub') }}</p>

          <label for="ct-email">{{ t('contatoForm.email') }}</label>
          <input id="ct-email" ref="emailRef" v-model="form.email" type="email" inputmode="email" autocomplete="email" maxlength="160" required :aria-invalid="campoErro === 'email'">

          <label for="ct-tel">{{ t('contatoForm.telefone') }}</label>
          <input id="ct-tel" v-model="form.telefone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" :placeholder="t('contatoForm.telefonePlaceholder')" required :aria-invalid="campoErro === 'telefone'">

          <label for="ct-msg">{{ t('contatoForm.mensagem') }}</label>
          <textarea id="ct-msg" v-model="form.mensagem" rows="3" maxlength="2000" />

          <!-- Honeypot: invisible to people, bots fill it. -->
          <input v-model="form.site" class="ct-hp" type="text" name="site" tabindex="-1" autocomplete="off" aria-hidden="true">

          <p v-if="erro" class="ct-erro" role="alert">{{ erro }}</p>
          <button type="submit" class="pc-btn pc-btn--primary ct-enviar" :disabled="enviando">
            {{ enviando ? t('contatoForm.enviando') : t('contatoForm.enviar') }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ct-flutuante {
  position: fixed;
  right: 16px;
  bottom: calc(16px + var(--ct-acima, 0px) + env(safe-area-inset-bottom, 0px));
  /* Below the fixed buy bar (900) and every modal/checkout (1000+). */
  z-index: 850;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border: 0;
  border-radius: 50%;
  background: var(--pc-blue, #1f6feb);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, bottom 0.2s ease;
}
.ct-flutuante:hover { transform: scale(1.06); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28); }
.ct-flutuante:focus-visible { outline: 3px solid var(--pc-blue-deep, #17539f); outline-offset: 3px; }
@media (min-width: 761px) {
  .ct-flutuante { right: 24px; bottom: calc(24px + var(--ct-acima, 0px)); width: 60px; height: 60px; }
}
@media print { .ct-flutuante, .ct-fundo { display: none; } }

.ct-fundo {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  background: rgba(11, 31, 58, 0.45);
}
@media (min-width: 761px) { .ct-fundo { align-items: center; } }
.ct-caixa {
  position: relative;
  width: 100%;
  max-width: 420px;
  max-height: 100%;
  overflow-y: auto;
  padding: 20px 18px 18px;
  border-radius: 14px;
  background: #fff;
  color: var(--pc-ink, #1a1a1a);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}
.ct-x {
  position: absolute;
  top: 6px;
  right: 8px;
  width: 36px;
  height: 36px;
  border: 0;
  background: none;
  font-size: 26px;
  line-height: 1;
  color: var(--pc-graphite, #636363);
  cursor: pointer;
}
.ct-titulo { margin: 0 32px 4px 0; font-size: 1.15rem; }
.ct-sub { margin: 0 0 12px; color: var(--pc-graphite, #636363); font-size: 0.92rem; }
.ct-form { display: grid; gap: 6px; }
.ct-form label { margin-top: 6px; font-size: 0.88rem; font-weight: 600; }
.ct-form input, .ct-form textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #cfd6df;
  border-radius: 8px;
  font: inherit;
  font-size: 16px; /* no iOS zoom on focus */
}
.ct-form input[aria-invalid='true'] { border-color: var(--pc-red, #d33a3a); }
.ct-form textarea { resize: vertical; }
.ct-hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.ct-erro { margin: 6px 0 0; color: var(--pc-red, #d33a3a); font-size: 0.9rem; }
.ct-enviar { width: 100%; margin-top: 12px; }
</style>
