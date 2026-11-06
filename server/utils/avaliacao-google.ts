import { ambienteForaDeProd } from './ambiente-alerta'

// Pedido de avaliacao no Google aos clientes do premium (aprovado pelo Cesar
// em 05/nov/2026). Duas pecas: uma linha no e-mail de entrega (premium-email)
// e UM e-mail de acompanhamento 3 dias depois da entrega.
//
// Regra do Google, que e o motivo do desenho: o pedido vai para TODOS os
// clientes. Nada de filtrar pela nota (nao ha pergunta de nota antes) e nada
// de brinde, cupom ou desconto em troca. Os filtros abaixo sao so de
// elegibilidade do pedido (pagou, nao foi reembolsado, nao pediu para sair),
// nunca de satisfacao.

export const LINK_AVALIACAO_GOOGLE = 'https://g.page/r/CWpx3yMC2irbEBM/review'

export const FRASE_AVALIACAO_ENTREGA =
  'Este relatório te ajudou? Uma avaliação no Google ajuda outras pessoas a comprar carro com mais segurança:'

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

export function montarAvaliacaoEmail(placaBruta: string): { assunto: string; html: string; texto: string } {
  const placa = String(placaBruta || '').trim().toUpperCase()
  const link = LINK_AVALIACAO_GOOGLE
  const par1 = `Há alguns dias você consultou a placa ${placa} com a gente. Esperamos que o relatório tenha ajudado na sua decisão.`
  const par2 = 'Pode nos contar como foi? Leva menos de um minuto:'
  const par3 = 'A sua opinião, boa ou ruim, nos ajuda a melhorar e ajuda outras pessoas que estão comprando carro.'

  const texto = [
    'Olá,',
    '',
    par1,
    '',
    par2,
    link,
    '',
    par3,
    '',
    'Obrigado,',
    'Equipe PlacaCompleta',
  ].join('\n')

  const p = (t: string, mb = 16) => `<p style="margin:0 0 ${mb}px;font-size:16px;line-height:1.55;color:${GRAFITE};">${t}</p>`
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ASSUNTO_AVALIACAO)}</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Pode nos contar como foi a consulta da placa ${esc(placa)}? Leva menos de um minuto.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f7;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid ${FIO};border-radius:16px;overflow:hidden;">
<tr><td align="center" style="padding:28px 24px 20px;border-bottom:1px solid ${FIO};"><img src="https://placacompleta.com.br/logo-horizontal-600.png" width="180" height="72" alt="PlacaCompleta" style="display:block;border:0;width:180px;height:auto;"></td></tr>
<tr><td style="padding:32px 32px 8px;font-family:${FONTE};">
${p('Olá,')}
${p(esc(par1).replace(esc(placa), `<strong style="color:#1a1a1a">${esc(placa)}</strong>`))}
${p(esc(par2), 8)}
${p(`<a href="${link}" style="color:${AZUL};text-decoration:underline;word-break:break-all;">${link}</a>`)}
${p(esc(par3))}
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

export async function enviarAvaliacaoEmail(email: string, placa: string): Promise<boolean> {
  const config = useRuntimeConfig()
  if (!config.resendApiKey || !email) return false
  const { assunto, html, texto } = montarAvaliacaoEmail(placa)
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
  enviar?: (email: string, placa: string) => Promise<boolean>
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
  const emails = [...new Set(lista.map((p) => normalizarEmail(p.email)).filter(Boolean))]
  const jaEnviados = new Set<string>()
  if (emails.length) {
    const { data: env, error: e2 } = await supabase
      .from('avaliacao_google_envios')
      .select('email_norm')
      .in('email_norm', emails)
    if (e2) throw new Error(`envios: ${e2.message}`)
    for (const r of env || []) jaEnviados.add(r.email_norm)
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
    // Trava no banco: a chave primaria e o e-mail. Quem consegue inserir e
    // quem envia; duas rodadas ao mesmo tempo nao geram dois e-mails.
    const { error: eIns } = await supabase
      .from('avaliacao_google_envios')
      .insert({ email_norm: email, pedido_id: p.id })
    if (eIns) continue
    const ok = await enviar(String(p.email).trim(), String(p.placa || '')).catch(() => false)
    if (ok) { enviados++; continue }
    falhas++
    // Solta a vaga: a proxima rodada tenta de novo (dentro da janela).
    await supabase.from('avaliacao_google_envios').delete().eq('email_norm', email)
  }
  return { candidatos: elegiveis.length, enviados, falhas, dry_run: false }
}
