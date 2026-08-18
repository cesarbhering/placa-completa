<script setup lang="ts">
// Relatorio premium (superficie paga, token e a credencial).
const route = useRoute()
const token = route.params.token as string
useHead({ title: 'Relatório Premium', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const { data, pending, error } = await useFetch<any>('/api/premium/report', { query: { token } })

const v = computed(() => data.value?.consulta?.response || {})
const g = (k: string) => (v.value ? v.value[k] : null)
const has = (k: string) => v.value && v.value[k] !== undefined && v.value[k] !== null && v.value[k] !== ''

// indicadores "de risco" (true = atenção)
const indicadores = computed(() => [
  { k: 'indicadorRouboFurto', label: 'Roubo/Furto' },
  { k: 'indicadorRestricaoRenajud', label: 'Restrição RENAJUD' },
  { k: 'indicadorRestricaoRfb', label: 'Restrição RFB' },
  { k: 'indicadorMultaRenainf', label: 'Multa RENAINF' },
  { k: 'indicadorRecall', label: 'Recall' },
  { k: 'indicadorLeilao', label: 'Leilão' },
  { k: 'indicadorComunicacaoVenda', label: 'Comunicação de venda' },
  { k: 'indicadorPendenciaEmissao', label: 'Pendência de emissão' },
  { k: 'indicadorAlarme', label: 'Alarme' },
  { k: 'indicadorSiniav', label: 'SINIAV' },
].map((i) => ({ ...i, on: g(i.k) === true })))

const restricoes = computed(() =>
  ['descricaoRestricao1', 'descricaoRestricao2', 'descricaoRestricao3', 'descricaoRestricao4', 'descricaoRestricaoRfb']
    .map((k) => g(k)).filter(Boolean),
)
const cadastro = computed(() => [
  ['Marca/Modelo', g('descricaoMarcaModelo')],
  ['Ano fab./modelo', has('anoFabricacao') ? `${g('anoFabricacao')}/${g('anoModelo')}` : null],
  ['Cor', g('descricaoCor')],
  ['Espécie', g('descricaoEspecie')],
  ['Tipo', g('descricaoTipoVeiculo')],
  ['Categoria', g('descricaoCategoria')],
  ['Chassi', g('chassi')],
  ['Renavam', g('renavam')],
  ['Situação', g('situacao')],
  ['UF jurisdição', g('ufJurisdicao')],
  ['Potência', g('potencia')],
  ['Cilindrada', g('cilindrada')],
  ['Lotação', g('lotacao')],
  ['Eixos', g('quantidadeDeEixos')],
].filter((r) => r[1] !== null && r[1] !== undefined && r[1] !== ''))
</script>

<template>
  <div class="rep">
    <div class="card">
      <div v-if="pending">Carregando…</div>
      <div v-else-if="error || !data">Relatório não encontrado.</div>
      <template v-else>
        <h1>Relatório Veicular Completo</h1>
        <p class="placa">Placa {{ data.placa }}</p>

        <div v-if="data.status !== 'entregue'" class="aviso">
          Status: {{ data.status }}. Se você acabou de pagar, atualize em instantes.
        </div>

        <template v-else>
          <h2>Indicadores</h2>
          <div class="inds">
            <span v-for="i in indicadores" :key="i.k" class="ind" :class="{ on: i.on }">
              {{ i.label }}: {{ i.on ? 'SIM' : 'não' }}
            </span>
          </div>

          <template v-if="restricoes.length">
            <h2>Restrições</h2>
            <ul><li v-for="(r, idx) in restricoes" :key="idx">{{ r }}</li></ul>
          </template>

          <h2>Ficha cadastral</h2>
          <table><tbody>
            <tr v-for="(row, idx) in cadastro" :key="idx"><td>{{ row[0] }}</td><td>{{ row[1] }}</td></tr>
          </tbody></table>

          <details class="raw"><summary>Dados completos (JSON)</summary>
            <pre>{{ JSON.stringify(v, null, 2) }}</pre>
          </details>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.rep { min-height: 100vh; background: #0b1220; padding: 20px; color: #dbe4f4; font-family: system-ui; }
.card { max-width: 640px; margin: 0 auto; background: #111a2e; border: 1px solid #24324d; border-radius: 12px; padding: 24px; }
h1 { font-size: 20px; margin: 0; } h2 { font-size: 14px; text-transform: uppercase; color: #8296b8; letter-spacing: .5px; margin: 22px 0 8px; }
.placa { color: #9db8e8; margin: 4px 0 0; }
.aviso { background: #0b1424; border: 1px solid #24324d; border-radius: 8px; padding: 14px; margin-top: 16px; }
.inds { display: flex; flex-wrap: wrap; gap: 6px; }
.ind { font-size: 12px; padding: 4px 8px; border-radius: 6px; background: rgba(30,158,74,.15); color: #4ade80; }
.ind.on { background: rgba(224,83,61,.18); color: #f87171; font-weight: 600; }
table { width: 100%; border-collapse: collapse; }
td { padding: 7px 0; border-bottom: 1px solid #1c2740; font-size: 14px; }
td:first-child { color: #8296b8; width: 42%; }
ul { margin: 0; padding-left: 18px; } li { margin: 3px 0; }
.raw { margin-top: 20px; } summary { cursor: pointer; color: #9db8e8; font-size: 12px; }
pre { background: #0b1424; border: 1px solid #24324d; border-radius: 8px; padding: 12px; overflow: auto; font-size: 11px; max-height: 340px; }
</style>
