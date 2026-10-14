// Limpeza UNICA dos snapshots antigos (LGPD, 14/out): tira numero de processo
// judicial e comitente pessoa fisica de relatorio_snapshot.historicoLeilao,
// com o mesmo filtro do site (shared/leilao-lgpd.ts).
//
// Uso (na raiz do repo, com node_modules):
//   SUPABASE_ACCESS_TOKEN=$(cat ~/.supabase/access-token) \
//   node_modules/.bin/jiti scripts/lgpd-limpar-snapshots-leilao.ts <project_ref> [--aplicar]
//
// Sem --aplicar: so conta (antes) e mostra o que mudaria. Com --aplicar: grava
// backup JSONL (id + historicoLeilao original) em ./lgpd-backup-<ref>-<ts>.jsonl
// ANTES de atualizar, atualiza linha a linha e conta de novo (depois).

import { writeFileSync, appendFileSync } from 'node:fs'
import { historicoLgpd } from '../shared/leilao-lgpd'

const ref = process.argv[2]
const aplicar = process.argv.includes('--aplicar')
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !token) { console.error('uso: SUPABASE_ACCESS_TOKEN=... jiti scripts/lgpd-limpar-snapshots-leilao.ts <project_ref> [--aplicar]'); process.exit(1) }

async function sql(query: string): Promise<any[]> {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
  })
  const j: any = await r.json()
  if (!r.ok || !Array.isArray(j)) throw new Error(`sql ${r.status}: ${JSON.stringify(j).slice(0, 300)}`)
  return j
}

// Contagem em SQL (independe do filtro em TS): CNJ/processo no texto e comitente preenchido.
const CONTAGEM = `
select count(*) filter (where relatorio_snapshot->'historicoLeilao' is not null and relatorio_snapshot->'historicoLeilao' <> 'null'::jsonb) as com_historico,
  count(*) filter (where (relatorio_snapshot->'historicoLeilao')::text ~ '\\d{7}-?\\d{2}\\.?\\d{4}\\.?\\d\\.?\\d{2}\\.?\\d{4}') as com_cnj,
  count(*) filter (where (relatorio_snapshot->'historicoLeilao')::text ~* 'processo_judicial|"processo') as com_campo_processo,
  count(*) filter (where exists (select 1 from jsonb_array_elements(case when jsonb_typeof(relatorio_snapshot->'historicoLeilao'->'passagens') = 'array' then relatorio_snapshot->'historicoLeilao'->'passagens' else '[]'::jsonb end) p where coalesce(p->>'comitente', '') <> '')) as com_comitente
from pedidos_premium`

async function main() {
  console.log('ANTES', (await sql(CONTAGEM))[0])
  const ids = (await sql(`select id from pedidos_premium where jsonb_typeof(relatorio_snapshot->'historicoLeilao'->'passagens') = 'array' and jsonb_array_length(relatorio_snapshot->'historicoLeilao'->'passagens') > 0 order by id`)).map((x) => x.id)
  console.log('pedidos com passagens:', ids.length)
  const backup = `lgpd-backup-${ref}-${Date.now()}.jsonl`
  if (aplicar) writeFileSync(backup, '')
  let mudariam = 0, comitentesCortados = 0, refsCortadas = 0
  for (const id of ids) {
    const [row] = await sql(`select relatorio_snapshot->'historicoLeilao' as h from pedidos_premium where id = '${String(id).replace(/'/g, "''")}'`)
    const antes = row?.h
    const depois = historicoLgpd(antes)
    if (JSON.stringify(antes) === JSON.stringify(depois)) continue
    mudariam++
    antes.passagens.forEach((p: any, i: number) => {
      if (p?.comitente && !depois.passagens[i].comitente) comitentesCortados++
      if (p?.ref && !depois.passagens[i].ref) refsCortadas++
    })
    if (!aplicar) continue
    appendFileSync(backup, JSON.stringify({ id, historicoLeilao: antes }) + '\n')
    const tag = `$lgpd${Math.random().toString(36).slice(2, 8)}$`
    const lit = JSON.stringify(depois)
    if (lit.includes(tag)) throw new Error('tag de dollar-quote colidiu, rode de novo')
    await sql(`update pedidos_premium set relatorio_snapshot = jsonb_set(relatorio_snapshot, '{historicoLeilao}', ${tag}${lit}${tag}::jsonb) where id = '${String(id).replace(/'/g, "''")}'`)
  }
  console.log({ mudariam, comitentesCortados, refsCortadas, aplicado: aplicar, backup: aplicar ? backup : null })
  if (aplicar) console.log('DEPOIS', (await sql(CONTAGEM))[0])
}

main().catch((e) => { console.error(e); process.exit(1) })
