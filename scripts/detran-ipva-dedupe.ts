// Tira IPVA repetido do bloco do DETRAN ja gravado no snapshot, sem nova
// consulta, sem nova cobranca e sem e-mail. Mesma regra do parser
// (normalizarIpvaItens, server/utils/infosimples-detran.ts): so quando a soma
// da lista passa do total da fonte (ipva_total_centavos) e os repetidos sao
// identicos em exercicio + vencimento + valor (FGP0J33 e FPL1A52). Mexe SO em
// multas.ipva_itens; o total da fonte fica. FPL1A52 nao tem bruto em
// premium_custos, por isso a correcao parte do snapshot (itens ja parseados).
//   SUPABASE_ACCESS_TOKEN=$(cat ~/.supabase/access-token) JITI_ALIAS='{"~":"'$PWD'"}' \
//     node_modules/.bin/jiti scripts/detran-ipva-dedupe.ts <project_ref> FGP0J33,FPL1A52 [--aplicar]
// Desfazer (volta ipva_itens/ipva_total_centavos do backup, so das placas listadas):
//     ... scripts/detran-ipva-dedupe.ts <project_ref> ORB7328 --restaurar=backup-ipva-dedupe-<ts>.json [--aplicar]
import { writeFileSync } from 'node:fs'
import { normalizarIpvaItens } from '../server/utils/infosimples-detran'

const [ref, placasArg, ...resto] = process.argv.slice(2)
const flag = resto.includes('--aplicar') ? '--aplicar' : undefined
const restaurar = (resto.find((a) => a.startsWith('--restaurar=')) || '').slice(12)
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

if (restaurar) {
  const { readFileSync } = await import('node:fs')
  const bkp: any[] = JSON.parse(readFileSync(restaurar, 'utf8')).filter((b: any) => placas.includes(String(b.placa)))
  const atuais = await sql(`select id, placa, relatorio_snapshot->'multas'->'ipva_itens' itens, relatorio_snapshot->'multas'->'ipva_total_centavos' total from pedidos_premium where id in (${bkp.map((b) => lit(b.id)).join(',') || "''"})`)
  for (const b of bkp) {
    const a = atuais.find((x) => x.id === b.id)
    console.log(`${b.placa}: agora ${a?.itens?.length ?? '?'} itens / ${a?.total ?? '?'} -> volta ${b.ipva_itens.length} itens / ${b.ipva_total_centavos}`)
  }
  if (flag !== '--aplicar') { console.log('\n(dry-run: nada gravado)'); process.exit(0) }
  const arq = `backup-ipva-antes-de-restaurar-${Date.now()}.json`
  writeFileSync(arq, JSON.stringify(atuais), { mode: 0o600 })
  for (const b of bkp) {
    const tag = `$m${Math.random().toString(36).slice(2, 8)}$`
    await sql(`update pedidos_premium set relatorio_snapshot = jsonb_set(jsonb_set(relatorio_snapshot, '{multas,ipva_itens}', ${tag}${JSON.stringify(b.ipva_itens)}${tag}::jsonb), '{multas,ipva_total_centavos}', '${Number(b.ipva_total_centavos)}'::jsonb) where id = ${lit(b.id)}`)
    console.log(`${b.placa}: restaurado`)
  }
  console.log('backup do estado anterior:', arq)
  process.exit(0)
}

const linhas = await sql(`select id, placa, token_entrega, relatorio_snapshot->'multas'->'ipva_itens' itens,
    relatorio_snapshot->'multas'->'ipva_total_centavos' total, relatorio_snapshot->'multas'->>'fonte' fonte
  from pedidos_premium where status = 'entregue' and placa in (${placas.map(lit).join(',')})
    and jsonb_typeof(relatorio_snapshot->'multas'->'ipva_itens') = 'array'`)
const mudar: { l: any; itens: any[]; total: number }[] = []
for (const l of linhas) {
  const antes: any[] = l.itens || []
  const totalAntes = Number(l.total) || 0
  const depois = ordenar(normalizarIpvaItens(antes, totalAntes))
  const total = totalAntes
  const igual = depois.length === antes.length
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
