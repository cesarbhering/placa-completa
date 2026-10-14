import { emVoo } from './tarefas-em-voo'
import { consultarDetranInfosimples, registrarCusto, brutoDoResultado, placaParaDetran, detalheDaRecusa, estruturaChaves, logIndisponivel, type UfDetran } from './infosimples-detran'
import { renavamDaResposta, ufDaResposta } from './detran-multas'

// Detalhe da restricao RENAJUD (tribunal/orgao, tipo e
// data), so onde a Infosimples tem fonte: AL (/detran/al/renajud, sem
// credencial) e GO (/detran/go/veiculo, e-CNPJ, bloqueios_judiciais). Decisao
// do Cesar, 09/out. Integrado pela DOC (nao havia pedido real AL/GO com
// RENAJUD): formato que o parser nao reconhece vira 'indisponivel' e loga so
// as CHAVES; o relatorio fica com o card RENAJUD de sempre.
//
// LGPD: nada de nome de parte, autor, reu ou advogado. So os campos da
// whitelist abaixo vao pro snapshot.

export const RENAJUD_UFS: Partial<Record<UfDetran, { path: string; fonteCusto: string; fonte: string }>> = {
  AL: { path: 'detran/al/renajud', fonteCusto: 'infosimples_renajud_al', fonte: 'detran_al_renajud' },
  GO: { path: 'detran/go/veiculo', fonteCusto: 'infosimples_renajud_go', fonte: 'detran_go_veiculo' },
}

export interface ItemRenajud {
  tribunal: string | null
  orgao: string | null
  tipo: string | null
  data: string | null
}

// Item 12 (Cesar, 14/out): nunca nome de parte NEM numero de processo; so o que a
// restricao bloqueia (tipo), tribunal/orgao e data. Snapshots antigos com
// `processo` sao limpos na leitura (sanearRenajud).
export const CAMPOS_RENAJUD = ['tribunal', 'orgao', 'tipo', 'data'] as const

const texto = (v: unknown): string | null => {
  if (v == null || typeof v === 'object') return null
  const t = String(v).replace(/\s+/g, ' ').trim()
  return t || null
}


const data = (v: unknown): string | null => {
  const t = texto(v)
  const m = t?.match(/\d{2}\/\d{2}\/\d{4}/)
  return m ? m[0] : null
}

/** Tipo da restricao: so o texto curto (Transferencia, Licenciamento, Circulacao, Penhora...). */
const tipo = (v: unknown): string | null => {
  if (Array.isArray(v)) {
    const ts = v.map((x) => texto(typeof x === 'object' ? (x?.tipo ?? x?.descricao ?? x?.restricao) : x)).filter(Boolean)
    return ts.length ? ts.join(', ').slice(0, 120) : null
  }
  if (v && typeof v === 'object') return texto((v as any).tipo ?? (v as any).descricao)
  const t = texto(v)
  return t ? t.slice(0, 120) : null
}

function itemValido(i: ItemRenajud): boolean {
  return !!(i.tribunal || i.orgao)
}

/** AL: data.processos[] { numero_processo, orgao, tribunal, restricoes }. */
export function parsearRenajudAl(d: any): ItemRenajud[] | null {
  const lista = Array.isArray(d?.processos) ? d.processos : null
  if (!lista) return null
  const itens = lista.map((p: any): ItemRenajud => {
    const rs = p?.restricoes
    const primeiraData = Array.isArray(rs) ? rs.map((r: any) => data(r?.data ?? r?.data_inclusao ?? r?.inclusao)).find(Boolean) ?? null : null
    return {
      tribunal: texto(p?.tribunal),
      orgao: texto(p?.orgao),
      tipo: tipo(rs),
      data: data(p?.data ?? p?.data_inclusao) ?? primeiraData,
    }
  }).filter(itemValido)
  return itens.length ? itens : null
}

/** GO: data.bloqueios_judiciais[] { tribunal, comarca, numero_processo, tipo, inclusao_data }. */
export function parsearRenajudGo(d: any): ItemRenajud[] | null {
  const lista = Array.isArray(d?.bloqueios_judiciais) ? d.bloqueios_judiciais : null
  if (!lista) return null
  const itens = lista.map((b: any): ItemRenajud => ({
    tribunal: texto(b?.tribunal),
    orgao: texto(b?.comarca),
    tipo: tipo(b?.tipo),
    data: data(b?.inclusao_data),
  })).filter(itemValido)
  return itens.length ? itens : null
}

export function parsearRenajud(uf: UfDetran, d: any): ItemRenajud[] | null {
  if (uf === 'AL') return parsearRenajudAl(d)
  if (uf === 'GO') return parsearRenajudGo(d)
  return null
}

/** Garantia final por lista de permissao (o que vai pro snapshot e pra tela). */
export function sanearRenajud(bloco: any): any {
  if (!bloco || typeof bloco !== 'object') return null
  const itens = Array.isArray(bloco.itens)
    ? bloco.itens.map((i: any) => Object.fromEntries(CAMPOS_RENAJUD.map((k) => [k, texto(i?.[k])]))).filter((i: any) => i.tribunal || i.orgao)
    : []
  return { status: bloco.status === 'ok' && itens.length ? 'ok' : 'indisponivel', uf: texto(bloco.uf), itens }
}

export function temRenajud(response: any): boolean {
  const r = Array.isArray(response) ? response[0] : response
  return r?.indicadorRestricaoRenajud === true || r?.indicadorRestricaoRenajud === 'true'
}

async function lerSnapshot(supabase: any, id: string): Promise<any | null> {
  const { data: row } = await supabase.from('pedidos_premium').select('relatorio_snapshot').eq('id', id).maybeSingle()
  const s = row?.relatorio_snapshot
  return s && typeof s === 'object' ? s : null
}

/**
 * Busca o detalhe RENAJUD e grava em snapshot.renajudDetalhe. Gate: UF com
 * fonte (AL/GO) e indicadorRestricaoRenajud aceso. 1 chamada por pedido (nao
 * repete se ja gravou). Custo gravado sempre. Fail-open: nunca lanca.
 */
export async function completarRenajud(
  supabase: any,
  pedido: { id: string; placa: string },
  ctx: { response: any },
): Promise<{ ok: boolean; pulado?: string; code?: number }> {
  try {
    const uf = String(ufDaResposta(ctx.response) || '').toUpperCase() as UfDetran
    const cfg = RENAJUD_UFS[uf]
    if (!cfg) return { ok: false, pulado: `uf ${uf || '?'} sem fonte de RENAJUD` }
    if (!temRenajud(ctx.response)) return { ok: false, pulado: 'sem RENAJUD' }
    const renavam = renavamDaResposta(ctx.response)
    if (!renavam) return { ok: false, pulado: 'sem renavam' }
    const snap = await lerSnapshot(supabase, pedido.id)
    if (!snap) return { ok: false, pulado: 'sem snapshot' }
    if (snap.renajudDetalhe) return { ok: false, pulado: 'ja tem' }

    const res = await consultarDetranInfosimples({ uf, placa: placaParaDetran(pedido.placa, ctx.response), renavam, path: cfg.path })
    await registrarCusto(supabase, { pedidoId: pedido.id, fonte: cfg.fonteCusto, preco: res.preco, code: res.code, detalhe: detalheDaRecusa(res), bruto: brutoDoResultado(res) })
    let bloco: any = { status: 'indisponivel', uf }
    if (res.code === 200 && res.data) {
      const itens = parsearRenajud(uf, res.data)
      if (itens) bloco = { status: 'ok', uf, fonte: cfg.fonte, itens }
      else console.warn(`[renajud] formato-desconhecido uf=${uf} pedido=${String(pedido.id).slice(0, 8)} chaves=${JSON.stringify(estruturaChaves(res.data)).slice(0, 1500)}`)
    } else {
      logIndisponivel(pedido.id, `${uf}-renajud`, res.code, res.codeMessage || 'sem data', 0)
    }
    const atual = (await lerSnapshot(supabase, pedido.id)) || snap
    const { error } = await supabase.from('pedidos_premium')
      .update({ relatorio_snapshot: { ...atual, renajudDetalhe: sanearRenajud(bloco) } })
      .eq('id', pedido.id)
    if (error) return { ok: false, pulado: 'update: ' + error.message }
    return { ok: bloco.status === 'ok', code: res.code }
  } catch (e: any) {
    console.warn('[renajud] falhou:', e?.message || e)
    return { ok: false, pulado: 'erro' }
  }
}

/** Pos-entrega: solto, nunca segura nem quebra a entrega. */
export function completarRenajudDepois(supabase: any, pedido: { id: string; placa: string }, ctx: { response: any }): void {
  void emVoo('renajud', () => completarRenajud(supabase, pedido, ctx).catch(() => {}))
}
