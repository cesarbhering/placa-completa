<script setup lang="ts">
import { NOTA_NIVEL, gravidadeInformada, cabeEmPilula } from '~/shared/leilao-exibicao'

// Card de passagem por leilao, "ficha em linhas rotuladas" (opcao 2 escolhida
// pelo Cesar, 21/out/2026): titulo com a data, comitente de subtitulo e cada
// fato numa linha com rotulo a esquerda. Vale para todas as passagens (nossas
// fontes e base parceira). Fotos, edital e "o que foi comparado" ficam no card
// da pagina, abaixo desta ficha.
const props = defineProps<{ p: any }>()
const p = computed(() => props.p)
// Pilula so pra rotulo curto; rotulo longo vira texto colorido (no celular a
// pilula longa quebrava feio).
const forma = (t: unknown) => (cabeEmPilula(t) ? '' : 'lf-chip--texto')
const mostraGravidade = computed(() => gravidadeInformada(p.value.gravidade))
const linhasFatos = computed(() => {
  const l: { k: string; v: string }[] = []
  if (p.value.loteNumero) l.push({ k: 'Lote', v: String(p.value.loteNumero) })
  if (p.value.ref && p.value.fonteTipo === 'detran') l.push({ k: 'Edital', v: String(p.value.ref) })
  if (p.value.leiloeiro) l.push({ k: 'Leiloeiro', v: String(p.value.leiloeiro) })
  for (const d of (p.value.detalhes || [])) l.push({ k: d.rotulo, v: d.valor })
  if (p.value.origem) l.push({ k: 'Origem', v: p.value.origem })
  if (p.value.desfecho) l.push({ k: 'Desfecho', v: p.value.desfecho })
  return l
})
const notaDocumento = computed(() => (p.value.fonteTipo === 'detran'
  ? 'Registro de edital de leilão; pode não constar no documento do veículo.'
  : 'Registro de catálogo de leilão; pode não constar no documento do veículo.'))
</script>

<template>
  <div class="lf">
    <p class="lf-tit">{{ p.data ? `Leilão em ${p.data}` : 'Leilão (data não informada)' }}</p>
    <p v-if="p.comitente" class="lf-sub">{{ p.comitente }}</p>
    <div class="lf-sep" />
    <dl class="lf-linhas">
      <div class="lf-linha">
        <dt>Nível</dt>
        <dd><span class="lf-chip" :class="[`lf-chip--${p.nivel}`, forma(p.rotuloNivel)]">{{ p.rotuloNivel }}</span><small v-if="NOTA_NIVEL[p.nivel]">{{ NOTA_NIVEL[p.nivel] }}</small></dd>
      </div>
      <div class="lf-linha">
        <dt>Fonte</dt>
        <dd><span class="lf-chip lf-chip--fonte" :class="forma(p.fonte)">{{ p.fonte }}</span><small v-if="p.tipoFonte && p.fonteTipo === 'detran'">{{ p.tipoFonte }}</small></dd>
      </div>
      <div v-if="mostraGravidade" class="lf-linha">
        <dt>Gravidade</dt>
        <dd><span class="lf-chip" :class="[`lf-chip--g-${p.gravidade.cor}`, forma(p.gravidade.rotulo)]">{{ p.gravidade.rotulo }}</span><small v-if="p.gravidadeExplica" class="lf-bloco">{{ p.gravidadeExplica }}</small></dd>
      </div>
      <div v-if="p.comitente" class="lf-linha">
        <dt>Comitente</dt>
        <dd>
          <span>{{ p.comitente }}</span>
          <small v-if="p.comitenteTipo">{{ p.comitenteTipo.tipo }}: {{ p.comitenteTipo.leitura }}</small>
        </dd>
      </div>
      <div v-for="f in linhasFatos" :key="f.k" class="lf-linha">
        <dt>{{ f.k }}</dt>
        <dd><span>{{ f.v }}</span></dd>
      </div>
    </dl>
    <div class="lf-sep" />
    <p class="lf-nota">{{ notaDocumento }}</p>
  </div>
</template>

<style scoped>
.lf-tit { margin: 0; font-size: 17px; font-weight: 700; line-height: 1.3; color: #1a1a1a; }
.lf-sub { margin: 2px 0 0; font-size: 14px; color: #636363; }
.lf-sep { height: 1px; background: #e8e8e8; margin: 12px 0; }
.lf-linhas { margin: 0; display: grid; gap: 8px; }
.lf-linha { display: grid; grid-template-columns: 96px 1fr; gap: 10px; align-items: baseline; font-size: 14.5px; }
.lf-linha dt { color: #636363; margin: 0; }
.lf-linha dd { margin: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; font-weight: 600; color: #1a1a1a; min-width: 0; overflow-wrap: anywhere; }
.lf-linha small { font-weight: 400; font-size: 13px; color: #636363; }
.lf-linha small.lf-bloco { flex-basis: 100%; }
.lf-chip { display: inline-flex; align-items: center; font-size: 12px; font-weight: 700; letter-spacing: .02em; line-height: 1; padding: 5px 9px; border-radius: 999px; background: #f2f3f5; color: #3d3d3d; white-space: nowrap; }
.lf-chip--confirmado { background: #fdecea; color: #b3261e; }
.lf-chip--provavel { background: #fdecea; color: #b3261e; }
.lf-chip--possivel { background: #fff4dc; color: #8a5a00; }
.lf-chip--fonte { background: #e3f6f4; color: #137a73; }
.lf-chip--g-vermelho { background: #fdecea; color: #b3261e; }
.lf-chip--g-laranja { background: #fff0e0; color: #a14a00; }
.lf-chip--g-amarelo { background: #fff4dc; color: #8a5a00; }
.lf-chip--g-verde { background: #e8f5ee; color: #14622f; }
.lf-chip--g-cinza { background: #f2f3f5; color: #636363; }
.lf-nota { margin: 0; font-size: 13px; color: #636363; }
.lf-chip--texto { background: none !important; padding: 0; border-radius: 0; white-space: normal; line-height: 1.35; font-size: 14px; letter-spacing: 0; }
@media print { .lf-chip { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
