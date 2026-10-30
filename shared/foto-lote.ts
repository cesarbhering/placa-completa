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

/**
 * Teto de sanidade de midias por passagem. Desde 27/out/2026 a leiloes-api
 * manda TODAS as fotos do lote (antes eram 4) e o relatorio mostra em
 * carrossel; o teto so protege contra resposta torta.
 */
export const MAX_MIDIAS_LOTE = 300

/**
 * Teto de refs que o SERVIDOR grava por passagem (RPC fotos_passagem_gravar,
 * migration 20261018120000, recusa mais de 4). Sobe quando a RPC nova (ate 300,
 * substitui quando a lista e maior) for aplicada; fica com o fotos-depois.
 */
export const FOTOS_RPC_MAX = 4

/** detalhes.fotos -> refs, por ordem (todas, ate o teto). Ref so com caracteres de token. */
export function fotoRefsDaPassagem(p: any): FotoRef[] {
  const lista = p?.detalhes?.fotos
  if (!Array.isArray(lista)) return []
  return lista
    .filter((f: any) => f && typeof f.foto_ref === 'string' && /^[A-Za-z0-9._~-]{8,512}$/.test(f.foto_ref))
    .map((f: any) => ({ ref: f.foto_ref, ordem: Number(f.ordem) || 0, vista: VISTAS[String(f.vista || '').toLowerCase()] || null }))
    .sort((a: FotoRef, b: FotoRef) => a.ordem - b.ordem)
    .slice(0, MAX_MIDIAS_LOTE)
}

/** URL da foto pela nossa rota (nunca a URL assinada). */
export function urlFotoLote(token: string, ref: string): string {
  return `/api/premium/foto?token=${encodeURIComponent(token)}&ref=${encodeURIComponent(ref)}`
}

// ---------- Videos do lote (contrato da leiloes-api #206, 27/out/2026) ----------
// detalhes.videos: [{ordem, url_origem, so_link?, foto_ref?}].
//   - com foto_ref: arquivo da leiloeira no nosso R2 (ate 200 MB); a URL sai do
//     mesmo /v1/foto-link da foto (rota /api/premium/foto);
//   - so_link 'plataforma': YouTube/Vimeo, embutido pelo url_origem;
//   - so_link 'grande': arquivo acima de 200 MB, so o link da leiloeira;
//   - so_link 'falhou': download falhou, nao aparece.

export interface VideoLote {
  ref: string | null
  ordem: number
  /** null = no nosso R2 (ref). */
  so_link: 'plataforma' | 'grande' | null
  /** Embed (plataforma) ou link da leiloeira (grande). */
  url: string | null
}

const REF_OK = /^[A-Za-z0-9._~-]{8,512}$/

/** YouTube/Vimeo -> URL de embed (youtube-nocookie / player.vimeo). Outro host: null. */
export function embedDeVideo(url: unknown): string | null {
  let u: URL
  try { u = new URL(String(url || '')) } catch { return null }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const h = u.hostname.replace(/^www\.|^m\./, '')
  let id: string | null = null
  if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0]
  else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] ?? null)
  }
  if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`
  if (h === 'vimeo.com' || h === 'player.vimeo.com') {
    const v = u.pathname.match(/(?:^|\/)(\d{5,12})(?:$|\/)/)?.[1]
    if (v) return `https://player.vimeo.com/video/${v}`
  }
  return null
}

/** detalhes.videos -> videos exibiveis, por ordem. 'falhou' e host desconhecido ficam de fora. */
export function videosDaPassagem(p: any): VideoLote[] {
  const lista = p?.detalhes?.videos
  if (!Array.isArray(lista)) return []
  const out: VideoLote[] = []
  for (const v of lista) {
    if (!v || typeof v !== 'object') continue
    const ordem = Number(v.ordem) || 0
    if (typeof v.foto_ref === 'string' && REF_OK.test(v.foto_ref)) { out.push({ ref: v.foto_ref, ordem, so_link: null, url: null }); continue }
    if (v.so_link === 'plataforma') {
      const e = embedDeVideo(v.url_origem)
      if (e) out.push({ ref: null, ordem, so_link: 'plataforma', url: e })
    } else if (v.so_link === 'grande' && /^https?:\/\//i.test(String(v.url_origem || ''))) {
      out.push({ ref: null, ordem, so_link: 'grande', url: String(v.url_origem) })
    }
  }
  return out.sort((a, b) => a.ordem - b.ordem).slice(0, MAX_MIDIAS_LOTE)
}

/** O ref (foto OU video) pertence a uma passagem deste snapshot? */
export function fotoRefDoRelatorio(snapshot: any, ref: string): boolean {
  const passagens = snapshot?.historicoLeilao?.passagens
  if (!Array.isArray(passagens) || !ref) return false
  return passagens.some((p: any) =>
    (Array.isArray(p?.foto_refs) ? p.foto_refs : fotoRefsDaPassagem(p)).some((f: FotoRef) => f.ref === ref)
    || (Array.isArray(p?.video_refs) ? p.video_refs : videosDaPassagem(p)).some((v: VideoLote) => v.ref === ref))
}

/** Um item do carrossel do lote. */
export interface MidiaLote {
  tipo: 'foto' | 'video' | 'embed' | 'link'
  src: string
  alt: string
}

/**
 * Fotos (todas, por ordem) e depois os videos da passagem, prontos pro
 * carrossel. Foto/video do R2 sempre pela NOSSA rota (urlFotoLote). Snapshot
 * antigo: as URLs de foto ja saneadas (p.fotos).
 */
export function midiasDaPassagem(p: any, token: string, altBase = 'do lote de leilão'): MidiaLote[] {
  const refs: FotoRef[] = Array.isArray(p?.foto_refs) ? p.foto_refs : fotoRefsDaPassagem(p)
  const fotos: MidiaLote[] = refs.map((f, i) => ({ tipo: 'foto' as const, src: urlFotoLote(token, f.ref), alt: altFotoLote(f.vista, i).replace('do lote de leilão com perfil parecido', altBase) }))
  for (const u of Array.isArray(p?.fotos) ? p.fotos : []) {
    if (typeof u === 'string' && u) fotos.push({ tipo: 'foto', src: u, alt: `Foto ${fotos.length + 1} ${altBase}` })
  }
  const videos: VideoLote[] = Array.isArray(p?.video_refs) ? p.video_refs : videosDaPassagem(p)
  const vids: MidiaLote[] = videos.map((v, i) => {
    const alt = `Vídeo ${i + 1} ${altBase}`
    if (v.ref) return { tipo: 'video' as const, src: urlFotoLote(token, v.ref), alt }
    return { tipo: v.so_link === 'plataforma' ? 'embed' as const : 'link' as const, src: String(v.url), alt }
  })
  return [...fotos, ...vids].slice(0, MAX_MIDIAS_LOTE)
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
