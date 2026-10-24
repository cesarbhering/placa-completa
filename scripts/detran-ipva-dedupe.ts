// Tira IPVA repetido do bloco do DETRAN ja gravado no snapshot, sem nova
// consulta, sem nova cobranca e sem e-mail. Mesma regra do parser
// (normalizarIpvaItens, server/utils/infosimples-detran.ts): mesmo exercicio +
// vencimento + valor (SP, FGP0J33/FPL1A52) e cota unica + parcelas do mesmo ano
// (DF, ORB7328). Mexe SO em multas.ipva_itens e multas.ipva_total_centavos.
// Total: quando o gravado era a soma da lista (DF), vira a soma nova; quando
// veio da fonte (SP, ipva/normalizado_ipva), fica como esta.
// FPL1A52 nao tem bruto em premium_custos, por isso a correcao parte do
// snapshot (que tem os itens ja parseados), igual pra todos.
//   SUPABASE_ACCESS_TOKEN=$(cat ~/.supabase/access-token) JITI_ALIAS='{"~":"'$PWD'"}' \
//     node_modules/.bin/jiti scripts/detran-ipva-dedupe.ts <project_ref> ORB7328,FGP0J33,FPL1A52 [--aplicar]
import { writeFileSync } from 'node:fs'
import { normalizarIpvaItens } from '../server/utils/infosimples-detran'

const [ref, placasArg, flag] = process.argv.slice(2)
const pat = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !placasArg || !pat) { console.error('uso: ... <project_ref> PLACA1,PLACA2 [--aplicar]'); process.exit(1) }
const placas = placasArg.split(',').map((p) => p.trim().toUpperCase()).filter((p) => /^[A-Z0-9]{7}$/.test(p))
const lit = (s: string) => `'${String(s).replace(/'/g, "''")}'`
async function sql(query: string): Promise<any[]> {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
  const j: any = await r.json()
  if (!r.ok || !Array.isArray(j)) throw new Error(`sql ${r.status}: ${JSON.stringify(j).slice(0, 300)}`)
  return j
}
const ordenar = (l: any[]) => [...l].sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0))
const soma = (l: any[]) => l.reduce((a, x) => a + (Number(x?.valor_centavos) || 0), 0)

const linhas = await sql(`select id, placa, token_entrega, relatorio_snapshot->'multas'->'ipva_itens' itens,
    relatorio_snapshot->'multas'->'ipva_total_centavos' total, relatorio_snapshot->'multas'->>'fonte' fonte
  from pedidos_premium where status = 'entregue' and placa in (${placas.map(lit).join(',')})
    and jsonb_typeof(relatorio_snapshot->'multas'->'ipva_itens') = 'array'`)
const mudar: { l: any; itens: any[]; total: number }[] = []
for (const l of linhas) {
  const antes: any[] = l.itens || []
  const depois = ordenar(normalizarIpvaItens(antes))
  const totalAntes = Number(l.total) || 0
  const total = totalAntes === soma(antes) ? soma(depois) : totalAntes
  const igual = depois.length === antes.length && total === totalAntes
  console.log(`${l.placa} (${l.fonte}): itens ${antes.length} -> ${depois.length}, total ${totalAntes} -> ${total}${igual ? ' (nada a mudar)' : ''}`)
  if (!igual) mudar.push({ l, itens: depois, total })
}
for (const p of placas) if (!linhas.some((l) => l.placa === p)) console.log(`  aviso: ${p} sem pedido entregue com ipva_itens`)
if (flag !== '--aplicar') { console.log('\n(dry-run: nada gravado)'); process.exit(0) }
if (!mudar.length) { console.log('nada a aplicar'); process.exit(0) }
const arq = `backup-ipva-dedupe-${Date.now()}.json`
writeFileSync(arq, JSON.stringify(mudar.map(({ l }) => ({ id: l.id, token: l.token_entrega, placa: l.placa, ipva_itens: l.itens, ipva_total_centavos: l.total }))), { mode: 0o600 })
console.log('backup:', arq)
for (const { l, itens, total } of mudar) {
  const tag = `$m${Math.random().toString(36).slice(2, 8)}$`
  await sql(`update pedidos_premium set relatorio_snapshot = jsonb_set(jsonb_set(relatorio_snapshot, '{multas,ipva_itens}', ${tag}${JSON.stringify(itens)}${tag}::jsonb), '{multas,ipva_total_centavos}', '${total}'::jsonb) where id = ${lit(l.id)}`)
  console.log(`${l.placa}: aplicado`)
}
