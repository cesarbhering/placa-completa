<script setup lang="ts">
import { homepageFaqs } from '~/data/homepage-faqs'

// SEO
useHead({
  title: 'PlacaCompleta — Consulta Veicular Completa e Grátis',
  meta: [
    { name: 'description', content: 'Digite a placa e receba dados completos do veículo no seu e-mail. Marca, modelo, FIPE, situação e mais — em segundos. 100% grátis.' },
    { name: 'keywords', content: 'consulta placa, consulta veicular grátis, dados veículo por placa, tabela FIPE por placa, placa completa, consultar placa gratis' },
    { property: 'og:title', content: 'PlacaCompleta — Consulta Veicular Completa e Grátis' },
    { property: 'og:description', content: 'Digite a placa e receba dados completos do veículo no seu e-mail. Marca, modelo, FIPE, situação e mais — em segundos.' },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: homepageFaqs.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      }),
    },
  ],
})

// State
const placa = ref('')
const email = ref('')
const placaError = ref('')
const emailError = ref('')
const loading = ref(false)
const consultaCount = ref(0)
const openFaqIndex = ref<number | null>(null)
const showMobileMenu = ref(false)

// Fetch consultation count
const { data: countData } = await useFetch('/api/count')
if (countData.value?.count) {
  consultaCount.value = countData.value.count
}

const placaRef = ref<HTMLInputElement | null>(null)

// Load saved email + override body styles for dark theme
onMounted(() => {
  const saved = localStorage.getItem('pc_email')
  if (saved) email.value = saved

  // Override global body background so navy/scanlines don't bleed through
  document.body.style.background = '#060824'
  document.body.style.backgroundImage = 'none'
  document.body.style.display = 'block'

  nextTick(() => {
    placaRef.value?.focus()
  })
})

onUnmounted(() => {
  // Restore body styles when leaving page
  document.body.style.background = ''
  document.body.style.backgroundImage = ''
  document.body.style.display = ''
})

function formatPlaca(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7)
}

function onPlacaInput(e: Event) {
  const target = e.target as HTMLInputElement
  placa.value = formatPlaca(target.value)
  placaError.value = ''
}

function validateEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
}

function validatePlaca(val: string): boolean {
  const clean = val.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(clean)
}

function toggleFaq(index: number) {
  openFaqIndex.value = openFaqIndex.value === index ? null : index
}

function scrollTo(id: string) {
  showMobileMenu.value = false
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

async function handleSubmit() {
  placaError.value = ''
  emailError.value = ''

  if (!validatePlaca(placa.value)) {
    placaError.value = 'Placa inválida. Use o formato ABC1D23 ou ABC1234.'
    return
  }

  if (!validateEmail(email.value)) {
    emailError.value = 'Informe um e-mail válido.'
    return
  }

  localStorage.setItem('pc_email', email.value)
  loading.value = true

  try {
    const result = await $fetch<{ success: boolean; emailSent: boolean; message: string }>('/api/consulta', {
      method: 'POST',
      body: {
        email: email.value,
        phone: null,
        placa: placa.value,
        isPWA: false,
      },
    })

    if (result.emailSent) {
      navigateTo(`/?consulta=sucesso&placa=${placa.value}`)
    } else {
      navigateTo(`/?placa=${placa.value}`)
    }
  } catch {
    navigateTo(`/?placa=${placa.value}&email=${encodeURIComponent(email.value)}`)
  } finally {
    loading.value = false
  }
}

// Showcase card sample data
const showcaseData = [
  { label: 'Placa', value: 'ABC1D23' },
  { label: 'Marca', value: 'VOLKSWAGEN' },
  { label: 'Modelo', value: 'CROSSFOX 1.6' },
  { label: 'Ano/Modelo', value: '2007/2007' },
  { label: 'Cor', value: 'Prata' },
  { label: 'Combustível', value: 'GASOLINA' },
  { label: 'Município', value: 'SAO PAULO - SP' },
  { label: 'Situação', value: 'Sem restrição' },
  { label: 'Valor FIPE', value: 'R$ 28.799,00' },
  { label: 'Chassi', value: '9BWAA05U**********' },
]

const includedItems = [
  { icon: 'car', title: 'Marca e Modelo', desc: 'Fabricante e modelo completo do veículo' },
  { icon: 'calendar', title: 'Ano Fabricação', desc: 'Ano de fabricação e ano modelo' },
  { icon: 'palette', title: 'Cor', desc: 'Cor predominante do veículo' },
  { icon: 'dollar', title: 'Valor FIPE', desc: 'Preço atualizado pela tabela FIPE' },
  { icon: 'shield', title: 'Situação', desc: 'Restrições, roubo/furto, alertas' },
  { icon: 'key', title: 'Chassi', desc: 'Número do chassi (parcial)' },
  { icon: 'fuel', title: 'Combustível', desc: 'Tipo de combustível do veículo' },
  { icon: 'map', title: 'Município/UF', desc: 'Cidade e estado de registro' },
]
</script>

<template>
  <div class="lp">
    <!-- Navbar -->
    <nav class="lp-nav">
      <div class="lp-nav__inner">
        <div class="lp-nav__brand" @click="scrollTo('hero')">
          <img src="/logo-nobg-200.png" alt="PlacaCompleta" class="lp-nav__logo" width="32" height="32" />
          <span class="lp-nav__name">PlacaCompleta</span>
        </div>

        <div class="lp-nav__links" :class="{ 'lp-nav__links--open': showMobileMenu }">
          <a href="#como-funciona" @click.prevent="scrollTo('como-funciona')">Como Funciona</a>
          <a href="#perguntas" @click.prevent="scrollTo('perguntas')">Perguntas</a>
        </div>

        <button class="lp-nav__cta" @click="scrollTo('hero')">Consultar Agora</button>

        <button class="lp-nav__hamburger" @click="showMobileMenu = !showMobileMenu" aria-label="Menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>

    <!-- Hero Section -->
    <section id="hero" class="lp-hero">
      <div class="lp-hero__inner">
        <!-- Showcase Card (left) -->
        <div class="lp-hero__showcase">
          <div class="showcase-card">
            <div class="showcase-card__titlebar">
              <span class="showcase-card__titlebar-icon">&#128203;</span>
              <span>Dados do Veículo &mdash; ABC1D23</span>
              <div class="showcase-card__titlebar-buttons">
                <span class="showcase-card__btn">_</span>
                <span class="showcase-card__btn">&square;</span>
                <span class="showcase-card__btn">&times;</span>
              </div>
            </div>
            <div class="showcase-card__body">
              <div
                v-for="(item, i) in showcaseData"
                :key="item.label"
                class="showcase-card__row"
                :style="{ animationDelay: `${0.3 + i * 0.1}s` }"
              >
                <span class="showcase-card__label">{{ item.label }}</span>
                <span class="showcase-card__value">{{ item.value }}</span>
              </div>
            </div>
            <div class="showcase-card__statusbar">
              Consulta realizada com sucesso &mdash; 100% grátis
            </div>
          </div>
        </div>

        <!-- Copy + CTA (right) -->
        <div class="lp-hero__copy">
          <div v-if="consultaCount > 0" class="lp-hero__badge">
            {{ consultaCount.toLocaleString('pt-BR') }} consultas realizadas
          </div>

          <h1 class="lp-hero__title">
            Consulta Veicular<br />
            <span class="lp-hero__title-accent">Completa e Grátis</span>
          </h1>

          <p class="lp-hero__subtitle">
            Digite a placa e receba dados completos do veículo no seu e-mail.
            Marca, modelo, FIPE, situação e mais &mdash; em segundos.
          </p>

          <form class="lp-hero__form" @submit.prevent="handleSubmit" novalidate>
            <div class="lp-hero__form-row">
              <div class="lp-hero__field">
                <input
                  ref="placaRef"
                  :value="placa"
                  type="text"
                  class="lp-hero__input lp-hero__input--placa"
                  :class="{ 'lp-hero__input--error': placaError }"
                  placeholder="ABC1D23"
                  maxlength="7"
                  autocomplete="off"
                  autocapitalize="characters"
                  inputmode="text"
                  @input="onPlacaInput"
                />
                <span v-if="placaError" class="lp-hero__error">{{ placaError }}</span>
              </div>
              <div class="lp-hero__field">
                <input
                  v-model="email"
                  type="email"
                  class="lp-hero__input"
                  :class="{ 'lp-hero__input--error': emailError }"
                  placeholder="seu@email.com"
                  autocomplete="email"
                  inputmode="email"
                />
                <span v-if="emailError" class="lp-hero__error">{{ emailError }}</span>
              </div>
              <button
                type="submit"
                class="lp-hero__submit"
                :disabled="loading"
              >
                <span v-if="loading" class="lp-hero__submit-loading"></span>
                <span v-else>Consultar Grátis &rarr;</span>
              </button>
            </div>
          </form>

          <p class="lp-hero__trust">
            Sem cadastro &middot; 100% grátis &middot; Resultado em segundos
          </p>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section id="como-funciona" class="lp-steps">
      <div class="lp-steps__inner">
        <h2 class="lp-section-title">Como Funciona</h2>
        <div class="lp-steps__grid">
          <div class="lp-step">
            <div class="lp-step__number">1</div>
            <h3 class="lp-step__title">Digite a placa</h3>
            <p class="lp-step__desc">Insira a placa do veículo no formato padrão ou Mercosul.</p>
          </div>
          <div class="lp-step">
            <div class="lp-step__number">2</div>
            <h3 class="lp-step__title">Informe seu e-mail</h3>
            <p class="lp-step__desc">Para receber os dados completos diretamente na sua caixa de entrada.</p>
          </div>
          <div class="lp-step">
            <div class="lp-step__number">3</div>
            <h3 class="lp-step__title">Receba os dados</h3>
            <p class="lp-step__desc">Em segundos, todos os dados do veículo chegam no seu e-mail.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- What's Included -->
    <section class="lp-included">
      <div class="lp-included__inner">
        <h2 class="lp-section-title">O que está incluído</h2>
        <div class="lp-included__grid">
          <div v-for="item in includedItems" :key="item.title" class="lp-included__card">
            <div class="lp-included__icon">
              <svg v-if="item.icon === 'car'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M5 17a2 2 0 00-2 2v0a2 2 0 002 2h0M19 17a2 2 0 012 2v0a2 2 0 01-2 2h0"/></svg>
              <svg v-else-if="item.icon === 'calendar'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              <svg v-else-if="item.icon === 'palette'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="12" r="1.5" fill="currentColor"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/></svg>
              <svg v-else-if="item.icon === 'dollar'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
              <svg v-else-if="item.icon === 'shield'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z"/><path d="M9 12l2 2 4-4"/></svg>
              <svg v-else-if="item.icon === 'key'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              <svg v-else-if="item.icon === 'fuel'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 22V6a2 2 0 012-2h8a2 2 0 012 2v16"/><path d="M3 22h12"/><rect x="5" y="8" width="8" height="4"/><path d="M15 12h2a2 2 0 012 2v2a2 2 0 002 2v0"/><path d="M21 10v4"/></svg>
              <svg v-else-if="item.icon === 'map'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            </div>
            <h3 class="lp-included__title">{{ item.title }}</h3>
            <p class="lp-included__desc">{{ item.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section id="perguntas" class="lp-faq">
      <div class="lp-faq__inner">
        <h2 class="lp-section-title">Perguntas Frequentes</h2>
        <div class="lp-faq__list">
          <div
            v-for="(faq, i) in homepageFaqs"
            :key="faq.question"
            class="lp-faq__item"
            :class="{ 'lp-faq__item--open': openFaqIndex === i }"
          >
            <button class="lp-faq__question" @click="toggleFaq(i)">
              <span>{{ faq.question }}</span>
              <span class="lp-faq__chevron">&#9660;</span>
            </button>
            <div class="lp-faq__answer">
              <p>{{ faq.answer }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Bottom CTA -->
    <section class="lp-bottom-cta">
      <div class="lp-bottom-cta__inner">
        <h2 class="lp-bottom-cta__title">Pronto para consultar?</h2>
        <p class="lp-bottom-cta__desc">
          Digite a placa e receba todos os dados do veículo no seu e-mail. Grátis e sem cadastro.
        </p>
        <button class="lp-hero__submit" @click="scrollTo('hero')">
          Consultar Agora &rarr;
        </button>
      </div>
    </section>

    <!-- Footer handled by app.vue -->
  </div>
</template>

<style lang="scss" scoped>
/* ===================== */
/* DESIGN TOKENS         */
/* ===================== */
$lp-bg: #060824;
$lp-bg-card: #0c1038;
$lp-navy: #090c9b;
$lp-blue: #3066be;
$lp-pink: #e84393;
$lp-pink-dark: #c0392b;
$lp-ivory: #fbfff1;
$lp-text: #c8cfe6;
$lp-text-muted: #7e89a8;
$lp-border: rgba(48, 102, 190, 0.2);
$lp-card-border: rgba(48, 102, 190, 0.15);

/* ===================== */
/* BASE                  */
/* ===================== */
.lp {
  background: $lp-bg;
  background-image:
    radial-gradient(ellipse at 20% 50%, rgba($lp-navy, 0.4) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 20%, rgba($lp-blue, 0.15) 0%, transparent 50%);
  color: $lp-text;
  min-height: 100vh;
  font-family: $font-body;
  overflow-x: hidden;
  position: relative;

  // Noise overlay
  &::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
  }
}

.lp > * {
  position: relative;
  z-index: 1;
}

/* ===================== */
/* NAVBAR                */
/* ===================== */
.lp-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba($lp-bg, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid $lp-border;

  &__inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    flex-shrink: 0;
  }

  &__logo {
    width: 32px;
    height: 32px;
  }

  &__name {
    font-family: $font-display;
    font-size: 1.375rem;
    color: $lp-ivory;
    letter-spacing: 1px;
  }

  &__links {
    display: flex;
    gap: 32px;

    a {
      color: $lp-text-muted;
      text-decoration: none;
      font-size: 0.875rem;
      transition: color 0.2s;

      &:hover {
        color: $lp-ivory;
      }
    }
  }

  &__cta {
    background: $lp-pink;
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: 6px;
    font-family: $font-display;
    font-size: 1rem;
    cursor: pointer;
    letter-spacing: 0.5px;
    transition: background 0.2s, box-shadow 0.2s;
    flex-shrink: 0;

    &:hover {
      background: #ec5ba5;
      box-shadow: 0 0 20px rgba($lp-pink, 0.4);
    }
  }

  &__hamburger {
    display: none;
    flex-direction: column;
    gap: 4px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;

    span {
      display: block;
      width: 20px;
      height: 2px;
      background: $lp-ivory;
      transition: transform 0.2s;
    }
  }
}

@media (max-width: 768px) {
  .lp-nav {
    &__links {
      display: none;
      position: absolute;
      top: 60px;
      left: 0;
      right: 0;
      background: rgba($lp-bg, 0.95);
      backdrop-filter: blur(12px);
      flex-direction: column;
      padding: 16px 24px;
      gap: 16px;
      border-bottom: 1px solid $lp-border;

      &--open {
        display: flex;
      }
    }

    &__cta {
      display: none;
    }

    &__hamburger {
      display: flex;
    }
  }
}

/* ===================== */
/* HERO SECTION          */
/* ===================== */
.lp-hero {
  padding: 80px 24px 40px;
  min-height: calc(100vh - 60px);
  display: flex;
  align-items: center;

  &__inner {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 64px;
    align-items: center;
    width: 100%;
  }

  /* Showcase Card */
  &__showcase {
    animation: heroSlideInLeft 0.8s ease-out both;
  }
}

.showcase-card {
  background: $win-bg;
  border: 2px solid;
  border-color: $win-white $win-darker $win-darker $win-white;
  transform: perspective(800px) rotateY(-2deg) rotateX(1deg);
  box-shadow:
    12px 12px 40px rgba(0, 0, 0, 0.5),
    0 0 30px rgba($lp-blue, 0.1);
  transition: transform 0.4s ease, box-shadow 0.4s ease;

  &:hover {
    transform: perspective(800px) rotateY(0deg) rotateX(0deg);
    box-shadow:
      0 8px 30px rgba(0, 0, 0, 0.4),
      0 0 40px rgba($lp-blue, 0.15);
  }

  &__titlebar {
    background: linear-gradient(90deg, $win-title, $lp-blue);
    color: white;
    font-family: $font-display;
    font-size: 1rem;
    padding: 4px 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    user-select: none;

    &-icon {
      font-size: 0.875rem;
    }

    &-buttons {
      margin-left: auto;
      display: flex;
      gap: 2px;
    }
  }

  &__btn {
    width: 16px;
    height: 16px;
    background: $win-bg;
    border: 2px solid;
    border-color: $win-white $win-darker $win-darker $win-white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    line-height: 1;
  }

  &__body {
    padding: 8px 12px;
    background: $win-white;
    margin: 4px;
    border: 2px solid;
    border-color: $win-darker $win-white $win-white $win-darker;
  }

  &__row {
    display: flex;
    justify-content: space-between;
    padding: 4px 2px;
    border-bottom: 1px dotted #9ab1d0;
    font-size: 0.8125rem;
    animation: rowReveal 0.4s ease-out both;

    &:last-child {
      border-bottom: none;
    }
  }

  &__label {
    font-weight: 600;
    color: $graphite;
    font-family: $font-body;
  }

  &__value {
    color: $navy-electric;
    font-weight: 700;
    font-family: $font-body;
    text-align: right;
  }

  &__statusbar {
    border: 2px solid;
    border-color: $win-darker $win-white $win-white $win-darker;
    background: $win-bg;
    padding: 3px 8px;
    font-family: $font-body;
    font-size: 0.6875rem;
    color: $graphite;
    margin: 0 4px 4px;
  }
}

/* Hero Copy */
.lp-hero__copy {
  animation: heroFadeInUp 0.8s ease-out 0.2s both;
}

.lp-hero__badge {
  display: inline-block;
  background: rgba($lp-blue, 0.15);
  border: 1px solid rgba($lp-blue, 0.3);
  color: $lp-blue;
  font-family: $font-display;
  font-size: 0.9375rem;
  padding: 6px 16px;
  border-radius: 20px;
  margin-bottom: 20px;
  letter-spacing: 0.5px;
}

.lp-hero__title {
  font-family: $font-display;
  font-size: 3rem;
  color: $lp-ivory;
  line-height: 1.1;
  margin-bottom: 16px;
  letter-spacing: 1px;

  &-accent {
    color: $lp-pink;
  }
}

.lp-hero__subtitle {
  font-size: 1rem;
  color: $lp-text;
  line-height: 1.6;
  margin-bottom: 32px;
  max-width: 480px;
}

.lp-hero__form {
  margin-bottom: 16px;
}

.lp-hero__form-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.lp-hero__field {
  flex: 1;
  min-width: 140px;
}

.lp-hero__input {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.07);
  border: 2px solid $lp-border;
  border-radius: 8px;
  color: $lp-ivory;
  font-family: $font-body;
  font-size: 0.9375rem;
  outline: none;
  transition: border-color 0.2s, background 0.2s;

  &::placeholder {
    color: $lp-text-muted;
  }

  &:focus {
    border-color: $lp-blue;
    background: rgba(255, 255, 255, 0.1);
  }

  &--placa {
    font-family: $font-display;
    font-size: 1.25rem;
    text-transform: uppercase;
    letter-spacing: 3px;
    text-align: center;
  }

  &--error {
    border-color: $lp-pink;
    background: rgba($lp-pink, 0.08);
  }
}

.lp-hero__error {
  display: block;
  font-size: 0.75rem;
  color: $lp-pink;
  margin-top: 4px;
}

.lp-hero__submit {
  background: $lp-pink;
  color: white;
  border: none;
  padding: 12px 28px;
  border-radius: 8px;
  font-family: $font-display;
  font-size: 1.125rem;
  cursor: pointer;
  letter-spacing: 0.5px;
  white-space: nowrap;
  transition: background 0.2s, box-shadow 0.2s, transform 0.2s;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: #ec5ba5;
    box-shadow: 0 0 30px rgba($lp-pink, 0.4);
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &-loading {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
}

.lp-hero__trust {
  font-size: 0.8125rem;
  color: $lp-text-muted;
  letter-spacing: 0.3px;
}

@media (max-width: 768px) {
  .lp-hero {
    padding: 70px 16px 24px;
    min-height: auto;

    &__inner {
      grid-template-columns: 1fr;
      gap: 40px;
    }

    &__copy {
      order: 1;
    }

    &__showcase {
      order: 2;
    }
  }

  .lp-hero__title {
    font-size: 2.25rem;
  }

  .lp-hero__form-row {
    flex-direction: column;
  }

  .lp-hero__field {
    min-width: 100%;
  }

  .showcase-card {
    transform: perspective(800px) rotateY(0deg) rotateX(1deg);

    &:hover {
      transform: perspective(800px) rotateY(0deg) rotateX(0deg);
    }
  }
}

/* ===================== */
/* SECTION TITLE         */
/* ===================== */
.lp-section-title {
  font-family: $font-display;
  font-size: 2rem;
  color: $lp-ivory;
  text-align: center;
  margin-bottom: 36px;
  letter-spacing: 1px;
}

/* ===================== */
/* HOW IT WORKS          */
/* ===================== */
.lp-steps {
  padding: 56px 24px;
  border-top: 1px solid $lp-border;

  &__inner {
    max-width: 900px;
    margin: 0 auto;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
  }
}

.lp-step {
  text-align: center;
  padding: 32px 24px;
  background: rgba($lp-bg-card, 0.6);
  border: 1px solid $lp-card-border;
  border-radius: 12px;
  transition: border-color 0.3s, transform 0.3s;

  &:hover {
    border-color: rgba($lp-blue, 0.4);
    transform: translateY(-4px);
  }

  &__number {
    width: 48px;
    height: 48px;
    background: rgba($lp-pink, 0.15);
    color: $lp-pink;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: $font-display;
    font-size: 1.5rem;
    margin: 0 auto 16px;
    border: 2px solid rgba($lp-pink, 0.3);
  }

  &__title {
    font-family: $font-display;
    font-size: 1.25rem;
    color: $lp-ivory;
    margin-bottom: 8px;
    letter-spacing: 0.5px;
  }

  &__desc {
    font-size: 0.875rem;
    color: $lp-text-muted;
    line-height: 1.5;
  }
}

@media (max-width: 768px) {
  .lp-steps__grid {
    grid-template-columns: 1fr;
    max-width: 400px;
    margin: 0 auto;
  }
}

/* ===================== */
/* WHAT'S INCLUDED       */
/* ===================== */
.lp-included {
  padding: 56px 24px;
  border-top: 1px solid $lp-border;

  &__inner {
    max-width: 1000px;
    margin: 0 auto;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }

  &__card {
    background: rgba($lp-bg-card, 0.6);
    border: 1px solid $lp-card-border;
    border-radius: 10px;
    padding: 24px 16px;
    text-align: center;
    transition: border-color 0.3s, transform 0.3s;

    &:hover {
      border-color: rgba($lp-blue, 0.4);
      transform: translateY(-3px);
    }
  }

  &__icon {
    width: 40px;
    height: 40px;
    margin: 0 auto 12px;
    color: $lp-blue;

    svg {
      width: 100%;
      height: 100%;
    }
  }

  &__title {
    font-family: $font-display;
    font-size: 1.0625rem;
    color: $lp-ivory;
    margin-bottom: 6px;
    letter-spacing: 0.5px;
  }

  &__desc {
    font-size: 0.75rem;
    color: $lp-text-muted;
    line-height: 1.4;
  }
}

@media (max-width: 768px) {
  .lp-included__grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .lp-included__grid {
    grid-template-columns: 1fr 1fr;
  }
}

/* ===================== */
/* FAQ                   */
/* ===================== */
.lp-faq {
  padding: 56px 24px;
  border-top: 1px solid $lp-border;

  &__inner {
    max-width: 700px;
    margin: 0 auto;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__item {
    background: rgba($lp-bg-card, 0.6);
    border: 1px solid $lp-card-border;
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 0.3s;

    &:hover {
      border-color: rgba($lp-blue, 0.3);
    }

    &--open {
      border-color: rgba($lp-blue, 0.4);

      .lp-faq__chevron {
        transform: rotate(180deg);
      }

      .lp-faq__answer {
        max-height: 300px;
        padding: 0 20px 16px;
        opacity: 1;
      }
    }
  }

  &__question {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: none;
    border: none;
    color: $lp-ivory;
    font-family: $font-display;
    font-size: 1.0625rem;
    text-align: left;
    cursor: pointer;
    letter-spacing: 0.5px;
    gap: 12px;
  }

  &__chevron {
    font-size: 0.75rem;
    color: $lp-text-muted;
    transition: transform 0.3s;
    flex-shrink: 0;
  }

  &__answer {
    max-height: 0;
    padding: 0 20px;
    opacity: 0;
    overflow: hidden;
    transition: max-height 0.3s ease, padding 0.3s ease, opacity 0.3s ease;

    p {
      font-size: 0.875rem;
      color: $lp-text-muted;
      line-height: 1.6;
    }
  }
}

/* ===================== */
/* BOTTOM CTA            */
/* ===================== */
.lp-bottom-cta {
  padding: 56px 24px;
  border-top: 1px solid $lp-border;
  text-align: center;

  &__inner {
    max-width: 600px;
    margin: 0 auto;
  }

  &__title {
    font-family: $font-display;
    font-size: 2rem;
    color: $lp-ivory;
    margin-bottom: 12px;
    letter-spacing: 1px;
  }

  &__desc {
    font-size: 1rem;
    color: $lp-text-muted;
    margin-bottom: 28px;
    line-height: 1.5;
  }
}

/* ===================== */
/* ANIMATIONS            */
/* ===================== */
@keyframes heroSlideInLeft {
  from {
    opacity: 0;
    transform: translateX(-40px) perspective(800px) rotateY(-2deg) rotateX(1deg);
  }
  to {
    opacity: 1;
    transform: translateX(0) perspective(800px) rotateY(-2deg) rotateX(1deg);
  }
}

@keyframes heroFadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes rowReveal {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
