<script setup lang="ts">
// Pagina de contato. Existe porque o rodape linkava mailto: em todas as
// paginas, e o Email Obfuscation da Cloudflare (ligado de proposito) reescreve
// mailto/e-mail em texto pra /cdn-cgi/l/email-protection#..., que da 404 pra
// crawler: ~380 "links quebrados" no Ahrefs. Agora o rodape aponta pra ca e o
// e-mail aparece SO aqui, dentro de <!--email_off-->, que a Cloudflare respeita
// e nao reescreve.
import { ref, onMounted } from 'vue'
import { escolherTitulo } from '~/shared/seo-titulo'
import { DESCRICOES } from '~/shared/seo-meta'
import { EMAIL_CONTATO, emailContatoHtml } from '~/shared/contato'

import { DESCRICOES_EN } from '~/shared/seo-meta-en'
const { t, emIngles, rota } = useIdioma()
const URL_PAGINA = `https://placacompleta.com.br${rota('/contato')}`
const descricao = emIngles.value ? DESCRICOES_EN.contato : DESCRICOES.contato
useHead({
  title: escolherTitulo([t('contato.title')]),
  titleTemplate: '%s',
  meta: [
    { name: 'description', content: descricao },
    { property: 'og:title', content: t('contato.ogTitle') },
    { property: 'og:description', content: descricao },
  ],
  link: [{ rel: 'canonical', href: URL_PAGINA }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: t('contato.ogTitle'),
        url: URL_PAGINA,
      }),
    },
  ],
})

const copiado = ref(false)
const podeCopiar = ref(false)
onMounted(() => { podeCopiar.value = !!navigator.clipboard })
async function copiar() {
  try {
    await navigator.clipboard.writeText(EMAIL_CONTATO)
    copiado.value = true
    setTimeout(() => { copiado.value = false }, 2500)
  } catch { /* sem clipboard: o e-mail esta na tela */ }
}
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <h1 class="pc-h1">{{ t('contato.h1') }}</h1>

      <div class="pc-prose">
        <p>{{ t('contato.intro') }}</p>

        <div class="contato-email">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <span class="contato-email__end" v-html="emailContatoHtml" />
          <button v-if="podeCopiar" type="button" class="pc-btn pc-btn--primary contato-email__copiar" @click="copiar">
            {{ copiado ? t('contato.copiado') : t('contato.copiar') }}
          </button>
        </div>

        <h2>{{ t('contato.relatorioH2') }}</h2>
        <p>{{ t('contato.relatorioP') }}</p>

        <h2>{{ t('contato.termosH2') }}</h2>
        <i18n-t keypath="contato.termosP" tag="p" scope="global">
          <template #termos><NuxtLink :to="rota('/termos-de-uso')">{{ t('rodape.termos') }}</NuxtLink></template>
          <template #privacidade><NuxtLink :to="rota('/politica-de-privacidade')">{{ t('rodape.privacidade') }}</NuxtLink></template>
        </i18n-t>
      </div>

      <nav class="pc-breadcrumb">
        <NuxtLink :to="rota('/')">PlacaCompleta</NuxtLink>
        <span> &rsaquo; </span>
        <strong>{{ t('contato.h1') }}</strong>
      </nav>
    </main>
  </div>
</template>

<style scoped>
.contato-email {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 20px 0 28px;
}

.contato-email__end {
  font-size: 1.15rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.contato-email__copiar {
  min-height: 44px;
}
</style>
