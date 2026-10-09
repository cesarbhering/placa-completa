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

useHead({
  title: escolherTitulo(['Contato do PlacaCompleta: E-mail e Prazo de Resposta']),
  titleTemplate: '%s',
  meta: [
    { name: 'description', content: DESCRICOES.contato },
    { property: 'og:title', content: 'Contato do PlacaCompleta' },
    { property: 'og:description', content: DESCRICOES.contato },
  ],
  link: [{ rel: 'canonical', href: 'https://placacompleta.com.br/contato' }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: 'Contato do PlacaCompleta',
        url: 'https://placacompleta.com.br/contato',
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
      <h1 class="pc-h1">Contato</h1>

      <div class="pc-prose">
        <p>
          Dúvida sobre uma consulta, problema com um relatório, correção de dado,
          imprensa ou parceria: escreva para o nosso e-mail.
        </p>

        <div class="contato-email">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <span class="contato-email__end" v-html="emailContatoHtml" />
          <button v-if="podeCopiar" type="button" class="pc-btn pc-btn--primary contato-email__copiar" @click="copiar">
            {{ copiado ? 'E-mail copiado' : 'Copiar e-mail' }}
          </button>
        </div>

        <h2>Prazo de resposta</h2>
        <p>
          Respondemos por e-mail em até 2 dias úteis. Se a dúvida for sobre um
          relatório, mande a placa e o link do relatório: assim a gente encontra
          o pedido mais rápido.
        </p>

        <h2>Termos e privacidade</h2>
        <p>
          Antes de escrever, pode ser que a resposta já esteja nos
          <NuxtLink to="/termos-de-uso">Termos de Uso</NuxtLink> ou na
          <NuxtLink to="/politica-de-privacidade">Política de Privacidade</NuxtLink>,
          que também explica como pedir acesso ou exclusão dos seus dados.
        </p>
      </div>

      <nav class="pc-breadcrumb">
        <NuxtLink to="/">PlacaCompleta</NuxtLink>
        <span> &rsaquo; </span>
        <strong>Contato</strong>
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
