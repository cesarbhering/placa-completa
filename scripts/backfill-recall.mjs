// Backfill do detalhe de recall nos relatorios ja entregues.
//
// Os relatorios antigos com recall pendente foram vendidos antes de existir a
// busca do detalhe, entao o snapshot deles nao tem o bloco. Este script vai ao
// portal para cada um e atualiza SO o campo `recall` dentro do snapshot: o
// resto fica intocado, porque o snapshot e o que a pessoa comprou.
//
// Uso (na VPS, com as envs do premium carregadas):
//   node scripts/backfill-recall.mjs            -> todos os pendentes
//   node scripts/backfill-recall.mjs TOKEN ...  -> so estes tokens
//
// Roda em serie de proposito: paralelo aqui so serviria pra furar o teto de
// gasto mais rapido.

import { createClient } from '@supabase/supabase-js'

const url = process.env.NUXT_PREMIUM_SUPABASE_URL
const key = process.env.NUXT_PREMIUM_SUPABASE_KEY
if (!url || !key) {
  console.error('faltam NUXT_PREMIUM_SUPABASE_URL e NUXT_PREMIUM_SUPABASE_KEY no ambiente')
  process.exit(1)
}
if (!process.env.NUXT_BROWSER_USE_API_KEY) {
  console.error('falta NUXT_BROWSER_USE_API_KEY no ambiente')
  process.exit(1)
}

const supabase = createClient(url, key)
const { buscarRecallDetalhe, temRecallPendente } = await import('../server/utils/recall-detalhe.ts')

const tokensPedidos = process.argv.slice(2)

const { data: pedidos, error } = await supabase
  .from('pedidos_premium')
  .select('id,placa,token_entrega,consulta_id,relatorio_snapshot')
  .eq('status', 'entregue')
  .not('relatorio_snapshot', 'is', null)
if (error) { console.error('leitura falhou:', error.message); process.exit(1) }

let feitos = 0
for (const p of pedidos || []) {
  if (tokensPedidos.length && !tokensPedidos.includes(p.token_entrega)) continue
  const snap = p.relatorio_snapshot
  if (!snap || typeof snap !== 'object') continue
  if (snap.recall) continue                                   // ja tem
  if (!temRecallPendente(snap?.consulta?.response)) continue  // nao tem recall

  console.log(`placa ${p.placa} (token ${p.token_entrega}): buscando`)
  const detalhe = await buscarRecallDetalhe(supabase, { placa: p.placa, consultaId: p.consulta_id })
  if (!detalhe) { console.log('  sem resposta util, segue'); continue }

  const { error: upErr } = await supabase
    .from('pedidos_premium')
    .update({ relatorio_snapshot: { ...snap, recall: detalhe } })
    .eq('id', p.id)
  if (upErr) console.log('  update falhou:', upErr.message)
  else { feitos++; console.log(`  ok: status ${detalhe.status}, ${detalhe.campanhas.length} campanha(s)`) }
}

console.log(`pronto: ${feitos} relatorio(s) atualizado(s)`)
