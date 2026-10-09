<script setup lang="ts">
// Versoes compativeis da FIPE ambigua, em acordeao: cada versao abre o
// grafico de historico de preco DELA (codigo FIPE + ano-modelo do relatorio).
// Um aberto por vez, todos fechados no inicio. O historico vem sob demanda de
// /api/premium/fipe-historico, que so responde versao da shortlist deste
// relatorio. Vale pra relatorio ja entregue: nada novo no snapshot.
import { ref, reactive } from 'vue'

const props = defineProps<{
  versoes: { codigo_fipe: string; modelo: string; valor: number | null }[]
  token: string
}>()

type Estado = { status: 'carregando' | 'ok' | 'vazio' | 'erro'; pontos: { label: string; price: number }[] }
const aberto = ref<string | null>(null)
const historicos = reactive<Record<string, Estado>>({})

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const painelId = (codigo: string) => `versao-fipe-${codigo}`

async function carregar(codigo: string) {
  const atual = historicos[codigo]
  if (atual && atual.status !== 'erro') return
  historicos[codigo] = { status: 'carregando', pontos: [] }
  try {
    const r: any = await $fetch('/api/premium/fipe-historico', { query: { token: props.token, codigo } })
    const pontos = Array.isArray(r?.historico) ? r.historico : []
    historicos[codigo] = { status: pontos.length > 1 ? 'ok' : 'vazio', pontos }
  } catch {
    historicos[codigo] = { status: 'erro', pontos: [] }
  }
}

function alternar(codigo: string) {
  if (aberto.value === codigo) { aberto.value = null; return }
  aberto.value = codigo
  carregar(codigo)
}
</script>

<template>
  <ul class="vc">
    <li v-for="c in versoes" :key="c.codigo_fipe" class="vc__item" :class="{ 'vc__item--aberto': aberto === c.codigo_fipe }">
      <button
        type="button"
        class="vc__cab"
        :aria-expanded="aberto === c.codigo_fipe ? 'true' : 'false'"
        :aria-controls="painelId(c.codigo_fipe)"
        @click="alternar(c.codigo_fipe)"
      >
        <span class="vc__modelo">{{ c.modelo }}</span>
        <span class="vc__valor">{{ c.valor ? brl(c.valor) : '-' }}</span>
        <svg class="vc__seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div v-if="aberto === c.codigo_fipe" :id="painelId(c.codigo_fipe)" class="vc__painel" role="region">
        <p v-if="historicos[c.codigo_fipe]?.status === 'carregando'" class="vc__msg">Carregando histórico…</p>
        <template v-else-if="historicos[c.codigo_fipe]?.status === 'ok'">
          <span class="vc__sub">Evolução do valor desta versão</span>
          <GraficoValor :historico="historicos[c.codigo_fipe].pontos" />
        </template>
        <p v-else-if="historicos[c.codigo_fipe]?.status === 'erro'" class="vc__msg">
          Não foi possível carregar o histórico agora.
          <button type="button" class="vc__tentar" @click="carregar(c.codigo_fipe)">Tentar de novo</button>
        </p>
        <p v-else class="vc__msg">Histórico de preço indisponível para esta versão.</p>
      </div>
    </li>
  </ul>
</template>

<style lang="scss" scoped>
$c-ink: #1a1a1a;
$c-graphite: #636363;
$c-hair: #e8e8e8;
$c-azul: #1f6feb;

.vc { list-style: none; margin: 0; padding: 0; }

.vc__item { border-bottom: 1px solid $c-hair; }
.vc__item:last-child { border-bottom: 0; }

.vc__cab {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 20px;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 8px 0;
  background: none;
  border: 0;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.vc__cab:focus-visible { outline: 2px solid $c-azul; outline-offset: 2px; }

.vc__modelo { color: $c-graphite; font-size: calc(13.5px * var(--rel-fs, 1)); overflow-wrap: anywhere; }
.vc__valor { color: $c-ink; font-weight: 500; font-size: calc(13.5px * var(--rel-fs, 1)); white-space: nowrap; }

.vc__seta { width: 18px; height: 18px; fill: none; stroke: $c-graphite; stroke-width: 2; transition: transform .15s ease; }
.vc__item--aberto .vc__seta { transform: rotate(180deg); }

.vc__painel { padding: 4px 0 14px; min-width: 0; }
.vc__sub { display: block; color: $c-graphite; font-size: calc(12px * var(--rel-fs, 1)); margin-bottom: 6px; }
.vc__msg { color: $c-graphite; font-size: calc(13px * var(--rel-fs, 1)); margin: 6px 0 0; }
.vc__tentar { background: none; border: 0; padding: 0; color: $c-azul; font: inherit; text-decoration: underline; cursor: pointer; }

@media print {
  .vc__seta { display: none; }
}
</style>
