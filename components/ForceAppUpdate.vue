<script setup lang="ts">
// Empurra o usuario do app Android ANTIGO (TWA v1, que aponta pra
// placacompleta.com.br) a atualizar pro app novo (que aponta pro subdominio
// congelado app.placacompleta.com.br). Dispara SO quando:
//   1) e o app instalado da Play (referrer android-app do pacote), rodando em
//      modo standalone;
//   2) esta no dominio principal (nao no app.*, homolog.*, staging.*, browser);
//   3) o servidor liga a flag (/api/app-status -> forceUpdate), que so vai pra
//      true depois que o v2 estiver publicado.
// Assim nunca afeta navegador, PWA-web, ambientes de teste, nem o app novo.
const PACKAGE = 'br.com.placacompleta'
const PLAY_URL = `https://play.google.com/store/apps/details?id=${PACKAGE}`
const MAIN_HOSTS = ['placacompleta.com.br', 'www.placacompleta.com.br']

const ativo = ref(false)

function abrirPlay() {
  // market:// abre a Play Store nativa; https como fallback se nao resolver.
  try { window.location.href = `market://details?id=${PACKAGE}` } catch { /* ignore */ }
  setTimeout(() => { window.location.href = PLAY_URL }, 400)
}

onMounted(async () => {
  // QA visual: ?__fau=1 mostra o overlay sem precisar do app real. Inofensivo
  // (exige o parametro explicito) e nao chama o servidor.
  const params = new URLSearchParams(window.location.search)
  if (params.get('__fau') === '1') { ativo.value = true; document.body.style.overflow = 'hidden'; return }

  const refTwa = document.referrer.startsWith(`android-app://${PACKAGE}`)
  // O referrer android-app so vem no launch da TWA; persiste pra valer nas
  // navegacoes seguintes da mesma sessao/instalacao.
  if (refTwa) { try { localStorage.setItem('pc_twa', '1') } catch { /* modo privado */ } }
  let isTwa = refTwa
  if (!isTwa) { try { isTwa = localStorage.getItem('pc_twa') === '1' } catch { /* modo privado */ } }

  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true
  const mainDomain = MAIN_HOSTS.includes(window.location.hostname)
  if (!(isTwa && standalone && mainDomain)) return

  try {
    const r: any = await $fetch('/api/app-status')
    if (r?.forceUpdate) { ativo.value = true; document.body.style.overflow = 'hidden' }
  } catch { /* falha de rede nao pode travar o app */ }
})
</script>

<template>
  <ClientOnly>
    <div v-if="ativo" class="fau" role="dialog" aria-modal="true" aria-label="Atualização disponível">
      <div class="fau__card">
        <img src="/pwa-192x192.png" alt="" class="fau__logo" width="72" height="72" aria-hidden="true">
        <h2 class="fau__t">Uma nova versão está disponível</h2>
        <p class="fau__p">Atualize o PlacaCompleta para continuar usando o app com as últimas melhorias.</p>
        <button type="button" class="fau__btn" @click="abrirPlay">Atualizar agora</button>
      </div>
    </div>
  </ClientOnly>
</template>

<style scoped>
.fau {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(135deg, #001233 0%, #0466c8 100%);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
.fau__card {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 14px;
  color: #fff;
}
.fau__logo { border-radius: 16px; }
.fau__t { margin: 4px 0 0; font-size: 22px; font-weight: 700; }
.fau__p { margin: 0; font-size: 15px; line-height: 1.5; color: #cfe0f7; }
.fau__btn {
  margin-top: 8px;
  width: 100%;
  background: #fff;
  color: #0466c8;
  border: 0;
  border-radius: 8px;
  padding: 14px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}
.fau__btn:active { transform: translateY(1px); }
</style>
