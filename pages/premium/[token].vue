<script setup lang="ts">
import { cardRecallAssociado } from '~/shared/recall-associado'
import { BASE_LEILAO_TEXTO } from '~/shared/base-leilao'
import { textoDetranProtegido } from '~/shared/detran-protegido'
import { faixaLicenciamento } from '~/shared/licenciamento-faixa'
import { textoHodometro } from '~/shared/hodometro-texto'
import { efeitoRestricao, textoEfeito } from '~/shared/restricao-efeito'
import { dadosDe } from '~/shared/dados-de'
import { resumoQuitar, procedenciaDebitos, procedenciaKm, ufDoBlocoDetran, statusBaseNacional } from '~/shared/detran-quitar'
import { ufRenainfForaDoDetran, textoMultasRenainfForaDoDetran, EXPLICA_RENAINF_FORA_DO_DETRAN, esconderMultasQueFalharam } from '~/shared/renainf-detran'
import { inicioTardioDoHistorico } from '~/shared/historico-fipe'
import { metaCupomRecompra, linkWhatsappRecompra } from '~/shared/cupom-recompra-texto'
import { codigoFipeDoRelatorio } from '~/shared/codigo-fipe'
import { codigoDaTabela, tabelaDoSegmento } from '~/shared/tabela-fipe'
import { versoesParaExibir } from '~/shared/versao-fipe'
import { fipeEIncerta } from '~/shared/fipe-incerta'
import { opcoesDeCambio } from '~/shared/cambio-nome'
import { linhaRecallGrade } from '~/shared/recall-grade'
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
import { ROTULO_RESTRICAO, explicaRestricao, filtrarItensRestricao, ehEstoqueRenave, RENAVE_EXPLICACAO, ehRenajud, RENAJUD_EXPLICACAO, PARECER_SO_RENAVE, itemInformativo, itensQueRestringem } from '~/shared/restricoes'
import { LEILAO_FORA_DO_DOCUMENTO, leilaoSemOcorrencia } from '~/shared/leilao-copy'
import { detalhesLegiveis, semValorEmReais, fonteExibicaoLeilao, comitenteExibicao, fraseComitente, paginaPublicaLeilao, AVISO_PAGINA_PUBLICA } from '~/shared/leilao-exibicao'
import { ehNotificacao, tituloNotificacao, camposNotificacao, contarPassagens, GRAVIDADE_NOTIFICADO, EXPLICA_NOTIFICACAO } from '~/shared/leilao-notificacao'
import { montarChecklist } from '~/shared/checklist-compra'
import { custo12Meses, combustivelPraConta, licenciamentoDaUf, KM_ANO_PADRAO } from '~/shared/custo-12-meses'
import { PRECO_COMBUSTIVEL_UF, SEMANA_ANP } from '~/shared/dados/combustivel-uf'
import { aliquotaIPVA } from '~/shared/ipva-uf'
import { variacaoFipe, fipeNoMes, mesDoRotulo } from '~/shared/fipe-variacao'
import { componenteEua, type RecallEuaTela } from '~/shared/recall-eua'
import { agruparEpisodios, tudoEncerrado, plural, type EtapaEpisodio } from '~/shared/episodios-roubo'
import { montarLinhaDoTempo } from '~/shared/linha-do-tempo'
import { textoAlerta, textoJudicial, textoIntervalo, dataBR as dataBRIso } from '~/shared/leilao-relatorio2'
import { rouboFurtoPeloDetran } from '~/shared/roubo-detran'

const route = useRoute()
const token = route.params.token as string
useHead({ title: 'Relatório Veicular', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const { data, pending, error, refresh } = await useFetch<any>('/api/premium/report', { query: { token } })

const { itens, sync: histSync, add: histAdd, updateStatus: histUpdate } = useConsultaHistory()
const { trackConversionPaga, track } = useAnalytics()

// ---------- cupom de recompra (card do fim) ----------
// O cupom nasce ~6 s depois da entrega. Se a pagina abriu antes, busca leve a
// cada 5 s por ate 1 min (endpoint so do cupom, sem recarregar o relatorio).
const cupomBuscado = ref<{ codigo: string; validoAte: string } | null>(null)
const cupomCard = computed(() => data.value?.cupomRecompra || cupomBuscado.value || null)
const cupomCopiado = ref(false)
const codigoCupomEl = ref<HTMLElement | null>(null)
let pollCupom: ReturnType<typeof setInterval> | null = null
function pararPollCupom() { if (pollCupom) { clearInterval(pollCupom); pollCupom = null } }
onMounted(() => {
  watch(() => data.value?.status === 'entregue' && !cupomCard.value, (esperar) => {
    if (!esperar) { pararPollCupom(); return }
    if (pollCupom) return
    let voltas = 0
    pollCupom = setInterval(async () => {
      voltas++
      try {
        const r: any = await $fetch('/api/premium/cupom-recompra', { query: { token } })
        if (r?.cupomRecompra?.codigo) { cupomBuscado.value = r.cupomRecompra; pararPollCupom(); return }
      } catch { /* rede oscilou: a proxima volta tenta */ }
      if (voltas >= 12) pararPollCupom()
    }, 5000)
  }, { immediate: true })
})
onBeforeUnmount(pararPollCupom)
function selecionarCodigoCupom() {
  const el = codigoCupomEl.value
  if (!el || typeof window === 'undefined') return
  const r = document.createRange(); r.selectNodeContents(el)
  const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r)
}
async function copiarCupom() {
  try { track('cupom_recompra_copiar', { origem: 'cupom_recompra' }) } catch { /* telemetria e best-effort */ }
  const codigo = cupomCard.value?.codigo
  if (!codigo) return
  try {
    await navigator.clipboard.writeText(codigo)
    cupomCopiado.value = true
    setTimeout(() => { cupomCopiado.value = false }, 1500)
  } catch {
    selecionarCodigoCupom()
  }
}
function cliqueWhatsappCupom() {
  try { track('cupom_recompra_whatsapp', { origem: 'cupom_recompra', method: 'whatsapp' }) } catch { /* best-effort */ }
}

const plano = computed<string>(() => data.value?.plano || 'completa')
const isBasica = computed(() => plano.value === 'basica')
// Pedido de cartao (Stripe): a tela NUNCA mostra QR de Pix nem tenta renovar Pix.
// Reconhece pela forma_pagamento do pedido ou pelo ?cartao=1 do success_url do
// Stripe (cobre o instante em que o report ainda nao trouxe a forma).
const ehCartao = computed(() => data.value?.formaPagamento === 'cartao' || String(route.query.cartao || '') === '1')
const restantes = computed<number>(() => data.value?.camposRestantes || 0)
const entregue = computed(() => data.value?.status === 'entregue')

// Entrega por e-mail a partir da propria pagina do relatorio. O servidor manda
// so o FLAG temEmail, nunca o e-mail: quem tem o link nao precisa descobrir o
// contato de quem comprou.
const emailEntrega = ref('')
const enviandoEmail = ref(false)
const erroEmail = ref('')
const emailEnviadoPara = ref('')
const mostrarFaixaEmail = computed(() => !!data.value && data.value.temEmail === false && !!entregue.value)

function mascararEmail(e: string): string {
  const [antes, dominio] = e.split('@')
  if (!dominio) return e
  const visivel = antes.slice(0, 3)
  return `${visivel}${antes.length > 3 ? '***' : ''}@${dominio}`
}

async function enviarPorEmail() {
  const valor = emailEntrega.value.trim().toLowerCase()
  erroEmail.value = ''
  if (!valor.includes('@')) {
    erroEmail.value = 'Informe um e-mail válido.'
    return
  }
  enviandoEmail.value = true
  try {
    await $fetch('/api/premium/email', { method: 'POST', body: { token, email: valor } })
    // Mostra mascarado: a tela pode estar aberta na frente de outra pessoa, e
    // o e-mail de quem comprou nao precisa ficar exposto ali.
    emailEnviadoPara.value = mascararEmail(valor)
  } catch (e: any) {
    erroEmail.value = e?.data?.message === 'Informe um e-mail válido.'
      ? 'Informe um e-mail válido.'
      : 'Não conseguimos enviar agora. O relatório continua nesta página.'
  } finally {
    enviandoEmail.value = false
  }
}

// O servidor ja devolve a resposta achatada (ver normalizarResposta): array de
// um elemento, com os indicadores que vinham aninhados em `restricoes` subidos
// pro topo e as restricoes detalhadas em `restricoesItens`.
// restricoesItens filtrado NA LEITURA: o snapshot entregue guarda a lista ja
// achatada, e um item que nao e restricao ("CNPJ_DA INSTITUICAO_FINANCEIRA",
// rotulo do CNPJ do credor do gravame) aparecia cru e acendia "Outras
// restricoes". Filtrar aqui cobre todos os relatorios ja entregues.
const v = computed(() => {
  const r: any = data.value?.consulta?.response || {}
  return Array.isArray(r.restricoesItens) ? { ...r, restricoesItens: filtrarItensRestricao(r.restricoesItens) } : r
})

// A API manda ENUM em caixa alta, com underscore e SEM acento
// ("EM_CIRCULACAO", "PENDENCIA_DE_EMISSAO_CRV"). Jogar isso na tela e entregar
// o banco cru; so trocar underscore por espaco produz "Em circulacao", que e
// portugues errado na cara do cliente. Os valores conhecidos ganham a grafia
// certa aqui; o resto cai no formatador generico, que ao menos tira o caixa-alta.
const ROTULOS: Record<string, string> = {
  EM_CIRCULACAO: 'Em circulação',
  BAIXADO: 'Baixado',
  ROUBO_FURTO: 'Roubo ou furto',
  // O sufixo _FILE_VEICULOS e ruido do sistema de origem, nao informacao.
  ALIENACAO_FIDUCIARIA_FILE_VEICULOS: 'Alienação fiduciária (veículo financiado)',
  RENAINF: 'Multas em aberto (RENAINF)',
  FURTO: 'Furto',
  ROUBO: 'Roubo',
  DECLARACAO: 'Declaração',
  APROPRIACAO_INDEBITA: 'Apropriação indébita',
  ESTELIONATO: 'Estelionato',
  PENDENCIA_DE_EMISSAO_CRV: 'Pendência de emissão do CRV',
  PENDENCIA_EMISSAO_CRV: 'Pendência de emissão do CRV',
  ALIENACAO_FIDUCIARIA: 'Alienação fiduciária (veículo financiado)',
  ARRENDAMENTO_MERCANTIL: 'Arrendamento mercantil',
  RESERVA_DE_DOMINIO: 'Reserva de domínio',
  PENHOR: 'Penhor',
  BUSCA_E_APREENSAO: 'Busca e apreensão',
  RESTRICAO_JUDICIAL: 'Restrição judicial',
  RESTRICAO_ADMINISTRATIVA: 'Restrição administrativa',
  RESTRICAO_RENAJUD: 'Restrição judicial (RENAJUD)',
  BAIXA: 'Veículo baixado',
  BAIXADO_DEFINITIVO: 'Veículo baixado',
  RECUPERADO_SINISTRO: 'Recuperado de sinistro',
  SINISTRO: 'Sinistro registrado',
  GRAVAME: 'Gravame (financiamento)',
  LEILAO: 'Passagem por leilão',
  RESTRICAO_TRIBUTARIA: 'Restrição tributária',
  RESTRICAO_BENEFICIO_TRIBUTARIO: 'Restrição de benefício tributário',
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
  // "_FILE_VEICULOS" e sufixo do sistema de origem, nunca informacao
  const chave = t.toUpperCase().replace(/[\s-]+/g, '_').replace(/_FILE_VEICULOS$/, '')
  if (ROTULOS[chave]) return ROTULOS[chave]
  if (ROTULO_RESTRICAO[chave]) return ROTULO_RESTRICAO[chave]
  if (SIGLAS.has(chave)) return chave
  if (!/^[A-Z0-9_]+$/.test(t)) return t
  return t.split('_').map((palavra, i) => {
    if (SIGLAS.has(palavra)) return palavra
    const min = palavra.toLowerCase()
    return i === 0 ? min.charAt(0).toUpperCase() + min.slice(1) : min
  }).join(' ')
}
// Ultima palavra do rotulo + icone viajam juntos (white-space: nowrap no
// span): quando o titulo quebra linha, o "i" quebra COM a palavra, nunca
// sozinho no meio do cartao.
function rotuloPartes(label: string): { inicio: string; fim: string } {
  const partes = label.trim().split(' ')
  const fim = partes.pop() || ''
  return { inicio: partes.length ? partes.join(' ') + ' ' : '', fim }
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
// `dica` vira tooltip no cartao: sigla sem explicacao obriga o cliente a sair
// do relatorio pra pesquisar o que ele acabou de comprar.
const INDICADORES: { k: string; label: string; sim: string; nao: string; risco: boolean; dica: string }[] = [
  { k: 'indicadorRouboFurto', label: 'Roubo / furto', sim: 'CONSTA', nao: 'NADA CONSTA', risco: true,
    dica: 'Verifica se existe registro ativo de roubo ou furto para este veículo.' },
  // "Leilão registrado no documento", nunca "Leilão": leiloeiro nem sempre
  // registra a passagem, entao ausencia de registro NAO e prova de que o
  // veiculo nunca foi leiloado. O rodape da secao repete isso em texto.
  { k: 'indicadorLeilao', label: 'Leilão registrado no documento', sim: 'CONSTA', nao: 'SEM REGISTRO', risco: true,
    dica: 'Verifica se existe passagem por leilão registrada no documento do veículo, o que costuma derrubar o valor de revenda. Nem todo leilão é registrado pelos leiloeiros.' },
  { k: 'indicadorRestricaoRenajud', label: 'RENAJUD', sim: 'CONSTA', nao: 'NADA CONSTA', risco: true,
    dica: 'Bloqueios determinados pela Justiça diretamente no cadastro do veículo, como penhora em processo.' },
  { k: 'indicadorRestricaoRfb', label: 'Restrição RFB', sim: 'CONSTA', nao: 'NADA CONSTA', risco: true,
    dica: 'Restrições da Receita Federal, em geral ligadas a importação ou regime fiscal do veículo.' },
  { k: 'indicadorMultaRenainf', label: 'Multa RENAINF', sim: 'CONSTA', nao: 'NADA CONSTA', risco: true,
    dica: 'Multas em aberto registradas contra o veículo, dentro e fora do estado.' },
  { k: 'indicadorRecall', label: 'Recall', sim: 'PENDENTE', nao: 'EM DIA', risco: true,
    dica: 'Chamados de segurança do fabricante ainda não atendidos para este veículo.' },
  { k: 'indicadorPendenciaEmissao', label: 'Pendência de emissão', sim: 'CONSTA', nao: 'NÃO', risco: true,
    dica: 'O documento de transferência (CRV) ainda não foi emitido. Sem ele a venda não se conclui.' },
  { k: 'indicadorAlarme', label: 'Alarme', sim: 'CONSTA', nao: 'NÃO', risco: true,
    dica: 'Alerta registrado no cadastro do veículo, em geral ligado a suspeita de irregularidade.' },
  // informativos: `true` nao e problema, so estado do cadastro
  { k: 'indicadorComunicacaoVenda', label: 'Comunicação de venda', sim: 'SIM', nao: 'NÃO', risco: false,
    dica: 'Mostra se o dono anterior já comunicou a venda. SIM significa que falta o novo dono concluir a transferência.' },
  { k: 'indicadorSiniav', label: 'SINIAV', sim: 'SIM', nao: 'NÃO', risco: false,
    dica: 'Mostra se o veículo tem a etiqueta eletrônica de identificação (SINIAV). É informativo, não é problema.' },
]

// Dois cartoes DERIVADOS entram junto dos flags da fonte:
// - Gravame: nao existe flag proprio; deriva das restricoes de garantia. Isso
//   tambem conserta o veredito — carro cuja unica pendencia e alienacao dizia
//   "Nada consta" com a restricao listada logo abaixo.
// - Circulacao: deriva de `situacao` (em circulacao x baixado).
const TIPOS_GRAVAME = ['ALIENACAO_FIDUCIARIA', 'ARRENDAMENTO_MERCANTIL', 'RESERVA_DE_DOMINIO', 'PENHOR']

// Que conceito de cartao cobre cada tipo de restricao. Usado duas vezes: pro
// cartao generico saber o que NAO tem cartao proprio, e pro veredito nao
// repetir o que um indicador aceso ja nomeia.
const COBERTURA_RESTRICAO: [RegExp, string][] = [
  [/^ROUBO/, 'Roubo / furto'],
  [/^(ALIENACAO|ARRENDAMENTO|RESERVA_DE_DOMINIO|PENHOR)/, 'Gravame'],
  [/^RENAINF/, 'Multa RENAINF'],
  [/^(RFB|RESTRICAO_RFB)/, 'Restrição RFB'],
  [/^PENDENCIA/, 'Pendência de emissão'],
  [/^COMUNICACAO_DE_VENDA/, 'Comunicação de venda'],
  // RECALL: faltava aqui, entao um veiculo com SO recall acendia o card
  // proprio (indicadorRecall) E "Outras restrições" pro mesmo item —
  // duplicado. Achado num relatorio real (placa OLO2I01).
  [/^RECALL/, 'Recall'],
  // RESTRICAO_JUDICIAL: mesma familia de bug, achada na auditoria pedida.
  // A chave ja aparece em EXPLICA_RESTRICAO (alguem ja viu essa string em
  // dado real), e a dica do indicadorRestricaoRenajud descreve exatamente
  // isso ("Bloqueios determinados pela Justiça diretamente no cadastro").
  [/^RESTRICAO_JUDICIAL/, 'RENAJUD'],
  // "RENAJUD" puro (RDW7C71): sem isto o item e o indicador entravam os dois
  // no veredito ("Atenção: consta RENAJUD e RENAJUD.").
  [/^(RESTRICAO_)?RENAJUD/, 'RENAJUD'],
]

const normalizaChave = (r: any) => String(r).toUpperCase().replace(/[\s-]+/g, '_')

// Historico de leilao vem do servico de leiloes, nao do payload da consulta.
// Declarado aqui, antes dos indicadores, porque a grade de indicadores le
// dele.
// Como o relatorio se refere ao veiculo. Com muitos clientes de moto, dizer
// "carro" pra quem consultou uma scooter e um erro que aparece na cara.
const segmento = computed<'carro' | 'moto' | 'caminhao' | 'outro'>(() => data.value?.segmento || 'outro')
const nomeVeiculo = computed(() => (
  segmento.value === 'moto' ? 'moto' : segmento.value === 'caminhao' ? 'caminhão' : segmento.value === 'carro' ? 'carro' : 'veículo'
))
const esteVeiculo = computed(() => `${segmento.value === 'moto' ? 'esta' : 'este'} ${nomeVeiculo.value}`)

const historicoLeilao = computed(() => data.value?.historicoLeilao ?? null)
const temSecaoLeilao = computed(() => !!historicoLeilao.value)
// "Dados de dd/mm" quando o bloco veio do cache de outro dia (shared/dados-de.ts).
const dadosDeBloco = (b: any) => dadosDe(b?.consultadoEm, (data.value as any)?.entregue_em)
const dadosLeilao = computed(() => dadosDeBloco(historicoLeilao.value))
const dadosRecallMontadora = computed(() => dadosDeBloco(recallMontadora.value))
// FIPE: o valorCusto guarda a hora da consulta em fipeConsultadoEm.
const dadosFipe = computed(() => dadosDe((data.value as any)?.valorCusto?.fipeConsultadoEm, (data.value as any)?.entregue_em))


// Roubo/furto so do DETRAN estadual (SENATRAN em nada consta). Ver shared/roubo-detran.
const rouboDetran = computed(() => rouboFurtoPeloDetran({
  senatranLigado: g('indicadorRouboFurto') === true,
  temOcorrenciasSenatran: ocorrencias.value.length > 0,
  multas: multasDetalhe.value,
}))

const indicadores = computed(() => {
  const base: any[] = INDICADORES.filter((i) => has(i.k)).map((i) => {
    const ligado = g(i.k) === true
    // Caso achado num relatorio real (placa GRU3557): indicadorRouboFurto
    // pode vir `false` (sem registro ATIVO agora) mesmo quando existem
    // declaracoes de furto/roubo no HISTORICO (ocorrenciasRouboFurto). O
    // cartao verde "NADA CONSTA" nesse caso e enganoso — quem le a sigla
    // "nada consta" entende "nunca teve problema", e nao e verdade. Se tem
    // ocorrencia registrada, o cartao acende mesmo com o indicador desligado.
    // SENATRAN em NADA CONSTA (sem indicador e sem historico) mas o DETRAN
    // estadual acusa roubo/furto: o cartao acende com a fonte explicita
    // (decisao do Cesar, 30/set). Com o SENATRAN acusando, segue como esta.
    // Recall: SENATRAN x montadora (Nissan/Mitsubishi pelo chassi). Decisao do
    // Cesar (01/out): quando divergirem, a grade mostra as DUAS fontes; quando
    // concordarem, fica a linha normal.
    if (i.k === 'indicadorRecall') {
      const linha = linhaRecallGrade(ligado, data.value?.recallMontadora)
      if (linha) return ligado ? { ...i, sim: linha.texto, ligado, alerta: linha.alerta } : { ...i, nao: linha.texto, ligado, alerta: linha.alerta }
    }
    if (i.k === 'indicadorRouboFurto' && rouboDetran.value) {
      return {
        ...i,
        nao: rouboDetran.value.valorCartao,
        dica: rouboDetran.value.texto,
        rotuloVeredito: rouboDetran.value.rotuloVeredito,
        ligado,
        alerta: true,
      }
    }
    if (i.k === 'indicadorRouboFurto' && !ligado && ocorrencias.value.length) {
      // Episodio encerrado muda o TEXTO, nao a cor (decisao do Cesar em
      // 22/set): registro de roubo continua sendo registro de roubo, e o
      // cartao do resumo e onde a pessoa passa o olho. O desfecho ela le na
      // secao, que o proprio cartao aponta.
      if (rouboTudoEncerrado.value) {
        return {
          ...i,
          nao: `Episódio encerrado (ver seção ${numSecao.value.ocorr})`,
          ligado,
          alerta: true,
        }
      }
      return {
        ...i,
        nao: 'Não ativo, mas tem histórico',
        ligado,
        alerta: true,
      }
    }
    return { ...i, ligado, alerta: ligado && i.risco }
  })

  // Sem os itens informativos (principal condutor): aparecem na secao, mas nao
  // acendem cartao nenhum.
  const itens = itensQueRestringem(v.value?.restricoesItens)
  if (Array.isArray(itens)) {
    const tem = itens.some((r: any) => TIPOS_GRAVAME.some((t) => normalizaChave(r).startsWith(t)))
    base.splice(Math.min(2, base.length), 0, {
      k: 'gravame', label: 'Gravame', sim: 'CONSTA', nao: 'NADA CONSTA', risco: true,
      dica: 'Financiamento ou garantia registrada sobre o veículo: alienação, leasing, reserva de domínio ou penhor.',
      ligado: tem, alerta: tem,
    })
  }

  if (has('situacao')) {
    const baixado = String(g('situacao')).toUpperCase().includes('BAIXADO')
    base.push({
      k: 'circulacao', label: 'Circulação', sim: 'BAIXADO', nao: 'LIVRE', risco: true,
      dica: 'Situação cadastral do veículo. Baixado significa retirado de circulação em definitivo.',
      ligado: baixado, alerta: baixado,
    })
  }

  // Cartao generico: pega restricao que nao tem cartao proprio (beneficio
  // tributario, por exemplo). Sem ele, a grade ficava toda verde com uma
  // restricao listada logo abaixo — toda restricao precisa acender ALGO.
  if (Array.isArray(itens)) {
    const semCartao = itens.some((r: any) => !COBERTURA_RESTRICAO.some(([re]) => re.test(normalizaChave(r))))
    base.push({
      k: 'outrasRestricoes', label: 'Outras restrições', sim: 'CONSTA', nao: 'NADA CONSTA', risco: true,
      dica: 'Qualquer restrição registrada que não se encaixa nos cartões específicos, como benefício fiscal com prazo de carência. O detalhe aparece na seção de Restrições.',
      ligado: semCartao, alerta: semCartao,
    })
  }

  // Historico de leilao: o unico indicador que NAO vem do payload da consulta,
  // e sim do servico de leiloes. Fica junto dos outros porque a pergunta que
  // ele responde ("esse carro foi leiloado?") e do mesmo tipo, e porque a
  // grade e o lugar onde as pessoas passam o olho primeiro.
  //
  // Se o servico nao respondeu, o indicador NAO entra: um cartao verde ali
  // seria dizer "nada consta" sem ter olhado, que e pior que nao dizer nada.
  if (historicoLeilao.value?.resumo) {
    const r = historicoLeilao.value.resumo
    // Ambiguo nao entra na conta: ele diz "existem varios carros com este
    // perfil", nao "este carro passou por leilao". Contar aqui pintaria de
    // amarelo um veiculo sem nenhum indicio real.
    const plural = (n: number) => (n > 1 ? 's' : '')
    // "Sem ocorrencia" e mais claro que "nada consta" pra uma base nossa, e o
    // estado do meio existe so quando ha foto pra pessoa comparar.
    // Contagem refeita a partir das passagens: a API soma edital de
    // NOTIFICACAO em n_confirmado, e notificacao nao e leilao realizado.
    const cont = contarPassagens(historicoLeilao.value.passagens)
    let valor = 'SEM OCORRÊNCIA'
    let alerta = false
    let aceso = false
    let neutro = false
    if (cont.confirmado > 0) {
      valor = `CONSTA (${cont.confirmado} confirmado${plural(cont.confirmado)})`
      alerta = true
      aceso = true
    } else if (cont.provavel > 0) {
      valor = `PROVÁVEL (${cont.provavel})`
      alerta = true
      aceso = true
    } else if (cont.notificado > 0) {
      // So notificacao: aceso, mas neutro. O DETRAN avisou o dono; o leilao
      // pode nao ter acontecido.
      valor = 'NOTIFICADO PARA LEILÃO'
      alerta = false
      aceso = true
      neutro = true
    } else if (possiveisComFoto.value.length > 0) {
      // Nem alerta nem verde: existe um lote parecido COM FOTO, e a decisao de
      // dizer se e o mesmo veiculo e de quem esta olhando.
      valor = 'CONFIRA AS FOTOS'
      alerta = false
      aceso = true
    }
    const cartaoLeilao = {
      k: 'historicoLeilao',
      label: 'Histórico de leilão (fontes públicas)',
      sim: valor,
      nao: 'SEM OCORRÊNCIA',
      risco: true,
      dica: `Cruzamos o veículo com uma base de ${BASE_LEILAO_TEXTO}, montada a partir de editais de órgãos de trânsito e catálogos de leiloeiras. Confirmado quer dizer chassi ou placa completos iguais; provável e possível são inferência por identificador parcial, então podem ser outro veículo. O detalhe de cada registro aparece na seção Histórico de leilão.`,
      ligado: aceso,
      alerta,
      // Cinza: aceso, mas nem problema (vermelho) nem "confira" (ambar).
      neutro,
    }
    // Entra colado no "Leilão registrado no documento", que responde a outra
    // pergunta: aquele diz se o leilao foi anotado no registro do veiculo, este
    // diz se o veiculo apareceu em edital ou catalogo. Um "sem registro" ao
    // lado de um "consta" parece contradicao quando os dois estao longe um do
    // outro; lado a lado, a diferenca fica evidente, e ela e justamente o que a
    // nossa base acrescenta.
    const posDoc = base.findIndex((i) => i.k === 'indicadorLeilao')
    if (posDoc >= 0) base.splice(posDoc + 1, 0, cartaoLeilao)
    else base.push(cartaoLeilao)
  }

  return base
})

// Copy das restricoes (dicionario + fallback) vive em shared/restricoes.ts,
// que e testavel sem montar a pagina. Aqui fica so o gancho de telemetria pro
// tipo que ainda nao tem copy propria.
const tiposRestricaoDesconhecidos = new Set<string>()
function registraTipoDesconhecido(chave: string) {
  if (!chave || tiposRestricaoDesconhecidos.has(chave)) return
  tiposRestricaoDesconhecidos.add(chave)
  if (import.meta.dev) console.warn('[relatorio] restricao sem copy especifica:', chave)
  try { trackRestricaoDesconhecida(chave) } catch { /* telemetria e best-effort */ }
}

// Detalhe do RENAJUD (AL/GO), so quando o parser reconheceu. Sem isso, o card
// fica com o texto geral.
// Item 12: o que cada restricao bloqueia (shared/restricao-efeito.ts).
function efeitoTexto(r: { tipo?: string | null; texto?: string | null }): string | null {
  return textoEfeito(efeitoRestricao(r))
}
const renajudItens = computed<any[]>(() => {
  const d: any = data.value?.renajudDetalhe
  return d?.status === 'ok' && Array.isArray(d.itens) ? d.itens : []
})
const restricoes = computed<{ rotulo: string; explica: string; renave: boolean; info: boolean; renajud?: boolean }[]>(() => {
  const arr = v.value?.restricoesItens
  if (!Array.isArray(arr)) return []
  return arr
    .filter(Boolean)
    .map((r: any) => {
      // Estoque RENAVE tem explicacao propria (RENAVE_EXPLICACAO) no lugar da
      // copy generica, e nao conta como tipo desconhecido.
      if (ehEstoqueRenave(r)) return { rotulo: humanizar(r), explica: '', renave: true, info: false }
      // RENAJUD: card em blocos (o que e, tipos possiveis, o que conferir).
      if (ehRenajud(r)) return { rotulo: humanizar(r), explica: '', renave: false, info: false, renajud: true }
      // Informativo (principal condutor): titulo e texto proprios, etiqueta
      // "Informação" em vez de "Restrição".
      const inf = itemInformativo(r)
      if (inf) return { rotulo: inf.titulo, explica: inf.texto, renave: false, info: true }
      return { rotulo: humanizar(r), explica: explicaRenainfOuPadrao(String(r)), renave: false, info: false }
    })
})
// RENAINF aceso e o DETRAN da UF respondeu sem multa: a multa e de orgao de
// fora ou federal. Explicacao propria pra nao contradizer o "nada consta" do
// DETRAN logo abaixo (shared/renainf-detran.ts).
// Tela de pagamento (Pix ou cartao aguardando): sem WhatsApp flutuante por cima.
// No relatorio entregue ele aparece (suporte).
useWhatsappOculto(() => data.value?.status === 'aguardando_pagamento')
const ufRenainfFora = computed(() => ufRenainfForaDoDetran(g('indicadorMultaRenainf'), data.value?.multas as any, g('ufJurisdicao')))
function explicaRenainfOuPadrao(r: string): string {
  if (ufRenainfFora.value && /^RENAINF/.test(normalizaChave(r))) return EXPLICA_RENAINF_FORA_DO_DETRAN
  return explicaRestricao(r, registraTipoDesconhecido)
}
// So o estoque RENAVE consta: nenhum outro item, nenhum outro cartao aceso
// alem do generico "Outras restrições" que ele mesmo acende.
const soEstoqueRenave = computed(() => {
  const itens = (Array.isArray(v.value?.restricoesItens) ? itensQueRestringem(v.value.restricoesItens) : []).filter(Boolean)
  return itens.length > 0 && itens.every(ehEstoqueRenave)
})

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
  // Data PURA (sem hora relevante pra exibicao): formata em UTC, nao no fuso
  // de quem abre. "2012-04-20" vira Date UTC-meia-noite; formatar no fuso de
  // Brasilia (America/Sao_Paulo, UTC-3) subtrai 3h e cai pro dia anterior
  // (19/04). timeZone:'UTC' devolve sempre o mesmo dia do calendario que veio
  // no dado, e elimina hydration mismatch (SSR roda em UTC, o navegador nao).
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? null : dt.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
})

// Faixa de licenciamento acima da ficha: e o dado que diz se o documento esta
// em dia, e enterrado como linha de tabela ninguem via. O tom segue o ano:
// exercicio atual (ou adiante) em dia; ano anterior pode so nao ter vencido
// ainda, porque o calendario corre pelo final da placa e varia por UF; dois
// anos ou mais e atraso sem desculpa.
// Regra em shared/licenciamento-faixa.ts: o DETRAN da UF (quando respondeu)
// manda sobre a base nacional, que pode estar defasada (caso DEI0D43, 14/out).
const licenciamento = computed(() => faixaLicenciamento({
  anoNacional: licAno.value,
  emissaoNacional: licEmissao.value,
  estadual: multasDetalhe.value as any,
}))

// ---------- veredito ----------
// O resumo que a pessoa procura antes de ler o resto: o que pesa contra, em
// uma frase. Sai dos proprios indicadores, sem inventar gravidade.
const alertas = computed(() => indicadores.value.filter((i) => i.alerta).map((i) => i.label))
// Rodape honesto do leilao: so aparece quando o indicador esta na tela.
const temIndicadorLeilao = computed(() => indicadores.value.some((i: any) => i.k === 'indicadorLeilao'))

const restricoesForaDosIndicadores = computed<string[]>(() => {
  const itens = itensQueRestringem(v.value?.restricoesItens)
  if (!Array.isArray(itens)) return []
  const acesos = new Set(alertas.value)
  const fora: string[] = []
  for (const bruto of itens) {
    const cobre = COBERTURA_RESTRICAO.find(([re]) => re.test(normalizaChave(bruto)))
    if (cobre && acesos.has(cobre[1])) continue
    const rotulo = humanizar(String(bruto))
    if (rotulo && !fora.includes(rotulo)) fora.push(rotulo)
  }
  return fora
})

const veredito = computed(() => {
  if (!entregue.value) return null
  // So a completa verifica risco. Dizer "nada consta" numa basica seria
  // afirmar que checamos coisas que nem foram consultadas.
  if (isBasica.value) return null
  if (!indicadores.value.length) return null
  // Documento atrasado ha dois anos ou mais trava transferencia e derruba o
  // "nada consta" igual a qualquer restricao. O caso ambar (ano anterior) NAO
  // entra: pode so estar dentro do calendario da UF, e a faixa da ficha ja
  // manda conferir.
  const licAtrasado = licenciamento.value?.tom === 'alerta'
  if (!alertas.value.length && !restricoesForaDosIndicadores.value.length && !licAtrasado) {
    return {
      tom: 'ok' as const,
      titulo: 'Nada consta contra este veículo.',
      // Notificacao para leilao nao e registro de leilao (nao acende alerta),
      // mas o parecer nao pode dizer "nada" e a secao logo abaixo mostrar o
      // aviso do DETRAN sem explicar a diferenca.
      texto: 'Na data de emissão, nenhum dos indicadores verificados aponta restrição, roubo, furto, registro de leilão ou pendência.'
        + (passagensNotificadas.value.length
          ? ' Consta notificação para leilão do DETRAN, que não comprova que o leilão aconteceu (veja o Histórico de leilão).'
          : ''),
    }
  }
  // Os rotulos sao siglas e nomes proprios (RENAJUD, RFB): baixar tudo pra
  // minuscula deixava "Atenção: renajud." Mantem a caixa e monta a frase.
  // O cartao generico aceso e sempre renomeado aqui pelo tipo especifico
  // (restricoesForaDosIndicadores) — listar os dois diria a mesma coisa duas
  // vezes: "consta Outras restrições e Restrição de benefício tributário".
  // Rotulo proprio no veredito quando o cartao acendeu por outra fonte (ex.:
  // "roubo/furto informado pelo DETRAN-MG", nunca so "Roubo / furto").
  // Unica restricao e o estoque RENAVE: parecer proprio (texto aprovado), em
  // vez de "Atenção: consta Estoque Renave", que soava como bloqueio.
  if (soEstoqueRenave.value && !licAtrasado && alertas.value.every((l) => l === 'Outras restrições')) {
    return { tom: 'alerta' as const, titulo: PARECER_SO_RENAVE.titulo, texto: PARECER_SO_RENAVE.texto }
  }
  const rotuloVer = new Map(indicadores.value.filter((i: any) => i.alerta && i.rotuloVeredito).map((i: any) => [i.label, i.rotuloVeredito]))
  const nomes = [
    ...alertas.value.filter((l) => l !== 'Outras restrições').map((l) => rotuloVer.get(l) || l),
    ...restricoesForaDosIndicadores.value,
    ...(licAtrasado ? ['licenciamento atrasado'] : []),
  ]
  // Sem repeticao: dois caminhos (indicador e item da lista) podem nomear a
  // mesma coisa.
  nomes.splice(0, nomes.length, ...[...new Set(nomes)])
  const lista = nomes.length === 1
    ? nomes[0]
    : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
  return {
    tom: 'alerta' as const,
    titulo: `Atenção: consta ${lista}.`,
    texto: 'Verifique os detalhes nas seções seguintes antes de concluir a negociação. As pendências apontadas podem impedir a transferência do veículo.',
  }
})

// ---------- retomada de um Pix vencido ----------
// O provedor nao cobra por QR gerado, entao vencer nao precisa custar o pedido
// inteiro: placa, plano e e-mail ja estao confirmados e so falta o codigo.
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
  // Cartao nunca renova Pix: o pagamento e pela sessao Stripe. Sem esta guarda,
  // o pedido de cartao (que volta do Stripe sem br_code) gerava uma cobranca Pix
  // aqui — QR na tela em vez do relatorio e risco de cobranca dupla.
  if (!ehCartao.value && d.status === 'aguardando_pagamento' && (d.expirado || !d.brCode)) {
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
    await buscarQr()   // o codigo mudou; o QR desenhado precisa acompanhar
  } catch (e: any) {
    // Pix ja pago (inclusive a cobranca Woovi original, RBF5A06): o status
    // detecta e dispara a entrega; a pagina recarrega com o novo estado.
    if (e?.data?.message === 'Este pagamento ja foi confirmado.') {
      try { await $fetch('/api/premium/status', { query: { token } }) } catch { /* o polling tenta de novo */ }
      await refresh()
      return
    }
    erroRenovar.value = e?.data?.message === 'O pagamento atual ainda esta valido.'
      ? 'O código anterior voltou a valer. Atualize a página.'
      : 'Não conseguimos gerar o código agora. Tente de novo em instantes.'
  } finally {
    renovando.value = false
  }
}

// ---------- identidade do documento ----------
// Numero derivado do token por hash: deterministico (recarregar nao muda o
// numero) e verificavel, sem inventar sequencia que nao existe.
const numeroDoc = computed(() => {
  const t = String(token || '')
  let h = 5381
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0
  const ano = data.value?.entregue_em ? new Date(data.value.entregue_em).getFullYear() : new Date().getFullYear()
  return `PC-${ano}-${h.toString(36).toUpperCase().padStart(6, '0').slice(0, 6)}`
})

// Fuso fixo: sem ele, servidor e navegador formatam horas diferentes e o Vue
// acusa hydration mismatch.
const emissaoFmt = computed(() => {
  const iso = data.value?.entregue_em
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const dia = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  return `${dia} às ${hora}`
})

// QR de autenticidade: aponta pra propria URL do relatorio. Quem recebe o
// papel escaneia e ve o original vivo — e o que separa um laudo de um print.
// So no cliente, porque a URL vem do window; o espaco fica reservado no CSS.
const qrSvg = ref('')
onMounted(async () => {
  try {
    const { renderSVG } = await import('uqr')
    qrSvg.value = renderSVG(window.location.origin + window.location.pathname, { border: 1 })
  } catch { /* sem QR o rodape continua com o endereco por extenso */ }
})

// ---------- historico de leilao ----------
// So existe quando o servico esta configurado no ambiente (hoje, homolog) e o
// plano e completa; o servidor ja aplica as duas regras, aqui e so exibicao.
//
// A copy trata cada passagem pelo NIVEL DE CONFIANCA, porque a fonte varia: a
// mesma consulta pode achar um edital de DETRAN com o chassi inteiro (certeza)
// e um catalogo de leiloeira que so publica o final da placa (inferencia). Sem
// o rotulo, as duas coisas pareceriam iguais na tela, e a segunda pode ser
// outro carro.

const ROTULO_NIVEL: Record<string, string> = {
  confirmado: 'Confirmado',
  provavel: 'Provável',
  possivel: 'Possível',
}
const EXPLICA_NIVEL: Record<string, string> = {
  confirmado: 'O chassi, a placa ou o Renavam completos deste veículo constam no registro do leilão.',
  provavel: 'A fonte publica só parte do identificador, e o trecho publicado bate com este veículo, assim como marca, modelo e ano.',
  possivel: 'A fonte publica pouca coisa do identificador. O que dá para comparar bate com este veículo, mas pode ser outro do mesmo modelo e ano.',
}

const passagensLeilao = computed(() => {
  const lista = historicoLeilao.value?.passagens
  if (!Array.isArray(lista)) return []
  return lista.map((p: any, idx: number) => ({
    idx,
    nivel: p.nivel as string,
    // Edital de notificacao: vai pra um bloco proprio, cinza, e nunca conta
    // como leilao confirmado. Detectado aqui tambem (e nao so no servidor)
    // porque o snapshot de relatorio antigo guarda a gravidade velha.
    notificacao: ehNotificacao(p),
    // Word joiner depois do hifen: sem ele, no celular a linha quebrava em
    // "DETRAN-" / "RJ".
    tituloNotificacao: ehNotificacao(p) ? tituloNotificacao(p).replace('DETRAN-', 'DETRAN-\u2060') : '',
    // Todos os dados do edital de notificacao, ja legiveis (nunca o nome do
    // arquivo nem a URL do documento).
    camposNotificacao: ehNotificacao(p) ? camposNotificacao(p, { semPrevista: true }) : [],
    rotuloNivel: ROTULO_NIVEL[p.nivel] || humanizar(p.nivel),
    explicaNivel: EXPLICA_NIVEL[p.nivel] || '',
    // Nome PUBLICO da fonte (shared/leilao-exibicao.ts). Decisao do Cesar,
    // 06/out: casa privada mostra o NOME da casa ("Copart", "Superbid"), nao
    // mais o generico "Leiloeira particular". Vale pros snapshots antigos, que
    // gravaram "Leiloeira particular" no fonte_exibicao: o nome sai da chave
    // `fonte`. Orgao segue "Detran SP".
    fonte: fonteExibicaoLeilao(p),
    gravidade: ehNotificacao(p) ? GRAVIDADE_NOTIFICADO : p.gravidade,
    // O rotulo de tipo so aparece pro orgao oficial, que e a informacao que
    // muda a leitura da passagem.
    tipoFonte: p.fonte_tipo === 'detran' ? 'Edital de órgão oficial' : '',
    data: p.data_leilao ? formatarDataLeilao(p.data_leilao) : null,
    // Linha montada como lista pra nunca comecar com separador solto: no teste
    // real do homolog, uma passagem do DETRAN-SP sem data saiu como
    // "· Edital 001/2016 · Lote 02872".
    detalhe: [
      p.data_leilao ? `Leilão de ${formatarDataLeilao(p.data_leilao)}` : null,
      p.ref ? `Edital ${p.ref}` : null,
      p.lote ? `Lote ${p.lote}` : null,
      // Com termometro, a situacao crua ("SUCATA") viraria eco do rotulo.
      p.gravidade || !p.situacao ? null : semValorEmReais(humanizar(p.situacao)),
      // Sem valor em R$ (decisao do Cesar, 01/out).
    ].filter(Boolean).join(' · '),
    ref: p.ref,
    lote: p.lote,
    situacao: p.situacao ? semValorEmReais(humanizar(p.situacao)) : null,
    // Leiloeiro (a pessoa) so de orgao oficial: em casa privada aparece so o
    // nome da CASA, nunca o leiloeiro (Cesar, 06/out). Comitente logo abaixo do termometro, com
    // uma frase pelo tipo (banco, seguradora, Justica...): e o sinal de que a
    // passagem foi retomada de financiamento, sinistro ou leilao judicial.
    leiloeiro: p.fonte_tipo === 'detran' && p.leiloeiro ? String(p.leiloeiro) : null,
    comitente: comitenteExibicao(p.comitente)?.texto ?? null,
    fraseComitente: fraseComitente(p.comitente),
    detalhes: detalhesLegiveis(p.detalhes),
    evidencias: Array.isArray(p.evidencias) ? p.evidencias : [],
    // Fotos do lote, servidas do nosso armazenamento (nunca link direto da
    // leiloeira). Sao o unico caminho honesto de mostrar um "possivel": quem
    // decide se e o veiculo dele e a pessoa, olhando.
    fotos: Array.isArray(p.fotos) ? p.fotos.filter((f: any) => typeof f === 'string').slice(0, 3) : [],
    conflitos: Array.isArray(p.conflitos) ? p.conflitos : [],
    // Edital do orgao: so DETRAN. O snapshot de relatorio antigo nao tem estes
    // campos, e ai o botao simplesmente nao aparece, que e o comportamento
    // certo: o snapshot e o que a pessoa comprou.
    // Edital: DETRAN ou leilao judicial de casa privada, quando a leiloes-api
    // marca como disponivel (a regra LGPD fica la). Notificacao, nunca.
    edital_disponivel: !ehNotificacao(p) && !!p.edital_disponivel,
    edital_ref: !ehNotificacao(p) && p.edital_ref ? String(p.edital_ref) : null,
    editalDetran: p.fonte_tipo === 'detran',
    // Sem edital pra baixar (judicial que reprovou no LGPD): link pra pagina
    // publica do lote na leiloeira. Revalidado aqui (https + host conhecido).
    paginaPublica: !ehNotificacao(p) && !(p.edital_disponivel && p.edital_ref) ? paginaPublicaLeilao(p.pagina_publica_url) : null,
    // Relatorio 2.0 (leiloes-api): ja saneado no servidor; desconhecido nao vem.
    origem: p.origem?.rotulo ? String(p.origem.rotulo) : null,
    alertas: Array.isArray(p.alertas) ? p.alertas.map((a: any) => textoAlerta(a)) : [],
    desfecho: p.desfecho?.rotulo ? `${p.desfecho.rotulo}${p.desfecho.data ? `, ${dataBRIso(p.desfecho.data)}` : ''}` : null,
    judicial: p.contexto_judicial ? textoJudicial(p.contexto_judicial) : null,
    // Link do contexto judicial so quando o card ainda nao tem o da pagina publica.
    judicialUrl: p.contexto_judicial?.paginaPublicaUrl && !paginaPublicaLeilao(p.pagina_publica_url) && !(p.edital_disponivel && p.edital_ref) ? paginaPublicaLeilao(p.contexto_judicial.paginaPublicaUrl) : null,
    // Lote publico: sem repetir o link que o card ja mostra (pagina publica/judicial).
    lote: p.lote_publico?.status && !(p.lote_publico.url && [paginaPublicaLeilao(p.pagina_publica_url), paginaPublicaLeilao(p.contexto_judicial?.paginaPublicaUrl)].includes(p.lote_publico.url))
      ? { url: p.lote_publico.url || null, encerrado: p.lote_publico.status === 'encerrado_na_casa' }
      : null,
  }))
})

// ROTULO_DETALHE / detalhesLegiveis: shared/leilao-exibicao.ts (sem R$ no card).

function formatarDataLeilao(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

// Confirmado e provavel aparecem sempre. Os "possivel" ficam recolhidos atras
// de um botao: no teste com dado real, um Gol comum trouxe 4 passagens
// possiveis da mesma leiloeira, todas por final de placa e modelo, quase
// certamente carros diferentes. Empilhar isso no topo da secao daria ao
// palpite o mesmo peso visual de um edital com o chassi inteiro, e assustaria
// quem esta comprando um carro sem historico nenhum. A contagem continua
// visivel no resumo, entao nada e escondido.
const passagensFortes = computed(() => passagensLeilao.value.filter((p) => p.nivel !== 'possivel' && !p.notificacao))

// Notificacoes com identificacao forte, uma por data (o mesmo edital pode vir
// repetido de fontes da mesma UF). Notificacao "possivel" nao aparece: casar
// final de placa com um aviso de notificacao nao diz nada sobre este carro.
const passagensNotificadas = computed(() => {
  const vistas = new Set<string>()
  return passagensLeilao.value.filter((p) => {
    if (!p.notificacao || p.nivel === 'possivel') return false
    // Mesma notificacao repetida (mesmo edital e mesmas datas) aparece uma vez.
    const chave = p.tituloNotificacao + '|' + p.camposNotificacao.map((c) => c.valor).join('|')
    if (vistas.has(chave)) return false
    vistas.add(chave)
    return true
  })
})

// Edital do DETRAN. O link e assinado e vale 24h, entao ele e gerado no clique,
// nunca guardado: no snapshot, estaria morto no dia seguinte e vivo pra quem
// copiasse o JSON no primeiro.
const editalCarregando = ref<string | null>(null)
const editalErro = ref('')

async function baixarEdital(ref: string) {
  editalErro.value = ''
  editalCarregando.value = ref
  try {
    const r: any = await $fetch('/api/premium/edital', { method: 'POST', body: { token, edital_ref: ref } })
    if (!r?.url) throw new Error('sem url')
    // Nova aba: o relatorio continua aberto atras, que e onde a pessoa estava.
    window.open(r.url, '_blank', 'noopener')
  } catch (e: any) {
    editalErro.value = e?.data?.statusCode === 429
      ? 'Muitos downloads deste relatório agora. Tente daqui a pouco.'
      : 'Não conseguimos abrir o edital agora. Tente de novo em instantes.'
  } finally {
    editalCarregando.value = null
  }
}

// Lote ambiguo: varios lotes DIFERENTES que casaram exatamente pelas mesmas
// evidencias. Isso nao aponta um veiculo, aponta que o perfil (marca, modelo,
// ano, final de placa) e comum demais. Caso real: uma Fazer trouxe tres
// "possiveis" do mesmo catalogo, que eram tres motos distintas.
//
// A API ja separa isso e manda em resumo.possiveis_ambiguos. Aqui a gente
// REFAZ a conta a partir das evidencias porque o snapshot e imutavel: o
// relatorio ja comprado guarda a resposta antiga, com os lotes ambiguos ainda
// na lista, e sem isto ele continuaria mostrando indicio onde nao ha. Mesmo
// caminho ja usado pro ano do chassi e pro nome da fonte: o snapshot no banco
// fica intacto, so a exibicao e reconciliada.
function assinaturaDaPassagem(p: any): string {
  return [...(p.evidencias || [])].sort().join('|')
}

const possiveisAgrupados = computed(() => {
  const possiveis = passagensLeilao.value.filter((p) => p.nivel === 'possivel' && !p.notificacao)
  const porAssinatura = new Map<string, typeof possiveis>()
  for (const p of possiveis) {
    const chave = assinaturaDaPassagem(p)
    const lista = porAssinatura.get(chave) || []
    lista.push(p)
    porAssinatura.set(chave, lista)
  }
  const distintas: typeof possiveis = []
  let ambiguas = 0
  for (const lista of porAssinatura.values()) {
    if (lista.length > 1) ambiguas += lista.length
    else distintas.push(lista[0])
  }
  return { distintas, ambiguas }
})

const passagensPossiveis = computed(() => possiveisAgrupados.value.distintas)

// Contagem de lotes ambiguos: fica no snapshot e no log, NAO vai pra tela.
// Dizer ao cliente "existem 4 lotes parecidos que nao dao pra identificar" nao
// ajuda ele a decidir nada e ainda assusta. O que vale mostrar e o lote com
// foto, que ele consegue comparar (ver possiveisComFoto).
const ambiguos = computed(() =>
  Math.max(historicoLeilao.value?.resumo?.possiveis_ambiguos || 0, possiveisAgrupados.value.ambiguas),
)
const possiveisAbertas = ref(false)

// Uma passagem por vez aberta: a lista precisa continuar escaneavel.
const passagemAberta = ref<number | null>(null)
function alternarPassagem(idx: number) {
  passagemAberta.value = passagemAberta.value === idx ? null : idx
}

// "Tem indicio" passa a significar passagem que APONTA este veiculo. Um lote
// ambiguo nao aponta nada, entao a secao trata o caso como sem indicio e a
// linha explicativa aparece logo abaixo.
// So entra como indicio o que tem grau de certeza: confirmado e provavel. O
// "possivel" sozinho vira ruido, porque casa por perfil comum e pode ser outro
// veiculo do mesmo modelo, e o cliente nao tem como julgar. A excecao e quando
// a fonte publica FOTOS do lote: ai ele consegue comparar com o proprio
// veiculo, e o bloco aparece com esse proposito, separado e sem alarme.
const temIndicioReal = computed(() => passagensFortes.value.length > 0)

// Foto vence ambiguidade. Um lote so e "ambiguo" porque casou por um perfil
// comum e a gente nao consegue provar que e este veiculo; com foto, quem prova
// e o dono, olhando. Por isso este bloco olha TODOS os possiveis, inclusive os
// que a regra de ambiguidade tirou da lista textual.
const possiveisComFoto = computed(() =>
  passagensLeilao.value.filter((p) => p.nivel === 'possivel' && !p.notificacao && p.fotos.length > 0).slice(0, 3),
)

// Nivel que a tela mostra. Sai das passagens que sobraram, nao do nivel_max da
// resposta: quando os "possiveis" eram todos ambiguos e sairam, o nivel_max
// antigo continuaria dizendo "possivel" num relatorio que nao mostra passagem
// nenhuma.
const nivelExibido = computed<string>(() => {
  if (passagensFortes.value.some((p) => p.nivel === 'confirmado')) return 'confirmado'
  if (passagensFortes.value.some((p) => p.nivel === 'provavel')) return 'provavel'
  return 'possivel'
})

const resumoLeilao = computed(() => {
  const r = historicoLeilao.value?.resumo
  if (!r) return null
  const partes: string[] = []
  const plural = (n: number, um: string, muitos: string) => `${n} ${n > 1 ? muitos : um}`
  // Sem as notificacoes: elas tem bloco proprio e nao sao leilao confirmado.
  const cont = contarPassagens(historicoLeilao.value?.passagens)
  if (cont.confirmado) partes.push(plural(cont.confirmado, 'confirmada', 'confirmadas'))
  if (cont.provavel) partes.push(plural(cont.provavel, 'provável', 'prováveis'))
  if (passagensPossiveis.value.length) partes.push(plural(passagensPossiveis.value.length, 'possível', 'possíveis'))
  return partes.join(' · ')
})

// ---------- numeracao das secoes ----------
// Dinamica porque nem toda secao existe em todo laudo (a basica nao tem
// indicadores; sem FIPE nao ha secao de valor). Numeracao fixa deixaria buraco.
// A grade de indicadores existe? Dito a partir do payload, e nao de
// `indicadores.value`: o cartao de roubo/furto precisa citar o numero da secao
// de ocorrencias, e ler `indicadores` daqui fecharia um ciclo entre os dois
// computeds. Cada ramo abaixo e um trecho que empurra cartao pra grade, entao
// a resposta e a mesma de `indicadores.value.length > 0`.
const temIndicadores = computed(() => (
  INDICADORES.some((i) => has(i.k))
  || Array.isArray(v.value?.restricoesItens)
  || has('situacao')
  || !!historicoLeilao.value?.resumo
))

const numSecao = computed(() => {
  const ordem: string[] = ['veh']
  if (temIndicadores.value) ordem.push('ind')
  if (linhaDoTempo.value.length > 1) ordem.push('tempo')
  if (!isBasica.value && temIndicadores.value) ordem.push('restr')
  if (ocorrencias.value.length) ordem.push('ocorr')
  if (temSecaoLeilao.value) ordem.push('leilao')
  // Importacao e chassiOrigem NAO entram na numeracao: viraram subsecoes
  // dentro da ficha (rel__sub), igual Cadastral/Tecnica — nao sao mais card
  // proprio numerado.
  ordem.push('ficha')
  if (temValor.value) ordem.push('valor')
  ordem.push('check')
  const m: Record<string, number> = {}
  ordem.forEach((k, i) => { m[k] = i + 1 })
  return m
})

// Checklist de vistoria e transferencia (Relatorio 2.0, item 5): itens gerais
// + os que este relatorio acendeu (shared/checklist-compra.ts).
const checklist = computed(() => {
  const ind = (k: string) => !!indicadores.value.find((i: any) => i.k === k)?.ligado
  const leilaoForte = passagensFortes.value.length > 0 || g('indicadorLeilao') === true
  const leilaoPossivel = passagensLeilao.value.some((p: any) => p.nivel === 'possivel' && !p.notificacao)
  return montarChecklist({
    leilao: leilaoForte ? 'confirmado' : leilaoPossivel ? 'possivel' : null,
    roubo: ocorrencias.value.length > 0 || g('indicadorRouboFurto') === true || !!rouboDetran.value,
    recallPendente: recallPendente.value,
    kmCaiu: hodometroSuspeito.value,
    gravame: ind('gravame'),
    restricaoJudicial: restricoes.value.some((r) => r.renajud || /judic/i.test(r.rotulo)),
    debitosCentavos: resumoDetran.value?.totalCentavos ?? null,
    licenciamentoAtrasado: (licenciamento.value as any)?.tom === 'alerta',
    baixado: ind('circulacao'),
  })
})

// ---------- valor e custo ----------
const vc = computed(() => data.value?.valorCusto ?? null)

// Versao FIPE nao identificada com seguranca. Vale pro que vier daqui pra
// frente E pros relatorios ja gravados: o snapshot e imutavel, entao um
// relatorio antigo continua trazendo o valor do candidato ambiguo, e sem esta
// checagem ele seguiria exibindo numero errado como se fosse FIPE. Mesmo
// caminho ja usado no ano do chassi, no nome da fonte de leilao e nos lotes
// ambiguos.
const fipeIncerta = computed(() => fipeEIncerta(vc.value))
// Versoes compativeis so da tabela FIPE do veiculo: relatorio entregue antes
// da correcao pode trazer versao de carro num caminhao (PUF7J27 listava
// Touareg e Amarok). Sem nenhuma da tabela certa, a lista nao aparece.
const versoesCompativeis = computed(() => {
  const lista = vc.value?.fipeCandidato?.candidatos || []
  const tabela = tabelaDoSegmento(segmento.value)
  // Modelo, cabine, versao e motorizacao do nome (shared/versao-fipe.ts):
  // TRACKER nao lista ONIX, XEi nao lista SE-G, CS nao lista CD. Vale pra
  // relatorio ja entregue.
  const daTabela = lista.filter((c: any) => codigoDaTabela(c?.codigo_fipe, tabela))
  return versoesParaExibir(daTabela, g('descricaoMarcaModelo')).slice(0, 3)
})
// Camada 3: duvida SO de cambio (uma versao manual e uma automatica). A tela
// pergunta e o cliente toca na do carro dele; valor, historico, queda e
// seguro passam a ser os dessa versao (server/api/premium/fipe-escolha.post.ts).
const opcaoCambio = computed(() => opcoesDeCambio(versoesCompativeis.value))
const escolhaCambio = computed<any>(() => vc.value?.fipeEscolhaCliente ?? null)
const outraOpcaoCambio = computed(() => {
  const o = opcaoCambio.value, e = escolhaCambio.value
  if (!o || !e) return null
  return e.codigo_fipe === o.manual.codigo_fipe ? { rotulo: 'automático', c: o.automatico } : e.codigo_fipe === o.automatico.codigo_fipe ? { rotulo: 'manual', c: o.manual } : null
})
const escolhendoCambio = ref<string | null>(null)
const erroEscolhaCambio = ref('')
async function escolherCambio(codigo: string) {
  if (escolhendoCambio.value) return
  escolhendoCambio.value = codigo
  erroEscolhaCambio.value = ''
  try {
    await $fetch('/api/premium/fipe-escolha', { method: 'POST', body: { token, codigo } })
    await refresh()
  } catch {
    erroEscolhaCambio.value = 'Não foi possível atualizar agora. Tente de novo em instantes.'
  } finally {
    escolhendoCambio.value = null
  }
}
// Codigo FIPE da versao que deu o valor (shared/codigo-fipe.ts).
const codigoFipe = computed(() => codigoFipeDoRelatorio(vc.value))
// FIPE nao localizada: a fonte veio sem FIPE e nenhuma versao bateu com
// confianca (vc.fipeNaoLocalizado), ou relatorio entregue sem valorCusto
// nenhum (antigos, antes do fallback). A secao aparece com a linha dizendo
// isso, em vez de sumir.
const fipeNaoLocalizada = computed(() => entregue.value && !String(token).startsWith('_amostra') && !fipeIncerta.value && !vc.value?.fipe
  && (!vc.value || !!vc.value.fipeNaoLocalizado))
const temValor = computed(() => Boolean(vc.value?.fipe || vc.value?.seguroAnual || vc.value?.custo5anos || fipeIncerta.value || fipeNaoLocalizada.value))
// Custo de ter este carro em 12 meses (Relatorio 2.0, item 9): estimativa,
// um numero por mes (shared/custo-12-meses.ts). So carro, so com FIPE segura.
const custo12 = computed(() => {
  if (segmento.value !== 'carro' || fipeIncerta.value) return null
  const fipeNum = Number(String(vc.value?.fipe || '').replace(/[^\d,]/g, '').replace(',', '.'))
  const uf = String(g('ufJurisdicao') || '').toUpperCase()
  if (!/^[A-Z]{2}$/.test(uf)) return null
  const comb = combustivelPraConta({
    codigo: g('codigoCombustivel'), cilindradaCc: g('cilindrada'),
    utilitario: /CAMIONETA|CAMINHONETE|UTILITARIO/i.test(String(g('descricaoTipoVeiculo') || '')),
    precos: PRECO_COMBUSTIVEL_UF[uf],
  })
  return custo12Meses({
    valorFipe: Number.isFinite(fipeNum) ? fipeNum : null,
    uf,
    aliquotaIpva: aliquotaIPVA(uf),
    taxaLicenciamento: licenciamentoDaUf(uf)?.valor ?? null,
    licenciamentoOficial: licenciamentoDaUf(uf)?.oficial ?? false,
    seguroAnual: vc.value?.seguroAnual ?? null,
    // variacao REAL de 12 meses (quedaAno e da serie inteira)
    quedaAnoPct: variacaoFipe(vc.value?.historico, 12)?.pct ?? null,
    consumoKmL: comb?.consumoKmL ?? null,
    precoLitro: comb?.precoLitro ?? null,
    motorConsumo: comb?.motor ?? null,
    combustivel: comb?.combustivel ?? null,
    flex: comb?.flex ?? false,
    kmAno: KM_ANO_PADRAO,
  })
})
const fonteCusto12 = `Consumo: média de mercado para a cilindrada, não do modelo exato. Combustível: preço médio da ANP na UF (semana ${SEMANA_ANP}). Licenciamento: taxa 2026 da UF quando conferida no DETRAN ou na Fazenda; nas demais, valor de referência.`

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

// O grafico do historico vive em components/GraficoValor.vue (ECharts, SVG).
// So resta decidir aqui SE ha o que mostrar.
const temGrafico = computed(() => (vc.value?.historico?.length ?? 0) > 1)
// 13a: variacao em 12 e 24 meses + grafico recortado em 24 meses por padrao.
const variacao12 = computed(() => variacaoFipe(vc.value?.historico, 12))
const variacao24 = computed(() => variacaoFipe(vc.value?.historico, 24))
const graficoCompleto = ref(false)
const historicoGrafico = computed(() => {
  const h = vc.value?.historico || []
  if (graficoCompleto.value || h.length < 2) return h
  const fim = mesDoRotulo(h[h.length - 1].label)
  if (fim == null) return h
  const recorte = h.filter((p: any) => { const m = mesDoRotulo(p.label); return m != null && m >= fim - 24 })
  return recorte.length > 1 ? recorte : h
})
const graficoTemMais = computed(() => (vc.value?.historico?.length ?? 0) > historicoGrafico.value.length || graficoCompleto.value)
function fraseVariacao(v: { delta: number; pct: number; meses: number }): string {
  if (v.delta === 0) return `ficou estável em ${v.meses} meses`
  const quanto = `${brl(Math.abs(v.delta))} (${Math.abs(v.pct).toLocaleString('pt-BR')}%)`
  return v.delta < 0 ? `perdeu ${quanto} em ${v.meses} meses` : `valorizou ${quanto} em ${v.meses} meses`
}
// Serie que comeca muito depois do lancamento do ano-modelo: avisa em vez de
// parecer completa (shared/historico-fipe.ts).
const historicoDesde = computed(() => inicioTardioDoHistorico(vc.value?.historico, g('anoModelo')))

// ---------- ficha ----------
const linha = (rot: string, val: any) => (val === null || val === undefined || val === '' ? null : [rot, String(val)])


// Ocorrencias de roubo e furto: quando o indicador acende, ISTO e o detalhe
// que interessa — data, tipo e como o veiculo estava registrado na ocorrencia.
// So a completa recebe o objeto (whitelist).
const ocorrencias = computed(() => {
  const bloco: any = g('ocorrenciasRouboFurto')
  const lista = bloco && typeof bloco === 'object' ? bloco.ocorrencias : null
  if (!Array.isArray(lista)) return []
  return lista.map((o: any) => ({
    // Data pura: formata em UTC (ver comentario em licEmissao acima). O
    // 'T12:00:00' que existia aqui era uma tentativa de contornar o mesmo bug
    // por outro caminho (ancorar ao meio-dia pra sobreviver ao offset) — com
    // timeZone:'UTC' explicito ele fica desnecessario, a data crua ja basta.
    data: (() => {
      const d = new Date(String(o?.dataOcorrencia || ''))
      return Number.isNaN(d.getTime()) ? String(o?.dataOcorrencia || '') : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    })(),
    tipo: humanizar(o?.tipoOcorrenciaDeclaracao || o?.categoriaOcorrencia || 'Ocorrência'),
    categoria: humanizar(o?.categoriaOcorrencia),
    registro: [
      humanizar(o?.nomeMarcaModeloNoRegistroOcorrencia),
      humanizar(o?.nomeCorNoRegistroOcorrencia),
      o?.ufJurisdicaoNoRegistroOcorrencia,
    ].filter(Boolean).join(' · '),
  }))
})

// Os mesmos registros contados como HISTORIA: roubo, recuperacao e devolucao
// de um mesmo episodio viram um cartao so, com o desfecho no cabecalho. Tres
// cartoes vermelhos em sequencia faziam um caso encerrado em seis dias parecer
// tres problemas abertos.
const ETAPA_ROTULO: Record<EtapaEpisodio, string> = {
  ROUBO: 'Roubo', RECUPERACAO: 'Recuperação', DEVOLUCAO: 'Devolução',
}
const ORDEM_ETAPAS: EtapaEpisodio[] = ['ROUBO', 'RECUPERACAO', 'DEVOLUCAO']

const episodiosRoubo = computed(() => {
  const bloco: any = g('ocorrenciasRouboFurto')
  const lista = bloco && typeof bloco === 'object' ? bloco.ocorrencias : null
  return agruparEpisodios(lista).map((ep) => {
    const porEtapa = new Map(ep.registros.map((r) => [r.etapa, r]))
    // A tabela mostra sempre as tres etapas: "Sem registro" em vermelho na
    // linha que falta e o que diz que o caso esta em aberto.
    const linhas = ORDEM_ETAPAS.map((etapa) => {
      const r = porEtapa.get(etapa)
      return {
        etapa,
        rotulo: ETAPA_ROTULO[etapa],
        data: r ? dataBR(r.data) || r.data : null,
        // UF fica crua: humanizar transformaria "MG" em "Mg".
        detalhe: r ? [humanizar(r.marcaModelo), humanizar(r.cor), r.uf].filter(Boolean).join(', ') : '',
      }
    })
    const primeira = ep.registros[0]
    const titulo = ep.encerrado
      ? 'Episódio encerrado'
      : ep.etapaInicial === 'ROUBO'
        ? `${ep.tipoInicial === 'FURTO' ? 'Furto' : 'Roubo'} em aberto`
        : `${ETAPA_ROTULO[ep.etapaInicial]} sem registro de roubo`
    const sub = ep.encerrado
      ? (ep.duracaoDias === null
          ? 'Roubo, recuperação e devolução registrados'
          : `Roubo, recuperação e devolução em ${plural(ep.duracaoDias)}`)
      : 'Sem recuperação nem devolução registradas'
    return {
      encerrado: ep.encerrado,
      titulo,
      sub,
      tag: ep.encerrado ? 'Resolvido' : 'Pendente',
      linhas,
      chave: `${ep.etapaInicial}-${primeira?.data || 'sem-data'}`,
    }
  })
})

// Recall pendente: o indicador diz que existe, e o detalhe (montadora,
// campanha, componente) vem do portal publico, buscado na entrega. Enquanto
// ele nao chega, a secao mostra que a busca esta em andamento em vez de
// deixar a pessoa com a palavra "pendente" e nada mais.
const recallPendente = computed(() => g('indicadorRecall') === true)
const recallDetalhe = computed(() => {
  const r: any = data.value?.recall
  return r && r.status === 'ok' && Array.isArray(r.campanhas) && r.campanhas.length ? r : null
})
const recallCampanhas = computed(() => (recallDetalhe.value?.campanhas || []).map((c: any) => ({
  montadora: humanizar(c?.montadora) || null,
  campanha: c?.campanha || null,
  componente: humanizar(c?.componente) || null,
  descricao: c?.descricao || null,
  data_inicio: c?.data_inicio || null,
  situacao: humanizar(c?.situacao) || null,
})))
const RECALL_ORIENTACAO = 'O reparo é gratuito na concessionária da marca. Peça ao vendedor o comprovante do atendimento antes de fechar negócio.'
// Legenda "Campanha <id> · registrada em <data>" de uma campanha.
function legendaCampanha(c: any): string {
  const partes: string[] = []
  if (c?.campanha) partes.push(`Campanha ${c.campanha}`)
  if (c?.data_inicio) partes.push(`registrada em ${c.data_inicio}`)
  return partes.join(' · ')
}
// Subtitulo do cabecalho: a legenda da campanha quando ha uma so; senao o total.
const recallSubtitulo = computed(() => {
  const lista = recallCampanhas.value
  if (lista.length === 1) return legendaCampanha(lista[0])
  if (lista.length > 1) return `${lista.length} campanhas pendentes`
  return ''
})

// Modo AUTORITATIVO GM (Chevrolet + chassi cheio): a fonte da GM diz SE o recall
// esta aberto pra ESTE chassi e QUAIS campanhas. Quando vem (consultado), e a
// verdade; quando nao vem, o card cai no recall SENATRAN/local de cima.
const recallAutoritativo = computed(() => {
  const a: any = data.value?.recallAutoritativo
  return a && a.consultado === true ? a : null
})
const recallAbertoGM = computed(() => recallAutoritativo.value?.tem_recall_aberto === true)
const recallEua = computed<RecallEuaTela | null>(() => (data.value as any)?.recallEua ?? null)
const recallCampanhasGM = computed(() => (recallAutoritativo.value?.campanhas || []).filter((c: any) => c?.titulo || c?.descricao))

// Recall da MONTADORA por chassi (Nissan, Mitsubishi): todo veiculo da marca
// com chassi cheio, com ou sem a flag do SENATRAN. O status vem da propria
// montadora (aberto/realizado), com data, concessionaria e km do atendimento.
// Com campanha listada, e a verdade e substitui o card do SENATRAN; sem
// campanha, o card do SENATRAN segue como sempre.
const NOME_MONTADORA: Record<string, string> = { nissan: 'Nissan', mitsubishi: 'Mitsubishi', 'mercedes-benz': 'Mercedes-Benz' }
const recallMontadora = computed(() => {
  const n: any = data.value?.recallMontadora
  return n && n.consultado === true && Array.isArray(n.campanhas) && n.campanhas.length ? n : null
})
const nomeMontadora = computed(() => NOME_MONTADORA[String(recallMontadora.value?.fonte || '')] || 'montadora')
const campanhasAbertas = computed(() => (recallMontadora.value?.campanhas || []).filter((c: any) => c.status === 'aberto'))
const campanhasRealizadas = computed(() => {
  const m: any = recallMontadora.value
  if (!m) return []
  const atend: any[] = Array.isArray(m.atendimentos) ? m.atendimentos : []
  return m.campanhas.filter((c: any) => c.status !== 'aberto').map((c: any) => ({
    ...c,
    // Casa pelo codigo; sem codigo (Mercedes manda null), pelo titulo.
    atendimento: atend.find((a: any) => (a.codigo && a.codigo === c.codigo) || (!c.codigo && a.titulo && a.titulo === c.titulo)) || null,
  }))
})
// "Campanha X · realizada em DD/MM/AAAA na concessionaria Y, com N km". Sem
// codigo (Mercedes), comeca direto em "Realizada em...".
function metaCampanhaRealizada(c: any): string {
  const partes: string[] = []
  if (c.codigo) partes.push(`Campanha ${c.codigo}`)
  if (c.status === 'excluido') {
    partes.push(`veículo excluído da campanha pela ${nomeMontadora.value}`)
  } else if (c.atendimento) {
    const a = c.atendimento
    let t = a.data ? `realizada em ${dataBr(a.data)}` : 'realizada'
    if (a.concessionaria) t += ` na concessionária ${a.concessionaria}`
    if (a.km != null) t += `, com ${Number(a.km).toLocaleString('pt-BR')} km`
    partes.push(t)
  }
  const txt = partes.join(' · ')
  return txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : ''
}
// Hook de recall positivo na consulta gratis e nada pendente hoje: o relatorio
// diz QUAL campanha estava associada (shared/recall-associado.ts).
const cardAssociado = computed(() => cardRecallAssociado({
  sinal: data.value?.recallSinal,
  base: data.value?.recallBase,
  pendente: recallPendente.value || recallAbertoGM.value || campanhasAbertas.value.length > 0,
  montadoraComCampanhas: !!recallMontadora.value,
}))
const marcaComConsultaMontadora = computed(() =>
  /\b(nissan|mmc|mitsubishi|m\.?\s*benz|mercedes)\b/i.test(String(g('descricaoMarcaModelo') || '')) && String(g('chassi') || '').trim().length === 17,
)
function dataBr(iso?: string | null): string {
  const m = String(iso || '').match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

// Débitos e restrições no órgão de trânsito do estado (SP hoje). O indicador de
// multa diz que EXISTE; o valor e o detalhe vêm de uma busca solta na entrega,
// igual ao recall. A fonte não é citada pro cliente: é "o órgão de trânsito do
// estado". Só faz sentido pra veículo de SP com multa em aberto.
const multaIndicadorSP = computed(
  () => g('indicadorMultaRenainf') === true && String(g('ufJurisdicao') || '').toUpperCase() === 'SP',
)
// Veiculo registrado em SP, SC ou MG: a consulta DETRAN (Infosimples) roda pra TODO pedido
// dessas UFs (multas, hodometro, IPVA, licenciamento), nao so quando o RENAINF acende.
// Por isso o bloco e o poll acompanham qualquer veiculo de SP, nao so multa.
// Mesmo gate do servidor (DETRAN_UFS.gate): desde 13/out TODAS as UFs do mapa sao
// consultadas sempre, com ou sem multa RENAINF (decisao do Cesar). UF fora da
// lista nunca e consultada: sem isso o bloco ficava em "Consultando..." pra sempre.
const UFS_COM_DETRAN = ['SP', 'SC', 'MG', 'BA', 'RS', 'GO', 'PR', 'DF', 'CE', 'PA', 'AM', 'PE', 'ES', 'MA', 'AC', 'AL', 'PI', 'RR', 'RO', 'RN']
const ehVeiculoSpTela = computed(() => UFS_COM_DETRAN.includes(String(g('ufJurisdicao') || '').toUpperCase()))
const ufDetranTela = computed(() => String(g('ufJurisdicao') || '').toUpperCase())
const multasDetalhe = computed(() => {
  const m: any = data.value?.multas
  return m && (m.status === 'ok' || m.status === 'sem_debito') ? m : null
})
// Consulta do DETRAN nao rodou (credencial ausente/travada no servidor): sem
// isso o bloco ficava em "Consultando..." pra sempre.
// 'protegido' (proprietario bloqueou a consulta no DETRAN, code 620) tambem e
// final: entra junto em todo lugar que encerra a espera.
const multasProtegido = computed(() => (data.value?.multas as any)?.status === 'protegido')
const multasIndisponivel = computed(() => (data.value?.multas as any)?.status === 'indisponivel' || multasProtegido.value)
const ufMultasProtegido = computed(() => String((data.value?.multas as any)?.uf || ufDetranTela.value || '').toUpperCase())

// Ordem do Cesar (30/set): com multa no SENATRAN (RENAINF, ou SP que consulta
// sempre) o loading ESPERA a consulta ao DETRAN antes de abrir o relatorio. O
// servidor grava o bloco (ok) ou 'indisponivel' (erro, sem credencial); a tela
// solta assim que um dos dois chega. Limite: 150s desde a entrega (a chamada
// ao Infosimples pode levar minutos; depois disso o relatorio abre e o bloco de
// multas segue acompanhando, ver multasSemResposta) e, pra quem acabou de pagar, nunca menos de
// 60s desde que a tela viu a entrega (protege de relogio adiantado). Passou
// disso, abre o relatorio com "indisponivel" no bloco de multas.
const LIMITE_DETRAN_MS = 150 * 1000
const MIN_ESPERA_DETRAN_MS = 60 * 1000
const agoraMs = ref(Date.now())
const vistoEntregueEm = ref<number | null>(null)
// Relatorio 2.0: o servidor manda o estado de cada fonte lenta e ate quando
// a tela espera (entrega + 5 min). Com isso a espera vale pra TODAS as fontes
// (DETRAN, SEFAZ, recall, montadora, RENAJUD), com o progresso por fonte.
const fontesRel = computed<{ fonte: string; rotulo: string; estado: string }[] | null>(() => Array.isArray((data.value as any)?.fontes) ? (data.value as any).fontes : null)
const fonteDetran = computed(() => fontesRel.value?.find((f) => f.fonte === 'detran') || null)
const prazoDetran = computed<number | null>(() => {
  if (fontesRel.value) {
    if (!entregue.value || !fontesRel.value.length) return null
    const ate = new Date((data.value as any)?.aguardarAte || '').getTime()
    if (!Number.isFinite(ate)) return null
    const visto = vistoEntregueEm.value ?? agoraMs.value
    const ent = new Date(data.value?.entregue_em || '').getTime()
    // Entrega recente (10 min): garante o minimo de 60s de espera na tela.
    return Number.isFinite(ent) && visto - ent < 10 * 60 * 1000 ? Math.max(ate, Math.min(visto + MIN_ESPERA_DETRAN_MS, ent + 10 * 60 * 1000)) : ate
  }
  if (!entregue.value || !ehVeiculoSpTela.value) return null
  const visto = vistoEntregueEm.value ?? agoraMs.value
  const ent = new Date(data.value?.entregue_em || '').getTime()
  if (!Number.isFinite(ent)) return visto + LIMITE_DETRAN_MS
  let prazo = ent + LIMITE_DETRAN_MS
  // Entrega recente (10 min): garante o minimo de 60s de espera na tela.
  if (visto - ent < 10 * 60 * 1000) prazo = Math.max(prazo, Math.min(visto + MIN_ESPERA_DETRAN_MS, ent + 10 * 60 * 1000))
  return prazo
})
// Relatorio entregue na tela (o ramo final do template): so ai a escala de
// fonte do laudo sobe ~10% (--rel-fs). Pix pendente, cartao, carregando e
// erro ficam no tamanho de sempre.
const mostrandoLaudo = computed(() => !!data.value && !error.value && entregue.value && !aguardandoDetran.value)
const aguardandoDetran = computed(() => {
  if (prazoDetran.value == null || agoraMs.value >= prazoDetran.value) return false
  if (fontesRel.value) return fontesRel.value.some((f) => f.estado === 'consultando')
  return !multasDetalhe.value && !multasIndisponivel.value
})
// Passou do limite da tela de espera sem bloco: o relatorio abre, mas o bloco
// de multas segue "Consultando o DETRAN-XX" e a tela continua acompanhando
// (pollMultas) ate o servidor gravar o status final. "Indisponivel" SO quando o
// backend gravar (incidente 01-03/out: a consulta da Infosimples pode levar
// minutos, com 1 retry, e a tela dizia indisponivel antes da resposta).
const multasSemResposta = computed(() => prazoDetran.value != null && !multasDetalhe.value && !multasIndisponivel.value && !aguardandoDetran.value)
// Acompanhamento ate 12 min da entrega (300 s + retry + 330 s no pior caso).
const LIMITE_ACOMPANHAR_MS = 12 * 60 * 1000
const acompanhamentoEsgotado = ref(false)
// Relatorio antigo (entregue ha mais de 30 min) sem bloco nem status: a consulta
// nao vai mais chegar; vale o texto de indisponivel de sempre.
const multasSemRespostaAntigo = computed(() => {
  const ent = new Date(data.value?.entregue_em || '').getTime()
  return multasSemResposta.value && Number.isFinite(ent) && Date.now() - ent > 30 * 60 * 1000
})
// Sem multa RENAINF, DETRAN que falhou some do relatorio (falha silenciosa).
const multasFalhaSilenciosa = computed(() => fonteDetran.value?.estado !== 'chegando' && esconderMultasQueFalharam({
  renainf: g('indicadorMultaRenainf'),
  status: (data.value?.multas as any)?.status ?? null,
  semRespostaAntigo: multasSemRespostaAntigo.value,
}))
let tickDetran: any = null
let pollDetran: any = null
function pararEsperaDetran() {
  if (tickDetran) { clearInterval(tickDetran); tickDetran = null }
  if (pollDetran) { clearInterval(pollDetran); pollDetran = null }
}
onMounted(() => {
  watch(aguardandoDetran, (esperando) => {
    if (!esperando) { pararEsperaDetran(); return }
    if (vistoEntregueEm.value == null) vistoEntregueEm.value = Date.now()
    if (!tickDetran) tickDetran = setInterval(() => { agoraMs.value = Date.now() }, 1000)
    if (!pollDetran) {
      pollDetran = setInterval(async () => {
        try { await refresh() } catch { /* rede oscilou; a proxima volta tenta */ }
      }, 3000)
    }
  }, { immediate: true })
})
function reais(centavos?: number | null): string | null {
  if (centavos == null) return null
  // Com separador de milhar: "R$ 2.970,56", nao "R$ 2970,56".
  return `R$ ${(centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
// Total "Para regularizar" = multas + licenciamento + IPVA em aberto. null quando nao ha nada a pagar (nao mostra o total).
// Sem bloco estadual (indisponivel/protegido): status pela base nacional.
// Com bloco, a caixa "Para transferir" ja diz tudo (feedback do Cesar, 14/out).
const statusNacional = computed(() => statusBaseNacional({ renainf: g('indicadorMultaRenainf'), licAno: licAno.value }))
// RENAINF aceso e DETRAN sem multa: texto aprovado (multa de fora do estado).
const textoRenainfFora = computed(() => ufRenainfFora.value ? textoMultasRenainfForaDoDetran(ufRenainfFora.value) : null)
// IPVA em aberto discriminado: itens do DETRAN (ipva_itens) + SEFAZ (ipva_sefaz,
// GO), um por exercicio, mais novo primeiro, com o total.
const ipvaLista = computed(() => {
  const m: any = multasDetalhe.value
  const det = Array.isArray(m?.ipva_itens) ? m.ipva_itens.map((x: any) => ({ ...x, sefaz: false })) : []
  const sef = Array.isArray(m?.ipva_sefaz) ? m.ipva_sefaz.map((x: any) => ({ ...x, sefaz: true })) : []
  const itens = [...det, ...sef]
    .filter((x: any) => Number(x?.valor_centavos) > 0)
    .sort((a: any, b: any) => (Number(b.ano) || 0) - (Number(a.ano) || 0))
  return {
    itens,
    total: itens.reduce((acc: number, x: any) => acc + Number(x.valor_centavos), 0),
    temSefaz: itens.some((x: any) => x.sefaz),
  }
})
// Extrato de quilometragem: cada leitura com o quanto rodou desde a anterior
// (primeira linha "-"). `caiu` marca uma leitura menor que a anterior.
// Leituras de km de todas as fontes: DETRAN (vistorias) + atendimentos de
// recall da montadora que trazem km (Mitsubishi), em ordem de data.
const kmLeituras = computed(() => {
  const det = (Array.isArray(multasDetalhe.value?.hodometro) ? multasDetalhe.value!.hodometro : [])
    .map((h: any) => ({ data: h?.data ?? null, km: Number(h?.km), fonte: 'DETRAN' }))
  const m: any = data.value?.recallMontadora
  const mont = (m?.consultado && Array.isArray(m.atendimentos) ? m.atendimentos : [])
    .filter((a: any) => a?.km != null && Number.isFinite(Number(a.km)) && a?.data)
    .map((a: any) => ({ data: a.data, km: Number(a.km), fonte: `${NOME_MONTADORA[String(m.fonte)] || 'Montadora'} (recall)` }))
  if (!mont.length) return det
  return [...det, ...mont].sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')))
})
const kmComMontadora = computed(() => kmLeituras.value.some((l: any) => l.fonte !== 'DETRAN'))
const hodometroSuspeito = computed(() => !!multasDetalhe.value?.hodometro_suspeito || hodometroExtrato.value.some((h) => h.caiu))
// Alerta (km caiu) ou orientacao com a ultima leitura: shared/hodometro-texto.ts.
const fraseHodometro = computed(() => textoHodometro({ suspeito: hodometroSuspeito.value, extrato: hodometroExtrato.value }))
// Caixa "Para transferir" e procedencia/data dos subblocos (shared/detran-quitar.ts).
const resumoDetran = computed(() => multasDetalhe.value ? resumoQuitar({
  bloco: multasDetalhe.value as any,
  ufVeiculo: ufDetranTela.value,
  restricoesNacionais: itensQueRestringem(v.value?.restricoesItens),
  indicadorRouboFurto: g('indicadorRouboFurto') === true,
}) : null)
const procDebitos = computed(() => {
  const estado = multasDetalhe.value ? 'ok' : multasProtegido.value ? 'protegido' : multasIndisponivel.value ? 'indisponivel' : null
  if (!estado) return null
  return procedenciaDebitos({ uf: ufDoBlocoDetran(data.value?.multas as any, ufDetranTela.value), consultadoEm: (data.value?.multas as any)?.consultadoEm || (data.value as any)?.detranConsultadoEm, estado })
})
const procKm = computed(() => {
  const ext = hodometroExtrato.value
  if (!ext.length) return null
  return procedenciaKm({ uf: ufDoBlocoDetran(data.value?.multas as any, ufDetranTela.value), fontes: ext.map((h) => h.fonte), ultimaData: ext[ext.length - 1].data })
})
// Linha do tempo unica (shared/linha-do-tempo.ts): fabricacao, leiloes,
// roubo/recuperacao, recalls com km, hodometro, licenciamento e multas por ano.
// Leiloes na linha do tempo: com a linha_do_tempo da leiloes-api (Relatorio
// 2.0), um evento por leilao (fontes e praças juntas) e o intervalo da
// recorrencia; os "possiveis" seguem vindo das passagens (a API so agrupa
// confirmado/provavel). Snapshot antigo: uma linha por passagem, como antes.
function leiloesDaLinhaDoTempo(passagens: any[]) {
  const api = historicoLeilao.value?.linha_do_tempo
  if (!Array.isArray(api) || !api.length) {
    return passagens.map((p: any) => ({
      data: p.data_leilao || null,
      titulo: fonteExibicaoLeilao(p),
      detalhe: [p.ref ? `Edital ${p.ref}` : null, p.lote ? `Lote ${p.lote}` : null].filter(Boolean).join(' · '),
      notificacao: ehNotificacao(p),
      confirmado: p.nivel === 'confirmado',
    }))
  }
  const intervalos: number[] = historicoLeilao.value?.recorrencia?.intervalosMeses || []
  let nLeilao = 0
  const eventos = api.map((e: any) => {
    const ehLeilao = e.tipo !== 'notificado'
    const intervalo = ehLeilao && nLeilao > 0 && intervalos[nLeilao - 1] != null ? textoIntervalo(intervalos[nLeilao - 1]) : null
    if (ehLeilao) nLeilao++
    const fim = e.dataFim && e.dataFim !== e.data ? `até ${dataBRIso(e.dataFim)}` : null
    return {
      data: e.data,
      titulo: (e.fontes || []).join(', '),
      detalhe: [fim, e.nPassagens > 1 ? `${e.nPassagens} registros` : null].filter(Boolean).join(' · '),
      notificacao: e.tipo === 'notificado',
      judicial: e.tipo === 'leilao_judicial',
      confirmado: true,
      intervalo,
    }
  })
  const possiveis = passagens.filter((p: any) => p.nivel === 'possivel' && !ehNotificacao(p)).map((p: any) => ({
    data: p.data_leilao || null,
    titulo: fonteExibicaoLeilao(p),
    detalhe: p.lote ? `Lote ${p.lote}` : '',
    confirmado: false,
  }))
  return [...eventos, ...possiveis]
}

const linhaDoTempo = computed(() => {
  const blocoRoubo: any = g('ocorrenciasRouboFurto')
  const eps = agruparEpisodios(blocoRoubo && typeof blocoRoubo === 'object' ? blocoRoubo.ocorrencias : null)
  const passagens: any[] = Array.isArray(historicoLeilao.value?.passagens) ? historicoLeilao.value.passagens : []
  const lic: any = g('ultimoLicenciamento')
  const hist = !fipeIncerta.value ? vc.value?.historico : null
  return montarLinhaDoTempo({
    fipeNaData: (iso) => fipeNoMes(hist, iso)?.price ?? null,
    anoFabricacao: g('anoFabricacao') as any,
    anoModelo: g('anoModelo') as any,
    leiloes: leiloesDaLinhaDoTempo(passagens),
    roubo: eps.flatMap((ep) => ep.registros.map((r) => ({ etapa: r.etapa, data: r.data, tipo: ep.tipoInicial }))),
    recallsAtendidos: campanhasRealizadas.value.filter((c: any) => c.atendimento?.data).map((c: any) => ({ data: c.atendimento.data, titulo: c.titulo, km: c.atendimento.km })),
    recallsAbertos: recallCampanhas.value.filter((c: any) => c.data_inicio).map((c: any) => ({ data: c.data_inicio, titulo: c.componente || c.campanha })),
    hodometro: kmLeituras.value.map((h: any) => ({ data: h?.data ?? null, km: Number(h?.km) })),
    licenciamento: lic && typeof lic === 'object' && lic.anoLicenciamento ? { ano: lic.anoLicenciamento, emissao: lic.dataHoraEmissao || null } : null,
    multas: (multasDetalhe.value?.multas_itens || []).map((m: any) => ({ data: m.dataInfracao, valorCentavos: Math.round((Number(m.valor) || 0) * 100) })),
  })
})

const hodometroExtrato = computed(() => {
  const lista = kmLeituras.value
  return lista.map((h: any, i: number) => {
    const km = Number(h?.km)
    const prev = i > 0 ? Number(lista[i - 1]?.km) : null
    const delta = prev == null || !Number.isFinite(prev) ? null : km - prev
    return {
      data: formatarDataBR(h?.data),
      km: Number.isFinite(km) ? km.toLocaleString('pt-BR') : '-',
      rodou: delta == null ? '-' : `${delta >= 0 ? '+' : ''}${delta.toLocaleString('pt-BR')}`,
      caiu: delta != null && delta < 0,
      fonte: h?.fonte || 'DETRAN',
    }
  })
})
// Rotulo humano do tipo de restricao do DETRAN.
function rotuloRestricao(tipo?: string | null): string {
  const map: Record<string, string> = {
    financeira: 'Financeira', judiciaria: 'Judiciária',
    administrativa: 'Administrativa', tributaria: 'Tributária', furto: 'Furto/roubo',
    sng: 'Gravame (SNG)', situacao: 'Situação', divida_ativa: 'Dívida ativa', recuperado: 'Veículo recuperado',
    outros_debitos: 'Outros débitos', licenciamento_notificado: 'Licenciamento notificado', cadastro: 'Cadastro', clonagem: 'Clonagem',
  }
  return map[String(tipo || '')] || 'Restrição'
}

// dd/mm/aaaa a partir de ISO (YYYY-MM-DD), sem depender de timezone.
function formatarDataBR(iso?: string | null): string {
  const s = String(iso || '')
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s
}

// Historico existe, mas sem nada pendente: o resumo para de acender vermelho e
// passa a dizer o que de fato aconteceu.
const rouboTudoEncerrado = computed(() => {
  const bloco: any = g('ocorrenciasRouboFurto')
  const lista = bloco && typeof bloco === 'object' ? bloco.ocorrencias : null
  return tudoEncerrado(agruparEpisodios(lista))
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
  linha('Procedência', humanizar(g('procedencia'))),
  linha('Situação', humanizar(g('situacao'))),
  linha('UF da jurisdição', g('ufJurisdicao')),
  linha('Município', humanizar(g('municipio'))),
  // "Primeiro emplacamento" (municipio da wdapi, via preview do pedido) foi
  // removido: o Cesar constatou que o dado vem inconsistente (as vezes e o
  // 1o emplacamento de fato, as vezes reflete a situacao atual, sem como
  // diferenciar so pelo payload). O 'Município' acima (SENATRAN) e confiavel
  // e fica. Sem fonte confiavel = sem exibir (mesmo criterio do vin-decoder).
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

// Importacao: SO pra veiculo estrangeiro (procedencia === 'ESTRANGEIRO').
// `importacao` vem com campos zerados/vazios pra veiculo nacional (o
// comentario de camposRestantes() em shared/planos.ts ja nota isso — "quatro
// zeros"), entao alem do gate por procedencia cada campo tambem descarta
// "0"/vazio individualmente, senao a linha aparece com um zero sem sentido.
// Data pura (declaracao de importacao): mesmo motivo do timeZone:'UTC' em
// licEmissao/ocorrencias acima — sem isto, "2012-04-20" pode virar 19/04
// pro fuso de Brasilia, e SSR/client podem divergir (hydration mismatch).
const dataBR = (iso: any) => {
  if (!iso) return null
  const dt = new Date(String(iso))
  return Number.isNaN(dt.getTime()) ? null : dt.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}
const linhaImportacao = (rot: string, val: any) => {
  if (val === null || val === undefined || val === '') return null
  const s = String(val)
  if (s === '0' || s === '00000000000') return null
  return [rot, s]
}
const fichaImportacao = computed(() => {
  if (String(g('procedencia') || '').toUpperCase() !== 'ESTRANGEIRO') return []
  const imp = g('importacao') as any
  if (!imp || typeof imp !== 'object') return []
  return [
    linhaImportacao('Data da declaração', dataBR(imp.dataDeclaracaoImportacao)),
    linhaImportacao('Nº da declaração de importação', imp.numeroDeclaracaoImportacao),
    linhaImportacao('Órgão de despacho (Receita/SRF)', imp.codigoOrgaoSrf),
    linhaImportacao('Nº do processo de importação', imp.numeroProcessoImportacao),
    linhaImportacao('Nº do registro de despacho aduaneiro', imp.numeroRegistroDespachoAduaneira),
  ].filter(Boolean) as [string, string][]
})

// Origem do chassi: decode de VIN (services/vin-decoder), so completa. O
// server ja faz o gate por plano (nunca monta chassiOrigem pra basica) — aqui
// e so questao de ter o dado ou nao (fail-open: servico fora, campo vem
// null, secao inteira some). Cada linha omite campo null individualmente
// (ex: planta e frequentemente desconhecida).
// Pais/fabricante do vin-decoder: overrides curados (nossos) ja vem bem
// formatados ("Volkswagen do Brasil", "Brasil"); o que sobra do vPIC cru
// (WMI nao curado) vem GRITANDO em ingles ("MEXICO"). Traduz os paises mais
// comuns; title-case so entra se a string estiver TODA em maiuscula (senao
// "Volkswagen do Brasil" virava "Volkswagen Do Brasil" — capitaliza
// conectivo errado).
const PAISES_PT: Record<string, string> = {
  MEXICO: 'México', GERMANY: 'Alemanha', JAPAN: 'Japão',
  'UNITED STATES': 'Estados Unidos', 'UNITED STATES OF AMERICA': 'Estados Unidos', USA: 'Estados Unidos',
  'SOUTH KOREA': 'Coreia do Sul', KOREA: 'Coreia do Sul', ITALY: 'Itália', FRANCE: 'França',
  SPAIN: 'Espanha', BRAZIL: 'Brasil', ARGENTINA: 'Argentina', CHINA: 'China', CANADA: 'Canadá',
  'UNITED KINGDOM': 'Reino Unido', INDIA: 'Índia', SWEDEN: 'Suécia', 'CZECH REPUBLIC': 'República Tcheca',
  POLAND: 'Polônia', BELGIUM: 'Bélgica', THAILAND: 'Tailândia', AUSTRIA: 'Áustria',
  SLOVAKIA: 'Eslováquia', TURKEY: 'Turquia', PORTUGAL: 'Portugal', RUSSIA: 'Rússia',
  'SOUTH AFRICA': 'África do Sul',
  // Nomes do vPIC que ficavam em ingles (lista da tabela wmi do vin-decoder).
  'UNITED STATES (USA)': 'Estados Unidos', 'UNITED KINGDOM (UK)': 'Reino Unido', ENGLAND: 'Inglaterra',
  'HONG KONG': 'Hong Kong', TAIWAN: 'Taiwan', VIETNAM: 'Vietnã', AUSTRALIA: 'Austrália', DENMARK: 'Dinamarca',
  URUGUAY: 'Uruguai', NORWAY: 'Noruega', SWITZERLAND: 'Suíça', 'SAUDI ARABIA': 'Arábia Saudita',
  'PUERTO RICO': 'Porto Rico', 'NEW ZEALAND': 'Nova Zelândia', NETHERLANDS: 'Países Baixos', FINLAND: 'Finlândia',
  ESTONIA: 'Estônia', SLOVENIA: 'Eslovênia', SINGAPORE: 'Singapura', SERBIA: 'Sérvia', ROMANIA: 'Romênia',
  PHILIPPINES: 'Filipinas', 'NORTH MACEDONIA': 'Macedônia do Norte', LUXEMBOURG: 'Luxemburgo', ISRAEL: 'Israel',
  IRELAND: 'Irlanda', INDONESIA: 'Indonésia', HUNGARY: 'Hungria', COLOMBIA: 'Colômbia',
}
const CONECTIVOS_PT = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
function humanizarPaisFabricante(bruto: any, ehPais: boolean): string | null {
  if (!bruto) return null
  const s = String(bruto).trim()
  if (ehPais) {
    const traduzido = PAISES_PT[s.toUpperCase()]
    if (traduzido) return traduzido
  }
  const gritando = s === s.toUpperCase() && /[A-ZÀ-Ú]/.test(s)
  if (!gritando) return s
  return s.toLowerCase().split(' ').map((w, i) => (CONECTIVOS_PT.has(w) && i > 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ')
}
// Sem frase-resumo "Fabricado pela X em Y." (pedido do Cesar, 02/out): a
// ficha logo abaixo (Fabricante, Pais de fabricacao, Ano-modelo, Planta) ja
// diz tudo.

const fichaChassiOrigem = computed(() => {
  const co = data.value?.chassiOrigem
  if (!co) return []
  return [
    linha('Fabricante', humanizarPaisFabricante(co.fabricante, false)),
    linha('País de fabricação', humanizarPaisFabricante(co.pais, true)),
    linha('Ano-modelo (pelo chassi)', co.anoModelo),
    linha('Planta', co.plantaDetalhe?.cidade
      ? (co.plantaDetalhe.uf
          ? `${co.plantaDetalhe.cidade} (${co.plantaDetalhe.uf})`
          : ((humanizarPaisFabricante(co.plantaDetalhe.pais, true) || 'Brasil') !== 'Brasil'
              ? `${co.plantaDetalhe.cidade}, ${humanizarPaisFabricante(co.plantaDetalhe.pais, true)}`
              : co.plantaDetalhe.cidade))
      : co.planta),
  ].filter(Boolean) as [string, string][]
})

// Balanceamento das colunas da ficha: em vez de distribuicao FIXA
// (Cadastral+Importacao | Tecnica+Origem), calcula qual coluna cada bloco
// deve ir pra MINIMIZAR a diferenca de altura entre as duas — o numero de
// blocos e de linhas varia por relatorio (nem todo veiculo tem
// Importacao/Origem do chassi; o numero de linhas de cada tabela varia por
// plano/veiculo), entao a distribuicao ideal muda caso a caso.
//
// Peso de cada bloco = numero de linhas da tabela + 1.5 (constante pro
// titulo/label da subsecao — as linhas tem altura uniforme, entao isso
// aproxima bem a altura real sem medir pixel nenhum). Com no maximo 4
// blocos (Cadastral/Tecnica sempre + Importacao/Origem as vezes), forca
// bruta nas 2^n particoes e escolhe a que minimiza |somaEsq - somaDir| e'
// trivial (no maximo 16 combinacoes).
//
// Determinismo: deriva SO dos arrays de linha ja computados (fichaCadastral
// etc), nada de medir DOM/ResizeObserver — mesmo resultado no SSR e no
// client, sem risco de mismatch de hidratacao.
interface BlocoFicha { key: string; titulo: string; linhas: [string, string][]; nota?: string | null }
const fichaColunas = computed(() => {
  const candidatos: BlocoFicha[] = [
    { key: 'cadastral', titulo: 'Cadastral', linhas: fichaCadastral.value },
    { key: 'tecnica', titulo: 'Técnica', linhas: fichaTecnica.value },
    { key: 'importacao', titulo: 'Importação', linhas: fichaImportacao.value },
    { key: 'chassiOrigem', titulo: 'Origem do chassi', linhas: fichaChassiOrigem.value, nota: dadosDeBloco(data.value?.chassiOrigem) },
  ]
  const blocos = candidatos.filter((b) => b.linhas.length > 0)
  const pesos = blocos.map((b) => b.linhas.length + 1.5)
  const n = blocos.length
  const totalCombinacoes = 1 << n // no maximo 16 (n<=4)

  let melhorMask = 0
  let melhorDiff = Infinity
  for (let mask = 0; mask < totalCombinacoes; mask++) {
    let esq = 0
    let dir = 0
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) esq += pesos[i]
      else dir += pesos[i]
    }
    const diff = Math.abs(esq - dir)
    // Desempate: cadastral (indice 0, quando presente) na esquerda —
    // mask testado em ordem crescente, entao o primeiro empate encontrado
    // com cadastral do lado esquerdo (bit 0 ligado) ja fica, sem precisar
    // de logica extra: so troca de melhor quando estritamente MELHOR.
    if (diff < melhorDiff || (diff === melhorDiff && (mask & 1) && !(melhorMask & 1))) {
      melhorDiff = diff
      melhorMask = mask
    }
  }

  const esquerda: BlocoFicha[] = []
  const direita: BlocoFicha[] = []
  blocos.forEach((b, i) => {
    // Ordem de leitura preservada: itera na ordem original (nao na ordem do
    // bit), entao cada coluna sai com os blocos na sequencia natural
    // (Cadastral antes de Tecnica antes de Importacao antes de Origem),
    // so filtrados pra qual coluna o bit mandou.
    if (melhorMask & (1 << i)) esquerda.push(b)
    else direita.push(b)
  })
  return { esquerda, direita }
})

// ---------- retomada do Pix ----------
const valorPedido = computed(() => data.value?.valorCentavos ?? PLANOS[plano.value as 'basica' | 'completa']?.valorCentavos ?? 0)
const copiado = ref(false)

// QR da retomada, gerado AQUI a partir do copia-e-cola: o QR do Pix e apenas
// o br_code codificado. A versao anterior pedia a imagem ao provedor via
// /transparents/check, que devolve so {id, status, expiresAt} — o QR desta
// tela nunca chegou a aparecer. Local nao tem latencia externa nem esse limite.
const qr = ref<string | null>(null)
async function buscarQr() {
  const codigo = data.value?.brCode
  if (!codigo) { qr.value = null; return }
  try {
    const { renderSVG } = await import('uqr')
    qr.value = 'data:image/svg+xml;utf8,' + encodeURIComponent(renderSVG(codigo, { border: 2 }))
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

// Janela em que a abertura do relatorio ainda representa a compra que acabou
// de acontecer. Pedido sem data de entrega (ainda pagando) conta como recente:
// e exatamente o fluxo de quem esta na tela esperando o Pix cair.
const JANELA_CONVERSAO_MS = 6 * 60 * 60 * 1000
function entregaRecente(): boolean {
  const entregue = data.value?.entregue_em
  if (!entregue) return true
  const t = new Date(entregue).getTime()
  if (!Number.isFinite(t)) return true
  return Date.now() - t < JANELA_CONVERSAO_MS
}

onMounted(() => {
  histSync()
  const msg = `Fiz a consulta veicular no PlacaCompleta, olha o relatório: ${window.location.href}`
  compartilhar.value = `https://wa.me/?text=${encodeURIComponent(msg)}`
  if (data.value?.status === 'aguardando_pagamento' && data.value?.brCode && !ehCartao.value) buscarQr()
  if (!data.value) return
  const existe = itens.value.some((x) => x.token === token)
  if (existe) histUpdate(token, data.value.status)
  else histAdd({ token, placa: data.value.placa, veiculo: g('descricaoMarcaModelo') || null, status: data.value.status })
  // Na abertura, so conta conversao de relatorio RECEM entregue. O guard por
  // token vive no navegador, entao ele nao cobre a revisita em OUTRO aparelho
  // (paga no celular, abre o link do e-mail no computador semanas depois), e
  // cada abertura dessas virava um purchase novo pro GA4 e pro Ads. Uma
  // entrega tem minutos de vida, nao dias: fora dessa janela, a abertura e
  // leitura, nao compra. A transicao ao vivo (poll abaixo) segue reportando
  // sempre, que e o caminho de quem acabou de pagar.
  if (['pago', 'consultando', 'entregue'].includes(data.value.status) && entregaRecente()) {
    // Valor REAL do pedido (cupom incluido): com 0 (cupom 100%) nada dispara.
    trackConversionPaga(token, data.value.plano, data.value.valorCentavos ?? undefined)
  }
  if (data.value.status !== 'entregue') {
    // Polla o /status, que e leve e e quem detecta pagamento ate sem webhook.
    // A versao anterior chamava refresh() do relatorio INTEIRO a cada 4s: alem
    // do peso, o pending ligava e o template trocava a tela pelo "Carregando"
    // — era o flick periodico visto na tela do Pix.
    poll = setInterval(async () => {
      try {
        const r: any = await $fetch('/api/premium/status', { query: { token } })
        if (!r?.status || r.status === data.value?.status) return
        await refresh()          // o estado mudou de verdade: agora sim recarrega
        if (!ehCartao.value) await buscarQr()  // Pix: se veio br_code novo, o QR acompanha (cartao nunca tem QR)
        if (data.value) histUpdate(token, data.value.status)
        // conversao do Ads/GA4 (veio do outro lado do merge): dispara quando o
        // pagamento se confirma; a funcao e idempotente por token
        if (data.value && ['pago', 'consultando', 'entregue'].includes(data.value.status)) trackConversionPaga(token, data.value.plano, data.value.valorCentavos ?? undefined)
        if (data.value?.status === 'entregue') clearInterval(poll)
      } catch { /* rede oscilou; proxima volta tenta de novo */ }
    }, 5000)
  }
})
// Recall pendente sem detalhe ainda: a entrega deixou uma busca rodando em
// segundo plano e ela atualiza o snapshot quando termina. A tela acompanha por
// no maximo 4 minutos; passou disso, fica so o indicador, sem ficar batendo no
// servidor pra sempre.
let pollRecall: any = null
// Montadora (Nissan/Mitsubishi): a consulta roda logo depois da entrega (~2s). Se a tela abriu
// antes, acompanha por ate 1 minuto e para quando o bloco chega.
let pollNissan: any = null
onMounted(() => {
  if (!entregue.value || !marcaComConsultaMontadora.value || data.value?.recallMontadora) return
  const ate = Date.now() + 60 * 1000
  pollNissan = setInterval(async () => {
    if (Date.now() > ate || data.value?.recallMontadora) { clearInterval(pollNissan); return }
    try { await refresh() } catch { /* rede oscilou; a proxima volta tenta */ }
  }, 5000)
})
onMounted(() => {
  if (!recallPendente.value || recallDetalhe.value) return
  const ate = Date.now() + 4 * 60 * 1000
  pollRecall = setInterval(async () => {
    if (Date.now() > ate || recallDetalhe.value) { clearInterval(pollRecall); return }
    try { await refresh() } catch { /* rede oscilou; a proxima volta tenta */ }
  }, 15000)
})

// Multas sem detalhe ainda (relatorio ja aberto): a entrega deixou a busca do
// DETRAN rodando; a tela acompanha ate 12 min da entrega e o bloco entra sozinho
// quando o servidor grava ok/sem_debito/indisponivel. Tambem comeca quando a
// tela de espera (aguardandoDetran) termina sem o bloco.
let pollMultas: any = null
function acompanharMultas() {
  if (pollMultas || acompanhamentoEsgotado.value) return
  if ((!multaIndicadorSP.value && !ehVeiculoSpTela.value) || multasDetalhe.value || multasIndisponivel.value || aguardandoDetran.value) return
  const ent = new Date(data.value?.entregue_em || '').getTime()
  const ate = Number.isFinite(ent) ? ent + LIMITE_ACOMPANHAR_MS : Date.now() + LIMITE_ACOMPANHAR_MS
  if (Date.now() > ate) { acompanhamentoEsgotado.value = true; return }
  pollMultas = setInterval(async () => {
    if (multasDetalhe.value || multasIndisponivel.value) { clearInterval(pollMultas); pollMultas = null; return }
    if (Date.now() > ate) { clearInterval(pollMultas); pollMultas = null; acompanhamentoEsgotado.value = true; return }
    try { await refresh() } catch { /* rede oscilou; a proxima volta tenta */ }
  }, 10000)
}
onMounted(() => {
  acompanharMultas()
  watch(aguardandoDetran, (esperando) => { if (!esperando) acompanharMultas() })
})

onUnmounted(() => {
  if (poll) clearInterval(poll)
  if (pollRecall) clearInterval(pollRecall)
  if (pollNissan) clearInterval(pollNissan)
  if (pollMultas) clearInterval(pollMultas)
  pararEsperaDetran()
})
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
      />
    </div>


    <div class="rel__wrap" :class="{ 'rel__wrap--laudo': mostrandoLaudo }">
      <span v-if="!entregue" class="rel__tipo-fora">{{ isBasica ? PLANOS.basica.nome : PLANOS.completa.nome }}</span>

      <!-- pending && !data: o "Carregando" e so da PRIMEIRA carga. Em refresh
           de fundo os dados antigos ficam na tela ate os novos chegarem. -->
      <div v-if="pending && !data" class="rel__card rel__card--centro">
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
        <div v-if="data.status === 'aguardando_pagamento' && data.brCode && !ehCartao" class="rel__card rel__card--centro">
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

        <!-- ============ 1b. CONFIRMANDO O CARTAO ============ -->
        <!-- Pedido de cartao que voltou do Stripe e ainda aguarda a confirmacao
             do pagamento (o polling do /status consulta a sessao Stripe). NUNCA
             mostra QR de Pix: o cartao nao se paga por Pix. -->
        <div v-else-if="data.status === 'aguardando_pagamento' && ehCartao" class="rel__card rel__card--centro">
          <h1 class="rel__h">Confirmando o pagamento do cartão…</h1>
          <div class="rel__barra"><div class="rel__barra-fill" /></div>
          <p class="rel__hint">Assim que o pagamento for aprovado, seu relatório abre aqui. Isso leva alguns instantes.</p>
        </div>

        <!-- ============ 2. ESTADOS DE TRANSICAO E FALHA ============ -->
        <div v-else-if="!entregue || aguardandoDetran" class="rel__card rel__card--centro">
          <!-- Relatorio pronto, esperando o DETRAN (veiculo com multa). -->
          <template v-if="entregue && aguardandoDetran && fontesRel">
            <h1 class="rel__h">Pagamento confirmado ✓</h1>
            <div class="rel__barra"><div class="rel__barra-fill" /></div>
            <ul class="rel__espera">
              <li class="rel__espera-ok">Consulta da placa concluída ✓</li>
              <li v-for="f in fontesRel" :key="f.fonte" :class="f.estado === 'consultando' ? 'rel__espera-ativa' : 'rel__espera-ok'">
                {{ f.estado === 'consultando' ? `Consultando ${f.rotulo}…` : `${f.rotulo} ✓` }}
              </li>
            </ul>
            <p class="rel__hint">Estamos juntando tudo para entregar o relatório completo de uma vez, o que pode levar alguns minutos. Se alguma fonte demorar mais, o relatório abre com o que já chegou e o restante entra sozinho; avisamos por e-mail.</p>
          </template>
          <template v-else-if="entregue && aguardandoDetran">
            <h1 class="rel__h">Pagamento confirmado ✓</h1>
            <div class="rel__barra"><div class="rel__barra-fill" /></div>
            <ul class="rel__espera">
              <li class="rel__espera-ok">Consulta da placa concluída ✓</li>
              <li class="rel__espera-ativa">Consultando multas no DETRAN-{{ ufDetranTela }}…</li>
            </ul>
            <p class="rel__hint">O SENATRAN indicou multa neste veículo. Estamos buscando o detalhe no DETRAN, o que pode levar alguns minutos. Se demorar, o relatório abre e as multas entram sozinhas quando chegarem.</p>
          </template>
          <template v-else-if="['pago', 'consultando'].includes(data.status)">
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
            <!-- Veiculo que o registro nacional nao conhece: dizer isso e mais
                 util (e mais honesto) do que a frase generica, que deixava a
                 pessoa achando que o site quebrou e tentando de novo. -->
            <p v-if="data.motivoFalha === 'veiculo_nao_encontrado'" class="rel__hint">
              Não encontramos este veículo na base nacional com a placa {{ data.placa }}.
              O valor foi devolvido {{ ehCartao ? 'no seu cartão (aparece na fatura em até 10 dias úteis)' : 'no seu Pix' }} e nada ficou cobrado. Confira a placa no
              documento e, se ela estiver certa, escreva para contato@placacompleta.com.br.
            </p>
            <p v-else class="rel__hint">
              Este pedido foi encerrado e o valor devolvido {{ ehCartao ? 'no seu cartão' : 'no seu Pix' }}. Nada ficou
              cobrado. Se ainda quiser o relatório da placa {{ data.placa }}, é só
              começar um pedido novo.
            </p>
            <!-- Estorno e terminal: reabrir o Pix AQUI cobraria de novo um pedido
                 ja devolvido. O caminho certo e um pedido novo, com a placa e o
                 plano ja preenchidos. -->
            <NuxtLink
              class="rel__btn rel__btn--primario"
              :to="`/?placa=${data.placa}&plano=${isBasica ? 'basica' : 'completa'}`"
            >
              Refazer a consulta desta placa
            </NuxtLink>
            <NuxtLink to="/" class="rel__btn">Voltar ao início</NuxtLink>
          </template>
          <template v-else>
            <h1 class="rel__h">Aguardando confirmação</h1>
            <p class="rel__hint">Se você já pagou, o relatório libera sozinho. Pode deixar esta aba aberta.</p>
          </template>
        </div>

        <!-- ============ 3. O RELATORIO ============ -->
        <template v-else>
          <!-- Faixa de entrega por e-mail. So aparece pra quem comprou sem
               informar e-mail (o campo do Pix e opcional desde que ele saiu da
               frente da cobranca). Sem isto, quem fechava o modal do Pix nao
               tinha onde informar depois, e a entrega virava caso de suporte:
               aconteceu de verdade com o pedido da KCD1J29.
               O link continua sendo o acesso, e a frase diz isso: o e-mail e
               conveniencia, nao condicao. -->
          <div v-if="mostrarFaixaEmail" class="rel__email">
            <template v-if="emailEnviadoPara">
              <p class="rel__email-ok">Enviado para {{ emailEnviadoPara }}. O link desta página continua valendo.</p>
            </template>
            <template v-else>
              <div class="rel__email-txt">
                <strong>Quer receber este relatório por e-mail?</strong>
                <span>O link é seu acesso permanente.</span>
              </div>
              <form class="rel__email-form" @submit.prevent="enviarPorEmail">
                <label class="rel__sr" for="rel-email">Seu e-mail</label>
                <input
                  id="rel-email"
                  v-model="emailEntrega"
                  type="email"
                  inputmode="email"
                  autocomplete="email"
                  class="rel__email-input"
                  placeholder="seu@email.com"
                >
                <button type="submit" class="rel__btn rel__btn--mini" :disabled="enviandoEmail">
                  {{ enviandoEmail ? 'Enviando...' : 'Enviar' }}
                </button>
              </form>
              <p v-if="erroEmail" class="rel__hint rel__hint--erro">{{ erroEmail }}</p>
            </template>
          </div>
          <!-- Cabecalho de documento: identidade, numero e emissao. E o que
               faz laudo parecer laudo — estrutura, nao enfeite. -->
          <header class="rel__doc">
            <PlacaCompletaLogo variant="default" crop class="rel__doc-logo" />
            <div class="rel__doc-meta">
              <span class="rel__doc-titulo">Relatório de Consulta Veicular</span>
              <span class="rel__doc-linha">{{ isBasica ? PLANOS.basica.nome : PLANOS.completa.nome }} · Documento {{ numeroDoc }}</span>
              <span v-if="emissaoFmt" class="rel__doc-linha">Emitido em {{ emissaoFmt }}</span>
            </div>
          </header>
          <p class="rel__doc-validade">
            Este documento retrata a situação do veículo na data e hora de emissão.
          </p>

          <div class="rel__acoes">
            <button type="button" class="rel__btn rel__btn--mini" @click="imprimir">Imprimir</button>
            <a :href="compartilhar" target="_blank" rel="noopener" class="rel__btn rel__btn--mini">
              Compartilhar
            </a>
          </div>

          <!-- resumo + parecer -->
          <section class="rel__card">
            <h2 class="rel__h2">{{ numSecao.veh }}. Identificação do veículo</h2>
            <div class="rel__veh">
              <MarcaLogo :marca="g('descricaoMarcaModelo')" :logo-url="data?.logoMarca" />
              <span class="rel__veh-txt">
                <strong>{{ g('descricaoMarcaModelo') || 'Veículo consultado' }}</strong>
                <span>
                  {{ [has('anoFabricacao') ? `${g('anoFabricacao')}/${g('anoModelo')}` : null,
                      humanizar(g('descricaoCor')), humanizar(g('descricaoTipoVeiculo')),
                      g('municipio') && g('ufJurisdicao') ? `${humanizar(g('municipio'))}/${g('ufJurisdicao')}` : g('ufJurisdicao')]
                      .filter(Boolean).join(' · ') }}
                </span>
              </span>
              <PlacaMercosul :placa="data.placa" mini :width="190" class="rel__placa-tag" />
            </div>

            <span v-if="veredito" class="rel__parecer-rotulo">Parecer</span>
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
            <h2 class="rel__h2">{{ numSecao.ind }}. Indicadores verificados</h2>
            <div class="rel__inds">
              <div
                v-for="i in indicadores"
                :key="i.k"
                class="rel__ind"
                :class="i.alerta ? 'rel__ind--bad' : (i.ligado && i.neutro ? 'rel__ind--neutro' : (i.ligado && i.risco ? 'rel__ind--atencao' : 'rel__ind--ok'))"
              >
                <span class="rel__ind-lab">
                  {{ rotuloPartes(i.label).inicio }}<span class="rel__ind-glue">{{ rotuloPartes(i.label).fim }}<button type="button" class="rel__info" :data-dica="i.dica" :aria-label="i.dica">
                    <!-- Feather "info": mesmo vocabulario de traco dos outros icones do site -->
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </button></span>
                </span>
                <span class="rel__ind-val">{{ i.ligado ? i.sim : i.nao }}</span>
              </div>
            </div>
            <p v-if="temIndicadorLeilao" class="rel__ind-nota">
              Nem todo leilão é registrado pelos leiloeiros. A ausência de registro não garante que o veículo nunca passou por leilão.
            </p>
          </section>

          <!-- restricoes: na completa a secao existe sempre. Laudo lista a
               secao e diz "nada consta"; omitir deixaria duvida se foi checado. -->
          <!-- Linha do tempo unica do veiculo (Relatorio 2.0, item 2). -->
          <section v-if="numSecao.tempo" class="rel__card">
            <h2 class="rel__h2">{{ numSecao.tempo }}. Linha do tempo do veículo</h2>
            <p class="rel__tempo-sub">O que consta sobre este veículo, do mais antigo ao mais recente.</p>
            <ol class="rel__tempo">
              <li v-for="(e, idx) in linhaDoTempo" :key="'t' + idx" class="rel__tempo-item" :class="'rel__tempo-item--' + e.tom">
                <span class="rel__tempo-quando">{{ e.quando }}</span>
                <span class="rel__tempo-ponto" aria-hidden="true" />
                <div class="rel__tempo-txt">
                  <b>{{ e.titulo }}</b>
                  <small v-if="e.detalhe">{{ e.detalhe }}</small>
                  <small v-if="e.secao && numSecao[e.secao]" class="rel__tempo-ver">ver seção {{ numSecao[e.secao] }}</small>
                </div>
              </li>
            </ol>
            <p v-if="fraseHodometro" :class="fraseHodometro.tipo === 'alerta' ? 'rel__multas-kmalerta' : 'rel__multas-kmok'">{{ fraseHodometro.texto }}</p>
          </section>

          <section v-if="numSecao.restr" class="rel__card">
            <h2 class="rel__h2">{{ numSecao.restr }}. Restrições</h2>
            <template v-if="restricoes.length">
              <div v-for="(r, idx) in restricoes" :key="idx" class="rel__restr">
                <div class="rel__restr-topo">
                  <span class="rel__tag" :class="{ 'rel__tag--info': r.info }">{{ r.info ? 'Informação' : 'Restrição' }}</span>
                  <strong>{{ r.rotulo }}</strong>
                </div>
                <span v-if="!r.info && !r.renave && !r.renajud && efeitoTexto({ texto: r.rotulo })" class="rel__efeito">{{ efeitoTexto({ texto: r.rotulo }) }}</span>
                <div v-if="r.renave" class="rel__renave">
                  <strong class="rel__renave-tit">{{ RENAVE_EXPLICACAO.titulo }}</strong>
                  <p>{{ RENAVE_EXPLICACAO.texto }} <strong>{{ RENAVE_EXPLICACAO.destaque }}</strong></p>
                  <p class="rel__renave-conf">{{ RENAVE_EXPLICACAO.conferirTitulo }}</p>
                  <ul>
                    <li v-for="(c, ci) in RENAVE_EXPLICACAO.conferir" :key="ci">{{ c }}</li>
                  </ul>
                </div>
                <div v-else-if="r.renajud" class="rel__renave">
                  <strong class="rel__renave-tit">{{ RENAJUD_EXPLICACAO.titulo }}</strong>
                  <p>{{ RENAJUD_EXPLICACAO.texto }}<template v-if="!renajudItens.length"> {{ RENAJUD_EXPLICACAO.semDetalhe }}</template></p>
                  <p class="rel__renave-conf">{{ RENAJUD_EXPLICACAO.tiposTitulo }}</p>
                  <ul>
                    <li v-for="t in RENAJUD_EXPLICACAO.tipos" :key="t.nome"><strong>{{ t.nome }}:</strong> {{ t.efeito }}</li>
                  </ul>
                  <template v-if="renajudItens.length">
                    <p class="rel__renave-conf">Detalhe no DETRAN-{{ data?.renajudDetalhe?.uf }}:</p>
                    <ul>
                      <li v-for="(it, ii) in renajudItens" :key="'rj' + ii">
                        <strong v-if="it.tipo">{{ it.tipo }}</strong><template v-if="it.tipo && (it.tribunal || it.orgao)">. </template>
                        <template v-if="it.tribunal">{{ it.tribunal }}</template><template v-if="it.tribunal && it.orgao"> · </template><template v-if="it.orgao">{{ it.orgao }}</template><template v-if="it.data">, registrada em {{ it.data }}</template>.
                        <span v-if="efeitoTexto({ tipo: it.tipo, texto: 'RENAJUD' })" class="rel__efeito">{{ efeitoTexto({ tipo: it.tipo, texto: 'RENAJUD' }) }}</span>
                      </li>
                    </ul>
                  </template>
                  <p><strong>{{ RENAJUD_EXPLICACAO.destaque }}</strong></p>
                  <p class="rel__renave-conf">{{ RENAJUD_EXPLICACAO.conferirTitulo }}</p>
                  <ul>
                    <li v-for="(c, ci) in RENAJUD_EXPLICACAO.conferir" :key="ci">{{ c }}</li>
                  </ul>
                </div>
                <p v-else class="rel__restr-explica">{{ r.explica }}</p>
              </div>
            </template>
            <p v-else class="rel__nada">Nada consta na data de emissão.</p>

            <!-- Débitos/multas e recall vivem AQUI, no contexto de Restrições
                 (sao pendencias do veiculo), em vez de soltos apos a
                 Identificacao. Cada um e um subcard com sua propria moldura. -->

            <!-- Multas e débitos no órgão de trânsito do estado (SP): o
                 indicador de multa acende, e aqui vem o VALOR e o detalhe. -->
            <div v-if="(multaIndicadorSP || ehVeiculoSpTela || multasDetalhe) && !multasFalhaSilenciosa" class="rel__multas">
              <p class="rel__multas-tit">Multas e débitos</p>
              <p v-if="procDebitos" class="rel__multas-proc">{{ procDebitos }}</p>
              <template v-if="multasDetalhe">
                <!-- Ordem (feedback do Cesar, 14/out): procedencia, caixa,
                     infracoes, IPVA, restricoes. A caixa ja diz o total, o que
                     trava (inclusive roubo/furto) e o licenciamento vencido. -->
                <DetranQuitar v-if="resumoDetran" :resumo="resumoDetran" />

                <!-- Infracoes: em aberto, em recurso e autuacoes em andamento. -->
                <p v-if="textoRenainfFora" class="rel__multas-nota">{{ textoRenainfFora }}</p>
                <!-- AL: o /infracoes falhou e o total veio do /veiculo, sem o detalhe de cada multa. -->
                <p v-if="multasDetalhe.multas_sem_detalhe && multasDetalhe.multas_total_centavos > 0" class="rel__multas-nota">
                  O DETRAN{{ ufDetranTela ? '-' + ufDetranTela : '' }} informou o total das multas em aberto, sem o detalhe de cada infração nesta consulta.
                </p>
                <template v-if="multasDetalhe.multas_itens && multasDetalhe.multas_itens.length">
                  <p class="rel__multas-sub">Multas em aberto</p>
                  <p v-if="multasDetalhe.multas_atualizado_centavos" class="rel__multas-item-meta">
                    Valores originais de cada multa. Com juros e correção, o DETRAN cobra {{ reais(multasDetalhe.multas_atualizado_centavos) }} no total.
                  </p>
                  <ul class="rel__multas-itens">
                    <li v-for="(mt, idx) in multasDetalhe.multas_itens" :key="'mi' + idx" class="rel__multas-item">
                      <div class="rel__multas-item-top">
                        <span>{{ mt.descricao || 'Infração de trânsito' }}</span>
                        <b v-if="Number(mt.valor) > 0">{{ reais(Math.round(Number(mt.valor) * 100)) }}</b>
                        <b v-else class="rel__multas-sem-valor">autuação em andamento, valor a definir</b>
                      </div>
                      <p class="rel__multas-item-meta">
                        <span v-if="mt.dataInfracao">{{ mt.dataInfracao }}<span v-if="mt.horaInfracao && !String(mt.horaInfracao).startsWith('00:00')"> às {{ String(mt.horaInfracao).slice(0, 5) }}</span></span>
                        <span v-if="mt.local"> · {{ mt.local }}<span v-if="mt.municipio">, {{ mt.municipio }}</span></span>
                        <span v-if="mt.orgao"> · {{ mt.orgao }}</span>
                        <span v-if="mt.auto"> · auto {{ mt.auto }}</span>
                        <span v-if="mt.dataVencimento"> · vencimento {{ mt.dataVencimento }}</span>
                      </p>
                    </li>
                  </ul>
                </template>
                <!-- Em recurso (nao somam no total). -->
                <template v-if="multasDetalhe.multas_em_recurso && multasDetalhe.multas_em_recurso.length">
                  <p class="rel__multas-sub">Multas em recurso</p>
                  <ul class="rel__multas-itens">
                    <li v-for="(mt, idx) in multasDetalhe.multas_em_recurso" :key="'mr' + idx" class="rel__multas-item">
                      <div class="rel__multas-item-top">
                        <span>{{ mt.descricao || 'Infração de trânsito' }}</span>
                        <b>{{ reais(Math.round((mt.valor || 0) * 100)) }}</b>
                      </div>
                      <p class="rel__multas-item-meta">
                        <span v-if="mt.dataInfracao">{{ mt.dataInfracao }}</span>
                        <span v-if="mt.local"> · {{ mt.local }}</span>
                        <span v-if="mt.orgao"> · {{ mt.orgao }}</span>
                        <span v-if="mt.auto"> · auto {{ mt.auto }}</span>
                        <span> · em recurso</span>
                      </p>
                    </li>
                  </ul>
                </template>
                <p v-if="multasDetalhe.autuacoes_em_andamento" class="rel__multas-nota">
                  {{ multasDetalhe.autuacoes_em_andamento }}
                  {{ multasDetalhe.autuacoes_em_andamento === 1 ? 'autuação em andamento' : 'autuações em andamento' }}
                  no DETRAN (ainda sem multa).
                </p>

                <!-- IPVA em aberto, um item por exercicio. Total so com 2+ itens. -->
                <template v-if="ipvaLista.itens.length">
                  <p class="rel__multas-sub">IPVA em aberto</p>
                  <ul class="rel__multas-itens">
                    <li v-for="(ip, idx) in ipvaLista.itens" :key="'ip' + idx" class="rel__multas-item">
                      <div class="rel__multas-item-top">
                        <span>IPVA {{ ip.ano || '' }}</span>
                        <b>{{ reais(ip.valor_centavos) }}</b>
                      </div>
                      <p class="rel__multas-item-meta">
                        <span v-if="ip.vencimento">vencimento {{ ip.vencimento }}</span>
                        <span v-if="ip.sefaz">{{ ip.vencimento ? ' · ' : '' }}em aberto na SEFAZ</span>
                      </p>
                    </li>
                  </ul>
                  <div v-if="ipvaLista.itens.length >= 2" class="rel__multas-r rel__multas-ipvatotal">
                    <span>Total do IPVA em aberto</span>
                    <b>{{ reais(ipvaLista.total) }}</b>
                  </div>
                  <p v-if="ipvaLista.temSefaz" class="rel__multas-nota">Valores da SEFAZ são o valor original, sem juros e multa.</p>
                </template>

                <!-- Restrições do DETRAN (só as que constam de fato). -->
                <template v-if="multasDetalhe.restricoes_detran && multasDetalhe.restricoes_detran.length">
                  <p class="rel__multas-sub">Restrições no DETRAN</p>
                  <ul class="rel__multas-restr">
                    <li v-for="(rs, idx) in multasDetalhe.restricoes_detran" :key="'rs' + idx">
                      <b>{{ rotuloRestricao(rs.tipo) }}:</b> {{ rs.texto }}
                      <span v-if="efeitoTexto(rs)" class="rel__efeito">{{ efeitoTexto(rs) }}</span>
                    </li>
                  </ul>
                </template>
              </template>
              <p v-else-if="multasProtegido" class="rel__multas-nota">{{ textoDetranProtegido(ufMultasProtegido) }}</p>
              <p v-else-if="fonteDetran && fonteDetran.estado === 'chegando'" class="rel__multas-nota rel__multas-nota--consultando">Ainda chegando do DETRAN{{ ufDetranTela ? '-' + ufDetranTela : '' }}. O resultado entra aqui sozinho e avisamos por e-mail.</p>
              <p v-else-if="multasIndisponivel || multasSemRespostaAntigo" class="rel__multas-nota">A consulta de débitos e multas no DETRAN do estado não está disponível no momento. Confira direto no site do DETRAN.</p>
              <p v-else-if="multasSemResposta && acompanhamentoEsgotado" class="rel__multas-nota">O DETRAN{{ ufDetranTela ? '-' + ufDetranTela : '' }} ainda não respondeu. Recarregue esta página em alguns minutos para ver o resultado.</p>
              <p v-else-if="multasSemResposta" class="rel__multas-nota rel__multas-nota--consultando">Consultando o DETRAN{{ ufDetranTela ? '-' + ufDetranTela : '' }}, pode levar alguns minutos. O resultado aparece aqui sozinho.</p>
              <p v-else class="rel__multas-nota">Consultando débitos, multas e histórico no DETRAN. Aparece aqui em instantes.</p>
              <!-- Sem bloco estadual: status pela base nacional. -->
              <div v-if="!multasDetalhe && (multasProtegido || multasIndisponivel || multasSemRespostaAntigo) && statusNacional.length" class="rel__multas-bd">
                <div v-for="(r, idx) in statusNacional" :key="'n' + idx" class="rel__multas-r">
                  <span>{{ r.rotulo }}</span>
                  <b :class="{ 'rel__multas-ok': r.emDia, 'rel__multas-st-alerta': r.alerta }">{{ r.valor }}</b>
                </div>
              </div>
            </div>

            <!-- Quilometragem: virou parte da linha do tempo (secao propria). -->

            <!-- Recall pendente: a primeira pergunta de quem ve o cartao
                 vermelho e "recall de que?". -->
            <!-- Recall da MONTADORA por chassi (Nissan/Mitsubishi): abertas e realizadas. -->
            <div v-if="recallMontadora" class="rel__recall" :class="{ 'rel__recall--ok': !campanhasAbertas.length }">
              <div class="rel__recall-top">
                <div class="rel__recall-ic">{{ campanhasAbertas.length ? '!' : '✓' }}</div>
                <div>
                  <p class="rel__recall-tit">{{ campanhasAbertas.length ? 'Recall em aberto neste veículo' : 'Recalls deste veículo já realizados' }}</p>
                  <p class="rel__recall-sub">
                    Consulta oficial da {{ nomeMontadora }} pelo chassi ·
                    <template v-if="campanhasAbertas.length">{{ campanhasAbertas.length === 1 ? '1 campanha em aberto' : `${campanhasAbertas.length} campanhas em aberto` }}</template>
                    <template v-else>{{ campanhasRealizadas.length === 1 ? '1 campanha' : `${campanhasRealizadas.length} campanhas` }}</template>
                    <template v-if="dadosRecallMontadora"> · {{ dadosRecallMontadora }}</template>
                  </p>
                </div>
              </div>
              <template v-if="campanhasAbertas.length">
                <p class="rel__recall-sub rel__recall-sub--item">Campanhas em aberto</p>
                <ul class="rel__recall-lista">
                  <li v-for="(c, idx) in campanhasAbertas" :key="'ab' + idx" class="rel__recall-item">
                    <div class="rel__recall-item-top">
                      <span>{{ c.titulo || 'Campanha de recall' }}</span>
                      <b class="rel__recall-st--pend">Em aberto</b>
                    </div>
                    <p v-if="c.codigo" class="rel__recall-item-meta">Campanha {{ c.codigo }}</p>
                  </li>
                </ul>
              </template>
              <template v-if="campanhasRealizadas.length">
                <p v-if="campanhasAbertas.length" class="rel__recall-sub rel__recall-sub--item">Campanhas já realizadas</p>
                <ul class="rel__recall-lista">
                  <li v-for="(c, idx) in campanhasRealizadas" :key="'re' + idx" class="rel__recall-item">
                    <div class="rel__recall-item-top">
                      <span>{{ c.titulo || 'Campanha de recall' }}</span>
                      <b class="rel__recall-st--ok">{{ c.status === 'excluido' ? 'Não se aplica' : 'Realizada' }}</b>
                    </div>
                    <p class="rel__recall-item-meta">
                      {{ metaCampanhaRealizada(c) }}
                    </p>
                  </li>
                </ul>
              </template>
              <p v-if="campanhasAbertas.length" class="rel__recall-foot">{{ RECALL_ORIENTACAO }}</p>
            </div>

            <!-- Hook de recall da consulta gratis + nada pendente hoje: qual campanha era. -->
            <div v-if="cardAssociado" class="rel__recall rel__recall--assoc">
              <div class="rel__recall-top">
                <div class="rel__recall-ic">i</div>
                <div>
                  <p class="rel__recall-tit">{{ cardAssociado.titulo }}</p>
                  <p class="rel__recall-sub">{{ cardAssociado.fonte }}</p>
                </div>
              </div>
              <ul v-if="cardAssociado.itens.length" class="rel__recall-lista">
                <li v-for="(c, idx) in cardAssociado.itens" :key="'as' + idx" class="rel__recall-item">
                  <div class="rel__recall-item-top"><span>{{ c.nome }}</span></div>
                  <p v-if="c.meta" class="rel__recall-item-meta">{{ c.meta }}</p>
                </li>
              </ul>
              <p v-else class="rel__recall-body">A consulta grátis indicou uma campanha de recall para este veículo; os detalhes da campanha não vieram da base agora.</p>
              <p class="rel__recall-foot">{{ cardAssociado.situacao }}</p>
            </div>

            <div v-if="!recallMontadora && (recallPendente || recallAbertoGM)" class="rel__recall">
              <!-- MODO AUTORITATIVO GM (Chevrolet + chassi cheio): a fonte da GM
                   confirma o recall ABERTO e QUAIS campanhas. Precede o
                   SENATRAN/local. -->
              <template v-if="recallAbertoGM">
                <div class="rel__recall-top">
                  <div class="rel__recall-ic">!</div>
                  <div>
                    <p class="rel__recall-tit">Recall aberto neste veículo</p>
                    <p class="rel__recall-sub">{{ recallCampanhasGM.length === 1 ? '1 campanha em aberto' : `${recallCampanhasGM.length} campanhas em aberto` }}</p>
                  </div>
                </div>
                <template v-for="(c, idx) in recallCampanhasGM" :key="'gm' + idx">
                  <p v-if="c.titulo" class="rel__recall-sub rel__recall-sub--item">{{ c.titulo }}</p>
                  <p class="rel__recall-body">{{ c.descricao }}</p>
                </template>
                <p class="rel__recall-foot">{{ RECALL_ORIENTACAO }}</p>
              </template>

              <!-- SENATRAN/local (fallback quando o autoritativo nao veio). -->
              <template v-else>
                <div class="rel__recall-top">
                  <div class="rel__recall-ic">!</div>
                  <div>
                    <p class="rel__recall-tit">Recall pendente de atendimento</p>
                    <p v-if="recallSubtitulo" class="rel__recall-sub">{{ recallSubtitulo }}</p>
                  </div>
                </div>
                <template v-if="recallCampanhas.length">
                  <template v-for="(c, idx) in recallCampanhas" :key="idx">
                    <p v-if="recallCampanhas.length > 1 && (c.campanha || c.data_inicio)" class="rel__recall-sub rel__recall-sub--item">
                      {{ legendaCampanha(c) }}
                    </p>
                    <p class="rel__recall-body">
                      <b v-if="c.componente">Componente: {{ c.componente }}.</b>
                      {{ c.descricao }}
                    </p>
                  </template>
                  <p class="rel__recall-foot">{{ RECALL_ORIENTACAO }}</p>
                </template>
                <p v-else class="rel__recall-body">Recall pendente: buscando os detalhes da campanha.</p>
              </template>
            </div>

            <!-- Recall nos EUA (NHTSA): so chassi da America do Norte; informativo, colapsado. -->
            <details v-if="recallEua" class="rel__recall rel__recall--eua">
              <summary class="rel__recall-top">
                <div class="rel__recall-ic">i</div>
                <div>
                  <p class="rel__recall-tit">{{ recallEua.rotulo }}</p>
                  <p class="rel__recall-sub">{{ recallEua.campanhas.length === 1 ? '1 campanha' : `${recallEua.campanhas.length} campanhas` }}<template v-if="recallEua.modelo"> · {{ recallEua.marca }} {{ recallEua.modelo }} {{ recallEua.ano || '' }}</template></p>
                </div>
              </summary>
              <ul class="rel__recall-lista">
                <li v-for="c in recallEua.campanhas" :key="c.numero" class="rel__recall-item">
                  <div class="rel__recall-item-top"><span>{{ componenteEua(c.componente) }}</span></div>
                  <p class="rel__recall-item-meta">Campanha {{ c.numero }}<template v-if="c.data"> · {{ c.data }}</template></p>
                  <details v-if="c.resumo" class="rel__recall-eua-det">
                    <summary>ver detalhes</summary>
                    <p lang="en">{{ c.resumo }}</p>
                  </details>
                </li>
              </ul>
            </details>
          </section>

          <!-- Roubo e furto: um cartao por EPISODIO, nao por registro. Roubo,
               recuperacao e devolucao do mesmo caso sao uma historia so, e o
               cabecalho colorido ja diz como ela terminou. -->
          <section v-if="episodiosRoubo.length" class="rel__card">
            <h2 class="rel__h2">{{ numSecao.ocorr }}. Ocorrências de roubo e furto</h2>
            <div v-for="ep in episodiosRoubo" :key="ep.chave" class="rel__caso">
              <div class="rel__caso-hd" :class="ep.encerrado ? 'rel__caso-hd--ok' : 'rel__caso-hd--bad'">
                <div>
                  <strong>{{ ep.titulo }}</strong>
                  <small>{{ ep.sub }}</small>
                </div>
                <span class="rel__tag" :class="ep.encerrado ? 'rel__tag--ok' : 'rel__tag--bad'">{{ ep.tag }}</span>
              </div>
              <table class="rel__caso-tab">
                <tbody>
                  <tr v-for="l in ep.linhas" :key="l.etapa" :class="{ 'rel__caso-linha--vazia': !l.data }">
                    <td>{{ l.rotulo }}</td>
                    <td>
                      <template v-if="l.data">
                        {{ l.data }}
                        <span v-if="l.detalhe" class="rel__caso-det">{{ l.detalhe }}</span>
                      </template>
                      <template v-else>Sem registro</template>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p class="rel__ocorr-nota">
                <template v-if="ep.encerrado">
                  O registro do roubo permanece no histórico mesmo depois da devolução.
                  Peça ao vendedor o boletim de ocorrência e a baixa, e confira se o carro
                  voltou sem danos.
                </template>
                <template v-else>
                  Não há registro de recuperação nem de devolução. Sem a baixa da
                  ocorrência, o veículo pode ser apreendido numa blitz. Não feche negócio
                  sem esclarecer isto.
                </template>
              </p>
            </div>
          </section>

          <!-- historico de leilao (so completa, so onde o servico existe) -->
          <section v-if="temSecaoLeilao" class="rel__card">
            <h2 class="rel__h2">{{ numSecao.leilao }}. Histórico de leilão</h2>
            <p v-if="dadosLeilao" class="rel__dados-de">{{ dadosLeilao }}</p>
            <p v-if="temIndicioReal || possiveisComFoto.length || passagensNotificadas.length" class="rel__leilao-base">Placa e chassi cruzados com uma base de {{ BASE_LEILAO_TEXTO }}, montada a partir de editais de DETRANs e catálogos de leiloeiras.</p>

            <!-- Sem nada com grau de certeza, a seção diz UMA coisa só. Antes
                 empilhava "nenhum indício", mais a contagem de lotes parecidos,
                 mais o rodapé explicando níveis, e o resultado era um bloco
                 confuso pra dizer que não há nada. -->
            <template v-if="!temIndicioReal && !possiveisComFoto.length && !passagensNotificadas.length">
              <p class="rel__leilao-limpo">
                {{ leilaoSemOcorrencia(esteVeiculo) }}
              </p>
            </template>

            <template v-if="temIndicioReal">
              <p class="rel__leilao-resumo">
                <span class="rel__nivel" :class="`rel__nivel--${nivelExibido}`">
                  {{ ROTULO_NIVEL[nivelExibido] }}
                </span>
                <span v-if="resumoLeilao">{{ resumoLeilao }}</span>
              </p>
              <p v-if="historicoLeilao?.recorrencia?.texto" class="rel__leilao-recorr">{{ historicoLeilao.recorrencia.texto }}<template v-if="numSecao.tempo">: veja a sequência na seção {{ numSecao.tempo }}</template>.</p>

              <div v-for="p in passagensFortes" :key="p.idx" class="rel__leilao">
                <div class="rel__leilao-topo">
                  <span class="rel__nivel" :class="`rel__nivel--${p.nivel}`">{{ p.rotuloNivel }}</span>
                  <span class="rel__leilao-fonte">{{ p.fonte }}</span>
                  <span v-if="p.tipoFonte" class="rel__leilao-tipo">{{ p.tipoFonte }}</span>
                </div>
                <!-- Termometro: e a primeira coisa que a pessoa precisa ver.
                     "Retomada de financiamento" em verde diz, sem rodeio, que
                     o carro passou por leilao mas NAO foi sinistro. -->
                <p v-if="p.gravidade" class="rel__grav" :class="`rel__grav--${p.gravidade.cor}`">
                  <span class="rel__grav-barra" aria-hidden="true" />
                  <span class="rel__grav-rotulo">{{ p.gravidade.rotulo }}</span>
                </p>
                <!-- Relatorio 2.0: origem, alertas do edital, desfecho, contexto judicial e lote. -->
                <p v-if="p.origem" class="rel__leilao-origem"><span>Origem:</span> {{ p.origem }}</p>
                <ul v-if="p.alertas.length" class="rel__leilao-alertas">
                  <li v-for="a in p.alertas" :key="a">{{ a }}</li>
                </ul>
                <p v-if="p.judicial" class="rel__leilao-jud">
                  {{ p.judicial }}<template v-if="p.judicialUrl">. <a :href="p.judicialUrl" target="_blank" rel="noopener noreferrer nofollow">Ver no site do leiloeiro</a></template>
                </p>
                <p v-if="p.desfecho" class="rel__leilao-desf"><span>Desfecho:</span> {{ p.desfecho }}</p>
                <p v-if="p.lote" class="rel__leilao-lote">
                  <template v-if="p.lote.url"><a :href="p.lote.url" target="_blank" rel="noopener noreferrer nofollow">Ver o anúncio do lote na leiloeira</a></template>
                  <template v-else-if="p.lote.encerrado">Anúncio do lote já encerrado na leiloeira.</template>
                  <template v-else>Anúncio do lote no ar na leiloeira.</template>
                </p>
                <!-- Comitente em destaque, logo abaixo do termometro: quem
                     mandou o carro a leilao explica o porque. -->
                <div v-if="p.comitente || p.leiloeiro" class="rel__leilao-quem">
                  <p v-if="p.comitente" class="rel__leilao-comit"><span>Comitente:</span> {{ p.comitente }}</p>
                  <p v-if="p.fraseComitente" class="rel__leilao-comit-frase">{{ p.fraseComitente }}</p>
                  <p v-if="p.leiloeiro" class="rel__leilao-comit-frase">Leiloeiro: {{ p.leiloeiro }}</p>
                </div>
                <p v-if="p.detalhe" class="rel__leilao-det">{{ p.detalhe }}</p>
                <!-- O que a pessoa pensa ao ver isto e "mas o documento nao
                     diz nada de leilao". Leilao de seguradora e de leiloeira
                     muitas vezes nao vira anotacao no documento, entao a
                     ausencia la nao desmente o registro daqui. Frase sobre o
                     documento, nunca sobre quem o emite. -->
                <p class="rel__leilao-ctx">{{ LEILAO_FORA_DO_DOCUMENTO }}</p>
                <ul v-if="p.detalhes.length" class="rel__leilao-detalhes">
                  <li v-for="d in p.detalhes" :key="d.rotulo">
                    <span>{{ d.rotulo }}</span><strong>{{ d.valor }}</strong>
                  </li>
                </ul>

                <!-- Edital do orgao de transito: o documento que originou o
                     registro. E a resposta pra pergunta que toda passagem
                     levanta ("como voces sabem disso?"), na forma mais forte
                     possivel, que e o papel oficial. Aparece pra DETRAN e pra
                     leilao judicial de casa privada, quando o arquivo existe. -->
                <div v-if="p.edital_disponivel && p.edital_ref" class="rel__edital">
                  <button
                    type="button"
                    class="rel__btn rel__btn--mini"
                    :disabled="editalCarregando === p.edital_ref"
                    @click="baixarEdital(p.edital_ref)"
                  >
                    {{ editalCarregando === p.edital_ref ? 'Gerando o link...' : (p.editalDetran ? 'Baixar o edital do DETRAN (PDF)' : 'Baixar o edital do leilão judicial (PDF)') }}
                  </button>
                  <p class="rel__edital-aviso">
                    {{ p.editalDetran ? 'Documento oficial publicado pelo DETRAN.' : 'Edital do leilão judicial, publicado pela leiloeira.' }} O link vale por 24 horas; depois disso,
                    abra o relatório de novo para gerar um novo link.
                  </p>
                  <p v-if="editalErro && editalCarregando === null" class="rel__hint rel__hint--erro">{{ editalErro }}</p>
                </div>
                <div v-else-if="p.paginaPublica" class="rel__edital">
                  <a class="rel__btn rel__btn--mini" :href="p.paginaPublica" target="_blank" rel="noopener noreferrer nofollow">
                    Ver o edital no site da {{ p.fonte }}
                  </a>
                  <p class="rel__edital-aviso">{{ AVISO_PAGINA_PUBLICA }}</p>
                </div>

                <button
                  type="button"
                  class="rel__leilao-mais"
                  :aria-expanded="passagemAberta === p.idx"
                  @click="alternarPassagem(p.idx)"
                >
                  {{ passagemAberta === p.idx ? 'Ocultar o que foi comparado' : 'Ver o que foi comparado' }}
                </button>

                <div v-if="passagemAberta === p.idx" class="rel__leilao-evid">
                  <p v-if="p.gravidade?.motivo" class="rel__leilao-explica">{{ p.gravidade.motivo }}</p>
                  <p class="rel__leilao-explica">{{ p.explicaNivel }}</p>
                  <template v-if="p.evidencias.length">
                    <p class="rel__leilao-sub">Bateu</p>
                    <ul class="rel__leilao-lista">
                      <li v-for="(e, i) in p.evidencias" :key="`e${i}`">{{ e }}</li>
                    </ul>
                  </template>
                  <template v-if="p.conflitos.length">
                    <p class="rel__leilao-sub">Não bateu</p>
                    <ul class="rel__leilao-lista rel__leilao-lista--conflito">
                      <li v-for="(c, i) in p.conflitos" :key="`c${i}`">{{ c }}</li>
                    </ul>
                  </template>
                </div>
              </div>
            </template>

            <!-- Edital de NOTIFICACAO do DETRAN: o dono foi avisado de que o
                 veiculo iria a leilao. Nao prova que o leilao aconteceu, entao
                 fica cinza, fora da contagem de confirmados, sem data de
                 leilao, sem "edital" cru (o codigo interno do RJ as vezes traz
                 "sucata" no nome) e sem o texto de leilao fora do documento. -->
            <div v-if="passagensNotificadas.length" class="rel__notif-lista">
              <div v-for="p in passagensNotificadas" :key="`n${p.idx}`" class="rel__leilao rel__leilao--notif">
                <p class="rel__grav rel__grav--cinza">
                  <span class="rel__grav-barra" aria-hidden="true" />
                  <span class="rel__grav-rotulo">{{ p.tituloNotificacao }}</span>
                </p>
                <ul v-if="p.camposNotificacao.length" class="rel__leilao-detalhes">
                  <li v-for="c in p.camposNotificacao" :key="c.rotulo">
                    <span>{{ c.rotulo }}</span><strong>{{ c.valor }}</strong>
                  </li>
                </ul>
                <p class="rel__leilao-det">{{ EXPLICA_NOTIFICACAO }}</p>
              </div>
            </div>

            <!-- Lotes de perfil parecido COM FOTO. Não é indício e não acende
                 alerta: a fonte publica pouco do identificador, então quem
                 decide se é o veículo é a pessoa, comparando com o que ela tem
                 na garagem. Sem foto, esse bloco não existe: seria contagem
                 sem nada que a pessoa possa conferir. -->
            <div v-if="possiveisComFoto.length" class="rel__leilao-fotos">
              <p class="rel__leilao-fotos-txt">
                Encontramos {{ possiveisComFoto.length }}
                {{ possiveisComFoto.length > 1 ? 'lotes de leilão com perfil parecido' : 'lote de leilão com perfil parecido' }}
                com {{ esteVeiculo }} (marca, modelo, ano e final de placa), sem identificação completa.
                Não é indício: compare pelas fotos se é o seu veículo.
              </p>
              <div v-for="p in possiveisComFoto.slice(0, 3)" :key="`f${p.idx}`" class="rel__lote">
                <div class="rel__lote-fotos">
                  <a
                    v-for="(foto, i) in p.fotos.slice(0, 3)"
                    :key="`ft${i}`"
                    :href="foto"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img :src="foto" :alt="`Foto ${i + 1} do lote de leilão com perfil parecido`" loading="lazy" class="rel__lote-foto">
                  </a>
                </div>
                <p class="rel__lote-det">
                  <template v-if="p.detalhe">{{ p.detalhe }}</template>
                  <template v-if="p.gravidade"> · {{ p.gravidade.rotulo }}</template>
                </p>
              </div>
            </div>

            <p v-if="temIndicioReal || possiveisComFoto.length || passagensNotificadas.length" class="rel__leilao-aviso">
              Fonte: editais de órgãos de trânsito e catálogos de leiloeiras. Confirmado quer dizer placa ou chassi completos iguais; provável quer dizer identificador parcial mais atributos do veículo. Não substitui consulta oficial.
            </p>
          </section>

          <!-- ficha -->
          <section class="rel__card">
            <h2 class="rel__h2">{{ numSecao.ficha }}. Ficha cadastral e técnica</h2>

            <div v-if="licenciamento" class="rel__lic" :class="`rel__lic--${licenciamento.tom}`">
              <span class="rel__lic-pill">{{ licenciamento.rotulo }}</span>
              <span class="rel__lic-txt">
                Último licenciamento <strong>{{ licenciamento.ano }}</strong><template v-if="licenciamento.fonte">{{ licenciamento.fonte }}</template><template v-if="licenciamento.licenciadoEm"> · licenciado em {{ licenciamento.licenciadoEm }}</template><template v-if="licenciamento.emissao"> · documento emitido em {{ licenciamento.emissao }}</template><template v-if="licenciamento.nota"> · {{ licenciamento.nota }}</template>
              </span>
            </div>

            <!-- Ficha em DUAS colunas EXPLICITAS (nao grid 2xN): grid
                 alinha as row-tracks entre as colunas (cada linha fica da
                 altura do bloco mais alto), entao um bloco curto deixava
                 buraco branco ate o vizinho da linha terminar. Cada
                 .rel__ficha-col e flex column independente — os blocos
                 dela empacotam colados, sem alinhamento cruzado nenhum com
                 a outra coluna.

                 A distribuicao dos blocos entre as colunas vem de
                 fichaColunas (computed): balanceia caso a caso pra
                 minimizar a diferenca de altura, em vez de uma distribuicao
                 fixa — o numero de blocos e de linhas varia por relatorio. -->
            <div class="rel__ficha">
              <div class="rel__ficha-col">
                <div v-for="bloco in fichaColunas.esquerda" :key="bloco.key">
                  <span class="rel__sub">{{ bloco.titulo }}</span>
                  <p v-if="bloco.nota" class="rel__ficha-nota">{{ bloco.nota }}</p>
                  <table class="rel__tab">
                    <tbody>
                      <tr v-for="([k, val]) in bloco.linhas" :key="k"><td>{{ k }}</td><td>{{ val }}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="rel__ficha-col">
                <div v-for="bloco in fichaColunas.direita" :key="bloco.key">
                  <span class="rel__sub">{{ bloco.titulo }}</span>
                  <p v-if="bloco.nota" class="rel__ficha-nota">{{ bloco.nota }}</p>
                  <table class="rel__tab">
                    <tbody>
                      <tr v-for="([k, val]) in bloco.linhas" :key="k"><td>{{ k }}</td><td>{{ val }}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <!-- valor e custo: saiu da consulta gratis e agora e o que a basica
               entrega de imediato, antes da ficha tecnica -->
          <section v-if="temValor" class="rel__card">
            <h2 class="rel__h2">{{ numSecao.valor }}. Valor de mercado e custo de propriedade</h2>
            <!-- Sem versao identificada com seguranca, nada de numero: valor,
                 seguro e custo em cinco anos saem todos do mesmo valor FIPE, e
                 um valor errado contamina os tres. Prefiro dizer que nao sei a
                 dizer que uma scooter vale R$58 mil. -->
            <!-- Camada 3: so o cambio separa as versoes. O cliente toca no do
                 carro dele. -->
            <div v-if="fipeIncerta && opcaoCambio" class="rel__cambio">
              <p class="rel__cambio-tit">Seu carro é manual ou automático?</p>
              <p class="rel__cambio-txt">A tabela FIPE tem as duas versões deste modelo e o cadastro não informa o câmbio. Toque no do seu carro: o valor, o histórico e o seguro passam a ser os dessa versão.</p>
              <div class="rel__cambio-ops">
                <button type="button" class="rel__cambio-op" :disabled="!!escolhendoCambio" @click="escolherCambio(opcaoCambio.manual.codigo_fipe)">
                  <span>Manual</span><strong>{{ opcaoCambio.manual.valor ? brl(opcaoCambio.manual.valor) : '-' }}</strong>
                  <small v-if="escolhendoCambio === opcaoCambio.manual.codigo_fipe">Atualizando…</small>
                </button>
                <button type="button" class="rel__cambio-op" :disabled="!!escolhendoCambio" @click="escolherCambio(opcaoCambio.automatico.codigo_fipe)">
                  <span>Automático</span><strong>{{ opcaoCambio.automatico.valor ? brl(opcaoCambio.automatico.valor) : '-' }}</strong>
                  <small v-if="escolhendoCambio === opcaoCambio.automatico.codigo_fipe">Atualizando…</small>
                </button>
              </div>
              <p v-if="erroEscolhaCambio" class="rel__cambio-erro">{{ erroEscolhaCambio }}</p>
            </div>
            <div v-else-if="fipeIncerta" class="rel__fipe-incerta">
              <p class="rel__fipe-incerta-tit">Não foi possível identificar a versão FIPE com segurança</p>
              <p class="rel__fipe-incerta-txt">
                <template v-if="versoesCompativeis.length > 1">A tabela FIPE tem mais de uma versão compatível com a configuração deste veículo, e nenhuma bate o suficiente para afirmarmos qual é a certa. Confira no documento qual versão é a sua e use o valor correspondente na lista abaixo.</template>
                <template v-else>Nenhuma versão da tabela FIPE bate o suficiente com a configuração deste veículo para afirmarmos o valor. Preferimos não mostrar um valor que pode estar errado.</template>
              </p>
            </div>

            <div v-else class="rel__valores">
              <div v-if="fipeNaoLocalizada" class="rel__valor">
                <span class="rel__valor-k">Valor FIPE</span>
                <span class="rel__valor-v rel__valor-v--nl">não localizado para esta versão</span>
              </div>
              <div v-if="vc?.fipe" class="rel__valor">
                <span class="rel__valor-k">Valor FIPE</span>
                <span class="rel__valor-v">{{ vc.fipe }}</span>
                <span v-if="vc.fipeModelo" class="rel__valor-nota">{{ vc.fipeModelo }}</span>
                <span v-if="codigoFipe" class="rel__valor-nota">Código FIPE: {{ codigoFipe }}</span>
                <span v-if="dadosFipe" class="rel__valor-nota rel__dados-de">{{ dadosFipe }}</span>
                <span v-if="escolhaCambio?.cambio" class="rel__valor-nota">
                  Câmbio indicado por você: {{ escolhaCambio.cambio === 'manual' ? 'manual' : 'automático' }}.
                  <button v-if="outraOpcaoCambio" type="button" class="rel__cambio-trocar" :disabled="!!escolhendoCambio" @click="escolherCambio(outraOpcaoCambio.c.codigo_fipe)">
                    {{ escolhendoCambio ? 'Atualizando…' : `Trocar para ${outraOpcaoCambio.rotulo}` }}
                  </button>
                </span>
                <span v-if="erroEscolhaCambio && !fipeIncerta" class="rel__cambio-erro">{{ erroEscolhaCambio }}</span>
              </div>
              <div v-if="vc?.seguroAnual" class="rel__valor">
                <span class="rel__valor-k">Seguro estimado</span>
                <span class="rel__valor-v">{{ brl(vc.seguroAnual) }} / ano</span>
                <span v-if="vc.percentualFipe" class="rel__valor-nota">{{ vc.percentualFipe }}% do valor {{ segmento === 'moto' ? 'da moto' : 'do veículo' }}</span>
              </div>
              <div v-if="vc?.custo5anos" class="rel__valor">
                <span class="rel__valor-k">Custo em 5 anos</span>
                <span class="rel__valor-v">{{ brl(vc.custo5anos) }}</span>
                <span class="rel__valor-nota">IPVA e manutenção (sem seguro e combustível)</span>
              </div>
            </div>

            <!-- Custo de ter este carro em 12 meses (Relatorio 2.0, item 9). -->
            <div v-if="custo12" class="rel__c12">
              <div class="rel__c12-top">
                <span class="rel__sub">Custo de ter este carro em 12 meses</span>
                <span class="rel__c12-tag">Estimativa</span>
              </div>
              <p class="rel__c12-num"><strong>{{ brl(custo12.mensal) }}</strong> por mês <span>({{ brl(custo12.anual) }} em 12 meses)</span></p>
              <ul class="rel__c12-lista">
                <li v-for="l in custo12.linhas" :key="l.chave">
                  <span class="rel__c12-k">{{ l.rotulo }}<small v-if="l.nota">{{ l.nota }}</small></span>
                  <span class="rel__c12-v">{{ brl(l.mensal) }}/mês</span>
                </li>
              </ul>
              <p v-for="o in custo12.observacoes" :key="o" class="rel__c12-nota">{{ o }}</p>
              <p v-if="custo12.foraDaConta.length" class="rel__c12-nota">Fora da conta por falta de dado: {{ custo12.foraDaConta.join('; ') }}.</p>
              <p class="rel__c12-nota">{{ custo12.premissas.join(' ') }} {{ fonteCusto12 }}</p>
            </div>

            <!-- Versao FIPE ambigua: em vez de afirmar uma versao especifica
                 com risco de erro, mostra as versoes compativeis com a
                 configuracao do veiculo (cilindrada/carroceria) e deixa a
                 decisao final com quem esta lendo. -->
            <div v-if="fipeIncerta && versoesCompativeis.length > 1" class="rel__fipe-ambiguo">
              <span class="rel__sub">Versões compatíveis</span>
              <VersoesCompativeis :versoes="versoesCompativeis" :token="token" />
            </div>

            <div v-if="temGrafico && !fipeIncerta" class="rel__dep">
              <span class="rel__sub">Evolução do valor de mercado</span>
              <div v-if="variacao12 || variacao24" class="rel__var">
                <div v-for="v in [variacao12, variacao24].filter(Boolean)" :key="v!.meses" class="rel__var-item" :class="v!.delta < 0 ? 'rel__var-item--queda' : 'rel__var-item--alta'">
                  <span class="rel__var-k">Em {{ v!.meses }} meses</span>
                  <span class="rel__var-v">{{ fraseVariacao(v!) }}</span>
                  <span class="rel__var-n">de {{ brl(v!.de) }} em {{ v!.deRotulo }} para {{ brl(v!.ate) }} em {{ v!.ateRotulo }}</span>
                </div>
              </div>
              <GraficoValor :historico="historicoGrafico" />
              <button v-if="graficoTemMais" type="button" class="rel__var-toggle" @click="graficoCompleto = !graficoCompleto">
                {{ graficoCompleto ? 'Ver só os últimos 24 meses' : `Ver o histórico completo (desde ${vc.historico[0].label})` }}
              </button>
              <p v-if="historicoDesde" class="rel__dep-nota">Histórico disponível a partir de {{ historicoDesde }}.</p>
              <!-- As barras sao escaladas pela faixa da serie, nao pelo zero:
                   sem isso, oito barras iguais. Em troca, a legenda diz os
                   valores das pontas, senao a variacao parece maior do que e. -->
              <p v-if="vc.quedaAno !== null" class="rel__dep-txt">
                No histórico completo, de {{ brl(vc.historico[0].price) }} em {{ vc.historico[0].label }}
                para {{ brl(vc.historico[vc.historico.length - 1].price) }} em
                {{ vc.historico[vc.historico.length - 1].label }}:
                <strong>{{ vc.quedaAno < 0 ? 'queda' : 'alta' }} de {{ Math.abs(vc.quedaAno).toLocaleString('pt-BR') }}%</strong>.
              </p>
            </div>
          </section>

          <!-- Checklist de vistoria e transferencia (Relatorio 2.0, item 5). -->
          <section class="rel__card rel__check">
            <h2 class="rel__h2">{{ numSecao.check }}. O que conferir antes de fechar negócio</h2>
            <p class="rel__check-sub">Leve esta lista na hora de ver o carro. Os itens marcados vêm do que consta neste relatório.</p>
            <div class="rel__check-cols">
              <div v-for="bloco in [{ t: 'Na vistoria do carro', itens: checklist.vistoria }, { t: 'Na transferência', itens: checklist.transferencia }]" :key="bloco.t" class="rel__check-col">
                <h3 class="rel__check-h3">{{ bloco.t }}</h3>
                <ul class="rel__check-lista">
                  <li v-for="(it, i) in bloco.itens" :key="i" :class="{ 'rel__check-item--rel': it.doRelatorio }">
                    <span class="rel__check-box" aria-hidden="true" />
                    <span>
                      <small v-if="it.doRelatorio" class="rel__check-tag">Deste relatório</small>
                      {{ it.texto }}
                    </span>
                  </li>
                </ul>
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
              restrições nacionais e estaduais, roubo e furto, registro de leilão, gravame,
              RENAJUD e indicador de multas.
            </p>
            <NuxtLink class="rel__btn rel__btn--primario" :to="`/?placa=${data.placa}&plano=completa`">
              Relatório completo · {{ precoBRL(PLANOS.completa.valorCentavos) }}
            </NuxtLink>
          </section>

          <!-- Nova consulta: incentivo pra voltar depois de ver o relatorio
               pronto. So tela (mesmo tratamento do upsell da basica acima,
               .rel__card--up some na impressao: e conversa de produto, nao
               parte do laudo). -->
          <!-- Cupom de recompra (20%, 7 dias, qualquer placa, pode compartilhar).
               Opcao 1 do Cesar + botao de WhatsApp. Sem cupom (vencido ou
               relatorio antigo): card simples. -->
          <section v-if="cupomCard" class="rel__card rel__card--up rel__recompra">
            <p class="rel__recompra-eyebrow">Vai ver outro carro?</p>
            <h2 class="rel__recompra-tit">Sua próxima consulta sai com 20% de desconto</h2>
            <div class="rel__recompra-chip">
              <span ref="codigoCupomEl" class="rel__recompra-codigo">{{ cupomCard.codigo }}</span>
              <button type="button" class="rel__recompra-copiar" @click="copiarCupom">{{ cupomCopiado ? 'Copiado' : 'Copiar' }}</button>
            </div>
            <p class="rel__recompra-meta">{{ metaCupomRecompra(cupomCard) }}</p>
            <div class="rel__recompra-botoes">
              <NuxtLink class="rel__btn rel__btn--primario" to="/">Consultar outra placa</NuxtLink>
              <a class="rel__btn rel__btn--wa" :href="linkWhatsappRecompra(cupomCard)" target="_blank" rel="noopener" @click="cliqueWhatsappCupom">Enviar no WhatsApp</a>
            </div>
          </section>
          <section v-else class="rel__card rel__card--up rel__recompra">
            <h2 class="rel__recompra-tit">Precisa consultar outro veículo?</h2>
            <NuxtLink class="rel__btn rel__btn--primario" to="/">Consultar outra placa</NuxtLink>
          </section>

          <footer class="rel__aut">
            <div v-if="qrSvg" class="rel__aut-qr" aria-hidden="true" v-html="qrSvg" />
            <div class="rel__aut-txt">
              <strong>Verificação de autenticidade</strong>
              <span>
                Aponte a câmera para o código ou acesse o endereço deste relatório para
                conferir o documento original.
              </span>
              <span class="rel__aut-id">Documento {{ numeroDoc }} · placa {{ data.placa }} · placacompleta.com.br</span>
            </div>
          </footer>

          <!-- so na impressao: marca d'agua e rodape corrido de cada folha -->
          <img src="/logo-horizontal-600.png" alt="" class="rel__print-marca" aria-hidden="true">
          <div class="rel__print-pe" aria-hidden="true">
            Relatório de Consulta Veicular · Documento {{ numeroDoc }} · placa {{ data.placa }} · verifique em placacompleta.com.br
          </div>
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
$c-steel: #c2c2c2;
$fonte: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

.rel {
  // Escala de fonte do LAUDO (pedido do Cesar, 02/out: +10%). Um ponto so:
  // todo font-size deste arquivo e calc(Npx * var(--rel-fs)). Vale so com o
  // relatorio entregue na tela (rel__wrap--laudo); impressao volta a 1.
  --rel-fs: 1;
  .rel__wrap--laudo { --rel-fs: 1.1; }
  @media print { .rel__wrap--laudo { --rel-fs: 1; } }

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

  // Esta pagina nao decide NADA sobre o header: ele vem inteiro do parcial
  // global. Chegou a ter max-width de 860px pra casar com a coluna do
  // relatorio, mas nessa largura os cinco links quebravam em duas linhas e a
  // barra ia a 112px contra 80px da home.

  &__tipo-fora {
    display: block;
    font-size: calc(12px * var(--rel-fs, 1));
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $c-graphite;
    margin-bottom: 12px;
  }

  &__tipo {
    font-size: calc(12px * var(--rel-fs, 1));
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
    font-size: calc(12px * var(--rel-fs, 1));
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $c-graphite;
  }

  &__h {
    font-size: calc(clamp(22px, 3vw, 28px) * var(--rel-fs, 1));
    font-weight: 500;
    letter-spacing: 0;
    line-height: 1.1;
    margin: 0;
  }

  &__h2 {
    font-size: calc(11px * var(--rel-fs, 1));
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $c-graphite;
    margin: 0 0 12px;
  }

  &__hint {
    font-size: calc(15px * var(--rel-fs, 1)); line-height: 1.45; color: $c-charcoal; margin: 0;
    strong { color: $c-ink; }
    &--erro { color: $c-red; margin-top: 12px; }
  }

  // ---- cabecalho de documento ----
  &__doc {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    padding: 4px 2px 14px;
    border-bottom: 2px solid $c-slab;
  }

  &__doc-logo,
  &__doc-logo :deep(.placa-logo) { height: 48px; width: auto; flex-shrink: 0; }

  &__doc-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    text-align: right;
  }

  &__doc-titulo {
    font-size: calc(15px * var(--rel-fs, 1));
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $c-slab;
  }

  &__doc-linha {
    font-size: calc(12.5px * var(--rel-fs, 1));
    color: $c-graphite;
  }

  // Faixa de entrega por e-mail: discreta de proposito. Ela nao pode competir
  // com o relatorio, que e o que a pessoa veio ver; e um servico oferecido, nao
  // um passo pendente.
  &__email {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 16px;
    margin-bottom: 16px;
    padding: 12px 14px;
    border: 1px solid $c-hair;
    border-radius: 12px;
    background: $c-cloud;
  }

  &__email-txt {
    display: flex;
    flex-direction: column;
    min-width: 0;
    font-size: calc(13.5px * var(--rel-fs, 1));
    line-height: 1.4;

    strong { color: $c-ink; font-weight: 600; }
    span { color: $c-graphite; }
  }

  &__email-form {
    display: flex;
    gap: 8px;
    flex: 1 1 260px;
    min-width: 0;
  }

  &__email-input {
    flex: 1 1 auto;
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid $c-steel;
    border-radius: 4px;
    font-family: inherit;
    font-size: calc(14px * var(--rel-fs, 1));
    color: $c-ink;
    background: $c-canvas;

    &:focus-visible { outline: 2px solid $c-blue; outline-offset: 1px; border-color: $c-blue; }
  }

  // Rotulo so pra leitor de tela: o campo tem placeholder e a frase ao lado ja
  // diz o que ele e. A classe global visually-hidden nao existe fora da home.
  &__sr {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  &__email-ok {
    margin: 0;
    font-size: calc(13.5px * var(--rel-fs, 1));
    line-height: 1.4;
    color: $c-ink;
  }

  &__doc-validade {
    margin: 8px 2px 0;
    font-size: calc(12.5px * var(--rel-fs, 1));
    color: $c-graphite;
  }

  @media (max-width: 640px) {
    &__doc { flex-direction: column; align-items: flex-start; }
    &__doc-meta { align-items: flex-start; text-align: left; }
  }

  &__parecer-rotulo {
    display: block;
    margin: 16px 0 6px;
    font-size: calc(11px * var(--rel-fs, 1));
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $c-graphite;
  }

  &__nada {
    margin: 0;
    font-size: calc(14px * var(--rel-fs, 1));
    color: $c-charcoal;
  }

  // ---- verificacao de autenticidade ----
  &__recompra { display: flex; flex-direction: column; gap: 12px; }
  &__recompra-eyebrow {
    margin: 0;
    font-size: calc(11.5px * var(--rel-fs, 1));
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $c-graphite;
  }
  &__recompra-tit {
    margin: 0;
    font-size: calc(19px * var(--rel-fs, 1));
    font-weight: 700;
    line-height: 1.3;
    color: $c-ink;
  }
  &__recompra-chip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    background: #eaf1ff;
    border: 1.5px dashed $c-blue;
    border-radius: 10px;
  }
  &__recompra-codigo {
    font-family: $font-mono;
    font-weight: 700;
    letter-spacing: 0.06em;
    font-size: calc(18px * var(--rel-fs, 1));
    color: $c-blue-deep;
    overflow-wrap: anywhere;
    user-select: all;
  }
  &__recompra-copiar {
    flex-shrink: 0;
    font-family: $fonte;
    font-size: calc(13px * var(--rel-fs, 1));
    font-weight: 600;
    background: $c-canvas;
    color: $c-blue-deep;
    border: 1px solid $c-blue;
    border-radius: 6px;
    padding: 6px 12px;
    min-height: 36px;
    cursor: pointer;
    &:focus-visible { outline: 2px solid $c-blue; outline-offset: 2px; }
  }
  &__recompra-meta { margin: 0; font-size: calc(13px * var(--rel-fs, 1)); color: $c-graphite; }
  &__recompra-botoes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    .rel__btn { flex: 1 1 200px; }
  }

  &__aut {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 8px;
    padding: 14px 16px;
    border: 1px solid $c-hair;
    border-radius: 4px;
    background: $c-canvas;
  }

  &__aut-qr {
    width: 76px;
    height: 76px;
    flex-shrink: 0;

    :deep(svg) { width: 100%; height: 100%; display: block; }
  }

  &__aut-txt {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: calc(12.5px * var(--rel-fs, 1));
    line-height: 1.45;
    color: $c-graphite;

    strong {
      font-size: calc(11px * var(--rel-fs, 1));
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: $c-ink;
    }
  }

  &__aut-id { color: $c-charcoal; }

  // so existem no papel
  &__print-marca,
  &__print-pe { display: none; }

  // ---- veiculo + veredito ----
  &__veh {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 16px;
    border-bottom: 1px solid $c-hair;

    // No celular os tres blocos nao cabem lado a lado: espremido, o nome do
    // veiculo quebrava palavra a palavra. A placa desce pra linha de baixo.
    @media (max-width: 640px) {
      flex-wrap: wrap;
    }
  }

  &__restr-topo {
    display: flex;
    gap: 10px;
    align-items: center;

    strong { color: $c-ink; font-weight: 600; }
  }

  &__restr-explica {
    margin: 6px 0 0;
    font-size: calc(13px * var(--rel-fs, 1));
    line-height: 1.5;
    color: $c-graphite;
  }

  // Tooltip dos indicadores: botao de foco de verdade, entao funciona por
  // hover no mouse e por toque/Tab no resto. O texto vem de data-dica via
  // content: attr(), sem JS.
  &__ind-glue { white-space: nowrap; }

  &__info {
    // Tooltip e coisa de ponteiro: no celular nao ha hover e o toque ja tem
    // dono (o cartao). O icone so existe do desktop pra cima.
    display: none;

    @media (min-width: 1024px) { display: inline-flex; }
    align-items: center;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin-left: 4px;
    padding: 0;
    border: 0;
    background: transparent;
    color: $c-steel;
    cursor: help;
    position: relative;
    vertical-align: middle;

    svg { width: 15px; height: 15px; display: block; }

    &:hover, &:focus { color: $c-graphite; }

    &::after {
      content: attr(data-dica);
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      width: max-content;
      max-width: min(220px, 58vw);
      padding: 8px 10px;
      border-radius: 4px;
      background: $c-slab;
      color: #fff;
      font-size: calc(11.5px * var(--rel-fs, 1));
      font-weight: 400;
      font-style: normal;
      line-height: 1.45;
      text-align: left;
      white-space: normal;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.12s ease;
      z-index: 30;
    }

    &::before {
      content: '';
      position: absolute;
      bottom: calc(100% + 3px);
      left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: $c-slab;
      opacity: 0;
      transition: opacity 0.12s ease;
    }

    &:hover::after, &:focus::after,
    &:hover::before, &:focus::before { opacity: 1; }

    &:focus-visible { outline: 2px solid $c-blue; outline-offset: 2px; }
  }

  // Ocorrencias: cada uma e um bloco datado; a nota final orienta o que fazer.
  &__ocorr {
    padding: 12px 14px;
    border: 1px solid rgba(211, 58, 58, 0.35);
    background: #fdf1f1;
    border-radius: 4px;

    & + & { margin-top: 10px; }
  }

  &__ocorr-topo {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  &__ocorr-data {
    font-size: calc(13px * var(--rel-fs, 1));
    font-weight: 700;
    color: #8c2323;
    white-space: nowrap;
  }

  &__ocorr-det {
    margin: 8px 0 0;
    font-size: calc(14px * var(--rel-fs, 1));
    line-height: 1.45;
    color: $c-charcoal;
  }

  // ---- cartao do caso (roubo e furto) ----
  // O cabecalho colorido carrega o veredito; a tabela embaixo e a ficha das
  // datas. `break-inside: avoid` porque este relatorio e impresso e mostrado
  // pro vendedor, e um episodio partido em duas paginas perde o sentido.
  &__caso {
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;

    & + & { margin-top: 14px; }
  }

  &__caso-hd {
    padding: 12px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;

    strong { font-size: calc(15px * var(--rel-fs, 1)); }

    small {
      display: block;
      font-size: calc(12px * var(--rel-fs, 1));
      font-weight: 600;
      color: $c-charcoal;
      margin-top: 2px;
    }

    &--ok { background: #eaf7ee; strong { color: #14622f; } }
    &--bad { background: #fdf1f1; strong { color: #a32020; } }
  }

  &__caso-tab {
    width: 100%;
    border-collapse: collapse;
    font-size: calc(13.5px * var(--rel-fs, 1));

    td {
      padding: 9px 14px;
      border-top: 1px solid #eee;
      vertical-align: top;
    }

    td:first-child {
      width: 44%;
      font-weight: 600;
      color: $c-graphite;
    }

    td:last-child {
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
  }

  // A etapa que falta e o que mantem o caso em aberto: ela precisa ser a
  // unica coisa vermelha da tabela.
  &__caso-linha--vazia td:last-child { color: #a32020; }

  &__caso-det {
    display: block;
    margin-top: 2px;
    font-size: calc(12.5px * var(--rel-fs, 1));
    font-weight: 600;
    color: $c-graphite;
  }

  &__ocorr-nota {
    margin: 12px 0 0;
    font-size: calc(13px * var(--rel-fs, 1));
    line-height: 1.5;
    color: $c-graphite;
  }

  // ---- historico de leilao ----
  // Regra visual: o NIVEL manda. Confirmado usa a mesma tinta de alerta dos
  // indicadores ruins (e fato); provavel usa ambar (pede conferencia);
  // possivel fica cinza, quase nota de rodape, porque pode ser outro carro.
  &__nivel {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    font-size: calc(11px * var(--rel-fs, 1));
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 4px 9px;
    border-radius: 4px;
    border: 1px solid;
  }
  &__nivel--confirmado { color: #a32020; border-color: rgba(211, 58, 58, 0.4); background: rgba(211, 58, 58, 0.08); }
  &__nivel--provavel { color: #8a5200; border-color: rgba(180, 83, 9, 0.4); background: rgba(180, 83, 9, 0.08); }
  &__nivel--possivel { color: $c-graphite; border-color: $c-hair; background: $c-cloud; }

  &__leilao-resumo {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 14px;
    font-size: calc(14px * var(--rel-fs, 1));
    color: $c-charcoal;
  }

  &__leilao {
    border: 1px solid $c-hair;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 10px;

    &:last-of-type { margin-bottom: 0; }
  }

  &__leilao-topo {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__leilao-fonte { font-size: calc(15px * var(--rel-fs, 1)); font-weight: 600; color: $c-ink; }
  &__leilao-tipo { font-size: calc(12px * var(--rel-fs, 1)); color: $c-graphite; }

  &__leilao-det {
    margin: 0 0 4px;
    font-size: calc(14px * var(--rel-fs, 1));
    line-height: 1.5;
    color: $c-charcoal;
  }

  // Contexto, nao alerta: explica por que o documento pode nao trazer isto,
  // em tom menor que a passagem em si.
  &__leilao-ctx {
    margin: 6px 0 4px;
    font-size: calc(13px * var(--rel-fs, 1));
    line-height: 1.45;
    color: $c-graphite;
  }

  &__edital {
    margin: 10px 0 4px;
    padding: 10px 12px;
    border: 1px solid $c-hair;
    border-radius: 8px;
    background: $c-cloud;
  }

  &__edital-aviso {
    margin: 8px 0 0;
    font-size: calc(12.5px * var(--rel-fs, 1));
    line-height: 1.45;
    color: $c-graphite;
  }

  &__leilao-mais {
    margin-top: 6px;
    padding: 4px 0;
    background: none;
    border: 0;
    font: inherit;
    font-size: calc(13px * var(--rel-fs, 1));
    color: $c-blue;
    text-decoration: underline;
    cursor: pointer;

    &:focus-visible { outline: 2px solid $c-blue; outline-offset: 2px; }
  }

  // ---- termometro de gravidade ----
  // A cor vem pronta da API (verde/amarelo/laranja/vermelho/cinza) e e o sinal
  // mais rapido da secao: diz se a passagem foi sinistro feio, sinistro leve ou
  // so retomada de financiamento. Barra curta a esquerda + rotulo, pra ler de
  // relance sem depender so de cor (o texto diz a mesma coisa).
  &__grav {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 8px;
    font-size: calc(14px * var(--rel-fs, 1));
    font-weight: 600;
  }

  &__grav-barra {
    width: 26px;
    height: 6px;
    border-radius: 999px;
    flex-shrink: 0;
    background: $c-steel;
  }

  &__leilao-quem { margin: 6px 0 2px; }
  &__leilao-comit {
    margin: 0;
    font-size: calc(14px * var(--rel-fs, 1));
    font-weight: 600;
    color: $c-ink;
    span { font-weight: 500; color: $c-graphite; }
  }
  &__leilao-comit-frase {
    margin: 2px 0 0;
    font-size: calc(13px * var(--rel-fs, 1));
    color: $c-charcoal;
  }
  &__grav--verde { color: #14622f; .rel__grav-barra { background: $c-green; } }
  &__grav--amarelo { color: #8a6100; .rel__grav-barra { background: #e0a800; } }
  &__grav--laranja { color: #8a4b00; .rel__grav-barra { background: #e07a00; } }
  &__grav--vermelho { color: #a32020; .rel__grav-barra { background: $c-red; } }
  &__grav--cinza { color: $c-graphite; .rel__grav-barra { background: $c-steel; } }
  // Notificacao para leilao: mesmo cartao da passagem, sem peso de alerta.
  &__notif-lista { margin-top: 12px; }
  &__leilao--notif { background: #f6f7f9; .rel__leilao-detalhes { margin-bottom: 10px; } }

  &__leilao-detalhes {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;

    li {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      font-size: calc(13px * var(--rel-fs, 1));
      color: $c-graphite;
      border-bottom: 1px dashed $c-hair;
      padding: 4px 0;

      &:last-child { border-bottom: 0; }
    }

    strong {
      font-weight: 600;
      color: $c-charcoal;
      text-align: right;
    }
  }

  &__leilao-toggle {
    display: inline-block;
    margin: 4px 0 8px;
    padding: 9px 14px;
    background: $c-cloud;
    border: 1px solid $c-hair;
    border-radius: 6px;
    font: inherit;
    font-size: calc(14px * var(--rel-fs, 1));
    font-weight: 600;
    color: $c-charcoal;
    cursor: pointer;

    &:hover { border-color: $c-steel; }
    &:focus-visible { outline: 2px solid $c-blue; outline-offset: 2px; }
  }

  &__leilao-evid {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid $c-hair;
  }

  &__leilao-explica {
    margin: 0 0 10px;
    font-size: calc(13px * var(--rel-fs, 1));
    line-height: 1.5;
    color: $c-graphite;
  }

  &__leilao-sub {
    margin: 0 0 4px;
    font-size: calc(11px * var(--rel-fs, 1));
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $c-graphite;
  }

  &__leilao-lista {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;

    li {
      position: relative;
      padding-left: 16px;
      font-size: calc(13px * var(--rel-fs, 1));
      line-height: 1.45;
      color: $c-charcoal;

      &::before {
        content: '';
        position: absolute;
        left: 2px;
        top: 7px;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: $c-green;
      }
    }

    &:last-child { margin-bottom: 0; }
  }

  &__leilao-lista--conflito li::before { background: $c-red; }

  // "Dados de dd/mm": bloco que veio do cache de outro dia.
  &__dados-de {
    margin: -4px 0 10px;
    font-size: calc(12px * var(--rel-fs, 1));
    color: $c-graphite;
  }

  &__leilao-base {
    margin: 0 0 12px;
    font-size: calc(13px * var(--rel-fs, 1));
    line-height: 1.5;
    color: $c-graphite;
  }

  &__leilao-limpo {
    margin: 0;
    font-size: calc(15px * var(--rel-fs, 1));
    line-height: 1.5;
    color: $c-charcoal;
  }

  &__leilao-fotos {
    border: 1px solid $c-hair;
    border-radius: 8px;
    padding: 14px;
    margin-top: 12px;
  }

  &__leilao-fotos-txt {
    margin: 0 0 12px;
    font-size: calc(14px * var(--rel-fs, 1));
    line-height: 1.5;
    color: $c-charcoal;
  }

  &__lote {
    padding-top: 12px;
    border-top: 1px solid $c-hair;
    margin-top: 12px;

    &:first-of-type { border-top: 0; padding-top: 0; margin-top: 0; }
  }

  &__lote-fotos {
    display: flex;
    gap: 8px;
    overflow-x: auto;
  }

  &__lote-foto {
    width: 132px;
    height: 99px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid $c-hair;
    display: block;
  }

  &__lote-det {
    margin: 8px 0 0;
    font-size: calc(13px * var(--rel-fs, 1));
    line-height: 1.45;
    color: $c-graphite;
  }


  &__leilao-aviso {
    margin: 12px 0 0;
    font-size: calc(12px * var(--rel-fs, 1));
    line-height: 1.5;
    color: $c-graphite;
  }

  // Faixa do licenciamento: mesmo vocabulario dos indicadores (verde bom,
  // ambar confira, vermelho problema), acima das colunas da ficha.
  &__lic {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border: 1px solid;
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: calc(14px * var(--rel-fs, 1));
    line-height: 1.45;

    strong { font-weight: 700; }

    &--ok      { background: #eef9f1; border-color: rgba(30, 158, 74, 0.35); color: #14622f; }
    &--atencao { background: #fdf8ec; border-color: rgba(154, 100, 0, 0.35); color: #6d4a05; }
    &--alerta  { background: #fdf1f1; border-color: rgba(211, 58, 58, 0.35); color: #8c2323; }
  }

  &__lic-pill {
    font-size: calc(11px * var(--rel-fs, 1));
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
    padding: 3px 8px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.75);
  }

  &__veh-txt {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;

    // No celular o texto exige largura minima de verdade: com min-width 0 ele
    // encolhia ate caber espremido ao lado da placa em vez de empurra-la pra
    // linha de baixo, e o nome quebrava palavra a palavra.
    @media (max-width: 640px) {
      min-width: 200px;
    }

    strong { font-size: calc(18px * var(--rel-fs, 1)); font-weight: 500; }
    span { font-size: calc(13.5px * var(--rel-fs, 1)); color: $c-graphite; }
  }

  // A mesma placa simulada do hero, em miniatura: o cliente reconhece o objeto
  // que digitou. Largura fixa porque o dimensionamento interno e por container
  // query, entao a proporcao se resolve sozinha a partir dela.
  // A placa e o identificador do laudo: 132px sumia ao lado do logo de 56px.
  // 190px poe os caracteres na mesma escala do nome do veiculo. No celular
  // encolhe, senao logo + placa nao deixam largura pro texto.
  //
  // A largura BASE (190px) agora vem da prop `width` do PlacaMercosul (style
  // inline no proprio componente) e nao mais desta classe: essa classe e o
  // CSS de escopo do PROPRIO PlacaMercosul (.cb-plate{width:100%}) ficavam
  // com a MESMA especificidade no elemento raiz (Vue funde a class externa
  // nele), entao quem vencia era so questao de qual chunk de CSS carregava
  // primeiro — causava o flash reportado (placa nascia grande, 460px, e so
  // encolhia quando o CSS da pagina terminava de carregar). Style inline
  // resolve isso de vez, sem depender de ordem de carga.
  //
  // O media query do celular PRECISA de !important: e a UNICA forma de uma
  // regra de classe vencer um style inline (que sempre tem prioridade maior
  // que qualquer classe, com ou sem !important do outro lado).
  &__placa-tag {
    @media (max-width: 640px) {
      width: 178px !important;
      // Sem recuo: a placa alinha na borda esquerda da propria linha. (Um
      // margin-left aqui perderia mesmo: .cb-plate.is-mini zera margin com
      // duas classes de especificidade.)
    }
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
    font-size: calc(11px * var(--rel-fs, 1));
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $c-graphite;
  }

  &__valor-v {
    font-size: calc(22px * var(--rel-fs, 1));
    font-weight: 500;
    line-height: 1;
    color: $c-ink;

    &--nl { font-size: calc(15px * var(--rel-fs, 1)); line-height: 1.3; color: $c-graphite; }
  }

  &__valor-nota {
    font-size: calc(12px * var(--rel-fs, 1));
    color: $c-graphite;
  }

  &__dep {
    margin-top: 20px;
  }

  &__dep-nota {
    margin: 6px 0 0;
    font-size: calc(13px * var(--rel-fs, 1));
    color: $c-charcoal;
    font-style: italic;
  }

  &__dep-txt {
    margin-top: 10px;
    font-size: calc(13px * var(--rel-fs, 1));
    color: $c-charcoal;
  }

  &__fipe-incerta {
    border: 1px solid rgba(180, 83, 9, 0.35);
    background: #fdf8ec;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 16px;
  }

  &__fipe-incerta-tit {
    margin: 0 0 6px;
    font-size: calc(15px * var(--rel-fs, 1));
    font-weight: 700;
    color: #8a5200;
  }

  &__fipe-incerta-txt {
    margin: 0;
    font-size: calc(14px * var(--rel-fs, 1));
    line-height: 1.5;
    color: $c-charcoal;
  }

  &__cambio {
    margin: 4px 0 18px;
    padding: 16px;
    border: 1px solid $c-hair;
    border-radius: 12px;
    background: #f7f9fc;
  }
  &__cambio-tit { margin: 0 0 4px; font-weight: 700; font-size: calc(16px * var(--rel-fs, 1)); color: $c-ink; }
  &__cambio-txt { margin: 0 0 12px; font-size: calc(13.5px * var(--rel-fs, 1)); color: $c-graphite; line-height: 1.5; }
  &__cambio-ops { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
  &__cambio-op {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-height: 64px;
    min-width: 0;
    box-sizing: border-box;
    padding: 12px 14px;
    border: 1.5px solid #1f6feb;
    border-radius: 10px;
    background: #fff;
    color: $c-ink;
    font: inherit;
    text-align: left;
    cursor: pointer;

    span { font-size: calc(13px * var(--rel-fs, 1)); color: $c-graphite; }
    strong { font-size: calc(18px * var(--rel-fs, 1)); font-variant-numeric: tabular-nums; }
    small { font-size: 12px; color: #1f6feb; }
    &:disabled { opacity: .6; cursor: wait; }
    &:focus-visible { outline: 2px solid #1f6feb; outline-offset: 2px; }
  }
  &__cambio-erro { margin: 10px 0 0; font-size: 13px; color: #b42318; }
  &__cambio-trocar {
    background: none; border: 0; padding: 0; margin-left: 4px;
    color: #1f6feb; font: inherit; text-decoration: underline; cursor: pointer;
  }

  &__fipe-ambiguo {
    margin-top: 20px;
  }

  &__fipe-ambiguo-txt {
    margin: 6px 0 10px;
    font-size: calc(13px * var(--rel-fs, 1));
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
    font-size: calc(14px * var(--rel-fs, 1));
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

  // Quieto quando esta bem, alto quando nao esta: doze caixas verdes gritando
  // deixavam o problema sem contraste. O ok e neutro com ponto verde; so o
  // problema ganha fundo e borda de cor.
  &__ind {
    border: 1px solid $c-hair;
    border-radius: 4px;
    padding: 10px 12px;
    background: $c-canvas;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  &__ind-lab { font-size: calc(11.5px * var(--rel-fs, 1)); color: $c-graphite; }

  &__ind-val {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: calc(12px * var(--rel-fs, 1));
    font-weight: 700;
    letter-spacing: 0.03em;

    &::before {
      content: '';
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
  }

  // ---- linha do tempo do veiculo ----
  &__tempo-sub { margin: 0 0 10px; font-size: calc(13px * var(--rel-fs, 1)); color: #555; }
  &__tempo { list-style: none; margin: 0; padding: 0; }
  &__tempo-item {
    display: grid;
    grid-template-columns: 86px 18px 1fr;
    gap: 8px;
    align-items: start;
    position: relative;
    padding: 0 0 12px;
    break-inside: avoid;
  }
  &__tempo-item:not(:last-child)::after {
    content: '';
    position: absolute;
    left: calc(86px + 8px + 8px);
    top: 14px;
    bottom: -2px;
    width: 2px;
    background: #e3e6ea;
  }
  &__tempo-quando { font-size: calc(12.5px * var(--rel-fs, 1)); color: #555; text-align: right; padding-top: 1px; font-variant-numeric: tabular-nums; }
  &__tempo-ponto { width: 12px; height: 12px; margin: 3px 0 0 3px; border-radius: 50%; background: #9aa4b2; position: relative; z-index: 1; }
  &__tempo-txt { min-width: 0; font-size: calc(13.5px * var(--rel-fs, 1)); line-height: 1.35; }
  &__tempo-txt b { display: block; font-weight: 600; color: #1a1a1a; }
  &__tempo-txt small { display: block; color: #555; font-size: calc(12.5px * var(--rel-fs, 1)); }
  &__tempo-ver { color: #1f5fbf !important; }
  &__tempo-item--alerta .rel__tempo-ponto { background: #c62828; }
  &__tempo-item--alerta b { color: #a01d1d; }
  &__tempo-item--atencao .rel__tempo-ponto { background: #d98a00; }
  &__tempo-item--ok .rel__tempo-ponto { background: #1f8a4c; }

  // ---- checklist de vistoria e transferencia ----
  &__check-sub { margin: 0 0 12px; font-size: calc(13px * var(--rel-fs, 1)); color: #555; }
  &__check-cols { display: grid; grid-template-columns: 1fr; gap: 16px; }
  @media (min-width: 900px) { &__check-cols { grid-template-columns: 1fr 1fr; gap: 24px; } }
  &__check-h3 { margin: 0 0 8px; font-size: calc(14px * var(--rel-fs, 1)); font-weight: 700; color: #1a1a1a; }
  &__check-lista { list-style: none; margin: 0; padding: 0; }
  &__check-lista li {
    display: grid; grid-template-columns: 18px 1fr; gap: 10px; align-items: start;
    padding: 7px 0; border-bottom: 1px solid #eef0f3;
    font-size: calc(13.5px * var(--rel-fs, 1)); line-height: 1.4; color: #222;
    break-inside: avoid;
  }
  &__check-lista li:last-child { border-bottom: 0; }
  &__check-box { width: 16px; height: 16px; margin-top: 2px; border: 1.5px solid #8a94a3; border-radius: 3px; background: #fff; }
  &__check-item--rel { background: #fff8e6; margin: 0 -8px; padding-left: 8px !important; padding-right: 8px !important; border-radius: 6px; }
  &__check-item--rel .rel__check-box { border-color: #d98a00; }
  &__check-tag { display: block; font-size: calc(11px * var(--rel-fs, 1)); font-weight: 700; letter-spacing: .03em; text-transform: uppercase; color: #a86a00; margin-bottom: 1px; }
  @media print { &__check-cols { grid-template-columns: 1fr 1fr; gap: 18px; } }

  // ---- custo de 12 meses ----
  &__c12 { margin: 16px 0 0; padding: 14px; border: 1px solid #e3e6ea; border-radius: 12px; background: #fafbfc; break-inside: avoid; }
  &__c12-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  &__c12-tag { font-size: calc(11px * var(--rel-fs, 1)); font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #6b5200; background: #fff3cd; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
  &__c12-num { margin: 8px 0 10px; font-size: calc(14px * var(--rel-fs, 1)); color: #333; }
  &__c12-num strong { font-size: calc(24px * var(--rel-fs, 1)); color: #111; }
  &__c12-num span { color: #666; white-space: nowrap; }
  &__c12-lista { list-style: none; margin: 0; padding: 0; }
  &__c12-lista li { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 7px 0; border-top: 1px solid #eceef1; font-size: calc(13.5px * var(--rel-fs, 1)); }
  &__c12-k { min-width: 0; color: #222; }
  &__c12-k small { display: block; color: #666; font-size: calc(12px * var(--rel-fs, 1)); }
  &__c12-v { white-space: nowrap; font-weight: 600; font-variant-numeric: tabular-nums; }
  &__c12-nota { margin: 8px 0 0; font-size: calc(12px * var(--rel-fs, 1)); color: #666; line-height: 1.45; }

  // ---- variacao da FIPE em 12/24 meses (13a) ----
  &__var { display: grid; grid-template-columns: 1fr; gap: 8px; margin: 8px 0 10px; }
  @media (min-width: 640px) { &__var { grid-template-columns: 1fr 1fr; } }
  &__var-item { border: 1px solid #e3e6ea; border-radius: 10px; padding: 10px 12px; background: #fff; break-inside: avoid; }
  &__var-k { display: block; font-size: calc(11.5px * var(--rel-fs, 1)); font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #666; }
  &__var-v { display: block; margin-top: 2px; font-size: calc(15px * var(--rel-fs, 1)); font-weight: 700; color: #1a1a1a; }
  &__var-item--queda .rel__var-v { color: #a01d1d; }
  &__var-item--alta .rel__var-v { color: #14622f; }
  &__var-n { display: block; margin-top: 2px; font-size: calc(12px * var(--rel-fs, 1)); color: #666; }
  &__var-toggle { margin: 6px 0 0; padding: 0; border: 0; background: none; color: #1f5fbf; font: inherit; font-size: calc(13px * var(--rel-fs, 1)); cursor: pointer; text-decoration: underline; }
  @media print { &__var-toggle { display: none; } }

  // ---- leilao: campos do Relatorio 2.0 ----
  &__leilao-recorr { margin: 6px 0 10px; padding: 8px 12px; border-left: 3px solid #c62828; background: #fdf1f1; color: #8a1c1c; font-weight: 600; font-size: calc(13.5px * var(--rel-fs, 1)); border-radius: 4px; }
  &__leilao-origem, &__leilao-desf, &__leilao-jud, &__leilao-lote { margin: 6px 0 0; font-size: calc(13px * var(--rel-fs, 1)); color: #333; }
  &__leilao-origem span, &__leilao-desf span { color: #666; }
  &__leilao-jud a, &__leilao-lote a { color: #1f5fbf; }
  &__leilao-alertas { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
  &__leilao-alertas li { padding: 3px 9px; border-radius: 999px; background: #fff3cd; color: #6b4e00; font-size: calc(12px * var(--rel-fs, 1)); font-weight: 600; }

  // ---- recall pendente (Opcao 1 "Alerta classico") ----
  // Cartao vermelho com icone, titulo, subtitulo da campanha, corpo com o
  // componente em negrito + descricao, e a linha verde do reparo gratuito.
  &__recall {
    margin: 14px 0 0;
    padding: 14px;
    border: 1px solid #f2c9c9;
    background: #fdf1f1;
    border-radius: 12px;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  // Recall associado (hook positivo, nada pendente hoje): neutro, nem alerta nem "resolvido".
  &__recall--assoc {
    border-color: #cfd9ec;
    background: #f3f6fb;

    .rel__recall-ic { background: #3a5a99; }
    .rel__recall-tit { color: #1f3a6b; }
    .rel__recall-sub { color: #44597f; }
    // Situacao: "confirme", nao "resolvido" (o verde do foot padrao sugeriria feito).
    .rel__recall-foot { color: #7a5200; background: #fff4dc; }
  }

  // ---- recall nos EUA (informativo, colapsado; neutro, nao e alerta) ----
  &__recall--eua {
    border-color: #dfe5ee;
    background: #f6f8fb;

    .rel__recall-ic { background: #5b6b82; }
    .rel__recall-tit { color: #2b3a50; font-size: calc(14px * var(--rel-fs, 1)); }
    .rel__recall-sub { color: #55657d; }
    > summary { list-style: none; cursor: pointer; flex-wrap: wrap; }
    > summary::-webkit-details-marker { display: none; }
    > summary > div:nth-child(2) { flex: 1 1 0; min-width: 0; }
    > summary::after { content: 'ver campanhas'; flex-basis: 100%; padding-left: 44px; font-size: calc(12.5px * var(--rel-fs, 1)); color: #1f5fbf; }
    &[open] > summary::after { content: 'ocultar'; }
  }
  @media (min-width: 700px) { &__recall--eua > summary::after { flex-basis: auto; padding-left: 0; margin-left: auto; white-space: nowrap; } }
  &__recall-eua-det { margin-top: 4px; font-size: calc(12.5px * var(--rel-fs, 1)); }
  &__recall-eua-det summary { cursor: pointer; color: #1f5fbf; }
  &__recall-eua-det p { margin: 4px 0 0; color: #444; }
  @media print { &__recall--eua > summary::after { content: none; } }

  &__recall--ok {
    border-color: #cfe8d6;
    background: #f1faf3;

    .rel__recall-ic { background: #1f8a4c; }
    .rel__recall-tit { color: #14622f; }
    .rel__recall-sub { color: #2f6b45; }
  }

  &__multas-k3fonte { display: block; font-size: calc(11px * var(--rel-fs, 1)); color: #777; }

  &__recall-lista { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 8px; }
  &__recall-item { background: rgba(255, 255, 255, 0.7); border-radius: 8px; padding: 8px 10px; }
  &__recall-item-top { display: flex; justify-content: space-between; gap: 10px; font-size: calc(13.5px * var(--rel-fs, 1)); color: #1a1a1a; }
  &__recall-item-meta { margin: 3px 0 0; font-size: calc(12px * var(--rel-fs, 1)); color: #555; }
  &__recall-st--pend { color: #a32020; white-space: nowrap; }
  &__recall-st--ok { color: #14622f; white-space: nowrap; }

  &__recall-top {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__recall-ic {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: #d33a3a;
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: calc(18px * var(--rel-fs, 1));
    flex: 0 0 auto;
  }

  &__recall-tit {
    margin: 0;
    font-size: calc(15px * var(--rel-fs, 1));
    font-weight: 800;
    color: #a32020;
  }

  &__recall-sub {
    margin: 1px 0 0;
    font-size: calc(12px * var(--rel-fs, 1));
    color: #8a3030;

    &--item {
      margin-top: 11px;
      font-weight: 700;
    }
  }

  &__recall-body {
    margin: 11px 0 0;
    font-size: calc(13.5px * var(--rel-fs, 1));
    line-height: 1.5;
    color: #3d3d3d;

    b { color: #1a1a1a; }
  }

  &__recall-foot {
    margin: 11px 0 0;
    font-size: calc(12.5px * var(--rel-fs, 1));
    color: #14622f;
    background: #eaf7ee;
    border-radius: 8px;
    padding: 8px 10px;
    font-weight: 600;
  }

  // ---- multas / débitos e restrições (SP) ----
  // ---- multas e débitos (Total grande) + quilometragem (Extrato) ----
  &__multas {
    margin: 14px 0 0;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  &__multas-tit {
    margin: 0 0 10px;
    font-size: calc(11px * var(--rel-fs, 1));
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b7280;
  }

  // cartao "Para regularizar" + breakdown
  &__multas-cap {
    background: #fdf1f1;
    border-radius: 10px;
    padding: 12px 14px;
    text-align: center;
    margin-bottom: 12px;

    span {
      display: block;
      font-size: calc(11px * var(--rel-fs, 1));
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #8a3030;
      font-weight: 700;
    }
    b {
      font-size: calc(28px * var(--rel-fs, 1));
      font-weight: 800;
      color: #a32020;
      font-variant-numeric: tabular-nums;
    }
  }

  &__multas-bd { display: grid; gap: 7px; }

  &__multas-r {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: calc(13px * var(--rel-fs, 1));

    span { color: #3d3d3d; }
    b { font-variant-numeric: tabular-nums; color: #1a1a1a; text-align: right; }
  }

  &__multas-r--texto { flex-direction: column; gap: 4px; }
  &__multas-rtexto {
    margin: 0;
    font-size: calc(13px * var(--rel-fs, 1));
    line-height: 1.5;
    color: #1a1a1a;
  }

  &__multas-ok { color: #14622f !important; font-weight: 700; }
  // "valor original R$ X" embaixo do valor atualizado pelo DETRAN.
  &__multas-rnota {
    display: block;
    font-size: calc(11.5px * var(--rel-fs, 1));
    font-weight: 400;
    color: #636363;
    text-align: right;
  }

  // total embaixo da lista de IPVA por exercicio
  &__multas-ipvatotal {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid #e5e7eb;
    b { font-weight: 800; }
  }

  &__multas-sub {
    margin: 16px 0 8px;
    font-size: calc(11px * var(--rel-fs, 1));
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b7280;
  }

  // lista de multas em aberto (uma a uma)
  &__multas-itens { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  &__multas-item {
    padding: 10px 12px;
    background: #fafafa;
    border: 1px solid #eee;
    border-radius: 8px;
  }
  &__multas-item-top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: calc(13px * var(--rel-fs, 1));
    line-height: 1.35;

    span { color: #1a1a1a; font-weight: 600; }
    b { color: #a32020; white-space: nowrap; }
    // Multa sem valor definido (autuacao em andamento): texto, nao R$ 0,00.
    b.rel__multas-sem-valor { color: #6b7280; font-weight: 500; white-space: normal; text-align: right; }
  }
  &__multas-st-alerta { color: #a32020 !important; font-weight: 700; }
  &__efeito { display: block; margin-top: 2px; font-size: calc(12px * var(--rel-fs, 1)); color: #6b4e00; font-weight: 600; }
  &__multas-proc { margin: -2px 0 8px; font-size: calc(11.5px * var(--rel-fs, 1)); color: #6b7280; }
  &__multas-item-meta { margin: 4px 0 0; font-size: calc(12px * var(--rel-fs, 1)); line-height: 1.4; color: #6b7280; }

  // restricoes do DETRAN
  &__multas-restr {
    list-style: none; margin: 0; padding: 0; display: grid; gap: 6px;
    font-size: calc(13px * var(--rel-fs, 1)); line-height: 1.4; color: #1a1a1a;

    b { color: #6b7280; }
  }

  // extrato de quilometragem
  &__multas-k3 {
    width: 100%;
    border-collapse: collapse;
    font-size: calc(13px * var(--rel-fs, 1));

    td { padding: 8px 4px; border-top: 1px solid #f0f1f3; }
    tr:first-child td { border-top: 0; }
  }

  &__multas-k3head td {
    font-size: calc(10.5px * var(--rel-fs, 1));
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #9098a3;
    font-weight: 700;
    border: 0 !important;
    padding-bottom: 2px;
  }

  &__multas-k3km {
    text-align: right;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  &__multas-k3dl {
    text-align: right;
    color: #14622f;
    font-weight: 700;
    font-size: calc(12px * var(--rel-fs, 1));
    font-variant-numeric: tabular-nums;
    width: 74px;
  }

  // leitura que caiu (km menor que a anterior): destaca vermelho
  &__multas-k3caiu {
    td, .rel__multas-k3km { color: #a32020; }
    .rel__multas-k3dl { color: #a32020; }
  }

  &__multas-kmok {
    margin: 10px 0 0;
    font-size: calc(12.5px * var(--rel-fs, 1));
    color: #3d3d3d;

    b { color: #1a1a1a; }
  }

  &__multas-kmalerta {
    margin: 10px 0 0;
    padding: 8px 10px;
    font-size: calc(12.5px * var(--rel-fs, 1));
    line-height: 1.5;
    font-weight: 600;
    color: #a32020;
    background: #fbe3e3;
    border-radius: 8px;
  }

  &__multas-nota {
    margin: 6px 0 0;
    font-size: calc(13px * var(--rel-fs, 1));
    line-height: 1.5;
    color: $c-graphite;
  }

  &__ind-nota {
    font-size: calc(12px * var(--rel-fs, 1));
    line-height: 1.5;
    color: #636363;
    margin: 12px 0 0;
  }

  // Terceiro estado: aceso, mas sem afirmar problema. Nasceu do indicio
  // "possivel" de leilao, que pode ser outro carro do mesmo modelo: pintar de
  // verde esconderia o achado, e de vermelho condenaria o veiculo por
  // semelhanca.
  &__ind--atencao {
    border-color: rgba(180, 83, 9, 0.35);
    .rel__ind-val { color: #8a5200; &::before { background: #e0a800; } }
  }

  // Quarto estado, cinza: notificacao para leilao. Existe o registro, mas ele
  // nao afirma leilao nem condicao do veiculo.
  &__ind--neutro .rel__ind-val { color: $c-graphite; &::before { background: $c-steel; } }

  &__ind--ok .rel__ind-val { color: #14622f; &::before { background: $c-green; } }

  &__ind--bad {
    background: #fdf1f1;
    border-color: rgba(211, 58, 58, 0.35);
    .rel__ind-val { color: $c-red; &::before { background: $c-red; } }
  }

  // ---- restricoes ----
  &__restr {
    padding: 10px 0;
    border-bottom: 1px solid $c-hair;
    font-size: calc(14px * var(--rel-fs, 1));
    line-height: 1.4;
    color: $c-charcoal;

    &:last-child { border-bottom: 0; }
  }

  &__renave {
    margin-top: 6px;
    font-size: calc(13px * var(--rel-fs, 1));
    line-height: 1.5;
    color: $c-graphite;
    p { margin: 4px 0 0; }
    ul { margin: 4px 0 0; padding-left: 18px; }
    li { margin-top: 4px; }
  }
  &__renave-tit { display: block; color: $c-charcoal; }
  &__renave-conf { font-weight: 600; }

  &__tag {
    font-size: calc(10.5px * var(--rel-fs, 1));
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: #fdeeec;
    color: $c-red;
    border-radius: 4px;
    padding: 3px 7px;
    white-space: nowrap;
    flex-shrink: 0;

    // No cartao do caso a tag e o veredito em uma palavra, entao ela segue a
    // cor do cabecalho em vez do vermelho padrao de restricao.
    &--ok { background: #d7efdf; color: #14622f; }
    &--bad { background: #fdeeec; color: #a32020; }
    // Item informativo (principal condutor): neutro, nao e alerta nem "ok".
    &--info { background: #e8eef7; color: #2b4a75; }
  }

  // ---- ficha ----
  // Duas colunas EXPLICITAS (flex), nao mais grid: grid alinha as row-tracks
  // entre colunas (linha vira a altura do bloco mais alto), deixando buraco
  // branco sob um bloco curto ate o vizinho da linha terminar. Cada coluna
  // aqui e independente — os blocos dela empacotam colados.
  &__ficha {
    display: flex;
    gap: 28px;
    align-items: flex-start;

    @media (max-width: 640px) { flex-direction: column; gap: 20px; }
  }

  &__ficha-col {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  &__sub {
    display: block;
    font-size: calc(10.5px * var(--rel-fs, 1));
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $c-blue;
    border-bottom: 1px solid $c-blue;
    padding-bottom: 6px;
    margin-bottom: 4px;
  }

  // Frase da fabrica, acima da tabela de origem do chassi. Uma linha, tom de
  // texto normal: e informacao boa de ler, nao alerta.
  &__ficha-nota {
    margin: 0 0 4px;
    font-size: calc(13px * var(--rel-fs, 1));
    line-height: 1.45;
    color: $c-ink;
  }

  &__tab {
    width: 100%;
    border-collapse: collapse;

    td { padding: 8px 0; border-bottom: 1px solid $c-hair; font-size: calc(13.5px * var(--rel-fs, 1)); }
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
    font-size: calc(14px * var(--rel-fs, 1));
    color: $c-graphite;

    &:last-child { border-bottom: 0; }
    strong { font-size: calc(15px * var(--rel-fs, 1)); font-weight: 500; color: $c-ink; }

    &--total { background: $c-cloud; strong { font-size: calc(20px * var(--rel-fs, 1)); } }
  }

  &__placa-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 20px;
    border: 2px solid $c-ink;
    border-radius: 8px;

    span { font-size: calc(12px * var(--rel-fs, 1)); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: $c-graphite; }
    strong { font-size: calc(28px * var(--rel-fs, 1)); font-weight: 800; letter-spacing: 0.12em; }
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
    font-size: calc(11px * var(--rel-fs, 1));
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

  &__espera { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 6px; text-align: left; font-size: calc(14px * var(--rel-fs, 1)); }
  &__espera-ok { color: #14622f; }
  &__espera-ativa { font-weight: 700; }

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
    font-size: calc(14px * var(--rel-fs, 1));
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

    &--wa {
      background: #1f9d55;
      border-color: #1f9d55;
      color: #fff;
      &:hover { background: #17824a; border-color: #17824a; }
    }

    &--mini { min-height: 40px; padding: 8px 16px; font-size: calc(13px * var(--rel-fs, 1)); }
  }

  &__rodape { font-size: calc(12px * var(--rel-fs, 1)); color: $c-graphite; text-align: center; margin: 20px 0 0; }
}

// Impressao: o relatorio e um documento, entao tem que sair limpo no papel.
@media print {
  .rel { background: #fff; padding: 0; }
  .rel__acoes, .rel__navband, .rel__info { display: none !important; }

  // Marca d'agua e rodape corrido: position fixed em impressao repete em TODA
  // folha no Chromium — e o unico jeito confiavel de rodape por pagina, ja que
  // margin boxes de @page nao tem suporte la.
  .rel__print-marca {
    display: block !important;
    position: fixed;
    top: 50%;
    left: 50%;
    width: 420px;
    height: auto;
    transform: translate(-50%, -50%);
    opacity: 0.05;
    z-index: 0;
    pointer-events: none;
  }

  .rel__print-pe {
    display: block !important;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 4px 0 2px;
    border-top: 1px solid #ccc;
    background: #fff;
    font-size: calc(9px * var(--rel-fs, 1));
    text-align: center;
    color: #636363;
  }

  // folga pro rodape fixo nao cobrir a ultima linha de conteudo
  .rel__wrap { padding-bottom: 34px; }
  .rel__card { border-color: #ccc; box-shadow: none; break-inside: avoid; }

  // O upsell e conversa de tela: no papel vira panfleto grampeado no laudo.
  .rel__card--up { display: none !important; }

  // O rodape e os overlays vivem no app.vue e no body (Teleport): CSS escopado
  // nao os alcanca, e era por isso que o PDF saia com rodape, selo do Google
  // Play e afins. O :global cria a regra sem escopo; o body:has(...) prende o
  // efeito a paginas onde o relatorio esta montado, senao a folha de estilo
  // desta pagina (que sobrevive a navegacao no SPA) apagaria o rodape da
  // impressao de qualquer outra tela.
  :global(body:has(.rel__wrap) .footer) { display: none !important; }
  :global(body:has(.rel__wrap) .pch-overlay) { display: none !important; }
  :global(body:has(.rel__wrap) .pch-card) { display: none !important; }
  :global(body:has(.rel__wrap) .home-header__gaveta) { display: none !important; }
  :global(body:has(.rel__wrap) .home-header__scrim) { display: none !important; }
}
</style>
