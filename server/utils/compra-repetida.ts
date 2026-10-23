// Mesma pessoa pagando duas vezes pela mesma placa. Caso real: KZH9386,
// 23/out/2026. Pagou as 09:43 sem e-mail, recebeu, gerou outro Pix as 09:55 e
// pagou de novo as 09:59, agora com e-mail. Os tres pedidos com o mesmo IP,
// aparelho e obref.
//
// Antes de criar uma cobranca, procura um pedido ja pago da mesma placa, com
// plano igual ou superior, nas ultimas 24 h, vindo do mesmo IP E do mesmo
// aparelho (ou do mesmo obref). Nunca so o IP: em rede de operadora gente
// diferente divide IP, e o token de entrega devolvido e a credencial do
// relatorio. So conta em producao.

export const JANELA_COMPRA_REPETIDA_MS = 24 * 60 * 60 * 1000
const STATUS_PAGO = ['pago', 'consultando', 'entregue']

/** Planos que ja cobrem o que esta sendo comprado (igual ou superior). */
export function planosQueCobrem(plano: string): string[] {
  return plano === 'basica' ? ['basica', 'completa'] : ['completa']
}

export interface CompradorAtual {
  placa: string
  plano: string
  ip: string | null
  dispositivo?: string | null
  sistema?: string | null
  canal?: string | null
  obref?: string | null
}

const vazio = (v: unknown) => !v || v === 'desconhecido' || v === 'unknown'

/** Mesmo aparelho (categoria + sistema + canal) ou mesmo clique de anuncio. */
export function mesmoComprador(antigo: Record<string, any>, atual: CompradorAtual): boolean {
  if (vazio(atual.ip) || antigo.ip_address !== atual.ip) return false
  const aparelho = !vazio(atual.dispositivo) && !vazio(atual.sistema)
    && antigo.dispositivo === atual.dispositivo
    && antigo.sistema === atual.sistema
    && (antigo.canal ?? null) === (atual.canal ?? null)
  const clique = !!atual.obref && antigo.obref === atual.obref
  return aparelho || clique
}

export async function compraRepetida(
  supabase: any,
  atual: CompradorAtual,
  opts: { ambiente: string; homolog?: boolean; agora?: number },
): Promise<{ id: string; token_entrega: string } | null> {
  if (opts.homolog || opts.ambiente !== 'producao' || vazio(atual.ip)) return null
  const desde = new Date((opts.agora ?? Date.now()) - JANELA_COMPRA_REPETIDA_MS).toISOString()
  try {
    const { data } = await supabase.from('pedidos_premium')
      .select('id,token_entrega,ip_address,dispositivo,sistema,canal,obref,criado_em')
      .eq('placa', atual.placa)
      .eq('ip_address', atual.ip)
      .eq('ambiente', 'producao')
      .in('status', STATUS_PAGO)
      .in('plano', planosQueCobrem(atual.plano))
      .gte('criado_em', desde)
      .order('criado_em', { ascending: false })
      .limit(10)
    const achado = (data || []).find((l: any) => l.token_entrega && mesmoComprador(l, atual))
    return achado ? { id: achado.id, token_entrega: achado.token_entrega } : null
  } catch {
    // Falha na checagem nunca impede a venda.
    return null
  }
}

/**
 * Link de um pedido duplicado que foi reembolsado: acha a compra que ficou
 * (entregue, mesma placa, plano igual ou superior, mesmo IP + aparelho ou
 * obref, ate 24 h de distancia pra qualquer lado). Caso KZH9386: o link do
 * reembolsado tem que abrir o relatorio do que ficou.
 */
export async function pedidoQueFicou(
  supabase: any,
  reembolsado: Record<string, any>,
): Promise<{ token_entrega: string } | null> {
  if (reembolsado?.status !== 'reembolsado' || reembolsado.ambiente !== 'producao' || vazio(reembolsado.ip_address)) return null
  const t = Date.parse(String(reembolsado.criado_em || ''))
  if (!Number.isFinite(t)) return null
  const atual: CompradorAtual = {
    placa: reembolsado.placa, plano: reembolsado.plano || 'completa', ip: reembolsado.ip_address,
    dispositivo: reembolsado.dispositivo, sistema: reembolsado.sistema, canal: reembolsado.canal, obref: reembolsado.obref,
  }
  try {
    const { data } = await supabase.from('pedidos_premium')
      .select('id,token_entrega,ip_address,dispositivo,sistema,canal,obref,criado_em')
      .eq('placa', atual.placa)
      .eq('ip_address', atual.ip)
      .eq('ambiente', 'producao')
      .eq('status', 'entregue')
      .in('plano', planosQueCobrem(atual.plano))
      .gte('criado_em', new Date(t - JANELA_COMPRA_REPETIDA_MS).toISOString())
      .lt('criado_em', new Date(t + JANELA_COMPRA_REPETIDA_MS).toISOString())
      .order('criado_em', { ascending: false })
      .limit(10)
    const achado = (data || []).find((l: any) => l.token_entrega && l.id !== reembolsado.id && mesmoComprador(l, atual))
    return achado ? { token_entrega: achado.token_entrega } : null
  } catch {
    return null
  }
}

/**
 * Resposta 409 { ja_comprado, token_entrega } se for compra repetida, ou null
 * pra seguir. forcar_nova_compra === true (a pessoa confirmou que quer comprar
 * de novo, ex.: pra outra pessoa) pula a checagem.
 */
export async function respostaCompraRepetida(event: any, supabase: any, atual: CompradorAtual, ambiente: string, forcar: unknown) {
  if (forcar === true) return null
  const r = await compraRepetida(supabase, atual, { ambiente, homolog: !!useRuntimeConfig().public?.homolog })
  if (!r) return null
  setResponseStatus(event, 409)
  return { ja_comprado: true, token_entrega: r.token_entrega }
}
