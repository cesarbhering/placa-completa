// Fotos do lote de leilao guardadas no nosso R2 (leiloes-api #141, 16/out/2026).
//
// A passagem traz em detalhes.fotos itens {ordem, vista, url_origem, foto_ref}.
// O foto_ref e um token opaco (HMAC da nossa chave) que a leiloes-api troca por
// URL assinada de 24h em POST /v1/foto-link. O snapshot guarda SO o ref: a
// pagina pede /api/premium/foto?token=...&ref=..., o servidor confere que o ref
// e deste relatorio e responde 302 pra URL assinada. Nada que venca fica salvo.

export interface FotoRef { ref: string; ordem: number; vista: string | null }

const VISTAS: Record<string, string> = { frente: 'frente', traseira: 'traseira', lateral: 'lateral', painel: 'painel' }

/** detalhes.fotos -> ate 4 refs, por ordem. Ref so com caracteres de token. */
export function fotoRefsDaPassagem(p: any): FotoRef[] {
  const lista = p?.detalhes?.fotos
  if (!Array.isArray(lista)) return []
  return lista
    .filter((f: any) => f && typeof f.foto_ref === 'string' && /^[A-Za-z0-9._~-]{8,512}$/.test(f.foto_ref))
    .map((f: any) => ({ ref: f.foto_ref, ordem: Number(f.ordem) || 0, vista: VISTAS[String(f.vista || '').toLowerCase()] || null }))
    .sort((a: FotoRef, b: FotoRef) => a.ordem - b.ordem)
    .slice(0, 4)
}

/** URL da foto pela nossa rota (nunca a URL assinada). */
export function urlFotoLote(token: string, ref: string): string {
  return `/api/premium/foto?token=${encodeURIComponent(token)}&ref=${encodeURIComponent(ref)}`
}

/** O ref pertence a uma passagem deste snapshot? */
export function fotoRefDoRelatorio(snapshot: any, ref: string): boolean {
  const passagens = snapshot?.historicoLeilao?.passagens
  if (!Array.isArray(passagens) || !ref) return false
  return passagens.some((p: any) => (Array.isArray(p?.foto_refs) ? p.foto_refs : fotoRefsDaPassagem(p)).some((f: FotoRef) => f.ref === ref))
}

/** "Foto da frente do lote" etc. */
export function altFotoLote(vista: string | null, i: number): string {
  return vista ? `Foto ${vista === 'painel' ? 'do painel' : `da ${vista}`} do lote de leilão com perfil parecido` : `Foto ${i + 1} do lote de leilão com perfil parecido`
}
