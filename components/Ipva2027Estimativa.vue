<script setup lang="ts">
// IPVA 2027 estimate on /ipva-2027, under the plate lookup (slot of
// FipePorPlaca) or under a typed FIPE value. Never the official amount: FIPE
// value x passenger-car rate of the state, only for states whose rate was read
// on an official source, and never with a guessed tier (shared/ipva-2027.ts,
// shared/ipva-uf.ts). Motorcycles and trucks get no number.
import { ref, computed, watch } from 'vue'
import { states } from '~/data/states'
import { emEstado } from '~/shared/seo-titulo'
import { combustivelIpva, type CombustivelIpva } from '~/shared/ipva-uf'
import { estimarIpva2027, aliquotaEmTexto, reais, dependeEmTexto, combustivelEmTexto } from '~/shared/ipva-2027'

const props = withDefaults(defineProps<{
  fipe: string | number | null | undefined
  ufInicial?: string | null
  segmento?: string | null
  /** Fuel text and model name of the lookup ("Álcool/Gasolina", "... HEV"). */
  combustivelTexto?: string | null
  modelo?: string | null
  /** Fuel group given directly (the typed-value form assumes gasoline or flex). */
  combustivel?: CombustivelIpva | null
  /** 'placa': the state came with the lookup and the person confirms it. */
  origem?: 'placa' | 'manual'
  idBase?: string
}>(), {
  ufInicial: null,
  segmento: null,
  combustivelTexto: null,
  modelo: null,
  combustivel: null,
  origem: 'placa',
  idBase: 'ipe',
})

const UFS = Object.values(states)
  .map((s) => ({ uf: s.uf, nome: s.name }))
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

function ufValida(v: unknown): string {
  const u = String(v || '').trim().toUpperCase()
  return UFS.some((s) => s.uf === u) ? u : ''
}

const uf = ref(ufValida(props.ufInicial))
watch(() => props.ufInicial, (v) => { uf.value = ufValida(v) })

const nomeUf = computed(() => UFS.find((s) => s.uf === uf.value)?.nome || uf.value)
const grupo = computed(() => props.combustivel ?? combustivelIpva(null, props.combustivelTexto, props.modelo))
const est = computed(() => estimarIpva2027({ valorFipe: props.fipe, uf: uf.value, segmento: props.segmento, combustivel: grupo.value }))
</script>

<template>
  <div class="ipe" aria-live="polite">
    <p v-if="est.tipo === 'nao_automovel'" class="ipe__aviso">
      A estimativa desta página usa a alíquota de automóvel, e
      {{ est.segmento === 'moto' ? 'motos' : 'caminhões' }} podem ter alíquota diferente.
      Confira o IPVA na Secretaria da Fazenda (SEFAZ) do estado onde o veículo está registrado.
    </p>
    <template v-else>
      <label :for="`${idBase}-uf`" class="ipe__label">Estado onde o carro está registrado</label>
      <select :id="`${idBase}-uf`" v-model="uf" class="ipe__uf">
        <option value="">Escolha o estado</option>
        <option v-for="s in UFS" :key="s.uf" :value="s.uf">{{ s.nome }} ({{ s.uf }})</option>
      </select>
      <p v-if="origem === 'placa'" class="ipe__nota">
        O IPVA é pago no estado onde o carro está registrado hoje. Confira no documento do
        carro (CRLV) e troque o estado se precisar.
      </p>

      <div v-if="est.tipo === 'valor'" class="ipe__res">
        <div class="ipe__valor">
          <span>IPVA 2027 estimado</span>
          <strong>{{ reais(est.ipva) }}</strong>
        </div>
        <p class="ipe__conta">
          {{ reais(est.valorFipe) }} de valor FIPE × {{ aliquotaEmTexto(est.aliquota) }}, a alíquota
          <template v-if="est.combustivel === 'comum'">de automóvel</template>
          <template v-else>de carro {{ combustivelEmTexto(est.combustivel) }}</template>
          {{ emEstado(est.uf, nomeUf) }}.
        </p>
        <p class="ipe__nota">
          É uma estimativa, não o valor oficial nem uma consulta de débitos. O valor oficial sai na
          SEFAZ do estado, que usa a própria tabela do ano e aplica descontos e isenções que esta
          conta não considera. Alíquota conferida em {{ est.conferidoEm }}:
          <a :href="est.fonte.url" target="_blank" rel="noopener noreferrer">{{ est.fonte.nome }}</a>.
        </p>
      </div>

      <div v-else-if="est.tipo === 'faixa'" class="ipe__res">
        <div class="ipe__valor">
          <span>IPVA 2027 estimado</span>
          <strong>{{ reais(est.ipvaMin) }} a {{ reais(est.ipvaMax) }}</strong>
        </div>
        <p class="ipe__conta">
          A alíquota de automóvel {{ emEstado(est.uf, nomeUf) }} depende {{ dependeEmTexto(est.depende) }}:
          {{ est.descricao }}. A consulta pela placa nesta página não traz esse dado, então mostramos
          a faixa para {{ reais(est.valorFipe) }} de valor FIPE.
        </p>
        <p class="ipe__nota">
          É uma estimativa, não o valor oficial nem uma consulta de débitos. O valor oficial sai na
          SEFAZ do estado. Alíquotas conferidas em {{ est.conferidoEm }}:
          <a :href="est.fonte.url" target="_blank" rel="noopener noreferrer">{{ est.fonte.nome }}</a>.
        </p>
      </div>

      <p v-else-if="est.tipo === 'combustivel_especial' && est.combustivel" class="ipe__aviso">
        Para carro {{ combustivelEmTexto(est.combustivel) }}, a alíquota {{ emEstado(est.uf, nomeUf) }}
        pode ser diferente da de carro a gasolina ou flex, e a fonte oficial que conferimos não traz
        esse caso. Confira o valor na Secretaria da Fazenda (SEFAZ) do estado.
      </p>
      <p v-else-if="est.tipo === 'combustivel_especial'" class="ipe__aviso">
        Não identificamos o combustível deste carro, e ele muda a alíquota em alguns estados. Confira o
        valor na Secretaria da Fazenda (SEFAZ) do estado.
      </p>
      <p v-else-if="est.tipo === 'aliquota_nao_conferida'" class="ipe__aviso">
        Ainda não conferimos a alíquota 2027 {{ emEstado(est.uf, nomeUf) }} numa fonte oficial, por
        isso não mostramos estimativa para esse estado. Confira o valor na Secretaria da Fazenda
        (SEFAZ) do estado.
      </p>
      <p v-else-if="est.tipo === 'sem_fipe' && origem === 'manual'" class="ipe__nota">
        Digite o valor FIPE do carro para ver a estimativa.
      </p>
      <p v-else-if="est.tipo === 'sem_fipe'" class="ipe__aviso">
        Sem valor FIPE para este veículo, não dá para estimar o IPVA aqui. Confira o valor na
        SEFAZ do estado.
      </p>
    </template>
  </div>
</template>

<style scoped>
.ipe { margin-top: 16px; padding: 14px 16px; border: 1px solid var(--pc-hairline); border-radius: 12px; background: var(--pc-canvas); }
.ipe__label { display: block; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--pc-graphite); margin-bottom: 8px; }
.ipe__uf { width: 100%; max-width: 360px; height: 44px; padding: 0 12px; border: 1px solid var(--pc-steel); border-radius: 8px; font: inherit; color: var(--pc-ink); background: var(--pc-canvas); }
.ipe__uf:focus { outline: 2px solid var(--pc-blue); outline-offset: 1px; }
.ipe__res { margin-top: 12px; }
.ipe__valor { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px; padding: 14px 16px; border-radius: 12px; background: var(--pc-cloud); }
.ipe__valor span { font-size: 0.8125rem; color: var(--pc-graphite); text-transform: uppercase; letter-spacing: 0.05em; }
.ipe__valor strong { font-size: 1.5rem; color: var(--pc-ink); }
.ipe__conta { margin: 10px 0 0; color: var(--pc-charcoal); font-size: 0.9375rem; }
.ipe__nota { font-size: 0.8125rem; color: var(--pc-graphite); margin: 8px 0 0; }
.ipe__aviso { margin: 10px 0 0; color: var(--pc-charcoal); font-size: 0.9375rem; }
</style>
