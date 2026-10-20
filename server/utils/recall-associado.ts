import { consultarRecallToyota } from './recall-toyota'
import { normalizarMarcaRecall } from '../../shared/marcas-recall'
import { sinalPositivo, type RecallBase } from '../../shared/recall-associado'
import { agruparCampanhasRecall } from './recall-agrupar'

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
  const perfil = {
    placa: pedido.placa,
    chassi: chassi.length === 17 ? chassi : null,
    marca,
    modelo,
    ano_fab: r?.anoFabricacao ?? null,
    ano_mod: r?.anoModelo ?? null,
  }
  let resp = await consultarRecallToyota(perfil, { timeoutMs: TIMEOUT_MS }).catch(() => null)
  // Com chassi cheio a base so casa por VIN (firme) e NAO cai pra modelo/ano.
  // Se a gratis mostrou o hook por modelo/ano (suave, sem chassi no cache) o
  // pago voltava vazio e o relatorio dizia "detalhes nao vieram" (SHW1H43,
  // 15/out). Vazio com chassi -> repete sem chassi, igual a consulta gratis.
  if (resp && resp.matches.length === 0 && perfil.chassi) {
    resp = await consultarRecallToyota({ ...perfil, chassi: null }, { timeoutMs: TIMEOUT_MS }).catch(() => null)
  }
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
      ...(m.risco ? { risco: m.risco } : {}),
      ...(m.o_que_fazer ? { oQueFazer: m.o_que_fazer } : {}),
      ...(m.fabricacao_de ? { fabricacaoDe: m.fabricacao_de } : {}),
      ...(m.fabricacao_ate ? { fabricacaoAte: m.fabricacao_ate } : {}),
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
  op: { chaveApi?: string | null; fetcher?: typeof fetch } = {},
): Promise<RecallBase | null> {
  if (snap?.recallBase !== undefined) return snap.recallBase ?? null
  if (!sinalPositivo(pedido.recall_sinal)) return null
  const base = await buscarRecallBase(pedido, snap?.consulta?.response)
  if (!base) return null
  // Mais de uma campanha: o agente agrupa as parecidas (uma vez, gravado junto).
  // Falha = sem `agrupado` e a tela mostra a lista original.
  if (base.campanhas.length > 1) {
    base.agrupado = await agruparCampanhasRecall(base.campanhas, { sb: supabase, chaveApi: op.chaveApi, fetcher: op.fetcher, pedidoId: pedido.id })
  }
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
