import { randomBytes } from 'node:crypto'

// Regras da pesquisa de satisfacao que valem a pena testar sozinhas, longe do
// banco: o que conta como link plausivel e o que conta como resposta valida.

/**
 * O token e a unica credencial da pagina. Curto demais nao e link truncado por
 * cliente de e-mail: e tentativa de adivinhar, e a gente nem consulta o banco.
 */
export function tokenFeedbackPlausivel(bruto: unknown): boolean {
  const t = String(bruto || '').trim()
  return t.length >= 16 && /^[A-Za-z0-9_-]+$/.test(t)
}

export interface RespostaFeedback {
  nota: number
  comentario: string | null
}

/**
 * Nota inteira de 1 a 5, obrigatoria. Comentario e opcional, aparado, com teto
 * de 2000 caracteres: campo livre sem teto e convite pra colar um livro (ou um
 * payload) dentro da tabela.
 */
export function normalizarResposta(bruto: any): RespostaFeedback | { erro: string } {
  const nota = Number(bruto?.nota)
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    return { erro: 'Escolha uma nota de 1 a 5.' }
  }
  const comentario = String(bruto?.comentario ?? '').trim().slice(0, 2000)
  return { nota, comentario: comentario || null }
}

// ----------------------------------------------------------------------------
// Nota pelo e-mail de acompanhamento (05/nov/2026, decisao do Cesar). O e-mail
// traz cinco botoes, cada um leva para /feedback/<token>?nota=N; a pagina
// grava a nota no clique. Depois dela:
//  - 4 ou 5: convite para avaliar no Google;
//  - 1 a 3: "O que podemos melhorar?", texto vai para `comentario`.
// Sem cupom e sem brinde em nenhum caso.

export const LINK_AVALIACAO_GOOGLE = 'https://g.page/r/CWpx3yMC2irbEBM/review'

/** Caixa do Lead (lida pelo time na VPS). */
export const DESTINO_ALERTA_FEEDBACK = 'helena@placacompleta.com.br'

export function notaValida(bruto: unknown): number | null {
  const n = Number(bruto)
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
}

/** Qual tela vem depois da nota. */
export function caminhoDaNota(nota: number): 'google' | 'melhorar' {
  return nota >= 4 ? 'google' : 'melhorar'
}

export function gerarTokenFeedback(): string {
  // 18 bytes = 24 caracteres base64url: nao adivinhavel e passa no plausivel.
  return 'fb_' + randomBytes(18).toString('base64url')
}

export function linkFeedback(base: string, token: string, nota?: number): string {
  const raiz = String(base || 'https://placacompleta.com.br').replace(/\/+$/, '')
  return `${raiz}/feedback/${encodeURIComponent(token)}${nota ? `?nota=${nota}` : ''}`
}

export interface EstadoFeedback {
  existe: boolean
  placa: string | null
  nota: number | null
  comentarioEnviado: boolean
}

async function lerEstado(supabase: any, token: string): Promise<EstadoFeedback> {
  const { data } = await supabase
    .from('feedback_solicitacoes')
    .select('placa,nota,comentario')
    .eq('token', token)
    .maybeSingle()
  if (!data) return { existe: false, placa: null, nota: null, comentarioEnviado: false }
  return { existe: true, placa: data.placa || null, nota: data.nota ?? null, comentarioEnviado: !!data.comentario }
}

export async function estadoFeedback(supabase: any, token: string): Promise<EstadoFeedback> {
  if (!tokenFeedbackPlausivel(token)) return { existe: false, placa: null, nota: null, comentarioEnviado: false }
  return lerEstado(supabase, token)
}

/**
 * Grava a nota uma vez so. A trava e o update condicionado a respondido_em IS
 * NULL: clicar de novo (ou noutro botao) devolve a nota que ja estava gravada,
 * e a pagina mostra a mesma tela.
 */
export async function registrarNota(supabase: any, token: string, notaBruta: unknown): Promise<EstadoFeedback & { gravadaAgora: boolean }> {
  const nota = notaValida(notaBruta)
  if (!tokenFeedbackPlausivel(token) || !nota) {
    const e = await estadoFeedback(supabase, token)
    return { ...e, gravadaAgora: false }
  }
  const { data } = await supabase
    .from('feedback_solicitacoes')
    .update({ nota, respondido_em: new Date().toISOString() })
    .eq('token', token)
    .is('respondido_em', null)
    .select('id')
  const e = await lerEstado(supabase, token)
  return { ...e, gravadaAgora: !!data?.length }
}

export function montarAlertaNotaBaixa(a: { nota: number; comentario: string; token: string }): { subject: string; text: string } {
  return {
    subject: `Feedback do premium: nota ${a.nota}`,
    text: [`Nota: ${a.nota}`, '', 'Comentário:', a.comentario, '', `Token: ${a.token}`].join('\n'),
  }
}

/**
 * Comentario de quem deu 1 a 3. Uma vez so (update condicionado a comentario
 * IS NULL e nota <= 3). Nota 1 ou 2 com comentario avisa o Lead por e-mail:
 * so nota, comentario e token, sem o e-mail do cliente.
 */
export async function registrarComentario(
  supabase: any,
  token: string,
  bruto: unknown,
  avisar: (msg: { subject: string; text: string }) => Promise<void>,
): Promise<{ ok: boolean; motivo?: string }> {
  if (!tokenFeedbackPlausivel(token)) return { ok: false, motivo: 'link' }
  const comentario = String(bruto ?? '').trim().slice(0, 2000)
  if (!comentario) return { ok: false, motivo: 'vazio' }
  const { data } = await supabase
    .from('feedback_solicitacoes')
    .update({ comentario })
    .eq('token', token)
    .is('comentario', null)
    .lte('nota', 3)
    .select('nota')
  const linha = data?.[0]
  if (!linha) return { ok: true, motivo: 'ja_registrado' }
  if (linha.nota <= 2) {
    await avisar(montarAlertaNotaBaixa({ nota: linha.nota, comentario, token })).catch((e) => {
      console.warn('[feedback] alerta de nota baixa falhou:', e?.message || e)
    })
  }
  return { ok: true }
}
