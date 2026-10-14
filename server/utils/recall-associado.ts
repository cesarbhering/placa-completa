import { consultarRecallToyota } from './recall-toyota'
import { normalizarMarcaRecall } from '../../shared/marcas-recall'
import { sinalPositivo, type RecallBase } from '../../shared/recall-associado'

// Campanhas da base de recalls (a mesma do hook da consulta gratis) gravadas no
// snapshot do pedido como `recallBase`, pra o relatorio dizer QUAL recall estava
// associado ao carro mesmo quando hoje nada consta como pendente.
// So pra pedido cujo hook foi positivo (recall_sinal firme/suave). Fail-open.

const TIMEOUT_MS = 6000

export async function buscarRecallBase(
  pedido: { placa: string; recall_sinal?: string | null; recall_marca?: string | null },
  response: any,
): Promise<RecallBase | null> {
  if (!sinalPositivo(pedido.recall_sinal)) return null
  const r = Array.isArray(response) ? response[0] : response
  const desc = String(r?.descricaoMarcaModelo || '')
  const marca = normalizarMarcaRecall(String(pedido.recall_marca || desc.split('/')[0] || '').replace(/^I\//, '').trim())
  const modelo = normalizarMarcaRecall(desc.includes('/') ? desc.slice(desc.indexOf('/') + 1) : '') || null
  const chassi = String(r?.chassi || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const resp = await consultarRecallToyota({
    placa: pedido.placa,
    chassi: chassi.length === 17 ? chassi : null,
    marca,
    modelo,
    ano_fab: r?.anoFabricacao ?? null,
    ano_mod: r?.anoModelo ?? null,
  }, { timeoutMs: TIMEOUT_MS }).catch(() => null)
  if (!resp) return null
  return {
    consultado: true,
    sinal: pedido.recall_sinal as 'firme' | 'suave',
    fonte: 'base_recalls',
    campanhas: resp.matches.map((m) => ({
      codigo: m.code ? String(m.code) : null,
      nome: m.name ? String(m.name).trim() : null,
      modelo: m.model ? String(m.model) : null,
      ano_modelo: m.model_year ?? null,
      inicio: m.start_date ?? null,
      nivel: m.nivel,
    })),
  }
}

/**
 * Garante `recallBase` no snapshot (uma vez). Busca e grava quando o hook foi
 * positivo e o snapshot ainda nao tem o campo. Devolve o que houver.
 */
export async function garantirRecallBase(
  supabase: any,
  pedido: { id: string; placa: string; recall_sinal?: string | null; recall_marca?: string | null },
  snap: any,
): Promise<RecallBase | null> {
  if (snap?.recallBase !== undefined) return snap.recallBase ?? null
  if (!sinalPositivo(pedido.recall_sinal)) return null
  const base = await buscarRecallBase(pedido, snap?.consulta?.response)
  if (!base) return null
  try {
    // Rele antes de gravar: outro bloco (recall, multas) pode ter gravado no meio.
    const { data } = await supabase.from('pedidos_premium').select('relatorio_snapshot').eq('id', pedido.id).maybeSingle()
    const atual = data?.relatorio_snapshot || snap
    await supabase.from('pedidos_premium').update({ relatorio_snapshot: { ...atual, recallBase: base } }).eq('id', pedido.id)
  } catch (e: any) {
    console.warn('[recall-associado] gravar falhou (fail-open):', e?.message || e)
  }
  return base
}
