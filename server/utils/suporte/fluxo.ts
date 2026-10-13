import { TXT } from './textos'
import {
  LIMITES, gatilhoN2, pedePessoa, soEmoji, pedeCupom, confirmaPagamento, perguntaSeERobo, seDizAutomatico, comApresentacao, pedeDadoDeTerceiro, temXingamento, temLink, separarDocumento,
  hashNumero, cifrarJid, decifrarJid, mascararNumero, horarioComercial, diaBrasilia, guardarResposta, idLog, parseNota,
} from './regras'
import { perguntarAoAgente, type MsgHistorico, type Veredito } from './agente'
import { resultadoParaAgente, type ConsultaPedido, type FatoPedido } from './pedidos'
import { hmacPagador } from '../pagador-hash'

// Orquestracao do atendimento (N0). Tudo que fala com o mundo vem por `deps`
// (banco, Haiku, Evolution, e-mail), entao as simulacoes do plano rodam em
// teste sem rede.

export interface MsgConversa {
  de: 'cliente' | 'bot' | 'n1' | 'sistema'; texto: string; em: string; id?: string
  /** Mensagem do cliente que nao e texto: reacao (👍), figurinha ou midia (audio, imagem...). */
  tipo?: 'reacao' | 'figurinha' | 'midia'
  midia?: string
}
export interface Contadores {
  dia?: string; respostas_dia?: number; fora_escopo_seguidas?: number; pedir_pessoa?: number
  xingamentos?: number; terceiro?: number; links?: number; cupom?: number; robo?: number
  /** Ultima categoria do agente (so pro painel: motivo resumido sem PII). */
  categoria?: string
}
export interface Conversa {
  id: string
  numero_hash: string
  jid_cifrado: string
  numero_mascarado: string
  mensagens: MsgConversa[]
  nivel: 'N0' | 'N1' | 'N2'
  status: 'aberta' | 'aguardando_n1' | 'escalada' | 'silenciada' | 'bloqueada' | 'encerrada'
  motivo: string | null
  pedido_id: string | null
  contadores: Contadores
  silenciado_ate: string | null
  ultima_resposta_em: string | null
  n2_email_em: string | null
  bloqueado_em: string | null
  /** Nota 0-5 do atendimento: perguntada uma vez, ao concluir. */
  nota_pedida_em?: string | null
  nota?: number | null
  nota_em?: string | null
  /** Nivel em que o atendimento foi concluido (quando a nota foi pedida). */
  nivel_final?: 'N0' | 'N1' | 'N2' | null
}
export interface Tarefa {
  id: string; conversa_id: string; resumo: string; pergunta: string; resposta: string | null; status: string; criado_em: string
  escalada_em?: string | null
  /** A resposta da equipe encerra o atendimento: depois dela, o agente pede a nota. */
  encerrar?: boolean | null
}

export interface Repo {
  obterConversa(numeroHash: string): Promise<Conversa | null>
  numeroBloqueado(numeroHash: string): Promise<boolean>
  conversaPorId(id: string): Promise<Conversa | null>
  criarConversa(c: Omit<Conversa, 'id'>): Promise<Conversa>
  salvarConversa(c: Conversa): Promise<void>
  criarTarefa(t: { conversa_id: string; resumo: string; pergunta: string }): Promise<void>
  tarefaPendenteDaConversa(conversaId: string): Promise<Tarefa | null>
  tarefasRespondidas(): Promise<Tarefa[]>
  marcarTarefa(id: string, campos: Partial<Tarefa> & { repassada_em?: string }): Promise<void>
  tarefasPendentesDesde(antesDe: string): Promise<Tarefa[]>
  /** Conversas 'aberta' sem movimento (atualizado_em) desde `antesDe`. */
  conversasAbertasParadasDesde(antesDe: string): Promise<Conversa[]>
  registrarBloqueio(numeroHash: string, motivo: string): Promise<void>
}

export interface Deps {
  repo: Repo
  segredo: string
  /** Segredo do pagador_hash (mesmo HMAC do Pix). */
  segredoPagador: string
  agente: (hist: MsgHistorico[], extra?: string) => Promise<{ veredito: Veredito | null; falha: string | null }>
  consultarPedidos: (c: ConsultaPedido) => Promise<(FatoPedido & { id: string })[]>
  enviar: (jid: string, texto: string) => Promise<{ ok: boolean; status: number }>
  bloquear: (jid: string) => Promise<{ ok: boolean; status: number }>
  email: (assunto: string, texto: string) => Promise<void>
  agora?: () => Date
  log?: (linha: string) => void
}

// Servico que a PlacaCompleta nao presta: e fora de escopo, nao pergunta sobre a empresa.
const SERVICO_DE_FORA = /despachante|transferencia|emplacament|vistoria|licenciament|financiament|documentacao|segunda via|recurso de multa/

const RE_PLACA = /\b([A-Z]{3})-?(\d[A-Z0-9]\d{2})\b/i
const RE_EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

function agoraDe(d: Deps) { return (d.agora ?? (() => new Date()))() }
function log(d: Deps, c: Conversa, msg: string) { (d.log ?? ((l) => console.info(l)))(`[suporte] conversa=${idLog(c.numero_hash)} ${msg}`) }

function historico(c: Conversa): MsgHistorico[] {
  return c.mensagens.slice(-LIMITES.historico).map((m) => ({
    de: m.de,
    texto: m.tipo === 'reacao' ? `[reagiu com ${m.texto}]` : m.texto,
  }))
}

function ultimoDado(c: Conversa, re: RegExp): string | null {
  for (let i = c.mensagens.length - 1; i >= 0; i--) {
    if (c.mensagens[i].de !== 'cliente') continue
    const m = c.mensagens[i].texto.match(re)
    if (m) return m[0]
  }
  return null
}

/** Uma tarefa pendente por conversa: a nova so atualiza o resumo (mais completo). */
async function tarefaN1(c: Conversa, resumo: string, pergunta: string, d: Deps): Promise<void> {
  const ja = await d.repo.tarefaPendenteDaConversa(c.id)
  if (ja) await d.repo.marcarTarefa(ja.id, { resumo, pergunta })
  else await d.repo.criarTarefa({ conversa_id: c.id, resumo, pergunta })
}

function historicoParaEmail(c: Conversa): string {
  const rot = { cliente: 'Cliente', bot: 'Assistente', n1: 'Equipe', sistema: 'Sistema' } as const
  return c.mensagens.slice(-LIMITES.historico).map((m) => `${rot[m.de]}: ${m.texto}`).join('\n')
}

/** Garante a conversa do numero (cria na primeira mensagem). */
export async function conversaDoNumero(jid: string, d: Deps, texto?: string | null): Promise<Conversa> {
  const h = hashNumero(jid, d.segredo)
  const atual = await d.repo.obterConversa(h)
  const agora = agoraDe(d).getTime()
  // Nota pedida e 24 h sem resposta: o atendimento acabou (nota fica nula) e a
  // proxima mensagem abre outro.
  if (atual && atual.status !== 'encerrada' && atual.nota_pedida_em && atual.nota == null
    && agora - new Date(atual.nota_pedida_em).getTime() > LIMITES.janelaNotaMs) {
    atual.status = 'encerrada'
    await d.repo.salvarConversa(atual)
  }
  if (atual && atual.status !== 'encerrada') return atual
  // Encerrada por inatividade com a nota pedida: a resposta "4" ainda vale para ela.
  if (atual && atual.status === 'encerrada' && atual.nota_pedida_em && atual.nota == null && texto != null && parseNota(texto) != null
    && agora - new Date(atual.nota_pedida_em).getTime() <= LIMITES.janelaNotaMs) return atual
  // Bloqueio vale pro numero, nao so pra conversa.
  return d.repo.criarConversa({
    numero_hash: h, jid_cifrado: cifrarJid(jid, d.segredo), numero_mascarado: mascararNumero(jid),
    mensagens: [], nivel: 'N0', status: 'aberta', motivo: null, pedido_id: null, contadores: {},
    silenciado_ate: null, ultima_resposta_em: null, n2_email_em: null, bloqueado_em: null,
    nota_pedida_em: null, nota: null, nota_em: null, nivel_final: null,
  })
}

/** Pede a nota (uma vez por atendimento; nunca em bloqueio). */
async function pedirNota(c: Conversa, jid: string, d: Deps): Promise<void> {
  if (c.nota_pedida_em || c.status === 'bloqueada') return
  if (await enviarAoCliente(c, jid, TXT.pedirNota, d)) {
    c.nota_pedida_em = agoraDe(d).toISOString()
    c.nivel_final = c.nivel
    log(d, c, `nota pedida nivel=${c.nivel}`)
  }
}

async function enviarAoCliente(c: Conversa, jid: string, texto: string, d: Deps): Promise<boolean> {
  // Bloqueado no meio do caminho (outra mensagem disparou o bloqueio): so a
  // mensagem de encerramento ainda sai.
  if (texto !== TXT.encerramento && await d.repo.numeroBloqueado(c.numero_hash)) { c.status = 'bloqueada'; return false }
  // Primeira mensagem do atendimento: o Guilherme se apresenta (menos no encerramento por abuso).
  if (texto !== TXT.encerramento && !c.mensagens.some((m) => m.de === 'bot' || m.de === 'n1')) texto = comApresentacao(texto, TXT.apresentacao)
  const r = await d.enviar(jid, texto)
  const agora = agoraDe(d)
  if (r.ok) {
    c.mensagens.push({ de: 'bot', texto, em: agora.toISOString() })
    c.contadores.respostas_dia = (c.contadores.respostas_dia || 0) + 1
    c.ultima_resposta_em = agora.toISOString()
  } else {
    log(d, c, `envio falhou status=${r.status}`)
  }
  return r.ok
}

/** E-mail ao Cesar (N2), no maximo 1 por conversa por hora. */
async function escalarN2(c: Conversa, motivo: string, sugestao: string, d: Deps): Promise<void> {
  const agora = agoraDe(d)
  c.nivel = 'N2'
  c.status = 'escalada'
  c.motivo = motivo.slice(0, 200)
  if (c.n2_email_em && agora.getTime() - new Date(c.n2_email_em).getTime() < LIMITES.n2IntervaloMs) {
    log(d, c, 'n2 sem e-mail (anti-spam 1h)')
    return
  }
  c.n2_email_em = agora.toISOString()
  const texto = [
    'Cliente aguardando no WhatsApp da PlacaCompleta.',
    '',
    `Número: ${c.numero_mascarado}`,
    `Motivo: ${motivo}`,
    ...(sugestao ? [`Resumo/sugestão do Guilherme (agente): ${sugestao}`] : []),
    '',
    'Histórico (últimas mensagens):',
    historicoParaEmail(c),
    '',
    'Responda pelo celular pareado ou mande o texto à Helena, que repassa ao cliente.',
  ].join('\n')
  try { await d.email(`[Suporte WhatsApp] N2: ${motivo.slice(0, 60)} (${c.numero_mascarado})`, texto) } catch { log(d, c, 'e-mail n2 falhou') }
  log(d, c, `n2 motivo="${motivo.slice(0, 40)}"`)
}

async function bloquearConversa(c: Conversa, jid: string, motivo: string, d: Deps): Promise<void> {
  const agora = agoraDe(d)
  await enviarAoCliente(c, jid, TXT.encerramento, d)
  const r = await d.bloquear(jid)
  c.status = 'bloqueada'
  c.motivo = `bloqueio: ${motivo}`
  c.bloqueado_em = agora.toISOString()
  await d.repo.registrarBloqueio(c.numero_hash, motivo)
  try {
    await d.email(`[Suporte WhatsApp] Número bloqueado: ${motivo} (${c.numero_mascarado})`, [
      `O Guilherme (agente) bloqueou ${c.numero_mascarado} no WhatsApp.`,
      `Motivo: ${motivo}`,
      `Bloqueio na Evolution: ${r.ok ? 'ok' : `falhou (HTTP ${r.status})`}`,
      '',
      'Histórico (últimas mensagens):',
      historicoParaEmail(c),
      '',
      'Desbloqueio só a seu pedido.',
    ].join('\n'))
  } catch { log(d, c, 'e-mail de bloqueio falhou') }
  log(d, c, `bloqueada motivo="${motivo}" evolution=${r.status}`)
}

export interface Entrada {
  jid: string
  /** null = nao e texto (ver `tipo`). */
  texto: string | null
  msgId?: string
  tipo?: 'texto' | 'reacao' | 'figurinha' | 'midia'
  midia?: string
}

/**
 * Passo 1 (na hora): grava a mensagem do cliente (sem CPF/CNPJ) e aplica os
 * freios de abuso. Devolve o hash do documento informado (so em memoria) e
 * se ainda vale responder.
 */
export async function receberMensagem(e: Entrada, d: Deps): Promise<{ conversa: Conversa; docHash: string | null; responder: boolean }> {
  const c = await conversaDoNumero(e.jid, d, e.texto)
  const agora = agoraDe(d)
  if (c.status === 'bloqueada') return { conversa: c, docHash: null, responder: false }
  if (e.msgId && c.mensagens.some((m) => m.id === e.msgId)) return { conversa: c, docHash: null, responder: false }

  const dia = diaBrasilia(agora)
  if (c.contadores.dia !== dia) c.contadores = { ...c.contadores, dia, respostas_dia: 0 }

  const { texto, digitos } = separarDocumento(e.texto ?? '')
  const docHash = digitos && d.segredoPagador ? hmacPagador(digitos, d.segredoPagador) : null
  // Reacao e figurinha entram no historico (contam como atividade, zeram a
  // inatividade), mas nunca pedem resposta nem chamam o agente.
  const tipo = e.tipo ?? (e.texto == null ? 'midia' : 'texto')
  const registro: MsgConversa = tipo === 'reacao' ? { de: 'cliente', tipo: 'reacao', texto: String(e.texto || '') , em: agora.toISOString() }
    : tipo === 'figurinha' ? { de: 'cliente', tipo: 'figurinha', texto: '[figurinha]', em: agora.toISOString() }
      : tipo === 'midia' ? { de: 'cliente', tipo: 'midia', midia: e.midia || 'outro', texto: `[${e.midia === 'audio' ? 'áudio' : e.midia || 'arquivo'}]`, em: agora.toISOString() }
        : { de: 'cliente', texto, em: agora.toISOString() }
  c.mensagens.push({ ...registro, ...(e.msgId ? { id: e.msgId } : {}) })
  if (c.mensagens.length > 60) c.mensagens = c.mensagens.slice(-60)

  // Enxurrada: mais de 10 mensagens do cliente no ultimo minuto.
  const umMin = agora.getTime() - 60_000
  const noMinuto = c.mensagens.filter((m) => m.de === 'cliente' && new Date(m.em).getTime() >= umMin).length
  if (noMinuto > LIMITES.msgsPorMinutoAbuso) {
    await bloquearConversa(c, e.jid, 'mais de 10 mensagens em 1 minuto', d)
    await d.repo.salvarConversa(c)
    return { conversa: c, docHash: null, responder: false }
  }
  if (tipo === 'reacao' || tipo === 'figurinha') {
    await d.repo.salvarConversa(c)
    return { conversa: c, docHash: null, responder: false }
  }
  if (tipo === 'texto') {
    if (temXingamento(texto)) c.contadores.xingamentos = (c.contadores.xingamentos || 0) + 1
    if (temLink(texto)) c.contadores.links = (c.contadores.links || 0) + 1
    if ((c.contadores.xingamentos || 0) >= LIMITES.xingamentosParaBloquear) {
      await bloquearConversa(c, e.jid, 'xingamento reiterado', d)
      await d.repo.salvarConversa(c)
      return { conversa: c, docHash: null, responder: false }
    }
    if ((c.contadores.links || 0) >= LIMITES.linksParaBloquear) {
      await bloquearConversa(c, e.jid, 'spam (links repetidos)', d)
      await d.repo.salvarConversa(c)
      return { conversa: c, docHash: null, responder: false }
    }
  }
  await d.repo.salvarConversa(c)
  const silenciada = !!c.silenciado_ate && new Date(c.silenciado_ate).getTime() > agora.getTime()
  const noLimite = (c.contadores.respostas_dia || 0) >= LIMITES.respostasPorDia
  return { conversa: c, docHash, responder: !silenciada && !noLimite }
}

/** Passo 2 (respeitando 1 resposta a cada 10 s): decide e responde. */
export async function responderConversa(c: Conversa, jid: string, docHash: string | null, d: Deps): Promise<void> {
  const agora = agoraDe(d)
  // Nada novo do cliente desde a ultima resposta (rodada agendada que ja foi
  // coberta): nao responde de novo.
  if (c.status === 'bloqueada' || c.mensagens[c.mensagens.length - 1]?.de !== 'cliente') return
  // Todas as mensagens do cliente desde a nossa ultima resposta viram uma so
  // (debounce de 2 min: ele manda em varias linhas).
  const seguidas: MsgConversa[] = []
  for (let i = c.mensagens.length - 1; i >= 0 && c.mensagens[i].de === 'cliente'; i--) seguidas.unshift(c.mensagens[i])
  const textos = seguidas.filter((m) => !m.tipo).map((m) => m.texto)
  const midias = seguidas.filter((m) => m.tipo === 'midia')
  const texto = textos.join('\n')
  const ultimoBot = [...c.mensagens].reverse().find((m) => m.de === 'bot' || m.de === 'n1')?.texto || ''

  const finalizar = async (resposta: string | null) => {
    if (resposta) await enviarAoCliente(c, jid, resposta, d)
    await d.repo.salvarConversa(c)
  }

  // So reacao/figurinha desde a nossa ultima resposta: nada a dizer.
  if (!textos.length && !midias.length) return finalizar(null)
  // Audio/arquivo sem texto junto: pede para escrever.
  if (!textos.length) return finalizar(midias.some((m) => m.midia === 'audio') ? TXT.semAudio : TXT.soTexto)
  // So emoji (👍, 🙏): confirmacao. Responde curto, ou nada se a nossa ultima
  // mensagem ja foi uma despedida.
  if (soEmoji(texto)) {
    const despedida = [TXT.obrigadoNota, TXT.confirmacao, TXT.encerramento, TXT.pedirNota].includes(ultimoBot as any) || /é só chamar|qualquer coisa,? (é|e) só/i.test(ultimoBot)
    log(d, c, `acao=emoji ${despedida ? 'sem resposta' : 'confirmacao'}`)
    return finalizar(despedida ? null : TXT.confirmacao)
  }

  // Resposta a "De 0 a 5, como foi?": vale a primeira que for nota, em 24 h.
  if (c.nota_pedida_em && c.nota == null && agora.getTime() - new Date(c.nota_pedida_em).getTime() <= LIMITES.janelaNotaMs) {
    const nota = parseNota(texto)
    if (nota != null) {
      c.nota = nota
      c.nota_em = agora.toISOString()
      c.status = 'encerrada'
      log(d, c, `nota=${nota} nivel_final=${c.nivel_final}`)
      return finalizar(TXT.obrigadoNota)
    }
  }

  // Dado de terceiro: recusa + N2; insistiu, bloqueia.
  if (pedeDadoDeTerceiro(texto)) {
    c.contadores.terceiro = (c.contadores.terceiro || 0) + 1
    if (c.contadores.terceiro >= LIMITES.terceiroParaBloquear) {
      await bloquearConversa(c, jid, 'pedido insistente de dado de terceiro', d)
      return finalizar(null)
    }
    await escalarN2(c, 'pedido de dado pessoal de terceiro (recusado)', '', d)
    return finalizar(TXT.dadoDeTerceiro)
  }

  if (pedePessoa(texto)) c.contadores.pedir_pessoa = (c.contadores.pedir_pessoa || 0) + 1
  const gatilho = gatilhoN2(texto)
  const pessoa2x = (c.contadores.pedir_pessoa || 0) >= LIMITES.pedirPessoaParaEscalar

  // "E robo?": nao nega nem afirma; insistiu, passa para a equipe (N1).
  if (perguntaSeERobo(texto) && !gatilho) {
    c.contadores.robo = (c.contadores.robo || 0) + 1
    if (c.contadores.robo < LIMITES.roboParaEscalar) {
      log(d, c, 'acao=pergunta_robo')
      return finalizar(TXT.souGuilherme)
    }
    await tarefaN1(c, 'cliente insiste em saber se o atendimento é automático; quer outra pessoa da equipe', texto, d)
    c.nivel = 'N1'; c.status = 'aguardando_n1'; c.motivo = 'cliente pediu outra pessoa (pergunta se é robô)'
    log(d, c, 'acao=n1 pergunta_robo insistente')
    return finalizar(TXT.passoParaEquipe)
  }

  // Cupom: a 1a vez responde que nao ha e segue; insistiu, N2.
  let cupomInsistente = false
  if (pedeCupom(texto) && !gatilho) {
    c.contadores.cupom = (c.contadores.cupom || 0) + 1
    if (c.contadores.cupom < LIMITES.cupomParaEscalar) {
      log(d, c, 'acao=sem_cupom')
      return finalizar(TXT.semCupom)
    }
    cupomInsistente = true
  }

  // CPF/CNPJ informado: confere ja, pela placa ou e-mail que a conversa tem.
  let extra: string | undefined
  if (docHash) {
    const placa = ultimoDado(c, RE_PLACA)
    const email = ultimoDado(c, RE_EMAIL)
    const consulta: ConsultaPedido = { placa: placa || undefined, email: placa ? undefined : (email || undefined), docHash, pedidoComprovadoId: c.pedido_id }
    if (consulta.placa || consulta.email) {
      const fatos = await d.consultarPedidos(consulta)
      const dono = fatos.find((f) => f.dono_comprovado)
      if (dono) c.pedido_id = dono.id
      extra = resultadoParaAgente(fatos, consulta)
    }
  }

  let { veredito, falha } = await d.agente(historico(c), extra)
  if (veredito?.acao === 'consultar_pedido') {
    const consulta: ConsultaPedido = {
      email: veredito.consulta.email || undefined,
      placa: veredito.consulta.placa || undefined,
      token: veredito.consulta.token || undefined,
      docHash,
      pedidoComprovadoId: c.pedido_id,
    }
    let resultado: string
    if (consulta.email || consulta.placa || consulta.token) {
      const fatos = await d.consultarPedidos(consulta)
      const dono = fatos.find((f) => f.dono_comprovado)
      if (dono) c.pedido_id = dono.id
      resultado = resultadoParaAgente(fatos, consulta)
    } else {
      resultado = 'Consulta de pedido nao feita: o cliente ainda nao informou placa, e-mail ou link. Peça esses dados.'
    }
    const r2 = await d.agente(historico(c), `${resultado}\nAgora responda ao cliente (nao peça outra consulta).`)
    veredito = r2.veredito
    falha = r2.falha
    // Pediu consulta de novo: usa o texto que ele escreveu; sem texto, N1.
    if (veredito?.acao === 'consultar_pedido') {
      veredito = veredito.resposta
        ? { ...veredito, acao: 'responder' }
        : { ...veredito, acao: 'chamar_n1', resumo_n1: veredito.resumo_n1 || 'agente pediu segunda consulta de pedido' }
    }
  }

  // O N1 atende 24 h; so o N2 (Cesar) tem horario: fora das 8h-22h, avisa.
  const comHorarioN2 = (t: string) => (horarioComercial(agora) ? t : `${t}\n\n${TXT.foraDoHorarioN2}`)

  // Escalada obrigatoria (regra fixa), independente do que o modelo achou.
  if (gatilho || pessoa2x || cupomInsistente || veredito?.acao === 'escalar_n2') {
    const motivo = gatilho === 'reembolso' ? 'pedido de reembolso'
      : gatilho === 'juridico_imprensa' ? 'menção a Procon/advogado/processo/imprensa'
        : pessoa2x ? 'cliente pediu para falar com uma pessoa (2x)'
          : cupomInsistente ? 'cliente insiste em cupom/desconto'
          : (veredito?.motivo_n2 || 'escalada pelo assistente')
    await escalarN2(c, motivo, veredito?.motivo_n2 || veredito?.resumo_n1 || '', d)
    await tarefaN1(c, `[N2] ${motivo}${veredito?.resumo_n1 ? `: ${veredito.resumo_n1}` : ''}`, texto, d)
    c.contadores.fora_escopo_seguidas = 0
    log(d, c, `acao=escalar_n2 forcado=${!!(gatilho || pessoa2x || cupomInsistente)}`)
    return finalizar(comHorarioN2(TXT.escalada))
  }

  if (!veredito) {
    await tarefaN1(c, `assistente sem resposta (${falha || '?'})`, texto, d)
    c.nivel = 'N1'; c.status = 'aguardando_n1'; c.motivo = `falha do agente: ${falha || '?'}`
    log(d, c, `acao=n1 falha="${falha}"`)
    return finalizar(TXT.erro)
  }

  c.contadores.categoria = veredito.acao === 'fora_escopo' ? 'fora_escopo' : veredito.categoria
  if (veredito.acao === 'empresa' && SERVICO_DE_FORA.test(texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())) veredito = { ...veredito, acao: 'fora_escopo' }
  if (veredito.acao === 'fora_escopo') {
    c.contadores.fora_escopo_seguidas = (c.contadores.fora_escopo_seguidas || 0) + 1
    if (c.contadores.fora_escopo_seguidas >= 2) {
      c.silenciado_ate = new Date(agora.getTime() + LIMITES.silencioForaDeEscopoMs).toISOString()
      c.status = 'silenciada'
      c.contadores.fora_escopo_seguidas = 0
    }
    log(d, c, 'acao=fora_escopo')
    return finalizar(TXT.foraDeEscopo)
  }
  c.contadores.fora_escopo_seguidas = 0
  if (c.status === 'silenciada') c.status = 'aberta'

  if (veredito.acao === 'empresa') {
    log(d, c, 'acao=empresa')
    return finalizar(TXT.empresa)
  }

  // Dono ainda nao comprovado: nada de confirmar pagamento ou entrega.
  if (!c.pedido_id && confirmaPagamento(veredito.resposta)) {
    log(d, c, 'acao=responder trocada (confirmou pagamento sem dono comprovado)')
    return finalizar(TXT.precisaConfirmarDono)
  }

  // Persona: nunca "assistente automatico/virtual", "sou um robo".
  if (seDizAutomatico(veredito.resposta)) veredito = { ...veredito, resposta: TXT.souGuilherme }

  const g = guardarResposta(veredito.resposta)
  if (veredito.acao === 'chamar_n1' || g.barrada) {
    const resumo = g.barrada ? `resposta barrada (${g.barrada}); pergunta do cliente precisa de olhar humano` : (veredito.resumo_n1 || 'assistente pediu ajuda')
    await tarefaN1(c, resumo, texto, d)
    c.nivel = 'N1'; c.status = 'aguardando_n1'; c.motivo = resumo.slice(0, 200)
    log(d, c, `acao=n1${g.barrada ? ' barrada' : ''}`)
    const resp = g.barrada || !veredito.resposta ? TXT.verificando : g.texto
    return finalizar(resp)
  }

  log(d, c, `acao=responder categoria=${veredito.categoria}${veredito.atendimento_concluido ? ' concluido' : ''}`)
  await enviarAoCliente(c, jid, g.texto, d)
  if (veredito.atendimento_concluido) await pedirNota(c, jid, d)
  return finalizar(null)
}

/**
 * Inatividade (roda a cada minuto): conversa aberta cuja ULTIMA mensagem, de
 * qualquer lado, tem 40 min ou mais e encerrada com o pedido de nota (uma vez).
 * Qualquer mensagem nova, nossa ou do cliente, zera a contagem. Sem o "posso
 * encerrar?" intermediario (pedido do Cesar, 13/out: ele chegava com o cliente
 * ainda digitando). Nunca mexe em conversa aguardando N1/N2, silenciada,
 * bloqueada ou com a nota ja pedida.
 */
export async function rodarInatividade(d: Deps): Promise<{ encerradas: number }> {
  const agora = agoraDe(d)
  const limite = new Date(agora.getTime() - LIMITES.inatividadeMs).toISOString()
  let encerradas = 0
  for (const c of await d.repo.conversasAbertasParadasDesde(limite)) {
    if (c.status !== 'aberta' || c.nota_pedida_em) continue
    const ult = c.mensagens[c.mensagens.length - 1]
    if (!ult || agora.getTime() - new Date(ult.em).getTime() < LIMITES.inatividadeMs) continue
    const jid = decifrarJid(c.jid_cifrado, d.segredo)
    if (!jid) continue
    await pedirNota(c, jid, d)
    c.status = 'encerrada'
    encerradas++
    log(d, c, `inatividade: encerrada nivel=${c.nivel}`)
    await d.repo.salvarConversa(c)
  }
  return { encerradas }
}

/** Recebe e responde em sequencia (testes e uso sem agendamento). */
export async function processarMensagem(e: Entrada, d: Deps): Promise<Conversa> {
  const r = await receberMensagem(e, d)
  if (r.responder) await responderConversa(r.conversa, e.jid, r.docHash, d)
  return r.conversa
}

/**
 * Fila N1: entrega ao cliente as respostas que a equipe gravou na
 * suporte_tarefas e escala ao N2 o que ficou 15 min sem resposta em horario
 * comercial. Roda a cada minuto (plugin) e sob demanda (endpoint admin).
 */
export async function rodarFilaN1(d: Deps): Promise<{ repassadas: number; escaladas: number }> {
  const agora = agoraDe(d)
  let repassadas = 0, escaladas = 0
  for (const t of await d.repo.tarefasRespondidas()) {
    const c = await d.repo.conversaPorId(t.conversa_id)
    const jid = c ? decifrarJid(c.jid_cifrado, d.segredo) : null
    if (!c || !jid || !t.resposta) { await d.repo.marcarTarefa(t.id, { status: 'erro_repasse' }); continue }
    const texto = String(t.resposta).replace(/\s*[—–]\s*/g, ', ').trim()
    const r = await d.enviar(jid, texto)
    if (!r.ok) { log(d, c, `repasse falhou status=${r.status}`); continue }
    c.mensagens.push({ de: 'n1', texto, em: agora.toISOString() })
    c.ultima_resposta_em = agora.toISOString()
    // Resposta da equipe entregue: o cliente nao esta mais aguardando (N1 ou N2).
    if (c.status === 'aguardando_n1') { c.status = 'aberta'; c.nivel = 'N1' } else if (c.status === 'escalada') c.status = 'aberta'
    // A equipe marcou que a resposta encerra o caso: pede a nota.
    if (t.encerrar) await pedirNota(c, jid, d)
    await d.repo.salvarConversa(c)
    await d.repo.marcarTarefa(t.id, { status: 'repassada', repassada_em: agora.toISOString() })
    repassadas++
  }
  // N1 sem resposta em 15 min vai ao N2 a qualquer hora (o N1 e 24 h).
  const limite = new Date(agora.getTime() - LIMITES.n1SemRespostaMin * 60_000).toISOString()
  for (const t of await d.repo.tarefasPendentesDesde(limite)) {
    if (t.escalada_em) continue
    const c = await d.repo.conversaPorId(t.conversa_id)
    if (!c) continue
    await escalarN2(c, 'N1 sem resposta em 15 min', t.resumo, d)
    await d.repo.salvarConversa(c)
    await d.repo.marcarTarefa(t.id, { escalada_em: agora.toISOString() })
    escaladas++
  }
  return { repassadas, escaladas }
}
