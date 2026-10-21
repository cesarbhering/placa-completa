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
}

const props = withDefaults(defineProps<Props>(), {
  logoVariant: 'inverted',
  placa: '',
  consultada: false,
  mostrarBusca: true,
})

const emit = defineEmits<{
  consult: []
  'update:placa': [value: string]
  submit: []
}>()

// O header le o historico e abre o modal por conta propria. Passar isso por
// prop e evento obrigava cada pagina a lembrar de ligar os dois, e as legadas
// simplesmente nao ligavam: o item nunca aparecia la.
const { itens: consultasSalvas, sync: syncHistorico } = useConsultaHistory()
const modalConsultas = useState('pc-consultas-aberto', () => false)
// Zero esconde o item: "Suas consultas" vazio so daria uma porta pra lugar nenhum.
const totalConsultas = computed(() => consultasSalvas.value.length)
onMounted(() => syncHistorico())

// Ancoras da propria home + as paginas de conteudo. Rota usa NuxtLink (SPA);
// ancora fica em <a> normal, senao o NuxtLink tentaria resolver "#x" como rota.
const links = [
  { href: '#o-que-inclui', label: 'O que inclui' },
  { href: '/blog', label: 'Blog' },
  { href: '/tabela-fipe', label: 'Tabela FIPE' },
  { href: '/estudos', label: 'Estudos' },
  // So na gaveta (menu do celular): na barra do desktop, fora da home, a busca
  // divide o espaco e o sexto item quebrava a linha. O rodape tambem tem o link.
  { href: '/para-empresas', label: 'Para empresas', soGaveta: true },
  { href: '#duvidas', label: 'Dúvidas' },
]
// Fora da home nenhuma dessas ancoras existe na pagina: '#duvidas' vira clique
// morto e o logo levava pro topo do proprio relatorio em vez de voltar pra
// home. Prefixando com '/', o link volta pra home e cai na secao certa.
const route = useRoute()
// /placa/ABC1D23 e alias da home: mesmas ancoras, mesmo comportamento. Sem
// isto, ao consultar a URL mudava e o header passava a se achar em outra
// pagina, mandando '#duvidas' pra '/#duvidas' e perdendo o resultado.
const naHome = computed(() => route.path === '/' || route.path.startsWith('/placa/'))
const naAreaPremium = computed(() => route.path.startsWith('/premium'))
const alvo = (href: string) => (href.startsWith('#') && !naHome.value ? `/${href}` : href)
const ehAncora = (href: string) => href.startsWith('#')

// O logo faz as duas coisas que se espera dele, na ordem que a pessoa espera:
// fora do topo, sobe a pagina; ja no topo, o unico sentido possivel do clique e
// "me leva pra home". Antes decidia pela rota, entao na home ele nunca levava a
// lugar nenhum e fora dela nunca subia.
const noTopo = ref(true)
const rotuloLogo = computed(() =>
  noTopo.value ? 'PlacaCompleta, ir para a home' : 'PlacaCompleta, voltar ao topo da página')

function aoClicarLogo(e: MouseEvent) {
  // href="/" continua real (clique do meio, "abrir em nova aba", crawler);
  // o clique normal e que ganha o comportamento.
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
  e.preventDefault()
  if (noTopo.value) navigateTo('/')
  else window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Na home o campo entra so quando o formulario do herói sai da tela (dois
// campos identicos disputando a mesma acao seria pior). Nas paginas de
// conteudo nao existe outro campo, entao ele fica sempre. Na area premium a
// pessoa esta no meio de um pedido: consultar outra placa ali seria desvio.
const mostrarCampo = computed(() => {
  if (naAreaPremium.value) return false
  return naHome.value ? props.mostrarBusca : true
})

// Fora da home ninguem escuta 'update:placa'/'submit', entao o campo precisa
// do proprio estado e do proprio destino.
const placaLocal = ref('')
const valorCampo = computed(() => (naHome.value ? props.placa : placaLocal.value))
const limpaPlaca = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)

function aoDigitar(e: Event) {
  const v = limpaPlaca((e.target as HTMLInputElement).value)
  if (naHome.value) emit('update:placa', v)
  else placaLocal.value = v
}

function aoBuscar() {
  if (!naHome.value) {
    // Sem placa completa nao ha o que consultar; devolve o foco em vez de
    // navegar pra uma rota que so mostraria erro.
    if (placaLocal.value.length < 7) return
    navigateTo(`/placa/${placaLocal.value}`)
    return
  }
  emit('submit')
  // O resultado aparece no topo da pagina. Sem subir junto, a pessoa busca do
  // meio da home e nada visivel muda.
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

if (import.meta.client) {
  const marcar = () => { noTopo.value = window.scrollY <= 4 }
  onMounted(() => { marcar(); window.addEventListener('scroll', marcar, { passive: true }) })
  onUnmounted(() => window.removeEventListener('scroll', marcar))
}

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
    <a href="/" class="home-header__brand" :aria-label="rotuloLogo" @click="aoClicarLogo">
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
      <form v-else-if="mostrarCampo" class="home-header__search" @submit.prevent="aoBuscar">
        <label class="home-header__search-label" for="hdr-placa">Insira aqui a placa</label>
        <input
          id="hdr-placa"
          class="home-header__search-input"
          :value="valorCampo"
          type="text"
          placeholder="ABC1D23"
          maxlength="7"
          autocomplete="off"
          autocapitalize="characters"
          @input="aoDigitar"
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
      <template v-for="link in links.filter((l) => !l.soGaveta)" :key="link.href">
        <a v-if="ehAncora(alvo(link.href))" :href="link.href" class="home-header__link">{{ link.label }}</a>
        <NuxtLink v-else :to="alvo(link.href)" class="home-header__link">{{ link.label }}</NuxtLink>
      </template>
      <button
        v-if="totalConsultas > 0"
        type="button"
        class="home-header__link home-header__link--btn"
        @click="modalConsultas = true"
      >
        Suas consultas <span class="home-header__badge">{{ totalConsultas }}</span>
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
            <a v-if="ehAncora(alvo(link.href))" :href="link.href" class="home-header__gaveta-link" @click="fechaMenu">{{ link.label }}</a>
            <NuxtLink v-else :to="alvo(link.href)" class="home-header__gaveta-link" @click="fechaMenu">{{ link.label }}</NuxtLink>
          </template>
          <button
            v-if="totalConsultas > 0"
            type="button"
            class="home-header__gaveta-link home-header__gaveta-link--btn"
            @click="fechaMenu(); modalConsultas = true"
          >
            Suas consultas <span class="home-header__badge">{{ totalConsultas }}</span>
          </button>
        </nav>
      </Teleport>
    </ClientOnly>
  </header>
</template>

<!-- Sem <style>: a aparencia do header vive em
     assets/scss/components/_home-header.scss, global. Escopado no componente
     (ou pior, nos :deep de uma pagina) ele mudaria de cara conforme a rota
     onde fosse montado. -->
