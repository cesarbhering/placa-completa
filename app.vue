<script setup lang="ts">
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
      <footer class="footer">
        <nav class="footer__nav" aria-label="Conteúdo do site">
          <NuxtLink to="/consultar-placa">Consultar por Estado</NuxtLink>
          <span class="footer__sep">|</span>
          <NuxtLink to="/tabela-fipe">Tabela FIPE</NuxtLink>
          <span class="footer__sep">|</span>
          <NuxtLink to="/tabela-fipe-por-placa">FIPE pela Placa</NuxtLink>
          <span class="footer__sep">|</span>
          <NuxtLink to="/como-consultar-placa">Como Consultar</NuxtLink>
          <span class="footer__sep">|</span>
          <NuxtLink to="/carro-de-leilao/como-saber">Carro de Leilão</NuxtLink>
          <span class="footer__sep">|</span>
          <NuxtLink to="/ibv">IBV Auto</NuxtLink>
          <span class="footer__sep">|</span>
          <NuxtLink to="/estudos">Estudos</NuxtLink>
        </nav>

        <a
          v-if="!isPWA"
          href="https://play.google.com/store/apps/details?id=br.com.placacompleta&utm_source=site&utm_medium=footer&utm_campaign=download_badge"
          target="_blank"
          rel="noopener"
          class="footer__store-badge"
          aria-label="Baixe o PlacaCompleta na Google Play Store"
          @click="onStoreClick"
        >
          <img
            src="/badges/google-play-pt-br.png"
            alt="Disponível no Google Play"
            width="180"
            height="70"
            loading="lazy"
          >
        </a>

        <p>&copy; {{ new Date().getFullYear() }} PlacaCompleta. Consulta veicular grátis e segura.</p>
        <p class="footer__cnpj">CNPJ 62.569.152/0001-67</p>
        <div class="footer__pagamento">
          <span class="footer__pagamento-rot">Formas de pagamento</span>
          <LogosPagamento />
        </div>
        <p class="footer__email">
          Contato: <a href="mailto:contato@placacompleta.com.br">contato@placacompleta.com.br</a>
        </p>
        <nav class="footer__links">
          <NuxtLink to="/sobre">Sobre</NuxtLink>
          <span class="footer__sep">|</span>
          <NuxtLink to="/termos-de-uso">Termos de Uso</NuxtLink>
          <span class="footer__sep">|</span>
          <NuxtLink to="/politica-de-privacidade">Política de Privacidade</NuxtLink>
        </nav>
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
  margin: 16px auto 8px;
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
