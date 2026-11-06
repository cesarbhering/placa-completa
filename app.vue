<script setup lang="ts">
import { COLUNAS_RODAPE, ROTULOS_RODAPE_EN } from '~/shared/rodape-links'
import { BASE_URL, parDeIdiomas } from '~/shared/idiomas'
import { jsonLdProdutos, semProdutoNaPagina } from '~/shared/jsonld-produto'
const isReady = ref(false)
const isPWA = ref(false)

// Theming por dominio: regra global de canonical (moto conteudo-proprio vs
// funil cross-domain pro placacompleta). Uma chamada so, cobre toda pagina —
// ver composables/useSelfCanonical.ts.
useDomainCanonical()

// Header nas paginas de conteudo. A home e a area premium montam o proprio
// (uma precisa ligar o campo de placa ao formulario do herói, a outra vive
// dentro de uma faixa branca), entao aqui ele cobre so o resto do site, que
// antes nao tinha cabecalho nenhum.
const route = useRoute()

// JSON-LD do produto (a consulta), template unico do site: toda oferta sai
// dentro de um Product (shared/jsonld-produto.ts). Fora da area paga e das telas internas.
// URL sempre no dominio canonico (pagina pre-renderizada saia com "localhost").
useHead(() => (semProdutoNaPagina(route.path) ? {} : {
  script: [{ key: 'ld-produto', type: 'application/ld+json', innerHTML: JSON.stringify(jsonLdProdutos(route.path)) }],
}))
// English version (Nov 6, 2026). On pages that exist in both languages:
// hreflang pt-BR / en / x-default (x-default = PT), and on /en pages the html
// lang and og:locale switch to English. PT pages keep their head untouched
// apart from the three hreflang links. Token pages (noindex) get none.
const { t, emIngles, rota } = useIdioma()
useHead(() => {
  const par = parDeIdiomas(route.path)
  const head: Record<string, any> = {}
  if (par && par.pagina.redireciona) {
    head.link = [
      { rel: 'alternate', hreflang: 'pt-BR', href: `${BASE_URL}${par.pt}`, key: 'hreflang-pt' },
      { rel: 'alternate', hreflang: 'en', href: `${BASE_URL}${par.en}`, key: 'hreflang-en' },
      { rel: 'alternate', hreflang: 'x-default', href: `${BASE_URL}${par.pt}`, key: 'hreflang-x' },
    ]
  }
  if (emIngles.value) {
    // Site-wide defaults from nuxt.config are PT; on /en they get English
    // ones. Each page still overrides title, description and og with its own.
    const OG_TITLE = 'PlacaCompleta: full vehicle history report by license plate'
    const OG_DESC = 'Enter a Brazilian license plate and see what the listing does not tell you: restrictions, theft, liens, recalls, FIPE value and auction history.'
    head.htmlAttrs = { lang: 'en' }
    head.meta = [
      { property: 'og:locale', content: 'en_US', key: 'og:locale' },
      { name: 'description', content: OG_DESC, key: 'description' },
      { property: 'og:title', content: OG_TITLE, key: 'og:title' },
      { property: 'og:description', content: OG_DESC, key: 'og:description' },
      { property: 'og:image:alt', content: OG_TITLE, key: 'og:image:alt' },
      { name: 'twitter:title', content: OG_TITLE, key: 'twitter:title' },
      { name: 'twitter:description', content: OG_DESC, key: 'twitter:description' },
      { name: 'keywords', content: 'brazil license plate check, brazilian vehicle history, car history brazil, auction record, lien check, FIPE value, used car brazil', key: 'keywords' },
    ]
  }
  return head
})

// Footer columns in the current language: on /en, English labels, and links
// go to the /en twin when there is one (the rest opens in PT).
const colunasRodape = computed(() => {
  if (!emIngles.value) return COLUNAS_RODAPE
  const titulos: Record<string, string> = {
    Consultas: t('rodape.colunas.consultas'),
    'Preços e FIPE': t('rodape.colunas.precos'),
    Aprenda: t('rodape.colunas.aprenda'),
    Empresa: t('rodape.colunas.empresa'),
  }
  return COLUNAS_RODAPE.map((col) => ({
    titulo: titulos[col.titulo] || col.titulo,
    links: col.links.map((l) => ({ rotulo: ROTULOS_RODAPE_EN[l.to] || l.rotulo, to: rota(l.to) })),
  }))
})

const headerGlobal = computed(() => {
  const p = route.path
  if (p === '/' || p.startsWith('/placa/') || p.startsWith('/premium')) return false
  // /admin e /dash sao telas internas, nao site.
  return !p.startsWith('/admin') && !p.startsWith('/dash')
})

// Modal de consultas: mora aqui pra existir em qualquer rota. O header abre
// pelo mesmo estado compartilhado, sem a pagina no meio.
const modalConsultas = useState('pc-consultas-aberto', () => false)
useWhatsappOculto(modalConsultas)

// Detect PWA mode synchronously on client
if (import.meta.client) {
  isPWA.value = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true ||
                document.referrer.includes('android-app://')
}

// Wait for PWA Service Worker to be ready before showing app
// This prevents flicker during auto-update by keeping loading screen active
const pwaReady = useState('pwaReady', () => false)

if (!isPWA.value) {
  // Web: show app immediately, no loading screen
  isReady.value = true
} else {
  watch(pwaReady, (ready) => {
    if (ready) {
      // Small delay to ensure smooth transition and isPWA detection
      setTimeout(() => {
        isReady.value = true
      }, 100)
    }
  }, { immediate: true })
}

// Rodape: no celular as colunas sao sanfona fechada; no desktop ficam abertas
// e o titulo nao fecha nada.
const RODAPE_CEL = '(max-width: 760px)'
function cliqueColuna(e: Event) {
  if (import.meta.client && !window.matchMedia(RODAPE_CEL).matches) e.preventDefault()
}
onMounted(() => {
  if (!window.matchMedia(RODAPE_CEL).matches) return
  document.querySelectorAll<HTMLDetailsElement>('.footer__col').forEach((d) => { d.open = false })
})

function onStoreClick() {
  if (import.meta.client && (window as any).gtag) {
    (window as any).gtag('event', 'store_badge_click', {
      source: 'footer',
      store: 'google_play',
    })
  }
}
</script>

<template>
  <div>
    <!-- Gate de acesso: overlay de senha uma-vez (homolog e staging, via public.gated). -->
    <HomologGate />

    <!-- Empurrao de atualizacao do app Android antigo (TWA v1). So dispara no
         app da Play rodando no dominio principal e quando o servidor liga a flag. -->
    <ForceAppUpdate />

    <!-- PWA Loading Screen (PWA only) -->
    <div v-if="isPWA && !isReady" class="pwa-loader">
      <PlacaCompletaIcon variant="inverted" class="pwa-loader__logo" />
    </div>

    <div v-show="isReady">
      <!-- Faixa clara atras do header: as paginas legadas ainda vivem no
           gradiente navy do body, e o header e transparente com tinta escura.
           Sem a faixa ele sairia praticamente invisivel la. Sai quando essas
           paginas forem pro fundo claro. -->
      <div v-if="headerGlobal" class="faixa-header">
        <HomeHeader logo-variant="default" />
      </div>

      <NuxtPage />

      <ConsultasHistory :aberto="modalConsultas" @fechar="modalConsultas = false" />
      <!-- App: compra do Google Play concluida fora da tela de compra (pendente na loja). -->
      <ClientOnly><AvisoRelatorioPlay /></ClientOnly>
      <!-- WhatsApp flutuante (suporte): some em checkout/modal/Pix, sobe acima da barra de compra. -->
      <ClientOnly><WhatsappFlutuante /></ClientOnly>
      <!-- Rodape em colunas (opcao 1 do Cesar, 08/out): marca a esquerda +
           4 colunas (shared/rodape-links.ts). No celular as colunas viram
           sanfona (<details>, fechadas); marca, redes, pagamento e CNPJ ficam
           sempre visiveis. SSR sai com tudo aberto (crawler e desktop veem os
           links); o client fecha no celular. -->
      <footer class="footer">
        <div class="footer__grade">
          <div class="footer__marca">
            <NuxtLink :to="rota('/')" class="footer__logo" :aria-label="t('rodape.inicioAria')">
              <PlacaCompletaLogo crop />
            </NuxtLink>
            <p class="footer__frase">{{ t('rodape.frase') }}</p>
            <a
              v-if="!isPWA"
              href="https://play.google.com/store/apps/details?id=br.com.placacompleta&utm_source=site&utm_medium=footer&utm_campaign=download_badge"
              target="_blank"
              rel="noopener"
              class="footer__store-badge"
              :aria-label="t('rodape.playAria')"
              @click="onStoreClick"
            >
              <img src="/badges/google-play-pt-br.png" :alt="t('rodape.playAlt')" width="180" height="70" loading="lazy">
            </a>
            <!-- Perfis oficiais (shared/redes-sociais.ts). SVG inline, cor do rodape. -->
            <div class="footer__redes">
              <a href="https://www.linkedin.com/company/placacompleta/" target="_blank" rel="noopener noreferrer" :aria-label="t('rodape.linkedin')" class="footer__rede">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/></svg>
              </a>
              <a href="https://x.com/PlacaCompleta" target="_blank" rel="noopener noreferrer" :aria-label="t('rodape.x')" class="footer__rede">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.48l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.48 3.24H4.3l13.31 17.41Z"/></svg>
              </a>
              <a href="https://www.tiktok.com/@placacompleta/" target="_blank" rel="noopener noreferrer" :aria-label="t('rodape.tiktok')" class="footer__rede">
                <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
              </a>
              <a href="https://www.instagram.com/placa.completa/" target="_blank" rel="noopener noreferrer" :aria-label="t('rodape.instagram')" class="footer__rede">
                <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="currentColor"><path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2-.1-1.3-.1-1.6-.1-4.8s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.3-.1 1.6-.1 4.8-.1M12 0C8.7 0 8.3 0 7.1.1 5.8.1 4.9.3 4.1.6c-.8.3-1.5.7-2.2 1.4C1.3 2.7.9 3.4.6 4.2.3 5 .1 5.8.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.1 1.3.3 2.1.6 2.9.3.8.7 1.5 1.4 2.2.7.7 1.4 1.1 2.2 1.4.8.3 1.6.5 2.9.6 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c1.3-.1 2.1-.3 2.9-.6.8-.3 1.5-.7 2.2-1.4.7-.7 1.1-1.4 1.4-2.2.3-.8.5-1.6.6-2.9.1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.1-1.3-.3-2.1-.6-2.9-.3-.8-.7-1.5-1.4-2.2C21.3 1.3 20.6.9 19.8.6 19 .3 18.2.1 16.9.1 15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.8a1.4 1.4 0 1 0 0 2.9 1.4 1.4 0 0 0 0-2.9z"/></svg>
              </a>
            </div>
          </div>

          <nav class="footer__colunas" :aria-label="t('rodape.conteudoAria')">
            <details v-for="col in colunasRodape" :key="col.titulo" class="footer__col" open>
              <summary class="footer__col-tit" @click="cliqueColuna">{{ col.titulo }}</summary>
              <ul>
                <li v-for="l in col.links" :key="l.to">
                  <NuxtLink :to="l.to">{{ l.rotulo }}</NuxtLink>
                </li>
              </ul>
            </details>
          </nav>
        </div>

        <div class="footer__base">
          <p class="footer__cnpj">&copy; {{ new Date().getFullYear() }} PlacaCompleta · CNPJ 62.569.152/0001-67</p>
          <nav class="footer__legal" :aria-label="t('rodape.termosAria')">
            <NuxtLink :to="rota('/termos-de-uso')">{{ t('rodape.termos') }}</NuxtLink>
            <NuxtLink :to="rota('/politica-de-privacidade')">{{ t('rodape.privacidade') }}</NuxtLink>
          </nav>
          <SeletorIdioma />
          <div class="footer__pagamento">
            <span class="footer__pagamento-rot">{{ t('rodape.pagamento') }}</span>
            <LogosPagamento />
          </div>
        </div>
      </footer>
    </div>

  </div>
</template>

<style scoped>
.pwa-loader {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #001233 0%, #0466c8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.pwa-loader__logo {
  width: 120px;
  height: 120px;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(0.95);
  }
}
</style>

<style>
/* Global (not scoped) so .footer__store-badge applies to the footer in app.vue.
   .footer styles are defined globally in assets/styles. */
.footer__store-badge {
  display: inline-block;
  margin: 0;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.footer__store-badge:hover,
.footer__store-badge:focus-visible {
  transform: translateY(-1px);
  opacity: 0.92;
}

.footer__store-badge img {
  display: block;
  height: 56px;
  width: auto;
}

@media (max-width: 480px) {
  .footer__store-badge img {
    height: 48px;
  }
}
</style>
