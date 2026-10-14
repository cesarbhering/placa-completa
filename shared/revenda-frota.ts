// Revenda de frota (leiloes-api #106, fonte "Louco por Leilões"): carro de
// frota anunciado a venda, com placa, km, condicao declarada e o preco do
// anuncio comparado a FIPE. NAO e leilao: evento proprio na linha do tempo e
// card proprio no relatorio, fora de qualquer contagem de leilao.
//
// Contrato: passagem com fonte_tipo "revenda_frota" (ou detalhes.tipo_evento
// "revenda_frota"); data_leilao = entrada no estoque; detalhes.{status
// disponivel|saiu_do_estoque, saiu_em, km, condicao, video_url, pct_vs_fipe,
// faixa_fipe abaixo|na_fipe|acima}. Sem R$ (a API remove; aqui so %).

import { semProcesso } from './leilao-lgpd'

export function ehRevendaFrota(p: any): boolean {
  return !!p && (p.fonte_tipo === 'revenda_frota' || p?.detalhes?.tipo_evento === 'revenda_frota')
}

export interface RevendaFrota {
  data: string | null
  fonte: string
  status: 'disponivel' | 'saiu_do_estoque' | null
  saiuEm: string | null
  km: number | null
  condicao: string | null
  pctVsFipe: number | null
  faixaFipe: 'abaixo' | 'na_fipe' | 'acima' | null
  /** Video do anuncio: so https do YouTube e so com o carro ainda no estoque. */
  videoUrl: string | null
}

const iso = (v: unknown): string | null => {
  const m = String(v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}
const HOSTS_VIDEO = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com']

export function sanearRevendaFrota(p: any): RevendaFrota | null {
  if (!ehRevendaFrota(p)) return null
  const d = p.detalhes && typeof p.detalhes === 'object' ? p.detalhes : {}
  const status = d.status === 'disponivel' || d.status === 'saiu_do_estoque' ? d.status : null
  const km = Number(d.km)
  const pct = Number(d.pct_vs_fipe)
  const faixa = ['abaixo', 'na_fipe', 'acima'].includes(d.faixa_fipe) ? d.faixa_fipe : null
  let videoUrl: string | null = null
  try {
    const u = new URL(String(d.video_url || ''))
    if (u.protocol === 'https:' && HOSTS_VIDEO.includes(u.hostname.toLowerCase()) && status === 'disponivel') videoUrl = u.toString()
  } catch { /* sem video */ }
  const condicao = semProcesso(String(d.condicao ?? '').replace(/\s+/g, ' ').trim()).slice(0, 160) || null
  return {
    data: iso(p.data_leilao),
    fonte: 'Louco por Leilões (revenda de frota)',
    status,
    saiuEm: status === 'saiu_do_estoque' ? iso(d.saiu_em) : null,
    km: Number.isFinite(km) && km > 0 ? Math.round(km) : null,
    condicao,
    pctVsFipe: Number.isFinite(pct) && d.pct_vs_fipe !== null && d.pct_vs_fipe !== '' ? Math.round(pct * 10) / 10 : null,
    faixaFipe: faixa,
    videoUrl,
  }
}

/** "12% abaixo da FIPE", "na FIPE", "3% acima da FIPE"; sem dado, null. Nunca R$. */
export function textoPrecoVsFipe(r: Pick<RevendaFrota, 'pctVsFipe' | 'faixaFipe'>): string | null {
  const p = r.pctVsFipe
  if (p != null && Math.abs(p) >= 0.5) {
    const n = Math.abs(p).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    return p < 0 ? `anunciado ${n}% abaixo da FIPE` : `anunciado ${n}% acima da FIPE`
  }
  if (p != null || r.faixaFipe === 'na_fipe') return 'anunciado pelo valor da FIPE'
  if (r.faixaFipe === 'abaixo') return 'anunciado abaixo da FIPE'
  if (r.faixaFipe === 'acima') return 'anunciado acima da FIPE'
  return null
}

const dataBR = (i: string | null) => (i ? `${i.slice(8, 10)}/${i.slice(5, 7)}/${i.slice(0, 4)}` : null)

/** Linha de status: "Ainda à venda" / "Saiu do estoque em 03/09/2026 (provável venda)". */
export function textoStatusRevenda(r: RevendaFrota): string | null {
  if (r.status === 'disponivel') return 'Ainda anunciado à venda'
  if (r.status === 'saiu_do_estoque') return r.saiuEm ? `Saiu do estoque em ${dataBR(r.saiuEm)} (provável venda)` : 'Saiu do estoque (provável venda)'
  return null
}

/** Copy vaga da consulta gratis (sem valor, sem data, sem fonte). */
export const FRASE_SINAL_FROTA = 'Consta anúncio de revenda de frota para este veículo. Confira no relatório completo.'
