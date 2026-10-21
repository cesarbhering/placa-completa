// Pedidos marcados 'indisponivel' por um 612 da Infosimples (que e "nada
// consta", regra do Cesar 21/out/2026) viram bloco 'ok' vazio, A PARTIR DO
// BRUTO ja gravado em premium_custos: sem nova consulta, sem nova cobranca.
// DF: o IPVA vem da SEFAZ, que nao foi consultada nesses pedidos; o bloco fica
// com ipva_sefaz_indisponivel (a tela diz que o valor nao veio).
//
// Uso (raiz do repo, na VPS):
//   SUPABASE_ACCESS_TOKEN=$(cat ~/.supabase/access-token) JITI_ALIAS='{"~":"'$PWD'"}' \
//     node_modules/.bin/jiti scripts/detran-612-reprocessar.ts <project_ref> [--aplicar] [--tokens=a,b]
// Sem --aplicar: so mostra antes/depois. Com --aplicar: backup 0600 do bloco multas antes.
import { writeFileSync } from 'node:fs'
import { blocoSemDados, mensagemDaFonte, DETRAN_UFS } from '../server/utils/infosimples-detran'

const [ref, ...args] = process.argv.slice(2)
const pat = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !pat) { console.error('uso: ... jiti scripts/detran-612-reprocessar.ts <project_ref> [--aplicar] [--tokens=a,b]'); process.exit(1) }
const aplicar = args.includes('--aplicar')
const tokens = (args.find((a) => a.startsWith('--tokens=')) || '').slice(9).split(',').filter(Boolean)
const lit = (s: string) => `'${String(s).replace(/'/g, "''")}'`
async function sql(query: string): Promise<any[]> {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
  const j: any = await r.json()
  if (!r.ok || !Array.isArray(j)) throw new Error(`sql ${r.status}: ${JSON.stringify(j).slice(0, 300)}`)
  return j
}

async function main() {
  const filtroTok = tokens.length ? `and p.token_entrega in (${tokens.map(lit).join(',')})` : `and p.entregue_em > now() - interval '60 days'`
  const linhas = await sql(`select p.id, p.placa, p.token_entrega, p.relatorio_snapshot->'multas' as multas,
      (select json_build_object('fonte', c.fonte, 'code', c.code, 'bruto', c.bruto, 'criado_em', c.criado_em) from premium_custos c
        where c.pedido_id = p.id and c.fonte like 'infosimples_detran_%' order by c.criado_em desc limit 1) as ultima
    from pedidos_premium p
    where p.status = 'entregue' and p.relatorio_snapshot->'multas'->>'status' = 'indisponivel' ${filtroTok}`)
  const alvos = linhas.filter((l) => l.ultima?.code === 612)
  console.log(`${alvos.length} pedido(s) com 612 marcado como indisponivel`)
  const backup: any[] = []
  for (const l of alvos) {
    const uf = String(l.multas?.uf || '').toUpperCase() as keyof typeof DETRAN_UFS
    const cfg: any = DETRAN_UFS[uf]
    if (!cfg) { console.log(`${l.placa}: UF ${uf} sem config, pulado`); continue }
    const msg = mensagemDaFonte({ codeMessage: l.ultima.bruto?.code_message || '', erros: l.ultima.bruto?.errors || [] })
    const novo: any = { ...blocoSemDados(cfg.fonte, msg), consultadoEm: l.ultima.criado_em }
    if (cfg.ipvaSefaz?.sempre) novo.ipva_sefaz_indisponivel = true
    console.log(`\n${l.placa} (${l.token_entrega.slice(0, 6)}...)\n  antes : ${JSON.stringify(l.multas)}\n  depois: ${JSON.stringify(novo)}`)
    backup.push({ id: l.id, token: l.token_entrega, multas: l.multas })
    if (aplicar) {
      const tag = `$m${Math.random().toString(36).slice(2, 8)}$`
      await sql(`update pedidos_premium set relatorio_snapshot = jsonb_set(relatorio_snapshot, '{multas}', ${tag}${JSON.stringify(novo)}${tag}::jsonb) where id = ${lit(l.id)} and relatorio_snapshot->'multas'->>'status' = 'indisponivel'`)
    }
  }
  if (aplicar && backup.length) {
    const arq = `backup-multas-612-${Date.now()}.json`
    writeFileSync(arq, JSON.stringify(backup), { mode: 0o600 })
    console.log(`\naplicado. Backup: ${arq}`)
  } else if (!aplicar) console.log('\n(dry-run: nada gravado; rode com --aplicar depois do deploy)')
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
