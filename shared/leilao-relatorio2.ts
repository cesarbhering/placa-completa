// Campos do Relatorio 2.0 na leiloes-api (#96/#97/#104, no ar em 14/out):
// na raiz, linha_do_tempo e recorrencia; por passagem, origem, alertas,
// desfecho, lote_publico e contexto_judicial.
//
// Regra geral: os nomes podem crescer na API. Valor desconhecido NAO aparece
// (tipo de origem, codigo de alerta, codigo de desfecho, tipo de evento). Os
// rotulos de alerta e desfecho sao NOSSOS (copy controlada); o de origem vem
// pronto da API, mas so pra tipo conhecido. Nenhum valor monetario.

import { paginaPublicaLeilao } from './leilao-exibicao'

const txt = (v: unknown, max = 160): string | null => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
  return s || null
}
const isoData = (v: unknown): string | null => {
  const m = String(v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}
export const dataBR = (iso: string | null | undefined): string | null => {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null
}

// ---------- origem ----------
export const TIPOS_ORIGEM = new Set(['detran_patio', 'judicial', 'apreensao_penal', 'financeira', 'seguradora'])
export interface OrigemLeilao { tipo: string; rotulo: string; uf: string | null }
export function sanearOrigem(o: any): OrigemLeilao | null {
  if (!o || typeof o !== 'object' || !TIPOS_ORIGEM.has(String(o.tipo))) return null
  const rotulo = txt(o.rotulo, 80)
  if (!rotulo) return null
  const uf = /^[A-Z]{2}$/.test(String(o.uf || '')) ? String(o.uf) : null
  return { tipo: String(o.tipo), rotulo, uf }
}

// ---------- alertas (sempre "declarado no edital") ----------
export const ROTULO_ALERTA: Record<string, string> = {
  chassi_remarcado: 'Chassi remarcado',
  so_desmonte: 'Apenas para desmonte',
  sem_chave: 'Sem chave',
  motor_inservivel: 'Motor inservível',
  placas_falsas: 'Placas falsas',
  renajud_declarado: 'RENAJUD declarado no edital',
  alienacao_fiduciaria_declarada: 'Alienação fiduciária declarada no edital',
  cambio_substituido: 'Câmbio substituído',
}
export interface AlertaLeilao { codigo: string; rotulo: string }
export function sanearAlertas(a: any): AlertaLeilao[] {
  if (!Array.isArray(a)) return []
  const vistos = new Set<string>()
  const out: AlertaLeilao[] = []
  for (const x of a) {
    const c = String(x?.codigo || '')
    if (!ROTULO_ALERTA[c] || vistos.has(c)) continue
    vistos.add(c)
    out.push({ codigo: c, rotulo: ROTULO_ALERTA[c] })
  }
  return out
}
/** "Chassi remarcado (declarado no edital)"; o que ja diz "no edital" nao repete. */
export function textoAlerta(a: AlertaLeilao): string {
  return /no edital$/i.test(a.rotulo) ? a.rotulo : `${a.rotulo} (declarado no edital)`
}

// ---------- desfecho (sem valor) ----------
export const ROTULO_DESFECHO: Record<string, string> = {
  arrematado: 'Arrematado',
  sem_licitante: 'Sem licitante (não foi vendido)',
  nao_pagou: 'Arrematante não pagou',
  suspenso: 'Leilão suspenso',
  cancelado: 'Leilão cancelado',
  encerrado_sem_confirmacao: 'Encerrado sem confirmação de venda',
}
export interface DesfechoLeilao { codigo: string; rotulo: string; data: string | null }
export function sanearDesfecho(d: any): DesfechoLeilao | null {
  const c = String(d?.codigo || '')
  if (!ROTULO_DESFECHO[c]) return null
  return { codigo: c, rotulo: ROTULO_DESFECHO[c], data: isoData(d?.data) }
}

// ---------- lote publico (catalogo comercial) ----------
export const LOTE_VIVO_DIAS = 30
export interface LotePublico { url: string | null; status: 'vivo' | 'encerrado_na_casa'; vistaEm: string | null }
/** URL so https, so com status vivo e vista ha no maximo 30 dias; senao fica so o status. */
export function sanearLotePublico(l: any, agora: Date = new Date()): LotePublico | null {
  if (!l || typeof l !== 'object') return null
  const status = l.status === 'vivo' ? 'vivo' : l.status === 'encerrado_na_casa' ? 'encerrado_na_casa' : null
  if (!status) return null
  const vistaEm = isoData(l.vista_em)
  let url: string | null = null
  try {
    const u = new URL(String(l.url || ''))
    const dias = vistaEm ? (agora.getTime() - new Date(`${vistaEm}T00:00:00Z`).getTime()) / 86400000 : Infinity
    if (u.protocol === 'https:' && status === 'vivo' && dias <= LOTE_VIVO_DIAS) url = u.toString()
  } catch { /* sem url */ }
  return { url, status, vistaEm }
}

// ---------- contexto judicial ----------
export interface ContextoJudicial { comarca: string | null; uf: string | null; data: string | null; paginaPublicaUrl: string | null }
export function sanearContextoJudicial(c: any): ContextoJudicial | null {
  if (!c || typeof c !== 'object') return null
  const r = {
    comarca: txt(c.comarca, 80),
    uf: /^[A-Z]{2}$/.test(String(c.uf || '')) ? String(c.uf) : null,
    data: isoData(c.data),
    paginaPublicaUrl: paginaPublicaLeilao(c.pagina_publica_url),
  }
  return r.comarca || r.uf || r.data || r.paginaPublicaUrl ? r : null
}
/** "Levado a leilão judicial em Campinas/SP, 06/05/2026" (partes que existirem). */
export function textoJudicial(c: ContextoJudicial): string {
  const onde = c.comarca ? ` em ${c.comarca}${c.uf ? `/${c.uf}` : ''}` : c.uf ? ` em ${c.uf}` : ''
  const quando = dataBR(c.data)
  return `Levado a leilão judicial${onde}${quando ? `, ${quando}` : ''}`
}

// ---------- raiz: linha do tempo e recorrencia ----------
export const TIPOS_EVENTO_LEILAO = new Set(['notificado', 'leilao', 'leilao_judicial'])
export interface EventoLeilaoApi { data: string; dataFim: string | null; tipo: 'notificado' | 'leilao' | 'leilao_judicial'; nPassagens: number; fontes: string[] }
export function sanearLinhaDoTempoLeilao(l: any): EventoLeilaoApi[] | null {
  if (!Array.isArray(l)) return null
  return l
    .filter((e) => e && TIPOS_EVENTO_LEILAO.has(String(e.tipo)) && isoData(e.data))
    .slice(0, 50)
    .map((e) => ({
      data: isoData(e.data)!,
      dataFim: isoData(e.data_fim),
      tipo: e.tipo,
      nPassagens: Math.max(1, Number(e.n_passagens) || 1),
      fontes: (Array.isArray(e.fontes) ? e.fontes : []).map((f: unknown) => txt(f, 60)).filter(Boolean).slice(0, 5) as string[],
    }))
}
export interface RecorrenciaLeilao { voltouALeilao: boolean; texto: string | null; nLeiloes: number; intervalosMeses: number[] }
export function sanearRecorrencia(r: any): RecorrenciaLeilao | null {
  if (!r || typeof r !== 'object') return null
  return {
    voltouALeilao: r.voltou_a_leilao === true,
    texto: r.voltou_a_leilao === true ? txt(r.texto, 120) : null,
    nLeiloes: Math.max(0, Number(r.n_leiloes) || 0),
    intervalosMeses: Array.isArray(r.intervalos_meses) ? r.intervalos_meses.map(Number).filter((n: number) => Number.isFinite(n) && n >= 0) : [],
  }
}

/** Texto do intervalo pro evento seguinte da linha do tempo: "voltou a leilão 7 meses depois". */
export function textoIntervalo(meses: number): string {
  if (meses >= 24 && meses % 12 === 0) return `voltou a leilão ${meses / 12} anos depois`
  if (meses >= 12) {
    const anos = Math.round((meses / 12) * 10) / 10
    return `voltou a leilão ${anos.toLocaleString('pt-BR')} ${anos === 1 ? 'ano' : 'anos'} depois`
  }
  return `voltou a leilão ${meses} ${meses === 1 ? 'mês' : 'meses'} depois`
}
