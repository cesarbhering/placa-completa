// Grava o bloco do DETRAN-RJ (so restricoes) no snapshot a partir do bruto JA
// gravado em premium_custos (fonte infosimples_detran_rj_restricoes), sem nova
// consulta nem nova cobranca. Uso pontual (LMI1G50, teste pago de 21/out/2026).
//   SUPABASE_ACCESS_TOKEN=$(cat ~/.supabase/access-token) JITI_ALIAS='{"~":"'$PWD'"}' \
//     node_modules/.bin/jiti scripts/detran-rj-do-bruto.ts <project_ref> <token_entrega> [--aplicar]
import { writeFileSync } from 'node:fs'
import { blocoDetranDaUf } from '../server/utils/infosimples-detran'

const [ref, token, flag] = process.argv.slice(2)
const pat = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !token || !pat) { console.error('uso: ... <project_ref> <token_entrega> [--aplicar]'); process.exit(1) }
const lit = (s: string) => `'${String(s).replace(/'/g, "''")}'`
async function sql(query: string): Promise<any[]> {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
  const j: any = await r.json()
  if (!r.ok || !Array.isArray(j)) throw new Error(`sql ${r.status}: ${JSON.stringify(j).slice(0, 300)}`)
  return j
}
const [l] = await sql(`select p.id, p.relatorio_snapshot->'multas' as multas,
  (select json_build_object('bruto', c.bruto, 'em', c.criado_em) from premium_custos c where c.pedido_id = p.id and c.fonte = 'infosimples_detran_rj_restricoes' and c.code = 200 order by c.criado_em desc limit 1) as custo
  from pedidos_premium p where p.token_entrega = ${lit(token)}`)
if (!l?.custo?.bruto) throw new Error('sem bruto do RJ em premium_custos para este pedido')
const novo: any = { ...(blocoDetranDaUf('RJ', l.custo.bruto) as any), uf: 'RJ', consultadoEm: l.custo.em }
console.log('antes :', JSON.stringify(l.multas))
console.log('depois:', JSON.stringify(novo))
if (flag !== '--aplicar') { console.log('(dry-run)'); process.exit(0) }
const arq = `backup-multas-rj-${Date.now()}.json`
writeFileSync(arq, JSON.stringify({ id: l.id, token, multas: l.multas }), { mode: 0o600 })
const tag = `$m${Math.random().toString(36).slice(2, 8)}$`
await sql(`update pedidos_premium set relatorio_snapshot = jsonb_set(relatorio_snapshot, '{multas}', ${tag}${JSON.stringify(novo)}${tag}::jsonb) where id = ${lit(l.id)}`)
console.log('aplicado. Backup:', arq)
