<script setup lang="ts">
import { COLUNAS_RODAPE } from '~/shared/rodape-links'
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
const headerGlobal = computed(() => {
  const p = route.path
  if (p === '/' || p.startsWith('/placa/') || p.startsWith('/premium')) return false
  // /admin e /dash sao telas internas, nao site.
  return !p.startsWith('/admin') && !p.startsWith('/dash')
})

// Modal de consultas: mora aqui pra existir em qualquer rota. O header abre
// pelo mesmo estado compartilhado, sem a pagina no meio.
const modalConsultas = useState('pc-consultas-aberto', () => false)

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
      <!-- Rodape em colunas (opcao 1 do Cesar, 08/out): marca a esquerda +
           4 colunas (shared/rodape-links.ts). No celular as colunas viram
           sanfona (<details>, fechadas); marca, redes, pagamento e CNPJ ficam
           sempre visiveis. SSR sai com tudo aberto (crawler e desktop veem os
           links); o client fecha no celular. -->
      <footer class="footer">
        <div class="footer__grade">
          <div class="footer__marca">
            <NuxtLink to="/" class="footer__logo" aria-label="PlacaCompleta, página inicial">
              <PlacaCompletaLogo crop />
            </NuxtLink>
            <p class="footer__frase">Consulta veicular por placa para quem vai comprar um usado. Leilão, roubo, gravame, multas e recall antes de fechar negócio.</p>
            <a
              v-if="!isPWA"
              href="https://play.google.com/store/apps/details?id=br.com.placacompleta&utm_source=site&utm_medium=footer&utm_campaign=download_badge"
              target="_blank"
              rel="noopener"
              class="footer__store-badge"
              aria-label="Baixe o PlacaCompleta na Google Play Store"
              @click="onStoreClick"
            >
              <img src="/badges/google-play-pt-br.png" alt="Disponível no Google Play" width="180" height="70" loading="lazy">
            </a>
            <!-- Perfis oficiais (shared/redes-sociais.ts). SVG inline, cor do rodape. -->
            <div class="footer__redes">
              <a href="https://www.linkedin.com/company/placacompleta/" target="_blank" rel="noopener noreferrer" aria-label="PlacaCompleta no LinkedIn" class="footer__rede">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/></svg>
              </a>
              <a href="https://x.com/PlacaCompleta" target="_blank" rel="noopener noreferrer" aria-label="PlacaCompleta no X" class="footer__rede">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.48l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.48 3.24H4.3l13.31 17.41Z"/></svg>
              </a>
            </div>
          </div>

          <nav class="footer__colunas" aria-label="Conteúdo do site">
            <details v-for="col in COLUNAS_RODAPE" :key="col.titulo" class="footer__col" open>
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
          <nav class="footer__legal" aria-label="Termos">
            <NuxtLink to="/termos-de-uso">Termos de Uso</NuxtLink>
            <NuxtLink to="/politica-de-privacidade">Política de Privacidade</NuxtLink>
          </nav>
          <div class="footer__pagamento">
            <span class="footer__pagamento-rot">Formas de pagamento</span>
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
