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
const { trackConversionPaga } = useAnalytics()

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
  // O sufixo _FILE_VEICULOS e ruido do sistema de origem, nao informacao.
  ALIENACAO_FIDUCIARIA_FILE_VEICULOS: 'Alienação fiduciária',
  RENAINF: 'Multas em aberto (RENAINF)',
  FURTO: 'Furto',
  ROUBO: 'Roubo',
  DECLARACAO: 'Declaração',
  APROPRIACAO_INDEBITA: 'Apropriação indébita',
  ESTELIONATO: 'Estelionato',
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
  { k: 'indicadorLeilao', label: 'Leilão', sim: 'CONSTA', nao: 'NADA CONSTA', risco: true,
    dica: 'Verifica se o veículo tem passagem por leilão registrada, o que costuma derrubar o valor de revenda.' },
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
]

const normalizaChave = (r: any) => String(r).toUpperCase().replace(/[\s-]+/g, '_')

const indicadores = computed(() => {
  const base: any[] = INDICADORES.filter((i) => has(i.k)).map((i) => {
    const ligado = g(i.k) === true
    return { ...i, ligado, alerta: ligado && i.risco }
  })

  const itens = v.value?.restricoesItens
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

  return base
})

// O rotulo diz O QUE consta; a explicacao diz O QUE ISSO SIGNIFICA pra quem
// esta comprando. Sem ela, "Reserva de domínio" e jargao.
const EXPLICA_RESTRICAO: Record<string, string> = {
  ROUBO_FURTO: 'Consta registro ativo de roubo ou furto. A transferência fica bloqueada e o veículo pode ser apreendido em fiscalização. Não conclua o negócio antes de esclarecer a situação.',
  ALIENACAO_FIDUCIARIA: 'O veículo está financiado e é a garantia do contrato. A transferência depende da quitação e da baixa do gravame.',
  ARRENDAMENTO_MERCANTIL: 'O veículo está em contrato de leasing: quem o usa não é o proprietário até o fim do contrato.',
  RESERVA_DE_DOMINIO: 'O vendedor original mantém a propriedade até o pagamento integral do contrato de compra.',
  PENHOR: 'O veículo foi dado como garantia de uma dívida e não pode ser transferido enquanto ela existir.',
  BUSCA_E_APREENSAO: 'Existe ordem para recolher o veículo, normalmente por financiamento não pago. Risco alto: o carro pode ser apreendido do novo dono.',
  RESTRICAO_JUDICIAL: 'Uma decisão da Justiça impede a transferência do veículo.',
  RESTRICAO_ADMINISTRATIVA: 'Um órgão de trânsito bloqueou alterações no cadastro do veículo.',
  RESTRICAO_TRIBUTARIA: 'O veículo tem pendência ou benefício fiscal que limita a transferência, como isenção de impostos com prazo de carência.',
  RESTRICAO_BENEFICIO_TRIBUTARIO: 'O veículo foi comprado com isenção ou redução de imposto e tem prazo de carência. Transferir antes do prazo exige quitar o imposto ou obter autorização fiscal.',
  COMUNICACAO_DE_VENDA: 'O dono anterior informou a venda ao órgão de trânsito. Falta o novo dono concluir a transferência.',
  PENDENCIA_DE_EMISSAO_CRV: 'O documento de transferência (CRV) ainda não foi emitido. Sem ele a venda não se conclui.',
  PENDENCIA_EMISSAO_CRV: 'O documento de transferência (CRV) ainda não foi emitido. Sem ele a venda não se conclui.',
  RENAINF: 'Constam multas em aberto registradas contra o veículo, dentro e fora do estado. Elas acompanham o carro, não o motorista.',
  RFB: 'Restrição da Receita Federal, comum em veículo com pendência de importação ou de regime fiscal.',
}

function explicaRestricao(bruto: string): string {
  const chave = String(bruto || '').toUpperCase().replace(/[\s-]+/g, '_')
  if (EXPLICA_RESTRICAO[chave]) return EXPLICA_RESTRICAO[chave]
  // variantes com sufixo de sistema ("_FILE_VEICULOS" etc): casa pelo prefixo
  const pref = Object.keys(EXPLICA_RESTRICAO).find((k) => chave.startsWith(k))
  if (pref) return EXPLICA_RESTRICAO[pref]
  return 'Uma restrição registrada condiciona ou impede a transferência do veículo. Esclareça com o vendedor antes de fechar negócio.'
}

const restricoes = computed<{ rotulo: string; explica: string }[]>(() => {
  const arr = v.value?.restricoesItens
  if (!Array.isArray(arr)) return []
  return arr
    .filter(Boolean)
    .map((r: any) => ({ rotulo: humanizar(r), explica: explicaRestricao(String(r)) }))
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
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? null : dt.toLocaleDateString('pt-BR')
})

// Faixa de licenciamento acima da ficha: e o dado que diz se o documento esta
// em dia, e enterrado como linha de tabela ninguem via. O tom segue o ano:
// exercicio atual (ou adiante) em dia; ano anterior pode so nao ter vencido
// ainda, porque o calendario corre pelo final da placa e varia por UF; dois
// anos ou mais e atraso sem desculpa.
const licenciamento = computed(() => {
  if (!licAno.value) return null
  const ano = parseInt(licAno.value, 10)
  if (!Number.isFinite(ano)) return null
  const atual = new Date().getFullYear()
  if (ano >= atual) return { ano: licAno.value, emissao: licEmissao.value, tom: 'ok', rotulo: 'Em dia', nota: null }
  if (ano === atual - 1) {
    return {
      ano: licAno.value, emissao: licEmissao.value, tom: 'atencao', rotulo: 'Confira',
      nota: `O licenciamento ${atual} pode ainda estar no prazo do calendário da UF.`,
    }
  }
  return { ano: licAno.value, emissao: licEmissao.value, tom: 'alerta', rotulo: 'Atrasado', nota: null }
})

// ---------- veredito ----------
// O resumo que a pessoa procura antes de ler o resto: o que pesa contra, em
// uma frase. Sai dos proprios indicadores, sem inventar gravidade.
const alertas = computed(() => indicadores.value.filter((i) => i.alerta).map((i) => i.label))

const restricoesForaDosIndicadores = computed<string[]>(() => {
  const itens = v.value?.restricoesItens
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
      texto: 'Na data de emissão, nenhum dos indicadores verificados aponta restrição, roubo, furto, leilão ou pendência.',
    }
  }
  // Os rotulos sao siglas e nomes proprios (RENAJUD, RFB): baixar tudo pra
  // minuscula deixava "Atenção: renajud." Mantem a caixa e monta a frase.
  // O cartao generico aceso e sempre renomeado aqui pelo tipo especifico
  // (restricoesForaDosIndicadores) — listar os dois diria a mesma coisa duas
  // vezes: "consta Outras restrições e Restrição de benefício tributário".
  const nomes = [
    ...alertas.value.filter((l) => l !== 'Outras restrições'),
    ...restricoesForaDosIndicadores.value,
    ...(licAtrasado ? ['licenciamento atrasado'] : []),
  ]
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
    await buscarQr()   // o codigo mudou; o QR desenhado precisa acompanhar
  } catch (e: any) {
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

// ---------- numeracao das secoes ----------
// Dinamica porque nem toda secao existe em todo laudo (a basica nao tem
// indicadores; sem FIPE nao ha secao de valor). Numeracao fixa deixaria buraco.
const numSecao = computed(() => {
  const ordem: string[] = ['veh']
  if (indicadores.value.length) ordem.push('ind')
  if (!isBasica.value && indicadores.value.length) ordem.push('restr')
  if (ocorrencias.value.length) ordem.push('ocorr')
  ordem.push('ficha')
  if (temValor.value) ordem.push('valor')
  const m: Record<string, number> = {}
  ordem.forEach((k, i) => { m[k] = i + 1 })
  return m
})

// ---------- valor e custo ----------
const vc = computed(() => data.value?.valorCusto ?? null)
const temValor = computed(() => Boolean(vc.value?.fipe || vc.value?.seguroAnual || vc.value?.custo5anos))
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

// O grafico do historico vive em components/GraficoValor.vue (ECharts, SVG).
// So resta decidir aqui SE ha o que mostrar.
const temGrafico = computed(() => (vc.value?.historico?.length ?? 0) > 1)

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
    data: (() => {
      const d = new Date(String(o?.dataOcorrencia || '') + 'T12:00:00')
      return Number.isNaN(d.getTime()) ? String(o?.dataOcorrencia || '') : d.toLocaleDateString('pt-BR')
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
onMounted(() => {
  histSync()
  const msg = `Fiz a consulta veicular no PlacaCompleta, olha o relatório: ${window.location.href}`
  compartilhar.value = `https://wa.me/?text=${encodeURIComponent(msg)}`
  if (data.value?.status === 'aguardando_pagamento' && data.value?.brCode) buscarQr()
  if (!data.value) return
  const existe = itens.value.some((x) => x.token === token)
  if (existe) histUpdate(token, data.value.status)
  else histAdd({ token, placa: data.value.placa, veiculo: g('descricaoMarcaModelo') || null, status: data.value.status })
  if (['pago', 'consultando', 'entregue'].includes(data.value.status)) trackConversionPaga(token, data.value.plano)
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
        await buscarQr()         // se veio br_code novo, o QR acompanha
        if (data.value) histUpdate(token, data.value.status)
        // conversao do Ads/GA4 (veio do outro lado do merge): dispara quando o
        // pagamento se confirma; a funcao e idempotente por token
        if (data.value && ['pago', 'consultando', 'entregue'].includes(data.value.status)) trackConversionPaga(token, data.value.plano)
        if (data.value?.status === 'entregue') clearInterval(poll)
      } catch { /* rede oscilou; proxima volta tenta de novo */ }
    }, 5000)
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
      />
    </div>


    <div class="rel__wrap">
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
            <p class="rel__hint">
              Este pedido foi encerrado e o valor devolvido no seu Pix. Nada ficou
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
              <MarcaLogo :marca="g('descricaoMarcaModelo')" />
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
                :class="i.alerta ? 'rel__ind--bad' : 'rel__ind--ok'"
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
          </section>

          <!-- restricoes: na completa a secao existe sempre. Laudo lista a
               secao e diz "nada consta"; omitir deixaria duvida se foi checado. -->
          <section v-if="numSecao.restr" class="rel__card">
            <h2 class="rel__h2">{{ numSecao.restr }}. Restrições</h2>
            <template v-if="restricoes.length">
              <div v-for="(r, idx) in restricoes" :key="idx" class="rel__restr">
                <div class="rel__restr-topo">
                  <span class="rel__tag">Restrição</span>
                  <strong>{{ r.rotulo }}</strong>
                </div>
                <p class="rel__restr-explica">{{ r.explica }}</p>
              </div>
            </template>
            <p v-else class="rel__nada">Nada consta na data de emissão.</p>
          </section>

          <!-- ocorrencias de roubo/furto: o detalhe por tras do indicador -->
          <section v-if="ocorrencias.length" class="rel__card">
            <h2 class="rel__h2">{{ numSecao.ocorr }}. Ocorrências de roubo e furto</h2>
            <div v-for="(o, idx) in ocorrencias" :key="idx" class="rel__ocorr">
              <div class="rel__ocorr-topo">
                <span class="rel__tag">{{ o.tipo }}</span>
                <!-- Rotulada: a data solta fez ate o dono perguntar "isso e a
                     data do roubo?". E a data do REGISTRO da ocorrencia. -->
                <span class="rel__ocorr-data">Ocorrência registrada em {{ o.data }}</span>
              </div>
              <p class="rel__ocorr-det">
                <template v-if="o.categoria && o.categoria !== o.tipo">{{ o.categoria }} · </template>
                Veículo no registro da ocorrência: {{ o.registro }}
              </p>
            </div>
            <p class="rel__ocorr-nota">
              Ocorrências registradas permanecem no histórico mesmo após a recuperação
              do veículo. Solicite ao vendedor o boletim de ocorrência e a respectiva baixa.
            </p>
          </section>

          <!-- ficha -->
          <section class="rel__card">
            <h2 class="rel__h2">{{ numSecao.ficha }}. Ficha cadastral e técnica</h2>

            <div v-if="licenciamento" class="rel__lic" :class="`rel__lic--${licenciamento.tom}`">
              <span class="rel__lic-pill">{{ licenciamento.rotulo }}</span>
              <span class="rel__lic-txt">
                Último licenciamento <strong>{{ licenciamento.ano }}</strong><template v-if="licenciamento.emissao"> · documento emitido em {{ licenciamento.emissao }}</template><template v-if="licenciamento.nota"> · {{ licenciamento.nota }}</template>
              </span>
            </div>

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

          <!-- valor e custo: saiu da consulta gratis e agora e o que a basica
               entrega de imediato, antes da ficha tecnica -->
          <section v-if="temValor" class="rel__card">
            <h2 class="rel__h2">{{ numSecao.valor }}. Valor de mercado e custo de propriedade</h2>
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

            <div v-if="temGrafico" class="rel__dep">
              <span class="rel__sub">Evolução do valor de mercado</span>
              <GraficoValor :historico="vc.historico" />
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
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $c-slab;
  }

  &__doc-linha {
    font-size: 12.5px;
    color: $c-graphite;
  }

  &__doc-validade {
    margin: 8px 2px 0;
    font-size: 12.5px;
    color: $c-graphite;
  }

  @media (max-width: 640px) {
    &__doc { flex-direction: column; align-items: flex-start; }
    &__doc-meta { align-items: flex-start; text-align: left; }
  }

  &__parecer-rotulo {
    display: block;
    margin: 16px 0 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $c-graphite;
  }

  &__nada {
    margin: 0;
    font-size: 14px;
    color: $c-charcoal;
  }

  // ---- verificacao de autenticidade ----
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
    font-size: 12.5px;
    line-height: 1.45;
    color: $c-graphite;

    strong {
      font-size: 11px;
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
    font-size: 13px;
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
      font-size: 11.5px;
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
    font-size: 13px;
    font-weight: 700;
    color: #8c2323;
    white-space: nowrap;
  }

  &__ocorr-det {
    margin: 8px 0 0;
    font-size: 14px;
    line-height: 1.45;
    color: $c-charcoal;
  }

  &__ocorr-nota {
    margin: 12px 0 0;
    font-size: 13px;
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
    font-size: 14px;
    line-height: 1.45;

    strong { font-weight: 700; }

    &--ok      { background: #eef9f1; border-color: rgba(30, 158, 74, 0.35); color: #14622f; }
    &--atencao { background: #fdf8ec; border-color: rgba(154, 100, 0, 0.35); color: #6d4a05; }
    &--alerta  { background: #fdf1f1; border-color: rgba(211, 58, 58, 0.35); color: #8c2323; }
  }

  &__lic-pill {
    font-size: 11px;
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

    strong { font-size: 18px; font-weight: 500; }
    span { font-size: 13.5px; color: $c-graphite; }
  }

  // A mesma placa simulada do hero, em miniatura: o cliente reconhece o objeto
  // que digitou. Largura fixa porque o dimensionamento interno e por container
  // query, entao a proporcao se resolve sozinha a partir dela.
  // A placa e o identificador do laudo: 132px sumia ao lado do logo de 56px.
  // 190px poe os caracteres na mesma escala do nome do veiculo. No celular
  // encolhe, senao logo + placa nao deixam largura pro texto.
  &__placa-tag {
    width: 190px;
    flex-shrink: 0;

    @media (max-width: 640px) {
      width: 178px;
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

  &__ind-lab { font-size: 11.5px; color: $c-graphite; }

  &__ind-val {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
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
    font-size: 9px;
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
