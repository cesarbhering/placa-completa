<script setup lang="ts">
// Header de navegacao da home (web / nao-PWA). Estilo .toolbar do mockup v2.0:
// barra navy arredondada, logo a esquerda + nav ancora a direita.
// Os alvos das ancoras (#como-funciona, #o-que-inclui, #duvidas) vivem em
// pages/index.vue. Scroll suave herda do html{scroll-behavior:smooth} global.
interface Props {
  // A home v2.1 tem nav clara (guia HP: nav em canvas com hairline), entao
  // pede o logo escuro. O default fica no invertido pra nao mudar quem ja
  // usa o header sobre fundo escuro.
  logoVariant?: 'default' | 'brutalist' | 'fintech' | 'inverted'
  /** Placa digitada. Compartilhada com o formulario do herói. */
  placa?: string
  /** Depois da consulta o campo vira o selo "placa consultada". */
  consultada?: boolean
  /**
   * O campo de placa do header so entra quando o formulario do herói sai da
   * tela. Com os dois visiveis ao mesmo tempo seriam dois campos identicos
   * disputando a mesma acao.
   */
  mostrarBusca?: boolean
  /**
   * Quantas consultas pagas existem no historico local. Zero esconde o item:
   * "Suas consultas" vazio so daria uma porta pra lugar nenhum.
   */
  consultas?: number
}

withDefaults(defineProps<Props>(), {
  logoVariant: 'inverted',
  placa: '',
  consultada: false,
  mostrarBusca: true,
  consultas: 0,
})

const emit = defineEmits<{
  consult: []
  'update:placa': [value: string]
  submit: []
  'abrir-consultas': []
}>()

// Ancoras da propria home + as paginas de conteudo. Rota usa NuxtLink (SPA);
// ancora fica em <a> normal, senao o NuxtLink tentaria resolver "#x" como rota.
const links = [
  { href: '#o-que-inclui', label: 'O que inclui' },
  { href: '/ibv', label: 'IBV Auto' },
  { href: '/tabela-fipe', label: 'Tabela FIPE' },
  { href: '/estudos', label: 'Estudos' },
  { href: '#duvidas', label: 'Dúvidas' },
]
const ehAncora = (href: string) => href.startsWith('#')

// Menu do mobile. Abaixo de 1024px os cinco links nao cabem na barra e
// quebravam em duas linhas; viram gaveta atras do hamburguer (o guia HP pede
// exatamente isso abaixo desse ponto).
const menuAberto = ref(false)
const fechaMenu = () => { menuAberto.value = false }

// Rolar com a gaveta aberta deixaria o painel solto no meio da tela.
watch(menuAberto, (aberto) => {
  if (import.meta.client) document.body.style.overflow = aberto ? 'hidden' : ''
})
onUnmounted(() => { if (import.meta.client) document.body.style.overflow = '' })
</script>

<template>
  <header class="home-header">
    <a href="#top" class="home-header__brand" aria-label="PlacaCompleta, ir para o topo">
      <PlacaCompletaLogo :variant="logoVariant" crop class="home-header__logo" />
    </a>
    <!-- Centro do header: enquanto nao consultou, um campo de placa sempre a
         mao; depois, o selo da placa consultada. Com o header fixo, a acao
         principal nunca sai da tela. -->
    <div class="home-header__center">
      <div v-if="consultada" class="home-header__done">
        <span class="home-header__done-label">Placa consultada</span>
        <strong>{{ placa }}</strong>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="9" fill="currentColor" />
          <path d="M6 10.2l2.6 2.6L14 7.4" fill="none" stroke="#fff" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <form v-else-if="mostrarBusca" class="home-header__search" @submit.prevent="emit('submit')">
        <label class="home-header__search-label" for="hdr-placa">Insira aqui a placa</label>
        <input
          id="hdr-placa"
          class="home-header__search-input"
          :value="placa"
          type="text"
          placeholder="ABC1D23"
          maxlength="7"
          autocomplete="off"
          autocapitalize="characters"
          @input="emit('update:placa', ($event.target as HTMLInputElement).value)"
        />
        <button type="submit" class="home-header__search-btn" aria-label="Consultar placa">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M13.5 13.5L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </form>
    </div>

    <nav class="home-header__nav" aria-label="Navegação principal">
      <template v-for="link in links" :key="link.href">
        <a v-if="ehAncora(link.href)" :href="link.href" class="home-header__link">{{ link.label }}</a>
        <NuxtLink v-else :to="link.href" class="home-header__link">{{ link.label }}</NuxtLink>
      </template>
      <button
        v-if="consultas > 0"
        type="button"
        class="home-header__link home-header__link--btn"
        @click="emit('abrir-consultas')"
      >
        Suas consultas <span class="home-header__badge">{{ consultas }}</span>
      </button>
    </nav>

    <button
      type="button"
      class="home-header__burger"
      :aria-expanded="menuAberto ? 'true' : 'false'"
      aria-controls="menu-mobile"
      :aria-label="menuAberto ? 'Fechar menu' : 'Abrir menu'"
      @click="menuAberto = !menuAberto"
    >
      <span :class="{ 'is-x': menuAberto }" aria-hidden="true" />
    </button>

    <!-- Veu e gaveta vao pro body via Teleport: o .cb-navband tem
         backdrop-filter, e isso cria um bloco de contencao que faz o
         position:fixed dos filhos se referir a barra de 80px em vez da
         viewport. Sem o teleport a gaveta nascia com 80px de altura e
         transparente. O escopo do componente viaja junto, entao os estilos
         daqui continuam valendo. -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="menuAberto" class="home-header__scrim" @click="fechaMenu" />

        <nav
          id="menu-mobile"
          class="home-header__gaveta"
          :class="{ 'is-open': menuAberto }"
          aria-label="Navegação principal"
        >
          <button type="button" class="home-header__gaveta-x" aria-label="Fechar menu" @click="fechaMenu">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
          <template v-for="link in links" :key="'m-' + link.href">
            <a v-if="ehAncora(link.href)" :href="link.href" class="home-header__gaveta-link" @click="fechaMenu">{{ link.label }}</a>
            <NuxtLink v-else :to="link.href" class="home-header__gaveta-link" @click="fechaMenu">{{ link.label }}</NuxtLink>
          </template>
          <button
            v-if="consultas > 0"
            type="button"
            class="home-header__gaveta-link home-header__gaveta-link--btn"
            @click="fechaMenu(); emit('abrir-consultas')"
          >
            Suas consultas <span class="home-header__badge">{{ consultas }}</span>
          </button>
        </nav>
      </Teleport>
    </ClientOnly>
  </header>
</template>

<style lang="scss" scoped>
// ---------- gaveta do mobile ----------
// Vive aqui (e nao no index) porque o Teleport joga os elementos pro body: o
// seletor :deep(.home-v2 ...) do index deixaria de alcanca-los. O escopo do
// componente acompanha o teleport, entao estas regras seguem valendo.
$g-canvas: #ffffff;
$g-hair: #e8e8e8;
$g-ink: #1a1a1a;
$g-blue: #1f6feb;

.home-header__scrim {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(26, 26, 26, 0.45);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
}

.home-header__gaveta {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1210;
  width: min(300px, 82vw);
  background: $g-canvas;
  border-left: 1px solid $g-hair;
  padding: 72px 20px 20px;
  display: flex;
  flex-direction: column;
  transform: translateX(101%);
  transition: transform 0.26s cubic-bezier(0.22, 0.61, 0.36, 1);
  overflow-y: auto;

  &.is-open { transform: translateX(0); }

  @media (prefers-reduced-motion: reduce) { transition: none; }
  // Acima de 1024px a nav normal volta e a gaveta nao existe.
  @media (min-width: 1024px) { display: none; }
}

.home-header__gaveta-x {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 0;
  color: $g-ink;
  cursor: pointer;

  svg { width: 22px; height: 22px; }
  &:focus-visible { outline: 2px solid $g-blue; outline-offset: 2px; }
}

.home-header__gaveta-link--btn {
  background: transparent;
  border: 0;
  border-bottom: 1px solid $g-hair;
  cursor: pointer;
  text-align: left;
  width: 100%;
}

.home-header__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  margin-left: 6px;
  border-radius: 999px;
  background: $g-blue;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.home-header__gaveta-link {
  display: flex;
  align-items: center;
  min-height: 52px;
  padding: 0 8px;
  font-family: inherit;
  font-size: 18px;
  font-weight: 400;
  line-height: 1.38;
  color: $g-ink;
  text-decoration: none;
  border-bottom: 1px solid $g-hair;

  &:last-child { border-bottom: 0; }
  &:hover { color: $g-blue; }
}

// Hexes do mockup hardcoded (escopo local, nao mexe nos tokens globais).
.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #002855; // navy
  color: #fff;
  border-radius: 7px;
  padding: 10px 16px;
  box-shadow: 0 10px 30px rgba(0, 40, 85, 0.14);
  margin-bottom: 4px;

  &__brand {
    display: flex;
    align-items: center;
    gap: 9px;
    text-decoration: none;
    min-width: 0;

    &:focus-visible {
      outline: 2px solid #0466c8;
      outline-offset: 3px;
      border-radius: 4px;
    }
  }

  &__logo {
    height: 24px;
    width: auto;
    // O componente base tem width:100%; aqui restringimos pra caber na barra.
    :deep(.placa-logo) {
      height: 24px;
      width: auto;
    }
  }

  &__tag {
    font-weight: 600;
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.75);
    white-space: nowrap;
  }

  &__nav {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  &__link {
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.8125rem;
    text-decoration: none;
    white-space: nowrap;
    padding: 4px 2px;
    border-radius: 4px;
    transition: color 0.15s ease;

    &:hover {
      color: #fff;
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 2px solid #0466c8;
      outline-offset: 2px;
    }
  }
}

@media (max-width: 520px) {
  .home-header {
    padding: 9px 12px;
    gap: 10px;

    &__tag {
      display: none;
    }

    &__nav {
      gap: 12px;
    }

    &__link {
      font-size: 0.75rem;
    }
  }
}
</style>
