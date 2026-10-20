// Fotos do lote de leilao guardadas no nosso R2 (leiloes-api #141, 16/out/2026).
//
// A passagem traz em detalhes.fotos itens {ordem, vista, url_origem, foto_ref}.
// O foto_ref e um token opaco (HMAC da nossa chave) que a leiloes-api troca por
// URL assinada de 24h em POST /v1/foto-link. O snapshot guarda SO o ref: a
// pagina pede /api/premium/foto?token=...&ref=..., o servidor confere que o ref
// e deste relatorio e responde 302 pra URL assinada. Nada que venca fica salvo.

import { ehNotificacao } from './leilao-notificacao'

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

// ---------- Fotos que chegam DEPOIS da venda (Cesar, 18/out/2026) ----------
//
// O snapshot e congelado na venda. Quando a leiloes-api ainda esta buscando as
// fotos do lote, a passagem vem com detalhes.fotos_pendente=true: a pagina
// mostra "Buscando fotos do anúncio…" no card e o job do servidor
// (server/utils/fotos-depois.ts) grava os foto_refs quando elas chegam.
// Quando a busca termina sem foto, o job grava `fotos_busca` na passagem e o
// aviso some. Sem resposta final, o aviso some sozinho 7 dias depois da entrega.

/** Status que o job grava em passagem.fotos_busca (desligam o aviso na pagina). */
export type FotosBuscaStatus = 'sem_foto' | 'fonte_sem_foto'

function temFoto(p: any): boolean {
  if (Array.isArray(p?.foto_refs) && p.foto_refs.length) return true
  if (fotoRefsDaPassagem(p).length) return true
  return Array.isArray(p?.fotos) && p.fotos.some((f: any) => typeof f === 'string' && f)
}

/** Depois disso (da entrega), a pagina para de dizer "Buscando fotos" sozinha. */
export const AVISO_FOTOS_MAX_MS = 7 * 24 * 60 * 60 * 1000

/**
 * A pagina deve mostrar "Buscando fotos do anúncio…" nesta passagem?
 * Com `entregueEm`, o aviso some sozinho 7 dias depois da entrega (so
 * exibicao: nao depende do job).
 */
export function fotosPendentes(p: any, ctx?: { entregueEm?: string | null; agora?: number }): boolean {
  if (!p || typeof p !== 'object') return false
  const ent = new Date(String(ctx?.entregueEm || '')).getTime()
  if (Number.isFinite(ent) && (ctx?.agora ?? Date.now()) - ent > AVISO_FOTOS_MAX_MS) return false
  if (p.fotos_busca) return false
  if (temFoto(p)) return false
  if (typeof p.fotos_pendente === 'boolean') return p.fotos_pendente
  return p?.detalhes?.fotos_pendente === true
}

/**
 * O job deve perguntar a leiloes-api pelas fotos desta passagem?
 * Sem foto ainda, com lote, nao e edital de notificacao, a busca nao terminou sem foto e a fonte publica
 * foto: casa privada (catalogo com fotos) ou qualquer fonte que a propria API
 * marcou com fotos_pendente. `fontesSemFoto` = fontes que a API ja respondeu
 * "fonte_sem_foto" nesta execucao do servidor.
 */
export function passagemPrecisaDeFoto(p: any, fontesSemFoto?: Set<string>): boolean {
  if (!p || typeof p !== 'object') return false
  const fonte = String(p.fonte || '')
  if (!fonte || !String(p.lote || '').trim()) return false
  // Base parceira de leilao nao tem catalogo de fotos na nossa base.
  if (p.fonte_tipo === 'parceiro' || fonte === 'parceiro') return false
  if (temFoto(p)) return false
  const busca = p.fotos_busca?.status
  if (busca === 'sem_foto' || busca === 'fonte_sem_foto') return false
  if (fontesSemFoto?.has(fonte)) return false
  const det = p.detalhes && typeof p.detalhes === 'object' ? p.detalhes : {}
  if (ehNotificacao(p)) return false
  return det.fotos_pendente === true || p.fotos_pendente === true || p.fonte_tipo !== 'detran'
}
