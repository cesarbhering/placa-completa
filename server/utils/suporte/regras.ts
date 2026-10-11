import { createHmac, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { TXT } from './textos'

// Regras puras do atendimento (sem banco, sem rede): o que dispara escalada,
// abuso, horario, saneamento de documento e a guarda da resposta antes de
// sair pro cliente.

export const LIMITES = {
  respostasPorDia: 30,
  intervaloRespostaMs: 10_000,
  msgsPorMinutoAbuso: 10,
  historico: 20,
  xingamentosParaBloquear: 3,
  terceiroParaBloquear: 2,
  linksParaBloquear: 3,
  pedirPessoaParaEscalar: 2,
  n1SemRespostaMin: 15,
  janelaNotaMs: 24 * 60 * 60 * 1000,
  n2IntervaloMs: 60 * 60 * 1000,
  silencioForaDeEscopoMs: 24 * 60 * 60 * 1000,
} as const

const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Escalada obrigatoria ao N2: reembolso, Procon/advogado/processo/imprensa. */
export function gatilhoN2(texto: string): 'reembolso' | 'juridico_imprensa' | null {
  const t = norm(texto)
  if (/procon|advogad|processar|processo judicial|vou processar|justica|juizado|reclame aqui|imprensa|jornal|reporter|reportagem/.test(t)) return 'juridico_imprensa'
  if (/reembols|estorn|dinheiro de volta|meu dinheiro|devolv\w* (o )?(meu )?(dinheiro|valor|pagamento)|devolucao|cancelar (a )?compra|chargeback/.test(t)) return 'reembolso'
  return null
}

/** Cliente pede para falar com uma pessoa. */
export function pedePessoa(texto: string): boolean {
  return /(falar|conversar|atendimento) com (um|uma|algum|alguem|o|a)? ?(humano|pessoa|atendente|gente de verdade|alguem)|\batendente\b|\bhumano\b|pessoa de verdade/.test(norm(texto))
}

/** Pedido de dado pessoal de terceiro (dono/proprietario). */
export function pedeDadoDeTerceiro(texto: string): boolean {
  const t = norm(texto)
  return /(cpf|nome|endereco|telefone|celular|contato|cnh|rg)\b.{0,30}(dono|proprietari|quem (e|eh) o dono)|(dono|proprietari).{0,30}(cpf|nome|endereco|telefone|celular|contato)/.test(t)
}

const XINGAMENTOS = /\b(porra|caralho|merda|puta|puto|fdp|filho da puta|vagabund\w*|lixo|bosta|otari\w*|idiota\w*|imbecil\w*|desgraca\w*|arrombad\w*|cuzao|vtnc|vai tomar|safad\w*|ladr(ao|oes|ona)|golpist\w*)\b/
export function temXingamento(texto: string): boolean { return XINGAMENTOS.test(norm(texto)) }

export function temLink(texto: string): boolean { return /https?:\/\/|www\./i.test(String(texto || '')) }

// --- Documento (CPF/CNPJ) -----------------------------------------------------

/**
 * Tira CPF/CNPJ do texto do cliente ANTES de guardar ou mandar pro modelo.
 * Devolve o texto saneado e os digitos (so pra virar hash na hora).
 */
export function separarDocumento(texto: string): { texto: string; digitos: string | null } {
  let digitos: string | null = null
  const t = String(texto || '').replace(/\b\d{2,3}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2}\b|\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/g, (m) => {
    const d = m.replace(/\D/g, '')
    if (d.length === 11 || d.length === 14) { digitos = digitos || d; return '[documento informado]' }
    return m
  })
  return { texto: t, digitos }
}

// --- Numero do WhatsApp -------------------------------------------------------

/** Chaves derivadas do segredo do suporte (hash do numero e cifra do jid). */
function chave(segredo: string, uso: string): Buffer {
  return createHmac('sha256', segredo).update(`suporte:${uso}`).digest()
}

export function hashNumero(jid: string, segredo: string): string {
  return createHmac('sha256', chave(segredo, 'hash')).update(String(jid)).digest('hex')
}

/** jid cifrado (AES-256-GCM): so o servidor volta a ele, pra responder depois (fila N1). */
export function cifrarJid(jid: string, segredo: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', chave(segredo, 'cifra'), iv)
  const enc = Buffer.concat([c.update(jid, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.')
}

export function decifrarJid(cifrado: string, segredo: string): string | null {
  try {
    const [iv, tag, enc] = String(cifrado).split('.').map((p) => Buffer.from(p, 'base64url'))
    const d = createDecipheriv('aes-256-gcm', chave(segredo, 'cifra'), iv)
    d.setAuthTag(tag)
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
  } catch { return null }
}

/** "5511987654321@s.whatsapp.net" -> "+55 11 9****-4321". */
export function mascararNumero(jid: string): string {
  const d = String(jid || '').split('@')[0].replace(/\D/g, '')
  if (d.length < 8) return '****'
  if (d.startsWith('55') && d.length >= 12) return `+55 ${d.slice(2, 4)} ${d[4]}****-${d.slice(-4)}`
  return `+${d.slice(0, Math.min(2, d.length - 4))} ****-${d.slice(-4)}`
}

// --- Nota do atendimento -------------------------------------------------------

const NUM_PALAVRA: Record<string, number> = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5 }

/**
 * Nota de 0 a 5 numa resposta curta ("5", "nota 4", "cinco", "4/5", "dou 3").
 * Qualquer outra coisa: null (a mensagem segue pro agente).
 */
export function parseNota(texto: string): number | null {
  const t = norm(texto).replace(/[!.?,;:)(*]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t || t.length > 30) return null
  const m = t.match(/^(?:(?:nota|dou|daria|minha nota e|e)\s+)?(\d{1,2}|zero|um|uma|dois|duas|tres|quatro|cinco)(?:\s*(?:\/\s*5|de 5|estrelas?|pontos?))?$/)
  if (!m) return null
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUM_PALAVRA[m[1]]
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : null
}

// --- Horario (so pro N2) ------------------------------------------------------

/** Horario em que o Cesar (N2) responde: 8h as 22h (Brasilia). O N1 e 24 h. */
export function horarioComercial(agora: Date = new Date()): boolean {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(agora))
  return h >= 8 && h < 22
}

export function diaBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora)
}

// --- Guarda da resposta -------------------------------------------------------

/**
 * Ultima barreira antes do cliente. Troca travessao por virgula; resposta que
 * cita a fonte oficial, afirma que o carro "tem" problema, oferece cupom ou
 * fala em reembolso feito vira o texto de "verificando" (e o motivo vai pro N1).
 */
export function guardarResposta(texto: string): { texto: string; barrada: string | null } {
  let t = String(texto || '').replace(/\s*[—–]\s*/g, ', ').trim()
  const n = norm(t)
  let barrada: string | null = null
  if (/senatran/.test(n)) barrada = 'citou a fonte oficial'
  else if (/\b(tem|teve|possui|esta com|ta com)\b.{0,20}\b(leilao|roubo|furto|gravame|sinistro|restricao|multa|bloqueio|renajud|alienacao)/.test(n) && !/\b(nao|se|saber se)\b.{0,15}\b(tem|teve|possui)/.test(n)) barrada = 'afirmou que o veiculo tem problema'
  else if (/\bcupo(m|ns)\b.{0,40}\b(de|com|use|usar|aplica|desconto|codigo)\b|codigo promocional|\b\d{1,2}% de desconto/.test(n)) barrada = 'ofereceu cupom ou desconto'
  else if ((/\b(ja|vou|vamos|irei|iremos)\b.{0,25}\b(reembols|estorn|devolv)/.test(n) && !/encaminh|equipe|analis/.test(n))
    || /(reembolso|estorno|devolucao) (feito|realizado|aprovado|confirmado)/.test(n)) barrada = 'prometeu reembolso'
  if (!t) barrada = barrada || 'resposta vazia'
  return barrada ? { texto: TXT.verificando, barrada } : { texto: t.slice(0, 1500), barrada: null }
}

/** Log sem PII: so os 8 primeiros do hash. */
export function idLog(numeroHash: string): string { return String(numeroHash || '').slice(0, 8) }
