<script setup lang="ts">
// Variante A do teste A/B: novo layout de pagina inteira do resultado da
// consulta gratis. B = a pagina de hoje (fica no index.vue). Aqui so o A.
//
// Dois estados via `leilaoEncontrado`:
//   true  -> a base propria achou registro de leilao: mostra o gancho laranja
//            com os detalhes bloqueados (afirma o FATO de que achamos registro).
//   false -> nao achou OU nao consultou: NUNCA revela ausencia; o leilao aparece
//            bloqueado junto dos outros itens (bloco neutro).
// Prova social fica de fora no v1 (decisao do Cesar). Precos vem do pai (shared/planos).
// Header/logo reais sao do site (HomeHeader, ja renderizado acima no index).
//
// CTA (rodada 2, 26/set): a acao vive INLINE no fluxo do conteudo, logo apos o
// bloco bloqueado (leilao/pendentes) -- o padrao que converte no B. A rodada 1
// punha a CTA num card-aside sticky que parecia tabela de preco e pegou ZERO
// clique (todo o gap do A veio dai). Agora e coluna unica, um botao de acao que
// cai no olhar depois de a pessoa ver o que esta bloqueado.
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  dados: Record<string, any> | null
  modeloCurto: string
  valorFipeCurto: string | null
  fipeValido: boolean
  barraRelatorioStyle: Record<string, string>
  pctFipe: string | null
  qtdLeiloes: number
  leilaoEncontrado: boolean
  precoCompleta: string
  precoBasica: string
}>()

const emit = defineEmits<{ (e: 'comprar'): void; (e: 'cta-visto'): void }>()

const marcaModelo = () => [props.dados?.marca, props.dados?.modelo].filter(Boolean).join(' ')
const anoLabel = () => {
  const fab = props.dados?.anoFabricacao
  const mod = props.dados?.ano
  if (fab && mod) return `${fab} / ${mod}`
  return String(fab || mod || '')
}

// cta_completa_visto: dispara UMA vez quando a CTA entra na tela, igual a pagina
// de hoje faz com o bloco bloqueado. O pai carimba o evento (com ab_bloco).
const ctaRef = ref<HTMLElement | null>(null)
let obs: IntersectionObserver | null = null
onMounted(() => {
  if (!ctaRef.value || typeof IntersectionObserver === 'undefined') return
  obs = new IntersectionObserver((entradas) => {
    for (const en of entradas) {
      if (en.isIntersecting) { emit('cta-visto'); obs?.disconnect(); obs = null; break }
    }
  }, { threshold: 0.4 })
  obs.observe(ctaRef.value)
})
onBeforeUnmount(() => { obs?.disconnect(); obs = null })

const LockIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Bloqueado"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`
</script>

<template>
  <div class="la-root">
    <main class="la-pagina">
      <!-- TITULO -->
      <div class="la-titulo">
        <template v-if="leilaoEncontrado">
          <div class="la-sobre la-sobre--alerta">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            ATENÇÃO NESTA PLACA
          </div>
          <h1>Este <span>{{ modeloCurto }}</span> tem <span>{{ qtdLeiloes }}</span> {{ qtdLeiloes === 1 ? 'registro' : 'registros' }} de leilão na nossa base.</h1>
          <p>A consulta grátis mostra o que é o carro. Data, leiloeira, motivo e valor do leilão, e se ainda há indício de roubo, financiamento ou bloqueio, estão no relatório completo.</p>
        </template>
        <template v-else>
          <div class="la-sobre">CONSULTA GRÁTIS CONCLUÍDA</div>
          <h1>Você viu o que é o carro. Falta ver o que ele carrega.</h1>
          <p>Leilão, indício de roubo e furto, financiamento e bloqueio judicial não aparecem na consulta grátis. É isso que trava a transferência ou derruba o preço.</p>
        </template>
      </div>

      <!-- DADOS GRATIS -->
      <section class="la-card la-dados" aria-label="Dados do veículo">
        <div class="la-dado"><span>PLACA</span><strong>{{ dados?.placa }}</strong></div>
        <div v-if="marcaModelo()" class="la-dado"><span>MARCA / MODELO</span><strong>{{ marcaModelo() }}</strong></div>
        <div v-if="anoLabel()" class="la-dado"><span>ANO FAB. / MODELO</span><strong>{{ anoLabel() }}</strong></div>
        <div v-if="dados?.fipe" class="la-dado"><span>VALOR FIPE</span><strong class="la-forte">{{ dados.fipe }}</strong></div>
        <div v-if="dados?.cor" class="la-dado"><span>COR</span><strong>{{ dados.cor }}</strong></div>
        <div v-if="dados?.combustivel" class="la-dado"><span>COMBUSTÍVEL</span><strong>{{ dados.combustivel }}</strong></div>
        <div v-if="dados?.origem" class="la-dado"><span>ORIGEM</span><strong>{{ dados.origem }}</strong></div>
        <div v-if="dados?.chassiParcial" class="la-dado"><span>PARTE DO CHASSI</span><strong>{{ dados.chassiParcial }}</strong></div>
      </section>

      <!-- ANCORA DE PRECO (some inteira sem FIPE parseavel). Fica ENTRE os
           dados e o bloco de leilao/pendentes (ordem pedida pelo Cesar). -->
      <section v-if="fipeValido" class="la-card la-ancora">
        <div class="la-barra">
          <div class="la-barra-rot"><span>Tabela FIPE {{ marcaModelo() }}</span><strong>{{ valorFipeCurto }}</strong></div>
          <div class="la-trilho la-trilho--cheio" />
        </div>
        <h2>{{ precoCompleta }} agora, ou um carro que não transfere depois.</h2>
        <div class="la-barra">
          <div class="la-barra-rot"><span>Relatório completo</span><strong>{{ precoCompleta }}</strong></div>
          <div class="la-trilho"><b :style="barraRelatorioStyle" /></div>
        </div>
        <small><span>{{ pctFipe }}</span> do valor do carro para saber se ele carrega indício de roubo, leilão, financiamento ou bloqueio.</small>
      </section>

      <!-- BLOCO LEILAO -->
      <section v-if="leilaoEncontrado" class="la-leilao">
        <div class="la-bloco-topo">
          <h2>Registro de leilão encontrado</h2>
          <span>Placa e chassi cruzados com mais de 1 milhão de veículos leiloados</span>
        </div>
        <div class="la-leilao-grid">
          <div v-for="rot in ['Data do leilão','Leiloeira','Motivo','Valor de venda']" :key="rot" class="la-leilao-item">
            <span>{{ rot }}</span>
            <span class="la-bloqueado"><i /><span class="la-lock" v-html="LockIcon" /></span>
          </div>
        </div>
        <p>Carro de leilão costuma valer menos, pode ter restrição de seguro e às vezes nem consta no documento. Saiba antes de negociar.</p>
      </section>

      <section v-else class="la-card la-pendentes">
        <div class="la-bloco-topo">
          <h2>O que decide a compra deste <span>{{ modeloCurto }}</span></h2>
          <span>Liberado no relatório completo</span>
        </div>
        <div class="la-pendentes-grid">
          <div v-for="rot in ['Histórico de leilão','Leilão no documento','Indício de roubo e furto','Financiamento (gravame)','Bloqueio judicial','Multas e restrições']" :key="rot" class="la-pendente">
            <span>{{ rot }}</span>
            <span class="la-bloqueado"><i /><span class="la-lock" v-html="LockIcon" /></span>
          </div>
        </div>
        <p>O histórico de leilão cruza placa e chassi com mais de 1 milhão de veículos leiloados, inclusive leilões que não constam no documento.</p>
      </section>

      <!-- ACAO PRINCIPAL: CTA inline no fluxo, logo apos o bloco bloqueado
           (padrao que converte no B). Botao de acao, nao tabela de preco. -->
      <section class="la-acao" aria-label="Liberar o relatório completo">
        <h2 v-if="leilaoEncontrado">Libere o leilão e o relatório completo</h2>
        <h2 v-else-if="modeloCurto">Libere o relatório completo deste <span>{{ modeloCurto }}</span></h2>
        <h2 v-else>Libere o relatório completo</h2>
        <p class="la-acao-sub">Tudo que a consulta grátis não mostra, em até 5 minutos depois do Pix.</p>
        <div class="la-inclui">
          <span v-for="it in ['Roubo e furto','Leilão','Gravame','RENAJUD','Multas','Restrições']" :key="it">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#067647" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>{{ it }}
          </span>
        </div>
        <button ref="ctaRef" class="la-cta" type="button" @click="emit('comprar')">
          <span v-if="leilaoEncontrado">Ver o leilão e o relatório · {{ precoCompleta }}</span>
          <span v-else>Ver relatório completo · {{ precoCompleta }}</span>
        </button>
        <div class="la-cta-nota">Pix, uma vez · sem assinatura · nota fiscal sob pedido</div>
        <p class="la-acao-basica">Só a ficha? Consulta básica por {{ precoBasica }} (sem roubo e restrições).</p>
        <div class="la-garantia">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#067647" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>
          <div><strong>Não achou o veículo? O Pix volta sozinho.</strong> Sem cadastro, só um e-mail para o link.</div>
        </div>
      </section>

      <!-- FAQ -->
      <section class="la-faq">
        <div><strong>Quanto tempo leva?</strong><span>Em até 5 minutos depois do Pix, 24 horas por dia.</span></div>
        <div><strong>Preciso criar conta?</strong><span>Não. Só um e-mail para receber o link.</span></div>
        <div><strong>Mostra dados do dono?</strong><span>Não. Só a situação do veículo (LGPD).</span></div>
      </section>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.la-root {
  --la-navy:#001233; --la-ink:#101828; --la-ink2:#344054; --la-muted:#475467; --la-line:#e4e7ec; --la-bg:#f7f8fa;
  --la-blue:#1f5bd8; --la-blue-dark:#1747ad; --la-blue-tint:#f8faff;
  --la-orange-bg:#fff4ed; --la-orange-line:#f9c9a9; --la-orange-soft:#fbd9c4; --la-orange-ink:#b93815; --la-orange-text:#7a2e0e;
  --la-green:#067647; --la-green-bg:#ecfdf3; --la-green-line:#abefc6; --la-green-ink:#054f31;
  --la-lock:#e4e7ec;
  color: var(--la-ink);
  font-family: 'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
.la-root * { box-sizing: border-box; }
.la-pagina { max-width:760px; margin:0 auto; padding:40px 24px; display:flex; flex-direction:column; gap:24px; }
.la-card { background:#fff; border:1px solid var(--la-line); border-radius:16px; padding:24px; }

.la-titulo { display:flex; flex-direction:column; gap:10px; }
.la-sobre { font-size:13px; font-weight:800; letter-spacing:1.4px; color:var(--la-muted); }
.la-sobre--alerta { display:flex; align-items:center; gap:8px; color:var(--la-orange-ink); }
.la-titulo h1 { margin:0; font-size:36px; line-height:1.14; font-weight:800; letter-spacing:-.5px; }
.la-titulo h1 span { font-size:inherit; font-weight:inherit; color:inherit; }
.la-titulo p { margin:0; font-size:17px; line-height:1.55; color:var(--la-ink2); }

.la-dados { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:20px 24px; }
.la-dado { display:flex; flex-direction:column; gap:4px; min-width:0; }
.la-dado span { font-size:11px; font-weight:800; letter-spacing:1px; color:var(--la-muted); }
.la-dado strong { font-size:16px; font-weight:700; }
.la-dado .la-forte { font-weight:800; }

.la-bloqueado { display:flex; align-items:center; gap:8px; color:#98a2b3; }
.la-bloqueado i { display:inline-block; height:14px; width:80px; border-radius:4px; background:var(--la-lock); }
.la-lock :deep(svg) { width:14px; height:14px; }

.la-leilao { background:var(--la-orange-bg); border:1px solid var(--la-orange-line); border-radius:16px; padding:24px; display:flex; flex-direction:column; gap:16px; }
.la-bloco-topo { display:flex; justify-content:space-between; align-items:baseline; gap:24px; }
.la-bloco-topo h2 { margin:0; font-size:20px; font-weight:800; }
/* So o SUBTITULO (span filho DIRETO do topo) e pequeno. O nome do veiculo
   ({{ modeloCurto }}) vive DENTRO do h2 e tem que herdar o tamanho/peso/cor do
   titulo -- por isso `> span` (nao pega o span do h2) + o inherit explicito. */
.la-bloco-topo > span { font-size:13px; }
.la-bloco-topo h2 span { font-size:inherit; font-weight:inherit; color:inherit; }
.la-leilao .la-bloco-topo > span, .la-leilao > p { color:var(--la-orange-text); }
.la-leilao-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
.la-leilao-item { background:#fff; border:1px solid var(--la-orange-soft); border-radius:12px; padding:14px; display:flex; flex-direction:column; gap:10px; }
.la-leilao-item > span { font-size:13px; color:var(--la-muted); }
.la-leilao > p, .la-pendentes > p { margin:0; font-size:14px; line-height:1.5; }

.la-pendentes { display:flex; flex-direction:column; gap:16px; }
.la-pendentes .la-bloco-topo > span, .la-pendentes > p { color:var(--la-muted); }
.la-pendentes-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.la-pendente { background:#f9fafb; border:1px solid #eaecf0; border-radius:12px; padding:14px; display:flex; flex-direction:column; gap:10px; }
.la-pendente > span { font-size:14px; font-weight:700; }

.la-ancora { display:flex; flex-direction:column; gap:14px; }
.la-ancora h2 { margin:0; font-size:20px; font-weight:800; }
.la-barra { display:flex; flex-direction:column; gap:6px; }
.la-barra-rot { display:flex; justify-content:space-between; gap:12px; font-size:14px; }
.la-barra-rot span { color:var(--la-ink2); min-width:0; }
.la-barra-rot strong { font-weight:800; white-space:nowrap; }
.la-trilho { height:14px; border-radius:4px; background:var(--la-lock); }
.la-trilho--cheio { background:var(--la-navy); }
.la-trilho b { display:block; width:4px; height:14px; border-radius:4px; background:var(--la-blue); }
.la-ancora small { font-size:14px; color:var(--la-muted); }

/* ACAO PRINCIPAL: card destacado no fluxo, logo apos o bloco bloqueado. */
.la-acao { background:var(--la-blue-tint); border:2px solid var(--la-blue); border-radius:16px; padding:28px 24px; display:flex; flex-direction:column; gap:16px; box-shadow:0 12px 32px rgba(31,91,216,.12); }
.la-acao h2 { margin:0; font-size:24px; font-weight:800; letter-spacing:-.3px; }
.la-acao h2 span { font-size:inherit; font-weight:inherit; color:inherit; }
.la-acao-sub { margin:0; font-size:15px; color:var(--la-ink2); }
.la-inclui { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
.la-inclui span { display:flex; gap:6px; align-items:center; font-size:14px; font-weight:600; }
.la-cta { width:100%; min-height:60px; border:0; border-radius:12px; background:var(--la-blue); color:#fff; font:inherit; font-size:18px; font-weight:800; cursor:pointer; box-shadow:0 6px 16px rgba(31,91,216,.28); }
.la-cta:hover { background:var(--la-blue-dark); }
.la-cta-nota { text-align:center; font-size:13px; color:var(--la-muted); }
.la-acao-basica { margin:0; font-size:13px; color:var(--la-muted); }
.la-garantia { display:flex; gap:12px; align-items:flex-start; padding:14px; border-radius:12px; background:var(--la-green-bg); border:1px solid var(--la-green-line); font-size:14px; line-height:1.45; color:var(--la-green-ink); }

.la-faq { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:24px; padding:4px 4px 0; }
.la-faq div { display:flex; flex-direction:column; gap:4px; }
.la-faq strong { font-size:15px; }
.la-faq span { font-size:14px; line-height:1.45; color:var(--la-muted); }

@media (max-width:960px) {
  .la-pagina { padding:24px 16px; gap:20px; }
  .la-titulo h1 { font-size:26px; }
  .la-dados, .la-leilao-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .la-pendentes-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .la-inclui { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .la-faq { grid-template-columns:1fr; }
  .la-bloco-topo { flex-direction:column; gap:4px; }
  .la-acao { padding:22px 18px; }
  .la-acao h2 { font-size:21px; }
}
</style>
