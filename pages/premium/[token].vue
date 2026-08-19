<script setup lang="ts">
// Relatorio veicular (superficie PAGA — o token da URL e a credencial).
//
// Antes era marcacao crua com os dados do jeito que a API devolve. Agora segue
// a linguagem do .agents/DESIGN-hp.md, a mesma da home: canvas branco, tinta
// near-black, um acento azul, 4px no interativo e 16px no container, hairline
// no lugar de sombra pesada.
//
// A pagina cobre tres momentos bem diferentes:
//   1. entregue                -> o relatorio inteiro
//   2. aguardando_pagamento    -> retomada do Pix (a pessoa voltou pra concluir)
//   3. pago/consultando/erro   -> estados de transicao e falha
//
// O corte por plano acontece no servidor: o que a basica nao comprou nem chega
// aqui. A tela so esconde os blocos que ficariam vazios.
import { PLANOS, precoBRL } from '~/shared/planos'

const route = useRoute()
const token = route.params.token as string
useHead({ title: 'Relatório Veicular', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const { data, pending, error, refresh } = await useFetch<any>('/api/premium/report', { query: { token } })

const { itens, sync: histSync, add: histAdd, updateStatus: histUpdate } = useConsultaHistory()

const plano = computed<string>(() => data.value?.plano || 'completa')
const isBasica = computed(() => plano.value === 'basica')
const restantes = computed<number>(() => data.value?.camposRestantes || 0)
const entregue = computed(() => data.value?.status === 'entregue')

// O servidor ja devolve a resposta achatada (ver normalizarResposta): array de
// um elemento, com os indicadores que vinham aninhados em `restricoes` subidos
// pro topo e as restricoes detalhadas em `restricoesItens`.
const v = computed(() => data.value?.consulta?.response || {})

// A API manda ENUM em caixa alta, com underscore e SEM acento
// ("EM_CIRCULACAO", "PENDENCIA_DE_EMISSAO_CRV"). Jogar isso na tela e entregar
// o banco cru; so trocar underscore por espaco produz "Em circulacao", que e
// portugues errado na cara do cliente. Os valores conhecidos ganham a grafia
// certa aqui; o resto cai no formatador generico, que ao menos tira o caixa-alta.
const ROTULOS: Record<string, string> = {
  EM_CIRCULACAO: 'Em circulação',
  BAIXADO: 'Baixado',
  ROUBO_FURTO: 'Roubo ou furto',
  PENDENCIA_DE_EMISSAO_CRV: 'Pendência de emissão do CRV',
  PENDENCIA_EMISSAO_CRV: 'Pendência de emissão do CRV',
  ALIENACAO_FIDUCIARIA: 'Alienação fiduciária',
  ARRENDAMENTO_MERCANTIL: 'Arrendamento mercantil',
  RESERVA_DE_DOMINIO: 'Reserva de domínio',
  PENHOR: 'Penhor',
  BUSCA_E_APREENSAO: 'Busca e apreensão',
  RESTRICAO_JUDICIAL: 'Restrição judicial',
  RESTRICAO_ADMINISTRATIVA: 'Restrição administrativa',
  RESTRICAO_TRIBUTARIA: 'Restrição tributária',
  COMUNICACAO_DE_VENDA: 'Comunicação de venda',
  AUTOMOVEL: 'Automóvel',
  CAMINHONETE: 'Caminhonete',
  MOTOCICLETA: 'Motocicleta',
  CAMINHAO: 'Caminhão',
  ONIBUS: 'Ônibus',
  MICROONIBUS: 'Micro-ônibus',
  UTILITARIO: 'Utilitário',
  REBOQUE: 'Reboque',
  PASSAGEIRO: 'Passageiro',
  CARGA: 'Carga',
  MISTO: 'Misto',
  PARTICULAR: 'Particular',
  ALUGUEL: 'Aluguel',
  OFICIAL: 'Oficial',
}

// Siglas nao sao palavras: baixar o caixa-alta transformava "RFB" em "Rfb" e
// "RENAJUD" em "Renajud". Ficam intactas, inclusive no meio de uma frase.
const SIGLAS = new Set([
  'RFB', 'RENAJUD', 'RENAINF', 'CRV', 'CRLV', 'SINIAV', 'DETRAN', 'DENATRAN',
  'IPVA', 'DPVAT', 'PRF', 'BIN', 'SRF', 'DI', 'UF', 'CNPJ', 'CPF',
])

function humanizar(x: any): string {
  const t = String(x ?? '').trim()
  if (!t) return ''
  const chave = t.toUpperCase().replace(/[\s-]+/g, '_')
  if (ROTULOS[chave]) return ROTULOS[chave]
  if (SIGLAS.has(chave)) return chave
  if (!/^[A-Z0-9_]+$/.test(t)) return t
  return t.split('_').map((palavra, i) => {
    if (SIGLAS.has(palavra)) return palavra
    const min = palavra.toLowerCase()
    return i === 0 ? min.charAt(0).toUpperCase() + min.slice(1) : min
  }).join(' ')
}
const g = (k: string) => (v.value ? v.value[k] : null)
const has = (k: string) => {
  const x = g(k)
  return x !== undefined && x !== null && x !== ''
}
// Em medida, zero e ausencia de dado e nao valor: a homologacao devolve
// `cilindrada: 0` num Peugeot e `capacidadeMaximaDeCarga: 0` em carro de
// passeio. "0 cm³" na ficha so faz o cliente duvidar do resto.
const medida = (k: string) => {
  const n = Number(g(k))
  return Number.isFinite(n) && n > 0
}

// ---------- indicadores ----------
// Cada um vira um cartao verde/vermelho. `on: true` = atencao.
// `risco` diz se o valor `true` e um problema. Nem todo indicador ligado e
// ruim: SINIAV ligado significa que o veiculo TEM emplacamento eletronico
// registrado, o que e normal. Sem essa distincao o relatorio dizia
// "Atenção: SINIAV" como se fosse defeito.
const INDICADORES: { k: string; label: string; sim: string; nao: string; risco: boolean }[] = [
  { k: 'indicadorRouboFurto', label: 'Roubo / furto', sim: 'CONSTA', nao: 'NADA CONSTA', risco: true },
  { k: 'indicadorLeilao', label: 'Leilão', sim: 'CONSTA', nao: 'NADA CONSTA', risco: true },
  { k: 'indicadorRestricaoRenajud', label: 'RENAJUD', sim: 'CONSTA', nao: 'NADA CONSTA', risco: true },
  { k: 'indicadorRestricaoRfb', label: 'Restrição RFB', sim: 'CONSTA', nao: 'NADA CONSTA', risco: true },
  { k: 'indicadorMultaRenainf', label: 'Multa RENAINF', sim: 'CONSTA', nao: 'NADA CONSTA', risco: true },
  { k: 'indicadorRecall', label: 'Recall', sim: 'PENDENTE', nao: 'EM DIA', risco: true },
  { k: 'indicadorPendenciaEmissao', label: 'Pendência de emissão', sim: 'CONSTA', nao: 'NÃO', risco: true },
  { k: 'indicadorAlarme', label: 'Alarme', sim: 'CONSTA', nao: 'NÃO', risco: true },
  // informativos: `true` nao e problema, so estado do cadastro
  { k: 'indicadorComunicacaoVenda', label: 'Comunicação de venda', sim: 'SIM', nao: 'NÃO', risco: false },
  { k: 'indicadorSiniav', label: 'SINIAV', sim: 'SIM', nao: 'NÃO', risco: false },
]

const indicadores = computed(() =>
  INDICADORES.filter((i) => has(i.k)).map((i) => {
    const ligado = g(i.k) === true
    return { ...i, ligado, alerta: ligado && i.risco }
  }),
)

const restricoes = computed<string[]>(() => {
  const arr = v.value?.restricoesItens
  return Array.isArray(arr) ? arr.map(humanizar).filter(Boolean) : []
})

// ---------- veredito ----------
// O resumo que a pessoa procura antes de ler o resto: o que pesa contra, em
// uma frase. Sai dos proprios indicadores, sem inventar gravidade.
const alertas = computed(() => indicadores.value.filter((i) => i.alerta).map((i) => i.label))

const veredito = computed(() => {
  if (!entregue.value) return null
  // So a completa verifica risco. Dizer "nada consta" numa basica seria
  // afirmar que checamos coisas que nem foram consultadas.
  if (isBasica.value) return null
  if (!indicadores.value.length) return null
  if (!alertas.value.length) {
    return {
      tom: 'ok' as const,
      titulo: 'Nada consta contra este veículo.',
      texto: 'Nenhum dos indicadores verificados aponta restrição, roubo, furto, leilão ou pendência.',
    }
  }
  // Os rotulos sao siglas e nomes proprios (RENAJUD, RFB): baixar tudo pra
  // minuscula deixava "Atenção: renajud." Mantem a caixa e monta a frase.
  const nomes = alertas.value
  const lista = nomes.length === 1
    ? nomes[0]
    : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
  return {
    tom: 'alerta' as const,
    titulo: `Atenção: consta ${lista}.`,
    texto: 'Veja os detalhes abaixo antes de fechar negócio. O que consta aqui pode travar a transferência.',
  }
})

// ---------- retomada de um Pix vencido ----------
// O provedor nao cobra por QR gerado, entao vencer nao precisa custar o pedido
// inteiro: placa, plano e e-mail ja estao confirmados e so falta o codigo.
const showConsultas = ref(false)
const renovando = ref(false)
const erroRenovar = ref('')

// Renova sozinho ao abrir: quem clica num pedido pendente no historico quer
// pagar, nao ler um aviso. Uma tentativa por carregamento (`jaTentou`), senao
// uma falha viraria laco de chamadas ao provedor.
const jaTentou = ref(false)
onMounted(async () => {
  await nextTick()
  const d: any = data.value
  if (!d || jaTentou.value) return
  if (d.status === 'aguardando_pagamento' && (d.expirado || !d.brCode)) {
    jaTentou.value = true
    await renovarPix()
  }
})

async function renovarPix() {
  renovando.value = true
  erroRenovar.value = ''
  try {
    await $fetch('/api/premium/renovar-pix', { method: 'POST', body: { token } })
    // Recarrega em vez de montar a tela na mao: com br_code novo e prazo em dia,
    // o proprio ramo de pagamento pendente assume.
    await refresh()
  } catch (e: any) {
    erroRenovar.value = e?.data?.message === 'O pagamento atual ainda esta valido.'
      ? 'O código anterior voltou a valer. Atualize a página.'
      : 'Não conseguimos gerar o código agora. Tente de novo em instantes.'
  } finally {
    renovando.value = false
  }
}

// ---------- valor e custo ----------
const vc = computed(() => data.value?.valorCusto ?? null)
const temValor = computed(() => Boolean(vc.value?.fipe || vc.value?.seguroAnual || vc.value?.custo5anos))
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

// Escala pela FAIXA da serie, nao pelo zero: variacao de 8% num grafico
// ancorado no zero vira oito barras iguais e nao mostra nada. O menor ponto
// fica em 20% pra barra continuar existindo, e o maior em 100%.
function alturaBarra(price: number): string {
  const pts = vc.value?.historico || []
  if (pts.length < 2) return '100%'
  const vals = pts.map((p: any) => p.price)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  if (max === min) return '100%'
  return `${Math.round(20 + ((price - min) / (max - min)) * 80)}%`
}

// ---------- ficha ----------
const linha = (rot: string, val: any) => (val === null || val === undefined || val === '' ? null : [rot, String(val)])

// `ultimoLicenciamento` vem como objeto e ate agora era pago e descartado.
// Diz ao comprador se o veiculo esta em dia com o licenciamento do ano, que e
// exatamente o tipo de coisa que trava a transferencia.
const licAno = computed(() => {
  const l = g('ultimoLicenciamento') as any
  return l && typeof l === 'object' && l.anoLicenciamento ? String(l.anoLicenciamento) : null
})
const licEmissao = computed(() => {
  const l = g('ultimoLicenciamento') as any
  const d = l && typeof l === 'object' ? l.dataHoraEmissao : null
  if (!d) return null
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? null : dt.toLocaleDateString('pt-BR')
})

const fichaCadastral = computed(() => [
  linha('Placa', data.value?.placa),
  linha('Renavam', g('renavam')),
  linha('Chassi', g('chassi')),
  linha('Marca / modelo', g('descricaoMarcaModelo')),
  linha('Ano fab. / modelo', has('anoFabricacao') ? `${g('anoFabricacao')} / ${g('anoModelo')}` : null),
  linha('Cor', humanizar(g('descricaoCor'))),
  linha('Espécie', humanizar(g('descricaoEspecie'))),
  linha('Tipo do veículo', humanizar(g('descricaoTipoVeiculo'))),
  linha('Categoria', humanizar(g('descricaoCategoria'))),
  linha('Situação', humanizar(g('situacao'))),
  linha('UF da jurisdição', g('ufJurisdicao')),
  linha('Município', humanizar(g('municipio'))),
  linha('Último licenciamento', licAno.value),
  linha('Emissão do documento', licEmissao.value),
].filter(Boolean) as [string, string][])

// Unidades explicitas: "97" e "1400" sozinhos nao dizem nada.
const fichaTecnica = computed(() => [
  linha('Potência', medida('potencia') ? `${g('potencia')} cv` : null),
  linha('Cilindrada', medida('cilindrada') ? `${g('cilindrada')} cm³` : null),
  linha('Número de eixos', medida('quantidadeDeEixos') ? g('quantidadeDeEixos') : null),
  linha('Lotação', medida('lotacao') ? `${g('lotacao')} lugares` : null),
  linha('Peso bruto total', medida('pesoBruto') ? `${g('pesoBruto')} t` : null),
  linha('Cap. máx. de carga', medida('capacidadeMaximaDeCarga') ? `${g('capacidadeMaximaDeCarga')} t` : null),
  linha('Cap. máx. de tração', medida('capacidadeMaximaDeTracao') ? `${g('capacidadeMaximaDeTracao')} t` : null),
].filter(Boolean) as [string, string][])

// ---------- retomada do Pix ----------
const valorPedido = computed(() => data.value?.valorCentavos ?? PLANOS[plano.value as 'basica' | 'completa']?.valorCentavos ?? 0)
const copiado = ref(false)

// QR da retomada: buscado sob demanda, so quando a tela de pagamento pendente
// aparece. Nao vem no /report porque envolve uma chamada ao provedor de
// pagamento, e quem ja pagou nao tem por que esperar por ela.
const qr = ref<string | null>(null)
async function buscarQr() {
  try {
    const r: any = await $fetch('/api/premium/pix-qr', { query: { token } })
    qr.value = r?.brCodeBase64 || null
  } catch { qr.value = null }
}

function copiar() {
  if (!data.value?.brCode) return
  navigator.clipboard?.writeText(data.value.brCode)
  copiado.value = true
  setTimeout(() => { copiado.value = false }, 2200)
}

function imprimir() {
  if (import.meta.client) window.print()
}

// Precisa ser ref preenchida no onMounted, nao computed: no SSR nao existe
// `window`, e o computed ficava cacheado em '#'. O botao entao abria a propria
// pagina numa aba nova em vez do WhatsApp.
const compartilhar = ref('#')

// ---------- historico local + polling ----------
let poll: any = null
onMounted(() => {
  histSync()
  const msg = `Fiz a consulta veicular no PlacaCompleta, olha o relatório: ${window.location.href}`
  compartilhar.value = `https://wa.me/?text=${encodeURIComponent(msg)}`
  if (data.value?.status === 'aguardando_pagamento' && data.value?.brCode) buscarQr()
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
</script>

<template>
  <div class="rel">
    <!-- Mesmo cabecalho do site: o rodape ja vem do app.vue em toda pagina, e
         o relatorio nao tinha motivo pra ser a unica tela sem cabecalho. -->
    <div class="rel__navband">
      <!-- Sem :mostrar-busca: quem decide se o campo de placa existe e o
           proprio header, pela rota. A pagina nao precisa saber disso. -->
      <HomeHeader
        logo-variant="default"
        :consultas="itens.length"
        @abrir-consultas="showConsultas = true"
      />
    </div>

    <!-- Historico tambem aqui: quem chega pelo link do e-mail cai direto nesta
         pagina, e sem isto nao teria como voltar aos outros relatorios sem
         passar pela home. -->
    <ConsultasHistory :aberto="showConsultas" @fechar="showConsultas = false" />

    <div class="rel__wrap">
      <span class="rel__tipo-fora">{{ isBasica ? PLANOS.basica.nome : PLANOS.completa.nome }}</span>

      <div v-if="pending" class="rel__card rel__card--centro">
        <p class="rel__hint">Carregando…</p>
      </div>

      <div v-else-if="error || !data" class="rel__card rel__card--centro">
        <h1 class="rel__h">Relatório não encontrado</h1>
        <p class="rel__hint">O link pode ter expirado ou está incompleto.</p>
        <NuxtLink to="/" class="rel__btn rel__btn--primario">Fazer uma consulta</NuxtLink>
      </div>

      <template v-else>
        <!-- ============ 1. RETOMADA DO PIX ============ -->
        <!-- A pessoa iniciou o pagamento e voltou depois. Cai direto no Pix,
             sem passar por confirmacao de veiculo nem por formulario: ela ja
             fez tudo isso antes. -->
        <div v-if="data.status === 'aguardando_pagamento' && data.brCode" class="rel__card rel__card--centro">
          <span class="rel__kick">Pagamento pendente</span>
          <h1 class="rel__h">Conclua para liberar o relatório</h1>

          <div class="rel__resumo">
            <span class="rel__resumo-linha">
              <span>Relatório</span><strong>{{ isBasica ? PLANOS.basica.nome : PLANOS.completa.nome }}</strong>
            </span>
            <span class="rel__resumo-linha rel__resumo-linha--total">
              <span>Total</span><strong>{{ precoBRL(valorPedido) }}</strong>
            </span>
          </div>

          <div class="rel__placa-box">
            <span>Consultando a placa</span>
            <strong>{{ data.placa }}</strong>
          </div>

          <img v-if="qr" :src="qr" alt="QR Code do Pix" class="rel__qr">

          <button type="button" class="rel__btn rel__btn--primario" @click="copiar">
            {{ copiado ? 'Código copiado ✓' : 'Copiar código Pix (copia e cola)' }}
          </button>
          <p class="rel__brcode">{{ data.brCode }}</p>
          <p class="rel__hint">O relatório libera sozinho em até 5 minutos depois do pagamento.</p>
        </div>

        <!-- ============ 2. ESTADOS DE TRANSICAO E FALHA ============ -->
        <div v-else-if="!entregue" class="rel__card rel__card--centro">
          <template v-if="['pago', 'consultando'].includes(data.status)">
            <h1 class="rel__h">Pagamento confirmado ✓</h1>
            <div class="rel__barra"><div class="rel__barra-fill" /></div>
            <p class="rel__hint">Estamos montando seu relatório. Isso leva alguns instantes.</p>
          </template>
          <template v-else-if="data.expirado || data.status === 'expirado'">
            <h1 class="rel__h">Este Pix expirou</h1>
            <p class="rel__hint">
              Nada foi cobrado. Seus dados continuam salvos, é só gerar um novo código
              para a placa {{ data.placa }}.
            </p>
            <button type="button" class="rel__btn rel__btn--primario" :disabled="renovando" @click="renovarPix">
              {{ renovando ? 'Gerando…' : 'Gerar novo Pix' }}
            </button>
            <!-- O botao continua existindo: e o caminho quando a renovacao
                 automatica falha, e o que a pessoa ve enquanto ela acontece. -->
            <p v-if="erroRenovar" class="rel__hint rel__hint--erro">{{ erroRenovar }}</p>
          </template>
          <template v-else-if="data.status === 'reembolsado'">
            <h1 class="rel__h">Não foi possível concluir</h1>
            <p class="rel__hint">O valor foi estornado no seu Pix.</p>
            <NuxtLink to="/" class="rel__btn">Voltar ao início</NuxtLink>
          </template>
          <template v-else>
            <h1 class="rel__h">Aguardando confirmação</h1>
            <p class="rel__hint">Se você já pagou, o relatório libera sozinho. Pode deixar esta aba aberta.</p>
          </template>
        </div>

        <!-- ============ 3. O RELATORIO ============ -->
        <template v-else>
          <div class="rel__acoes">
            <button type="button" class="rel__btn rel__btn--mini" @click="imprimir">Imprimir</button>
            <a :href="compartilhar" target="_blank" rel="noopener" class="rel__btn rel__btn--mini">
              Compartilhar
            </a>
          </div>

          <!-- resumo + veredito -->
          <section class="rel__card">
            <div class="rel__veh">
              <span class="rel__veh-txt">
                <strong>{{ g('descricaoMarcaModelo') || 'Veículo consultado' }}</strong>
                <span>
                  {{ [has('anoFabricacao') ? `${g('anoFabricacao')}/${g('anoModelo')}` : null,
                      humanizar(g('descricaoCor')), humanizar(g('descricaoTipoVeiculo')),
                      g('municipio') && g('ufJurisdicao') ? `${humanizar(g('municipio'))}/${g('ufJurisdicao')}` : g('ufJurisdicao')]
                      .filter(Boolean).join(' · ') }}
                </span>
              </span>
              <PlacaMercosul :placa="data.placa" mini class="rel__placa-tag" />
            </div>

            <div v-if="veredito" class="rel__veredito" :class="`rel__veredito--${veredito.tom}`">
              <svg v-if="veredito.tom === 'alerta'" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 2.5 18.5 17.5H1.5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
                <path d="M10 8v3.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                <circle cx="10" cy="14.6" r="1" fill="currentColor" />
              </svg>
              <svg v-else viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="1.6" />
                <path d="M6 10.2l2.6 2.6L14 7.4" fill="none" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>
                <strong>{{ veredito.titulo }}</strong>
                {{ veredito.texto }}
              </span>
            </div>
          </section>

          <!-- indicadores (so na completa; a basica nem recebe os campos) -->
          <section v-if="indicadores.length" class="rel__card">
            <h2 class="rel__h2">Indicadores</h2>
            <div class="rel__inds">
              <div
                v-for="i in indicadores"
                :key="i.k"
                class="rel__ind"
                :class="i.alerta ? 'rel__ind--bad' : 'rel__ind--ok'"
              >
                <span class="rel__ind-lab">{{ i.label }}</span>
                <span class="rel__ind-val">{{ i.ligado ? i.sim : i.nao }}</span>
              </div>
            </div>
          </section>

          <!-- restricoes detalhadas -->
          <section v-if="restricoes.length" class="rel__card">
            <h2 class="rel__h2">Restrições detalhadas</h2>
            <div v-for="(r, idx) in restricoes" :key="idx" class="rel__restr">
              <span class="rel__tag">Restrição</span>
              <span>{{ r }}</span>
            </div>
          </section>

          <!-- valor e custo: saiu da consulta gratis e agora e o que a basica
               entrega de imediato, antes da ficha tecnica -->
          <section v-if="temValor" class="rel__card">
            <h2 class="rel__h2">Valor e custo de manter</h2>
            <div class="rel__valores">
              <div v-if="vc?.fipe" class="rel__valor">
                <span class="rel__valor-k">Valor FIPE</span>
                <span class="rel__valor-v">{{ vc.fipe }}</span>
                <span v-if="vc.fipeModelo" class="rel__valor-nota">{{ vc.fipeModelo }}</span>
              </div>
              <div v-if="vc?.seguroAnual" class="rel__valor">
                <span class="rel__valor-k">Seguro estimado</span>
                <span class="rel__valor-v">{{ brl(vc.seguroAnual) }} / ano</span>
                <span v-if="vc.percentualFipe" class="rel__valor-nota">{{ vc.percentualFipe }}% do valor do carro</span>
              </div>
              <div v-if="vc?.custo5anos" class="rel__valor">
                <span class="rel__valor-k">Custo em 5 anos</span>
                <span class="rel__valor-v">{{ brl(vc.custo5anos) }}</span>
                <span class="rel__valor-nota">Seguro, IPVA, manutenção e depreciação</span>
              </div>
            </div>

            <!-- depreciacao: a barra e proporcional ao maior valor da serie,
                 entao a queda aparece sem precisar de eixo nem biblioteca -->
            <div v-if="vc?.historico?.length" class="rel__dep">
              <span class="rel__sub">Como o valor andou</span>
              <div class="rel__dep-barras">
                <div v-for="pt in vc.historico" :key="pt.label" class="rel__dep-col">
                  <div class="rel__dep-barra" :style="{ height: alturaBarra(pt.price) }" />
                  <span class="rel__dep-lab">{{ pt.label }}</span>
                </div>
              </div>
              <!-- As barras sao escaladas pela faixa da serie, nao pelo zero:
                   sem isso, oito barras iguais. Em troca, a legenda diz os
                   valores das pontas, senao a variacao parece maior do que e. -->
              <p v-if="vc.quedaAno !== null" class="rel__dep-txt">
                De {{ brl(vc.historico[0].price) }} em {{ vc.historico[0].label }}
                para {{ brl(vc.historico[vc.historico.length - 1].price) }} em
                {{ vc.historico[vc.historico.length - 1].label }}:
                <strong>{{ vc.quedaAno < 0 ? 'queda' : 'alta' }} de {{ Math.abs(vc.quedaAno).toLocaleString('pt-BR') }}%</strong>.
              </p>
            </div>
          </section>

          <!-- ficha -->
          <section class="rel__card">
            <h2 class="rel__h2">Ficha cadastral e técnica</h2>
            <div class="rel__ficha">
              <div v-if="fichaCadastral.length">
                <span class="rel__sub">Cadastral</span>
                <table class="rel__tab">
                  <tbody>
                    <tr v-for="([k, val]) in fichaCadastral" :key="k"><td>{{ k }}</td><td>{{ val }}</td></tr>
                  </tbody>
                </table>
              </div>
              <div v-if="fichaTecnica.length">
                <span class="rel__sub">Técnica</span>
                <table class="rel__tab">
                  <tbody>
                    <tr v-for="([k, val]) in fichaTecnica" :key="k"><td>{{ k }}</td><td>{{ val }}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <!-- upsell da basica -->
          <section v-if="isBasica" class="rel__card rel__card--up">
            <h2 class="rel__h2">Faltam os dados de risco</h2>
            <p class="rel__hint">
              A consulta básica mostra o que o veículo é. O relatório completo mostra se dá
              pra confiar nele:
              <template v-if="restantes">são <strong>{{ restantes }}</strong> informações a mais, com</template>
              <template v-else>traz</template>
              restrições nacionais e estaduais, roubo e furto, passagem por leilão, gravame,
              RENAJUD, indicador de multas e chassi e Renavam completos.
            </p>
            <NuxtLink class="rel__btn rel__btn--primario" :to="`/?placa=${data.placa}&plano=completa`">
              Relatório completo · {{ precoBRL(PLANOS.completa.valorCentavos) }}
            </NuxtLink>
          </section>

          <p class="rel__rodape">
            Relatório gerado pelo PlacaCompleta · placa {{ data.placa }}
          </p>
        </template>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Mesma paleta e mesmas medidas da home v2 (guia HP).
$c-canvas: #ffffff;
$c-cloud: #f7f7f7;
$c-hair: #e8e8e8;
$c-ink: #1a1a1a;
$c-charcoal: #3d3d3d;
$c-graphite: #636363;
$c-blue: #1f6feb;
$c-blue-deep: #17539f;
$c-green: #1e9e4a;
$c-red: #d33a3a;
$c-slab: #0B1F3A;
$fonte: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

.rel {
  min-height: 100vh;
  background: $c-cloud;
  font-family: $fonte;
  color: $c-ink;
  line-height: 1.4;
  padding: 24px 16px 64px;

  &__wrap { max-width: 860px; margin: 0 auto; }

  &__navband {
    background: $c-canvas;
    border-bottom: 1px solid $c-hair;
    margin: -24px -16px 24px;
    padding: 0 16px;
  }

  :deep(.home-header) {
    max-width: 860px;
    margin: 0 auto;
    min-height: 72px;
    padding: 8px 0;
    background: transparent;
    border-radius: 0;
    box-shadow: none;
    border-bottom: 0;
  }
  :deep(.home-header__logo),
  :deep(.home-header__logo .placa-logo) { height: 48px; width: auto; flex-shrink: 0; }
  :deep(.home-header__link) {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 12px;
    color: $c-ink;
    font-size: 15px;
    text-decoration: none;
    &:hover { color: $c-blue; }
  }

  &__tipo-fora {
    display: block;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $c-graphite;
    margin-bottom: 12px;
  }

  &__tipo {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $c-graphite;
  }

  &__acoes { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 16px; }

  &__card {
    background: $c-canvas;
    border: 1px solid $c-hair;
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 16px;

    &--centro {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      text-align: center;
      padding: 32px 20px;
    }

    &--up { border-color: $c-blue; }
  }

  &__kick {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $c-graphite;
  }

  &__h {
    font-size: clamp(22px, 3vw, 28px);
    font-weight: 500;
    letter-spacing: 0;
    line-height: 1.1;
    margin: 0;
  }

  &__h2 {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $c-graphite;
    margin: 0 0 12px;
  }

  &__hint {
    font-size: 15px; line-height: 1.45; color: $c-charcoal; margin: 0;
    strong { color: $c-ink; }
    &--erro { color: $c-red; margin-top: 12px; }
  }

  // ---- veiculo + veredito ----
  &__veh {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 16px;
    border-bottom: 1px solid $c-hair;
  }

  &__veh-txt {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;

    strong { font-size: 18px; font-weight: 500; }
    span { font-size: 13.5px; color: $c-graphite; }
  }

  // A mesma placa simulada do hero, em miniatura: o cliente reconhece o objeto
  // que digitou. Largura fixa porque o dimensionamento interno e por container
  // query, entao a proporcao se resolve sozinha a partir dela.
  &__placa-tag {
    width: 132px;
    flex-shrink: 0;
  }

  // Valor e custo: tres numeros grandes lado a lado, mesma logica dos cartoes
  // de indicador, sem cor de destaque (o guia reserva o acento pra acao).
  &__valores {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  &__valor {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 14px;
    border: 1px solid $c-hair;
    border-radius: 4px;
  }

  &__valor-k {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $c-graphite;
  }

  &__valor-v {
    font-size: 22px;
    font-weight: 500;
    line-height: 1;
    color: $c-ink;
  }

  &__valor-nota {
    font-size: 12px;
    color: $c-graphite;
  }

  &__dep {
    margin-top: 20px;
  }

  &__dep-barras {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    height: 88px;
    margin-top: 10px;
  }

  &__dep-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
    gap: 6px;
  }

  &__dep-barra {
    width: 100%;
    background: $c-slab;
    border-radius: 2px 2px 0 0;
  }

  &__dep-lab {
    font-size: 10px;
    color: $c-graphite;
    white-space: nowrap;
  }

  &__dep-txt {
    margin-top: 10px;
    font-size: 13px;
    color: $c-charcoal;
  }

  &__veredito {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin-top: 16px;
    padding: 12px 14px;
    border-radius: 8px;
    border: 1px solid;
    font-size: 14px;
    line-height: 1.4;

    svg { width: 20px; height: 20px; flex-shrink: 0; margin-top: 1px; }
    strong { display: block; font-weight: 700; }

    &--alerta { background: #fdf5e6; border-color: #e6c07a; color: #9a6400; strong { color: #7a4d00; } }
    &--ok { background: #edf7f1; border-color: #c3e4d1; color: #1b6b3a; strong { color: #14522c; } }
  }

  // ---- indicadores ----
  &__inds {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 8px;
  }

  &__ind {
    border: 1px solid $c-hair;
    border-radius: 8px;
    padding: 10px;
    text-align: center;
    background: $c-cloud;
  }

  &__ind-lab { display: block; font-size: 11.5px; color: $c-graphite; margin-bottom: 3px; }
  &__ind-val { display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.03em; }
  &__ind--ok { background: #edf7f1; border-color: #c3e4d1; .rel__ind-val { color: $c-green; } }
  &__ind--bad { background: #fdeeec; border-color: #f2c3bd; .rel__ind-val { color: $c-red; } }

  // ---- restricoes ----
  &__restr {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 0;
    border-bottom: 1px solid $c-hair;
    font-size: 14px;
    line-height: 1.4;
    color: $c-charcoal;

    &:last-child { border-bottom: 0; }
  }

  &__tag {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: #fdeeec;
    color: $c-red;
    border-radius: 4px;
    padding: 3px 7px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  // ---- ficha ----
  &__ficha {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 28px;
    align-items: start;

    @media (max-width: 640px) { grid-template-columns: 1fr; }
  }

  &__sub {
    display: block;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $c-blue;
    border-bottom: 1px solid $c-blue;
    padding-bottom: 6px;
    margin-bottom: 4px;
  }

  &__tab {
    width: 100%;
    border-collapse: collapse;

    td { padding: 8px 0; border-bottom: 1px solid $c-hair; font-size: 13.5px; }
    td:first-child { color: $c-graphite; width: 48%; }
    td:last-child { font-weight: 500; text-align: right; word-break: break-word; }
    tr:last-child td { border-bottom: 0; }
  }

  // ---- retomada do Pix ----
  &__resumo {
    width: 100%;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    border: 1px solid $c-hair;
    border-radius: 8px;
    overflow: hidden;
  }

  &__resumo-linha {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid $c-hair;
    font-size: 14px;
    color: $c-graphite;

    &:last-child { border-bottom: 0; }
    strong { font-size: 15px; font-weight: 500; color: $c-ink; }

    &--total { background: $c-cloud; strong { font-size: 20px; } }
  }

  &__placa-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 20px;
    border: 2px solid $c-ink;
    border-radius: 8px;

    span { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: $c-graphite; }
    strong { font-size: 28px; font-weight: 800; letter-spacing: 0.12em; }
  }

  &__qr {
    width: 200px;
    height: 200px;
    border: 1px solid $c-hair;
    border-radius: 8px;
    background: #fff;
  }

  &__brcode {
    width: 100%;
    max-width: 420px;
    font-size: 11px;
    line-height: 1.4;
    color: $c-graphite;
    word-break: break-all;
    background: $c-cloud;
    border: 1px solid $c-hair;
    border-radius: 8px;
    padding: 10px;
    margin: 0;
    text-align: left;
  }

  &__barra { width: 100%; max-width: 320px; height: 4px; border-radius: 999px; background: $c-hair; overflow: hidden; }
  &__barra-fill {
    height: 100%;
    width: 40%;
    border-radius: 999px;
    background: $c-blue;
    animation: rel-desliza 1.1s ease-in-out infinite;
  }
  @keyframes rel-desliza {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(350%); }
  }

  // ---- botoes ----
  &__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 12px 24px;
    font-family: $fonte;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    color: $c-ink;
    background: $c-canvas;
    border: 1px solid $c-ink;
    border-radius: 4px;
    text-decoration: none;
    cursor: pointer;

    &:hover { background: $c-cloud; }
    &:focus-visible { outline: 2px solid $c-blue; outline-offset: 2px; }

    &--primario {
      background: $c-blue;
      border-color: $c-blue;
      color: #fff;
      &:hover { background: $c-blue-deep; border-color: $c-blue-deep; }
    }

    &--mini { min-height: 40px; padding: 8px 16px; font-size: 13px; }
  }

  &__rodape { font-size: 12px; color: $c-graphite; text-align: center; margin: 20px 0 0; }
}

// Impressao: o relatorio e um documento, entao tem que sair limpo no papel.
@media print {
  .rel { background: #fff; padding: 0; }
  .rel__acoes, .rel__navband { display: none !important; }
  .rel__card { border-color: #ccc; box-shadow: none; break-inside: avoid; }
}
</style>
