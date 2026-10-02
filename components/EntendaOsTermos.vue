<script setup lang="ts">
// Bloco discreto "Entenda os termos" (plano SEO 02/out, item #12): leva das
// paginas de estado/capital e da home pros artigos /o-que-e. Lista vem de
// shared/artigos-o-que-e.ts, entao artigo novo entra sozinho.
import { ARTIGOS } from '~/shared/artigos-o-que-e'

withDefaults(defineProps<{ compacto?: boolean }>(), { compacto: false })

const RESUMO: Record<string, string> = {
  renavam: 'o cadastro e o código do veículo',
  gravame: 'quando o carro garante um financiamento',
  renajud: 'bloqueio judicial no cadastro',
  'multas-renainf': 'infrações registradas no sistema nacional',
}
</script>

<template>
  <nav class="eot" :class="{ 'eot--compacto': compacto }" aria-label="Entenda os termos">
    <p class="eot__titulo">Entenda os termos</p>
    <ul class="eot__lista">
      <li v-for="a in ARTIGOS" :key="a.slug">
        <NuxtLink :to="`/o-que-e/${a.slug}`">{{ a.termo }}</NuxtLink>
        <span v-if="!compacto && RESUMO[a.slug]" class="eot__resumo">: {{ RESUMO[a.slug] }}</span>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.eot {
  margin: 24px 0;
  padding: 14px 16px;
  border: 1px solid var(--pc-hairline);
  border-radius: 12px;
  font-family: var(--pc-font);
  font-size: 0.875rem;
  color: var(--pc-charcoal);
}
.eot__titulo {
  margin: 0 0 6px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--pc-graphite);
}
.eot__lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
}
.eot__lista a {
  color: var(--pc-blue);
  font-weight: 600;
  text-decoration: none;
  border-bottom: 1px solid transparent;
}
.eot__lista a:hover { border-bottom-color: var(--pc-blue); }
.eot--compacto { border: 0; padding: 0; margin: 28px 0 0; }
.eot--compacto .eot__lista { display: flex; flex-wrap: wrap; gap: 6px 16px; }
</style>
