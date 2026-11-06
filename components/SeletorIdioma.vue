<script setup lang="ts">
import { parDeIdiomas } from '~/shared/idiomas'

// PT | EN switcher (Nov 6, 2026). Only shows on pages that exist in both
// languages. Clicking saves the choice in the pc_lang cookie (one year), which
// beats the IP from then on, both ways: a foreigner who picks PT stays in PT.
const route = useRoute()
const { locale } = useI18n()
const par = computed(() => parDeIdiomas(route.path))

function query() {
  const i = route.fullPath.search(/[?#]/)
  return i >= 0 ? route.fullPath.slice(i) : ''
}

function escolher(idioma: 'pt' | 'en') {
  gravarEscolhaIdioma(idioma)
}
</script>

<template>
  <nav v-if="par" class="idioma" aria-label="Idioma / Language">
    <a
      :href="par.pt + query()"
      hreflang="pt-BR"
      lang="pt-BR"
      class="idioma__opcao"
      :class="{ 'is-atual': locale !== 'en' }"
      :aria-current="locale !== 'en' ? 'true' : undefined"
      @click="escolher('pt')"
    >PT</a>
    <span class="idioma__sep" aria-hidden="true">|</span>
    <a
      :href="par.en + query()"
      hreflang="en"
      lang="en"
      class="idioma__opcao"
      :class="{ 'is-atual': locale === 'en' }"
      :aria-current="locale === 'en' ? 'true' : undefined"
      @click="escolher('en')"
    >EN</a>
  </nav>
</template>

<style scoped>
.idioma {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
}
.idioma__opcao {
  color: inherit;
  opacity: 0.7;
  text-decoration: none;
  padding: 4px 2px;
}
.idioma__opcao:hover,
.idioma__opcao:focus-visible {
  opacity: 1;
  text-decoration: underline;
}
.idioma__opcao.is-atual {
  opacity: 1;
  font-weight: 700;
}
.idioma__sep {
  opacity: 0.4;
}
</style>
