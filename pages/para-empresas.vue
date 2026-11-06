<script setup lang="ts">
import { RECURSOS, inclui, PLANOS, precoBRL } from '~/shared/planos'
import { PACOTES_EMPRESAS, precoPorConsulta, economiaPacote, type PacoteEmpresa } from '~/shared/pacotes-empresas'
import { TIPOS_EMPRESA, VOLUMES_EMPRESA, UFS, MSG_RECEBIDO } from '~/shared/empresas'
import { DESCRICOES } from '~/shared/seo-meta'
import { escolherTitulo } from '~/shared/seo-titulo'
import { DESCRICOES_EN } from '~/shared/seo-meta-en'
import { RECURSOS_EN, DETALHES_EN } from '~/shared/planos-en'


// Consultas em pacote para lojistas, garagens e despachantes (Cesar, 20/out/2026).
// Desde 04/nov/2026 dois pacotes tem preco fixo (shared/pacotes-empresas.ts);
// acima disso o Cesar fecha a proposta. O formulario grava em leads_empresas e
// avisa o Cesar (server/api/empresas/proposta.post.ts).

const { t, emIngles, rota } = useIdioma()
const URL = `https://placacompleta.com.br${rota('/para-empresas')}`
const descricao = emIngles.value ? DESCRICOES_EN.paraEmpresas : DESCRICOES.paraEmpresas
useHead({
  title: escolherTitulo([t('empresas.title'), t('empresas.titleCurto')]),
  titleTemplate: '%s',
  link: [{ rel: 'canonical', href: URL }],
  meta: [
    { name: 'description', content: descricao },
    { property: 'og:title', content: t('empresas.ogTitle') },
    { property: 'og:description', content: descricao },
    { property: 'og:url', content: URL },
  ],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'PlacaCompleta', item: 'https://placacompleta.com.br' },
        { '@type': 'ListItem', position: 2, name: t('empresas.breadcrumb') },
      ],
    }),
  }],
})

// O que vem em cada consulta: a mesma lista do cartao da Completa.
// In English, labels come from shared/planos-en.ts (same order, same items).
const itensCompleta = RECURSOS.filter((r) => inclui(r, 'completa')).map((r) => (emIngles.value
  ? { label: RECURSOS_EN[r.label] || r.label, detalhe: r.detalhe ? (DETALHES_EN[r.detalhe] || r.detalhe) : undefined }
  : r))

const QUEM_USA = ['revenda', 'garagem', 'despachante', 'financeira'].map((k) => ({
  t: t(`empresas.quemUsa.${k}T`),
  d: t(`empresas.quemUsa.${k}D`),
}))
const COMO_FUNCIONA = ['p1', 'p2', 'p3', 'p4'].map((k) => t(`empresas.como.${k}`))
// The form sends the PT values the API validates (shared/empresas.ts); only
// the visible label changes with the language.
const ROTULO_VOLUME: Record<string, string> = { 'até 20': 'ate20', '20 a 50': 'de20a50', '50 a 200': 'de50a200', 'mais de 200': 'mais200' }

const form = reactive({
  nome: '', empresa: '', tipo: '', cidade: '', uf: '', volume_faixa: '', whatsapp: '', email: '', mensagem: '', aceite: false,
  site: '', // honeypot: fica escondido; gente de verdade nunca preenche
})
const AVULSO = PLANOS.completa.valorCentavos
const pacotes = PACOTES_EMPRESAS.map((p) => ({ ...p, porConsulta: precoPorConsulta(p), economia: economiaPacote(p) }))

// Botao do pacote: leva ao formulario ja com a faixa e o pacote escritos.
function escolherPacote(p: PacoteEmpresa) {
  form.volume_faixa = p.volumeFaixa
  if (!form.mensagem.trim()) form.mensagem = t('empresas.msgPacote', { n: p.consultas, total: precoBRL(p.totalCentavos) })
  if (import.meta.client) document.getElementById('proposta')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
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
      ? t('empresas.muitosEnvios')
      // The API answers in PT; in English the field highlight is enough.
      : (emIngles.value ? t('comum.erroRede') : (e?.data?.message || t('comum.erroRede')))
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <div class="pc-page">
    <main class="pc-container emp">
      <section class="emp-hero">
        <p class="emp-kicker">{{ t('empresas.kicker') }}</p>
        <h1 class="pc-h1">{{ t('empresas.h1') }}</h1>
        <p class="emp-lead">{{ t('empresas.lead') }}</p>
        <ul class="emp-selos">
          <li>{{ t('empresas.selos.preco') }}</li>
          <li>{{ t('empresas.selos.volume') }}</li>
          <li>{{ t('empresas.selos.suporte') }}</li>
          <li>{{ t('empresas.selos.resposta') }}</li>
        </ul>
        <a href="#pacotes" class="pc-btn pc-btn--primary emp-cta">{{ t('empresas.verPacotes') }}</a>
      </section>

      <section id="pacotes" class="emp-bloco">
        <h2>{{ t('empresas.pacotesH2') }}</h2>
        <p class="emp-sub">{{ t('empresas.pacotesSub', { preco: precoBRL(AVULSO) }) }}</p>
        <div class="emp-pacotes">
          <div v-for="p in pacotes" :key="p.id" class="emp-pacote">
            <p class="emp-pacote__qtd">{{ t('empresas.nConsultas', { n: p.consultas }) }}</p>
            <p class="emp-pacote__total">{{ precoBRL(p.totalCentavos) }}</p>
            <p class="emp-pacote__cada"><strong>{{ precoBRL(p.porConsulta) }}</strong> {{ t('empresas.porConsulta') }}</p>
            <p class="emp-pacote__eco">
              {{ t('empresas.avulsoSeriam') }} <s>{{ precoBRL(p.economia.avulsoCentavos) }}</s>.
              {{ t('empresas.economiza', { valor: precoBRL(p.economia.centavos), pct: p.economia.pct }) }}
            </p>
            <button type="button" class="pc-btn pc-btn--primary emp-pacote__btn" @click="escolherPacote(p)">{{ t('empresas.queroPacote') }}</button>
          </div>
        </div>
        <p class="emp-nota emp-pacotes__mais">{{ t('empresas.mais50') }}</p>
      </section>

      <section class="emp-bloco">
        <h2>{{ t('empresas.quemUsaH2') }}</h2>
        <div class="emp-grid">
          <div v-for="q in QUEM_USA" :key="q.t" class="emp-card">
            <h3>{{ q.t }}</h3>
            <p>{{ q.d }}</p>
          </div>
        </div>
      </section>

      <section class="emp-bloco">
        <h2>{{ t('empresas.incluiH2') }}</h2>
        <p class="emp-sub">{{ t('empresas.incluiSub') }}</p>
        <ul class="emp-lista">
          <li v-for="r in itensCompleta" :key="r.label">
            <strong>{{ r.label }}</strong><span v-if="r.detalhe"> · {{ r.detalhe }}</span>
          </li>
        </ul>
      </section>

      <section class="emp-bloco">
        <h2>{{ t('empresas.comoH2') }}</h2>
        <ol class="emp-passos">
          <li v-for="(p, i) in COMO_FUNCIONA" :key="i">{{ p }}</li>
        </ol>
      </section>

      <section id="proposta" class="emp-bloco emp-form-wrap">
        <h2>{{ t('empresas.formH2') }}</h2>
        <div v-if="enviado" class="emp-ok" role="status" data-testid="empresas-ok">
          <strong>{{ emIngles ? t('empresas.recebido') : MSG_RECEBIDO }}</strong>
        </div>
        <form v-else class="emp-form" novalidate @submit.prevent="enviar">
          <div class="emp-campo">
            <label for="emp-nome">{{ t('empresas.nome') }}</label>
            <input id="emp-nome" v-model="form.nome" type="text" autocomplete="name" maxlength="120" :aria-invalid="campoErro === 'nome'" required>
          </div>
          <div class="emp-campo">
            <label for="emp-empresa">{{ t('empresas.empresa') }}</label>
            <input id="emp-empresa" v-model="form.empresa" type="text" autocomplete="organization" maxlength="160" :aria-invalid="campoErro === 'empresa'" required>
          </div>
          <div class="emp-campo">
            <label for="emp-tipo">{{ t('empresas.tipo') }}</label>
            <select id="emp-tipo" v-model="form.tipo" :aria-invalid="campoErro === 'tipo'" required>
              <option value="" disabled>{{ t('empresas.escolha') }}</option>
              <option v-for="tp in TIPOS_EMPRESA" :key="tp" :value="tp">{{ t(`empresas.tipos.${tp}`) }}</option>
            </select>
          </div>
          <div class="emp-linha">
            <div class="emp-campo emp-campo--cidade">
              <label for="emp-cidade">{{ t('empresas.cidade') }}</label>
              <input id="emp-cidade" v-model="form.cidade" type="text" autocomplete="address-level2" maxlength="120" :aria-invalid="campoErro === 'cidade'" required>
            </div>
            <div class="emp-campo emp-campo--uf">
              <label for="emp-uf">{{ t('empresas.uf') }}</label>
              <select id="emp-uf" v-model="form.uf" :aria-invalid="campoErro === 'uf'" required>
                <option value="" disabled>{{ t('empresas.uf') }}</option>
                <option v-for="u in UFS" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>
          </div>
          <div class="emp-campo">
            <label for="emp-volume">{{ t('empresas.volume') }}</label>
            <select id="emp-volume" v-model="form.volume_faixa" :aria-invalid="campoErro === 'volume_faixa'" required>
              <option value="" disabled>{{ t('empresas.escolha') }}</option>
              <option v-for="v in VOLUMES_EMPRESA" :key="v" :value="v">{{ t(`empresas.volumes.${ROTULO_VOLUME[v]}`) }}</option>
            </select>
          </div>
          <div class="emp-campo">
            <label for="emp-whats">{{ t('empresas.whatsapp') }}</label>
            <input id="emp-whats" v-model="form.whatsapp" type="tel" inputmode="tel" autocomplete="tel" :placeholder="t('empresas.whatsappPlaceholder')" maxlength="20" :aria-invalid="campoErro === 'whatsapp'" required>
          </div>
          <div class="emp-campo">
            <label for="emp-email">{{ t('empresas.email') }}</label>
            <input id="emp-email" v-model="form.email" type="email" inputmode="email" autocomplete="email" maxlength="160" :aria-invalid="campoErro === 'email'" required>
          </div>
          <div class="emp-campo">
            <label for="emp-msg">{{ t('empresas.mensagem') }}</label>
            <textarea id="emp-msg" v-model="form.mensagem" rows="3" maxlength="2000" />
          </div>
          <!-- honeypot: invisivel para pessoas, bots preenchem -->
          <div class="emp-hp" aria-hidden="true">
            <label for="emp-site">Site</label>
            <input id="emp-site" v-model="form.site" type="text" tabindex="-1" autocomplete="off">
          </div>
          <label class="emp-aceite">
            <input v-model="form.aceite" type="checkbox" :aria-invalid="campoErro === 'aceite'">
            <i18n-t keypath="empresas.aceite" tag="span" scope="global">
              <template #link><NuxtLink :to="rota('/politica-de-privacidade')" target="_blank">{{ t('empresas.aceiteLink') }}</NuxtLink></template>
            </i18n-t>
          </label>
          <p v-if="erro" class="emp-erro" role="alert">{{ erro }}</p>
          <button type="submit" class="pc-btn pc-btn--primary emp-enviar" :disabled="enviando">
            {{ enviando ? t('comum.enviando') : t('empresas.pedir') }}
          </button>
          <p class="emp-nota">{{ t('empresas.respondemos') }}</p>
        </form>
      </section>

      <nav class="pc-breadcrumb">
        <NuxtLink :to="rota('/')">PlacaCompleta</NuxtLink>
        <span> &rsaquo; </span>
        <strong>{{ t('empresas.breadcrumb') }}</strong>
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
.emp-pacotes { display: grid; grid-template-columns: 1fr; gap: 12px; }
@media (min-width: 720px) { .emp-pacotes { grid-template-columns: 1fr 1fr; } }
.emp-pacote { border: 1px solid #e8e8e8; border-radius: 14px; padding: 18px; background: #fff; display: grid; gap: 4px; }
.emp-pacote p { margin: 0; }
.emp-pacote__qtd { font-weight: 700; color: #17539f; }
.emp-pacote__total { font-size: 1.8rem; font-weight: 700; line-height: 1.1; }
.emp-pacote__cada { color: #3d3d3d; }
.emp-pacote__eco { font-size: 14px; color: #14622f; }
.emp-pacote__eco s { color: #636363; }
.emp-pacote__btn { margin-top: 10px; min-height: 44px; }
.emp-pacotes__mais { margin-top: 12px; }
.emp-ok { padding: 16px; border-radius: 10px; background: #e8f5ee; color: #14622f; }
</style>
