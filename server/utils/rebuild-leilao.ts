import { fotoRefsDaPassagem } from '../../shared/foto-lote'
import { montarRelatorioSnapshot } from './relatorio-snapshot'

// Rebuild admin do bloco de leilao de pedido JA entregue (modo rebuildLeilao
// do /api/premium/recall/backfill). Reconsulta a base de leiloes ao vivo, com o
// mesmo perfil e o mesmo caminho da entrega (montarRelatorioSnapshot, so o
// campo historicoLeilao, cache renovado), e troca SO
// relatorio_snapshot.historicoLeilao. Nada de e-mail, nada nos outros blocos.
// Base parceira: o pedido vai com o id, entao ela reaproveita a linha ja
// cobrada do pedido em vez de cobrar de novo (parceiro-leilao.ts).
//
// Auditoria: o bloco substituido fica em relatorio_snapshot.auditoria
// .historicoLeilaoAnteriores (ultimos MAX_ANTERIORES), com a data da troca. O
// report.get le os campos um a um e o /api/premium/foto so autoriza foto de
// historicoLeilao.passagens, entao o backup nao vai pro navegador.

export const MAX_ANTERIORES = 3

export type ResultadoRebuild =
  | { token: string; pulado: string }
  | { token: string; ok: false; motivo: string }
  | { token: string; ok: true; passagens: number; fotosPorPassagem: { fonte: string | null; lote: string | null; fotos: number }[] }

/** Quantas fotos a passagem mostra (refs do R2 ou as do detalhe). */
export function fotosDaPassagem(p: any): number {
  return Array.isArray(p?.foto_refs) ? p.foto_refs.length : fotoRefsDaPassagem(p).length
}

export async function rebuildLeilao(
  supabase: any,
  tokensBrutos: unknown[],
  deps: { montar?: typeof montarRelatorioSnapshot; agora?: number } = {},
): Promise<ResultadoRebuild[]> {
  const montar = deps.montar ?? montarRelatorioSnapshot
  const agora = deps.agora ?? Date.now()
  const tokens = [...new Set(tokensBrutos.map((t) => String(t || '').trim()).filter((t) => t && t.length <= 64))].slice(0, 20)
  if (!tokens.length) return []
  const { data, error } = await supabase
    .from('pedidos_premium')
    .select('id,status,placa,plano,consulta_id,preview,token_entrega,relatorio_snapshot')
    .in('token_entrega', tokens)
  if (error) throw createError({ statusCode: 502, message: 'Leitura falhou: ' + error.message })
  const porToken = new Map<string, any>((Array.isArray(data) ? data : []).map((p: any) => [p.token_entrega, p]))
  const out: ResultadoRebuild[] = []
  for (const token of tokens) {
    const p = porToken.get(token)
    if (!p) { out.push({ token, pulado: 'token inexistente' }); continue }
    if (p.status !== 'entregue') { out.push({ token, pulado: `pedido nao entregue (status ${p.status})` }); continue }
    const snap = p.relatorio_snapshot
    if (!snap || typeof snap !== 'object') { out.push({ token, pulado: 'sem snapshot' }); continue }
    if ((p.plano || 'completa') !== 'completa') { out.push({ token, pulado: 'plano sem bloco de leilao' }); continue }
    const base = await montar(
      supabase,
      { placa: p.placa, plano: 'completa', consulta_id: p.consulta_id, preview: p.preview, token: p.token_entrega, id: p.id } as any,
      ['historicoLeilao'],
      { renovarLeilao: true },
    ).catch(() => null)
    const novo = base?.historicoLeilao
    // Base fora do ar / timeout: montar devolve null. NAO apaga o bloco que o cliente ja tem.
    if (!novo) { out.push({ token, ok: false, motivo: 'base de leiloes nao respondeu; snapshot intacto, tente de novo' }); continue }
    const anteriores = Array.isArray(snap?.auditoria?.historicoLeilaoAnteriores) ? snap.auditoria.historicoLeilaoAnteriores : []
    const auditoria = {
      ...(snap.auditoria && typeof snap.auditoria === 'object' ? snap.auditoria : {}),
      historicoLeilaoAnteriores: [
        { substituidoEm: new Date(agora).toISOString(), motivo: 'rebuildLeilao', bloco: snap.historicoLeilao ?? null },
        ...anteriores,
      ].slice(0, MAX_ANTERIORES),
    }
    const { error: upErr } = await supabase
      .from('pedidos_premium')
      .update({ relatorio_snapshot: { ...snap, historicoLeilao: novo, auditoria } })
      .eq('id', p.id)
    if (upErr) { out.push({ token, ok: false, motivo: upErr.message }); continue }
    const passagens = Array.isArray(novo.passagens) ? novo.passagens : []
    out.push({
      token, ok: true, passagens: passagens.length,
      fotosPorPassagem: passagens.map((x: any) => ({ fonte: x?.fonte ?? null, lote: x?.lote ?? null, fotos: fotosDaPassagem(x) })),
    })
  }
  return out
}
