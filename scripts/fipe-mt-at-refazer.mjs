#!/usr/bin/env node
// FIPE com cambio no nome (MT/AT) que saiu ambigua ou "nao localizada" antes da
// correcao de 21/out/2026 (BCK2C28: "CHEV/PRISMA 1.4MT LT" com a manual sem
// "Mec." na FIPE). Refaz SO o bloco valorCusto (FIPE, historico, custo 5 anos,
// seguro) pelo modo rebuildFipe do endpoint admin /api/premium/recall/backfill,
// que ja existe em prod (mesma montagem da entrega, sem consulta paga de
// cadastro; o juiz Haiku so e chamado se o funil continuar ambiguo).
//
// Uso (na VPS, depois do deploy):
//   SUPABASE_ACCESS_TOKEN=$(cat ~/.supabase/access-token) node scripts/fipe-mt-at-refazer.mjs <project_ref>                (dry-run: lista)
//   ... ADMIN_SECRET=... node scripts/fipe-mt-at-refazer.mjs <project_ref> --aplicar [--tokens=a,b]   (backup 0600 antes)
import { writeFileSync } from 'node:fs'

const [ref, ...args] = process.argv.slice(2)
const pat = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !pat) { console.error('uso: SUPABASE_ACCESS_TOKEN=... node scripts/fipe-mt-at-refazer.mjs <project_ref> [--aplicar] [--tokens=a,b]'); process.exit(1) }
const aplicar = args.includes('--aplicar')
const so = (args.find((a) => a.startsWith('--tokens=')) || '').slice(9).split(',').filter(Boolean)
const BASE = process.env.SITE_URL || 'https://placacompleta.com.br'
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
  const j = await r.json()
  if (!r.ok || !Array.isArray(j)) throw new Error(`sql ${r.status}: ${JSON.stringify(j).slice(0, 300)}`)
  return j
}

const linhas = await sql(`select p.id, p.placa, p.token_entrega, p.entregue_em::date dia,
    coalesce(p.relatorio_snapshot->'consulta'->'response'->0->>'descricaoMarcaModelo', p.relatorio_snapshot->'consulta'->'response'->>'descricaoMarcaModelo') descricao,
    p.relatorio_snapshot->'valorCusto'->'fipeCandidato'->>'decididoPor' decidido,
    p.relatorio_snapshot->'valorCusto'->>'fipeNaoLocalizado' nao_localizado,
    p.relatorio_snapshot->'valorCusto'->>'fipeModelo' modelo,
    p.relatorio_snapshot->'valorCusto' vc
  from pedidos_premium p
  where p.status = 'entregue' and p.entregue_em > now() - interval '60 days'
    ${so.length ? `and p.token_entrega in (${so.map(lit).join(',')})` : ''}
    and (p.relatorio_snapshot->'valorCusto'->>'fipeNaoLocalizado' = 'true' or p.relatorio_snapshot->'valorCusto'->'fipeCandidato'->>'decididoPor' = 'ambiguo')
  order by p.entregue_em`)
const RE = /\bMT\b|\bAT\b|\d\.\dMT|\d\.\dAT|\bAT\d\b|\bT[AM]T\b/i
const alvos = linhas.filter((l) => RE.test(String(l.descricao || '')))
console.log(`${linhas.length} pedido(s) ambiguos ou sem FIPE em 60 dias; ${alvos.length} com MT/AT no nome:`)
for (const l of alvos) console.log(`  ${l.dia} ${l.placa} ${l.token_entrega.slice(0, 8)}... "${l.descricao}" decidido=${l.decidido || '-'} naoLocalizado=${l.nao_localizado || '-'} modelo=${l.modelo || '-'}`)
if (!aplicar) { console.log('\n(dry-run: nada gravado)'); process.exit(0) }
if (!process.env.ADMIN_SECRET) { console.error('falta ADMIN_SECRET'); process.exit(1) }
const arq = `backup-valorcusto-mtat-${Date.now()}.json`
writeFileSync(arq, JSON.stringify(alvos.map((l) => ({ id: l.id, token: l.token_entrega, valorCusto: l.vc }))), { mode: 0o600 })
console.log('backup:', arq)
for (const l of alvos) {
  const r = await fetch(`${BASE}/api/premium/recall/backfill`, { method: 'POST', headers: { 'x-admin-secret': process.env.ADMIN_SECRET, 'Content-Type': 'application/json' }, body: JSON.stringify({ rebuildFipe: [l.token_entrega] }) })
  const j = await r.json().catch(() => ({}))
  const [depois] = await sql(`select relatorio_snapshot->'valorCusto'->'fipeCandidato'->>'decididoPor' d, relatorio_snapshot->'valorCusto'->>'fipeModelo' m, relatorio_snapshot->'valorCusto'->>'fipeNaoLocalizado' nl from pedidos_premium where id = ${lit(l.id)}`)
  console.log(`${l.placa}: antes decidido=${l.decidido || '-'} modelo=${l.modelo || '-'} | depois decidido=${depois?.d || '-'} modelo=${depois?.m || '-'} naoLocalizado=${depois?.nl || '-'} | ${JSON.stringify(j.resultados?.[0] || j).slice(0, 160)}`)
}
