import { ambienteForaDeProd } from './ambiente-alerta'
import { gerarTokenFeedback, linkFeedback } from './feedback'

// Pedido de nota aos clientes do premium (05/nov/2026, decisao do Cesar).
// UM e-mail por cliente na vida, 3 dias depois da entrega, com cinco botoes de
// nota (1 a 5). Cada botao leva para /feedback/<token>?nota=N, que grava a
// nota; 4 ou 5 recebem o convite para avaliar no Google, 1 a 3 recebem o
// campo "O que podemos melhorar?" (ver server/utils/feedback.ts). Sem cupom e
// sem brinde. Os filtros abaixo sao so de elegibilidade do pedido (pagou, nao
// foi reembolsado, nao pediu para sair).

export const ASSUNTO_AVALIACAO = 'Como foi a sua consulta no PlacaCompleta?'

/** Espera entre a entrega e o acompanhamento. */
export const ESPERA_AVALIACAO_MS = 3 * 24 * 60 * 60 * 1000
/**
 * Teto de atraso: pedido entregue ha mais de 10 dias nao recebe mais (o timer
 * ficou parado, por exemplo). Pedir avaliacao de consulta antiga nao faz sentido.
 */
export const JANELA_AVALIACAO_MS = 10 * 24 * 60 * 60 * 1000

export function normalizarEmail(e: string | null | undefined): string {
  return String(e || '').trim().toLowerCase()
}

function emailValido(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

/** E-mail normalizado e a grafia original (aparada), sem repeticao. */
export function emailsParaBusca(emails: (string | null | undefined)[]): string[] {
  const out = new Set<string>()
  for (const e of emails) {
    const cru = String(e || '').trim()
    if (!cru) continue
    out.add(normalizarEmail(cru))
    out.add(cru)
  }
  return [...out]
}

export interface PedidoAvaliacao {
  id: string
  email: string | null
  placa: string | null
  status: string | null
  valor_centavos: number | null
  entregue_em: string | null
}

export interface FiltroAvaliacao {
  agora: number
  /** Corte do deploy: so pedidos entregues a partir daqui (nada retroativo). */
  desde: number
  /** E-mails normalizados fora da campanha (lista de exclusao do host + descadastro). */
  excluir: Set<string>
  /** E-mails normalizados que ja receberam o acompanhamento (uma vez na vida). */
  jaEnviados: Set<string>
}

/**
 * Por que o pedido NAO recebe o acompanhamento, ou null se recebe. Nao olha
 * nota, opiniao ou qualquer sinal de satisfacao: nao existe esse campo aqui
 * de proposito.
 */
export function motivoForaAvaliacao(p: PedidoAvaliacao, f: FiltroAvaliacao): string | null {
  const email = normalizarEmail(p.email)
  if (!email || !emailValido(email)) return 'sem_email'
  if (p.status !== 'entregue') return p.status === 'reembolsado' ? 'reembolsado' : 'nao_entregue'
  if (!p.valor_centavos || p.valor_centavos <= 0) return 'gratis'
  const entregue = p.entregue_em ? Date.parse(p.entregue_em) : NaN
  if (!Number.isFinite(entregue)) return 'nao_entregue'
  if (entregue < f.desde) return 'antes_do_deploy'
  if (f.agora - entregue < ESPERA_AVALIACAO_MS) return 'cedo'
  if (f.agora - entregue > JANELA_AVALIACAO_MS) return 'tarde'
  if (f.excluir.has(email)) return 'excluido'
  if (f.jaEnviados.has(email)) return 'ja_enviado'
  return null
}

/**
 * Elegiveis, um por e-mail (a pessoa com 2 pedidos recebe 1 e-mail so, citando
 * a placa do pedido mais antigo da janela).
 */
export function selecionarAvaliacao(pedidos: PedidoAvaliacao[], f: FiltroAvaliacao): PedidoAvaliacao[] {
  const vistos = new Set<string>()
  const ordenados = [...pedidos].sort((a, b) => String(a.entregue_em).localeCompare(String(b.entregue_em)))
  const saida: PedidoAvaliacao[] = []
  for (const p of ordenados) {
    if (motivoForaAvaliacao(p, f)) continue
    const email = normalizarEmail(p.email)
    if (vistos.has(email)) continue
    vistos.add(email)
    saida.push(p)
  }
  return saida
}

// ----------------------------------------------------------------------------
// E-mail de acompanhamento. Texto aprovado pelo Cesar em 05/nov. Mesmo layout
// dos outros e-mails ao cliente (tabela, estilo inline, largura fixa).

const NAVY = '#0B1F3A'
const AZUL = '#1f6feb'
const GRAFITE = '#3d3d3d'
const CINZA = '#636363'
const FIO = '#e8e8e8'
const FONTE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function montarAvaliacaoEmail(placaBruta: string, base: string, token: string): { assunto: string; html: string; texto: string } {
  const placa = String(placaBruta || '').trim().toUpperCase()
  const par1 = `Há alguns dias você consultou a placa ${placa} com a gente. Esperamos que o relatório tenha ajudado na sua decisão.`
  const par2 = 'De 1 a 5, como foi a sua experiência? É só clicar:'
  const notas = [1, 2, 3, 4, 5]

  const texto = [
    'Olá,',
    '',
    par1,
    '',
    par2,
    ...notas.map((n) => `${n}: ${linkFeedback(base, token, n)}`),
    '',
    'Obrigado,',
    'Equipe PlacaCompleta',
  ].join('\n')

  const p = (t: string, mb = 16) => `<p style="margin:0 0 ${mb}px;font-size:16px;line-height:1.55;color:${GRAFITE};">${t}</p>`
  // Botoes em tabela (o Outlook ignora padding em <a>), lado a lado, grandes
  // o bastante para o dedo no celular.
  const botoes = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:4px auto 8px;"><tr>${notas.map((n) => `<td style="padding:0 4px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#ffffff" style="border:2px solid ${AZUL};border-radius:8px;"><a href="${linkFeedback(base, token, n)}" aria-label="Nota ${n} de 5" style="display:block;width:44px;padding:12px 0;font-family:${FONTE};font-size:20px;font-weight:700;line-height:1;color:${AZUL};text-align:center;text-decoration:none;">${n}</a></td></tr></table></td>`).join('')}</tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="280" style="margin:0 auto 24px;width:280px;"><tr><td style="font-family:${FONTE};font-size:12px;color:${CINZA};text-align:left;">Muito ruim</td><td style="font-family:${FONTE};font-size:12px;color:${CINZA};text-align:right;">Muito bom</td></tr></table>`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ASSUNTO_AVALIACAO)}</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">De 1 a 5, como foi a consulta da placa ${esc(placa)}? É só clicar.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f7;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid ${FIO};border-radius:16px;overflow:hidden;">
<tr><td align="center" style="padding:28px 24px 20px;border-bottom:1px solid ${FIO};"><img src="https://placacompleta.com.br/logo-horizontal-600.png" width="180" height="72" alt="PlacaCompleta" style="display:block;border:0;width:180px;height:auto;"></td></tr>
<tr><td style="padding:32px 32px 8px;font-family:${FONTE};">
${p('Olá,')}
${p(esc(par1).replace(esc(placa), `<strong style="color:#1a1a1a">${esc(placa)}</strong>`))}
${p(esc(par2), 16)}
${botoes}
${p('Obrigado,<br>Equipe PlacaCompleta', 24)}
</td></tr>
<tr><td align="center" style="padding:24px 32px;background:${NAVY};font-family:${FONTE};">
<p style="margin:0;font-size:13px;line-height:1.5;color:rgba(255,255,255,0.75);">É só responder este e-mail ou escrever para <a href="mailto:contato@placacompleta.com.br" style="color:#ffffff;text-decoration:underline;">contato@placacompleta.com.br</a></p>
</td></tr>
</table>
<p style="margin:16px 0 0;font-family:${FONTE};font-size:12px;line-height:1.5;color:${CINZA};">PlacaCompleta · consulta veicular por placa</p>
</td></tr></table>
</body>
</html>`

  return { assunto: ASSUNTO_AVALIACAO, html, texto }
}

export async function enviarAvaliacaoEmail(email: string, placa: string, token: string): Promise<boolean> {
  const config = useRuntimeConfig()
  if (!config.resendApiKey || !email) return false
  const { assunto, html, texto } = montarAvaliacaoEmail(placa, String(config.premiumBaseUrl || ''), token)
  try {
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: {
        from: 'PlacaCompleta <contato@placacompleta.com.br>',
        to: [email],
        reply_to: 'contato@placacompleta.com.br',
        subject: assunto,
        html,
        text: texto,
      },
    })
    return true
  } catch (e: any) {
    console.error('[avaliacao-google] envio falhou:', String(e?.data?.message || e?.message || e))
    return false
  }
}

// ----------------------------------------------------------------------------
// Rodada (chamada pelo timer do host via POST /api/premium/avaliacao/run).

export interface OpcoesRodada {
  agora?: number
  desde: number
  excluir?: Iterable<string>
  dryRun?: boolean
  limite?: number
  /** Injetavel no teste. */
  enviar?: (email: string, placa: string, token: string) => Promise<boolean>
  /** Injetavel no teste. */
  novoToken?: () => string
  base?: string
  cfg?: any
}

export interface ResultadoRodada {
  candidatos: number
  enviados: number
  falhas: number
  dry_run: boolean
  /** So no dry-run: placa e id do pedido (nada de e-mail na resposta). */
  previa?: { pedido_id: string; placa: string }[]
  fora_de_prod?: boolean
}

export async function rodarAvaliacaoGoogle(supabase: any, o: OpcoesRodada): Promise<ResultadoRodada> {
  const dryRun = !!o.dryRun
  // Fora de prod nunca envia: homolog/staging aponta para dados de teste, e
  // um acompanhamento real saindo de la confundiria cliente.
  let fora = true
  try { fora = ambienteForaDeProd(o.cfg ?? useRuntimeConfig()) } catch { fora = true }
  if (fora) return { candidatos: 0, enviados: 0, falhas: 0, dry_run: dryRun, fora_de_prod: true }

  const agora = o.agora ?? Date.now()
  const limite = Math.max(1, Math.min(50, o.limite ?? 20))
  const inicio = new Date(Math.max(o.desde, agora - JANELA_AVALIACAO_MS)).toISOString()
  const fim = new Date(agora - ESPERA_AVALIACAO_MS).toISOString()

  const { data: pedidos, error } = await supabase
    .from('pedidos_premium')
    .select('id,email,placa,status,valor_centavos,entregue_em')
    .eq('status', 'entregue')
    .gt('valor_centavos', 0)
    .not('email', 'is', null)
    .gte('entregue_em', inicio)
    .lte('entregue_em', fim)
    .order('entregue_em', { ascending: true })
    .limit(500)
  if (error) throw new Error(`pedidos: ${error.message}`)

  const lista: PedidoAvaliacao[] = pedidos || []
  // "Uma vez na vida" mora em feedback_solicitacoes: quem ja tem linha la (de
  // qualquer epoca) nao recebe de novo. Procura pelo e-mail normalizado e pela
  // grafia original do pedido, para pegar linha antiga gravada sem normalizar.
  const variantes = emailsParaBusca(lista.map((p) => p.email))
  const jaEnviados = new Set<string>()
  if (variantes.length) {
    const { data: env, error: e2 } = await supabase
      .from('feedback_solicitacoes')
      .select('email')
      .in('email', variantes)
    if (e2) throw new Error(`feedback_solicitacoes: ${e2.message}`)
    for (const r of env || []) jaEnviados.add(normalizarEmail(r.email))
  }

  const excluir = new Set([...(o.excluir || [])].map(normalizarEmail).filter(Boolean))
  const elegiveis = selecionarAvaliacao(lista, { agora, desde: o.desde, excluir, jaEnviados }).slice(0, limite)

  if (dryRun) {
    return {
      candidatos: elegiveis.length, enviados: 0, falhas: 0, dry_run: true,
      previa: elegiveis.map((p) => ({ pedido_id: p.id, placa: String(p.placa || '').toUpperCase() })),
    }
  }

  const enviar = o.enviar ?? enviarAvaliacaoEmail
  let enviados = 0
  let falhas = 0
  for (const p of elegiveis) {
    const email = normalizarEmail(p.email)
    // Link proprio do cliente: a nota so vale se vier de quem comprou.
    const token = (o.novoToken ?? gerarTokenFeedback)()
    const { error: eSol } = await supabase.from('feedback_solicitacoes').insert({
      token, email, pedido_id: p.id, placa: String(p.placa || '').toUpperCase(),
      link: linkFeedback(o.base ?? String((o.cfg ?? useRuntimeConfig())?.premiumBaseUrl || ''), token),
    })
    if (eSol) { falhas++; continue }
    // Trava sem tabela nova: depois de inserir, so segue quem tem a linha
    // mais antiga daquele e-mail (desempate pelo token). Duas rodadas ao mesmo
    // tempo veem a mesma ordem e so uma envia; a outra apaga a propria linha.
    const { data: linhas } = await supabase
      .from('feedback_solicitacoes')
      .select('token,criado_em')
      .in('email', emailsParaBusca([p.email]))
      .order('criado_em', { ascending: true })
      .order('token', { ascending: true })
      .limit(1)
    if (linhas?.[0]?.token !== token) {
      await supabase.from('feedback_solicitacoes').delete().eq('token', token)
      continue
    }
    const ok = await enviar(String(p.email).trim(), String(p.placa || ''), token).catch(() => false)
    if (ok) {
      enviados++
      await supabase.from('feedback_solicitacoes').update({ email_enviado_em: new Date().toISOString() }).eq('token', token)
      continue
    }
    falhas++
    // Solta a vaga: a proxima rodada tenta de novo (dentro da janela).
    await supabase.from('feedback_solicitacoes').delete().eq('token', token)
  }
  return { candidatos: elegiveis.length, enviados, falhas, dry_run: false }
}
