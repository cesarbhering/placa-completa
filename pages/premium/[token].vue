<script setup lang="ts">
// Relatorio premium (superficie paga, token e a credencial).
const route = useRoute()
const token = route.params.token as string
useHead({ title: 'Relatório Veicular', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const { data, pending, error, refresh } = await useFetch<any>('/api/premium/report', { query: { token } })

// historico local: registra/atualiza este pedido e, se ainda nao entregue,
// fica dando refresh ate liberar (o "Concluir" do historico cai aqui).
const { itens, sync: histSync, add: histAdd, updateStatus: histUpdate } = useConsultaHistory()

function copiar() {
  if (data.value?.brCode) navigator.clipboard?.writeText(data.value.brCode)
}

let poll: any = null
onMounted(() => {
  histSync()
  if (!data.value) return
  const existe = itens.value.some((x) => x.token === token)
  if (existe) histUpdate(token, data.value.status)
  else histAdd({ token, placa: data.value.placa, veiculo: g('descricaoMarcaModelo') || null, status: data.value.status })
  if (data.value.status !== 'entregue') {
    poll = setInterval(async () => {
      await refresh()
      if (data.value) histUpdate(token, data.value.status)
      if (data.value?.status === 'entregue') clearInterval(poll)
    }, 4000)
  }
})
onUnmounted(() => poll && clearInterval(poll))

// Plano do pedido: a basica nao recebe os campos de risco (o corte e no
// servidor), entao a tela some com os blocos em vez de mostrar vazio.
const plano = computed<string>(() => data.value?.plano || 'completa')
const isBasica = computed(() => plano.value === 'basica')
const restantes = computed<number>(() => data.value?.camposRestantes || 0)

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
        <h1>{{ isBasica ? 'Consulta Básica' : 'Relatório Veicular Completo' }}</h1>
        <p class="placa">Placa {{ data.placa }}</p>

        <div v-if="data.status !== 'entregue'" class="aviso">
          <template v-if="['pago', 'consultando'].includes(data.status)">
            <h2 class="av-h">Pagamento confirmado ✓</h2>
            <p>Estamos rodando sua consulta. Isso leva alguns segundos.</p>
          </template>
          <template v-else-if="data.status === 'aguardando_pagamento' && data.brCode">
            <h2 class="av-h">Conclua o pagamento</h2>
            <p>Use o Pix copia e cola abaixo. Assim que cair, o relatório libera sozinho.</p>
            <button class="ghost" @click="copiar">Copiar código Pix</button>
            <p class="small">{{ data.brCode }}</p>
          </template>
          <template v-else-if="data.expirado || data.status === 'expirado'">
            <h2 class="av-h">Este Pix expirou</h2>
            <p>Inicie uma nova consulta para gerar outro pagamento.</p>
            <NuxtLink class="btnlink" to="/premium">Nova consulta</NuxtLink>
          </template>
          <template v-else-if="data.status === 'reembolsado'">
            <h2 class="av-h">Não foi possível concluir</h2>
            <p>O valor foi reembolsado.</p>
          </template>
          <template v-else>
            <h2 class="av-h">Status: {{ data.status }}</h2>
            <p>Se você acabou de pagar, aguarde alguns instantes.</p>
          </template>
        </div>

        <template v-else>
          <template v-if="!isBasica">
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
          </template>

          <h2>Ficha cadastral</h2>
          <table><tbody>
            <tr v-for="(row, idx) in cadastro" :key="idx"><td>{{ row[0] }}</td><td>{{ row[1] }}</td></tr>
          </tbody></table>

          <!-- Upsell honesto: diz quantos campos a completa ainda traria e o
               que sao, sem fingir que o dado ja esta aqui. -->
          <div v-if="isBasica" class="up">
            <h2 class="av-h">Faltam os dados de risco</h2>
            <p>
              A consulta básica mostra o que o veículo é. O relatório completo mostra
              se dá pra confiar nele:
              <template v-if="restantes">
                são <strong>{{ restantes }}</strong> informações a mais:
              </template>
              restrições nacionais e estaduais, roubo e furto, passagem por leilão,
              gravame, RENAJUD, indicador de multas, seguro estimado e custo em 5 anos.
            </p>
            <NuxtLink class="btnlink" :to="`/?placa=${data.placa}&plano=completa`">
              Ver relatório completo · R$ 45
            </NuxtLink>
          </div>

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
.aviso { background: #0b1424; border: 1px solid #24324d; border-radius: 8px; padding: 16px; margin-top: 16px; }
.av-h { font-size: 16px; margin: 0 0 8px; text-transform: none; color: #dbe4f4; letter-spacing: 0; }
.ghost { background: transparent; border: 1px solid #24324d; color: #9db8e8; border-radius: 7px; padding: 10px 12px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 6px; }
.small { color: #8296b8; font-size: 11px; word-break: break-all; margin: 8px 0 0; }
.btnlink { display: inline-block; margin-top: 10px; background: #0466c8; color: #fff; text-decoration: none; border-radius: 7px; padding: 10px 14px; font-size: 14px; font-weight: 600; }
.inds { display: flex; flex-wrap: wrap; gap: 6px; }
.ind { font-size: 12px; padding: 4px 8px; border-radius: 6px; background: rgba(30,158,74,.15); color: #4ade80; }
.ind.on { background: rgba(224,83,61,.18); color: #f87171; font-weight: 600; }
table { width: 100%; border-collapse: collapse; }
td { padding: 7px 0; border-bottom: 1px solid #1c2740; font-size: 14px; }
td:first-child { color: #8296b8; width: 42%; }
ul { margin: 0; padding-left: 18px; } li { margin: 3px 0; }
.up { margin-top: 24px; background: #0b1424; border: 1px solid #24324d; border-radius: 8px; padding: 16px; }
.up p { font-size: 14px; line-height: 1.5; color: #9db8e8; margin: 0 0 12px; }
.up strong { color: #dbe4f4; }
.raw { margin-top: 20px; } summary { cursor: pointer; color: #9db8e8; font-size: 12px; }
pre { background: #0b1424; border: 1px solid #24324d; border-radius: 8px; padding: 12px; overflow: auto; font-size: 11px; max-height: 340px; }
</style>
