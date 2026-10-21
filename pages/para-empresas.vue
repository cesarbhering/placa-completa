<script setup lang="ts">
import { RECURSOS, inclui } from '~/shared/planos'
import { TIPOS_EMPRESA, VOLUMES_EMPRESA, UFS, MSG_RECEBIDO } from '~/shared/empresas'
import { DESCRICOES } from '~/shared/seo-meta'
import { escolherTitulo } from '~/shared/seo-titulo'

// Consultas em pacote para lojistas, garagens e despachantes (Cesar, 20/out/2026).
// Sem preco na pagina: o Cesar fecha cada proposta. O formulario grava em
// leads_empresas e avisa o Cesar (server/api/empresas/proposta.post.ts).

const URL = 'https://placacompleta.com.br/para-empresas'
useHead({
  title: escolherTitulo(['Consulta Veicular em Pacote para Lojistas e Despachantes', 'Consultas em Pacote para Lojistas e Despachantes']),
  titleTemplate: '%s',
  link: [{ rel: 'canonical', href: URL }],
  meta: [
    { name: 'description', content: DESCRICOES.paraEmpresas },
    { property: 'og:title', content: 'Consultas em pacote para lojistas, garagens e despachantes' },
    { property: 'og:description', content: DESCRICOES.paraEmpresas },
    { property: 'og:url', content: URL },
  ],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'PlacaCompleta', item: 'https://placacompleta.com.br' },
        { '@type': 'ListItem', position: 2, name: 'Para empresas' },
      ],
    }),
  }],
})

// O que vem em cada consulta: a mesma lista do cartao da Completa.
const itensCompleta = RECURSOS.filter((r) => inclui(r, 'completa'))

const QUEM_USA = [
  { t: 'Revenda de usados', d: 'Consulta cada carro que entra no estoque antes de pagar, sem surpresa de leilão, gravame ou restrição.' },
  { t: 'Garagem', d: 'Confere o carro de troca na hora da negociação e mostra o relatório para o comprador.' },
  { t: 'Despachante', d: 'Vê restrições, débitos e situação do veículo antes de começar uma transferência.' },
  { t: 'Financeira pequena', d: 'Checa a garantia antes de liberar o crédito, com histórico de leilão e indício de sinistro.' },
]
const COMO_FUNCIONA = [
  'Você pede a proposta no formulário abaixo.',
  'Respondemos em até 24 horas úteis, com o preço do pacote para o seu volume.',
  'Você paga por Pix.',
  'As consultas ficam liberadas na hora.',
]

const form = reactive({
  nome: '', empresa: '', tipo: '', cidade: '', uf: '', volume_faixa: '', whatsapp: '', email: '', mensagem: '', aceite: false,
  site: '', // honeypot: fica escondido; gente de verdade nunca preenche
})
const enviando = ref(false)
const erro = ref('')
const campoErro = ref('')
const enviado = ref(false)

function origemAtual(): string {
  if (!import.meta.client) return ''
  const q = new URLSearchParams(window.location.search)
  const partes = ['utm_source', 'utm_medium', 'utm_campaign'].map((k) => (q.get(k) ? `${k}=${q.get(k)}` : null)).filter(Boolean)
  if (document.referrer && !document.referrer.includes(window.location.host)) partes.push(`ref=${document.referrer}`)
  return partes.join('; ')
}

async function enviar() {
  erro.value = ''
  campoErro.value = ''
  enviando.value = true
  try {
    await $fetch('/api/empresas/proposta', { method: 'POST', body: { ...form, origem: origemAtual() } })
    enviado.value = true
  } catch (e: any) {
    campoErro.value = e?.data?.data?.campo || ''
    erro.value = e?.statusCode === 429 || e?.response?.status === 429
      ? 'Muitos envios agora. Tente de novo em alguns minutos.'
      : (e?.data?.message || 'Não conseguimos enviar agora. Tente de novo em instantes.')
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <div class="pc-page">
    <main class="pc-container emp">
      <section class="emp-hero">
        <p class="emp-kicker">Para empresas</p>
        <h1 class="pc-h1">Consultas em pacote para lojistas, garagens e despachantes</h1>
        <p class="emp-lead">Quem consulta muitos carros por mês paga menos por consulta. Montamos o pacote para o seu volume.</p>
        <ul class="emp-selos">
          <li>Preço especial para pacotes</li>
          <li>Desconto por volume</li>
          <li>Suporte prioritário</li>
          <li>Resposta em até 24 horas úteis</li>
        </ul>
        <a href="#proposta" class="pc-btn pc-btn--primary emp-cta">Pedir proposta</a>
      </section>

      <section class="emp-bloco">
        <h2>Quem usa</h2>
        <div class="emp-grid">
          <div v-for="q in QUEM_USA" :key="q.t" class="emp-card">
            <h3>{{ q.t }}</h3>
            <p>{{ q.d }}</p>
          </div>
        </div>
      </section>

      <section class="emp-bloco">
        <h2>O que vem em cada consulta</h2>
        <p class="emp-sub">Cada consulta do pacote é o relatório completo, o mesmo vendido no site:</p>
        <ul class="emp-lista">
          <li v-for="r in itensCompleta" :key="r.label">
            <strong>{{ r.label }}</strong><span v-if="r.detalhe"> · {{ r.detalhe }}</span>
          </li>
        </ul>
      </section>

      <section class="emp-bloco">
        <h2>Como funciona</h2>
        <ol class="emp-passos">
          <li v-for="(p, i) in COMO_FUNCIONA" :key="i">{{ p }}</li>
        </ol>
      </section>

      <section id="proposta" class="emp-bloco emp-form-wrap">
        <h2>Peça sua proposta</h2>
        <div v-if="enviado" class="emp-ok" role="status" data-testid="empresas-ok">
          <strong>{{ MSG_RECEBIDO }}</strong>
        </div>
        <form v-else class="emp-form" novalidate @submit.prevent="enviar">
          <div class="emp-campo">
            <label for="emp-nome">Seu nome</label>
            <input id="emp-nome" v-model="form.nome" type="text" autocomplete="name" maxlength="120" :aria-invalid="campoErro === 'nome'" required>
          </div>
          <div class="emp-campo">
            <label for="emp-empresa">Empresa</label>
            <input id="emp-empresa" v-model="form.empresa" type="text" autocomplete="organization" maxlength="160" :aria-invalid="campoErro === 'empresa'" required>
          </div>
          <div class="emp-campo">
            <label for="emp-tipo">Tipo</label>
            <select id="emp-tipo" v-model="form.tipo" :aria-invalid="campoErro === 'tipo'" required>
              <option value="" disabled>Escolha</option>
              <option v-for="t in TIPOS_EMPRESA" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="emp-linha">
            <div class="emp-campo emp-campo--cidade">
              <label for="emp-cidade">Cidade</label>
              <input id="emp-cidade" v-model="form.cidade" type="text" autocomplete="address-level2" maxlength="120" :aria-invalid="campoErro === 'cidade'" required>
            </div>
            <div class="emp-campo emp-campo--uf">
              <label for="emp-uf">UF</label>
              <select id="emp-uf" v-model="form.uf" :aria-invalid="campoErro === 'uf'" required>
                <option value="" disabled>UF</option>
                <option v-for="u in UFS" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>
          </div>
          <div class="emp-campo">
            <label for="emp-volume">Volume estimado por mês</label>
            <select id="emp-volume" v-model="form.volume_faixa" :aria-invalid="campoErro === 'volume_faixa'" required>
              <option value="" disabled>Escolha</option>
              <option v-for="v in VOLUMES_EMPRESA" :key="v" :value="v">{{ v }} consultas</option>
            </select>
          </div>
          <div class="emp-campo">
            <label for="emp-whats">WhatsApp</label>
            <input id="emp-whats" v-model="form.whatsapp" type="tel" inputmode="tel" autocomplete="tel" placeholder="(11) 99999-9999" maxlength="20" :aria-invalid="campoErro === 'whatsapp'" required>
          </div>
          <div class="emp-campo">
            <label for="emp-email">E-mail</label>
            <input id="emp-email" v-model="form.email" type="email" inputmode="email" autocomplete="email" maxlength="160" :aria-invalid="campoErro === 'email'" required>
          </div>
          <div class="emp-campo">
            <label for="emp-msg">Mensagem (opcional)</label>
            <textarea id="emp-msg" v-model="form.mensagem" rows="3" maxlength="2000" />
          </div>
          <!-- honeypot: invisivel para pessoas, bots preenchem -->
          <div class="emp-hp" aria-hidden="true">
            <label for="emp-site">Site</label>
            <input id="emp-site" v-model="form.site" type="text" tabindex="-1" autocomplete="off">
          </div>
          <label class="emp-aceite">
            <input v-model="form.aceite" type="checkbox" :aria-invalid="campoErro === 'aceite'">
            <span>Li e aceito a <NuxtLink to="/politica-de-privacidade" target="_blank">política de privacidade</NuxtLink>.</span>
          </label>
          <p v-if="erro" class="emp-erro" role="alert">{{ erro }}</p>
          <button type="submit" class="pc-btn pc-btn--primary emp-enviar" :disabled="enviando">
            {{ enviando ? 'Enviando...' : 'Pedir proposta' }}
          </button>
          <p class="emp-nota">Respondemos em até 24 horas úteis, pelo WhatsApp ou e-mail que você informar.</p>
        </form>
      </section>

      <nav class="pc-breadcrumb">
        <NuxtLink to="/">PlacaCompleta</NuxtLink>
        <span> &rsaquo; </span>
        <strong>Para empresas</strong>
      </nav>
    </main>
  </div>
</template>

<style scoped>
.emp { max-width: 860px; }
.emp-hero { padding: 8px 0 20px; }
.emp-kicker { margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #1f6feb; }
.emp-lead { font-size: 1.05rem; color: #3d3d3d; margin: 8px 0 14px; }
.emp-selos { list-style: none; padding: 0; margin: 0 0 18px; display: flex; flex-wrap: wrap; gap: 8px; }
.emp-selos li { padding: 6px 12px; border-radius: 999px; background: #eef4ff; color: #17539f; font-weight: 600; font-size: 14px; }
.emp-cta { min-height: 44px; }
.emp-bloco { margin: 28px 0; }
.emp-bloco h2 { margin: 0 0 12px; }
.emp-sub { margin: 0 0 10px; color: #3d3d3d; }
.emp-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
@media (min-width: 720px) { .emp-grid { grid-template-columns: 1fr 1fr; } }
.emp-card { border: 1px solid #e8e8e8; border-radius: 12px; padding: 14px; background: #fff; }
.emp-card h3 { margin: 0 0 4px; font-size: 1rem; }
.emp-card p { margin: 0; color: #3d3d3d; font-size: 14px; line-height: 1.5; }
.emp-lista { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
.emp-lista span { color: #636363; font-size: 14px; }
.emp-passos { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
.emp-form-wrap { border: 1px solid #e8e8e8; border-radius: 14px; padding: 18px; background: #fff; }
.emp-form { display: grid; gap: 12px; }
.emp-campo { display: grid; gap: 4px; }
.emp-campo label { font-weight: 600; font-size: 14px; }
.emp-campo input, .emp-campo select, .emp-campo textarea { font: inherit; padding: 10px 12px; border: 1px solid #c2c2c2; border-radius: 8px; min-height: 44px; background: #fff; width: 100%; box-sizing: border-box; }
.emp-campo [aria-invalid='true'] { border-color: #d33a3a; }
.emp-linha { display: grid; grid-template-columns: 1fr 96px; gap: 10px; }
.emp-hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.emp-aceite { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; }
.emp-aceite input { width: 18px; height: 18px; margin-top: 2px; }
.emp-erro { margin: 0; color: #a01d1d; font-weight: 600; }
.emp-enviar { min-height: 48px; }
.emp-nota { margin: 0; font-size: 13px; color: #636363; }
.emp-ok { padding: 16px; border-radius: 10px; background: #e8f5ee; color: #14622f; }
</style>
