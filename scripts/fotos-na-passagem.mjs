#!/usr/bin/env node
// Acrescenta foto_refs (fotos do lote no R2) numa passagem JA EXISTENTE do
// snapshot de um relatorio, sem reconsultar o bloco de leilao. Feito pro caso
// em que o Cesar decide mostrar as fotos de um lote que a API de hoje nao
// devolve mais pra aquele perfil (16/out/2026).
//
// Uso (na VPS, raiz do repo; token do cliente SO por argumento, nunca no repo):
//   SUPABASE_ACCESS_TOKEN=$(cat ~/.supabase/access-token) node scripts/fotos-na-passagem.mjs \
//     <project_ref> <token_entrega> <fonte> <lote> <refs.json> [--aplicar]
//   ... --restaurar <backup.json>      (devolve o snapshot inteiro do backup)
//
// refs.json: [{"ordem":1,"vista":"frente","foto_ref":"..."}, ...] (ate 4).
// Sem --aplicar: so mostra o que mudaria. Com --aplicar: grava backup do
// snapshot INTEIRO em ./backup-snapshot-<inicio do token>-<ts>.json (0600)
// ANTES, e muda so o campo foto_refs da passagem (jsonb_set), nada mais.

import { readFileSync, writeFileSync } from 'node:fs'

const [ref, token, ...resto] = process.argv.slice(2)
const pat = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !token || !pat) {
  console.error('uso: SUPABASE_ACCESS_TOKEN=... node scripts/fotos-na-passagem.mjs <project_ref> <token_entrega> <fonte> <lote> <refs.json> [--aplicar] | --restaurar <backup.json>')
  process.exit(1)
}
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
  })
  const j = await r.json()
  if (!r.ok || !Array.isArray(j)) throw new Error(`sql ${r.status}: ${JSON.stringify(j).slice(0, 300)}`)
  return j
}
const dollar = (txt) => {
  const tag = `$fp${Math.random().toString(36).slice(2, 8)}$`
  if (txt.includes(tag)) throw new Error('tag colidiu, rode de novo')
  return `${tag}${txt}${tag}`
}

async function main() {
  if (resto[0] === '--restaurar') {
    const bk = JSON.parse(readFileSync(resto[1], 'utf8'))
    if (bk.token_entrega !== token) throw new Error('backup de outro relatorio')
    await sql(`update pedidos_premium set relatorio_snapshot = ${dollar(JSON.stringify(bk.relatorio_snapshot))}::jsonb where token_entrega = ${lit(token)}`)
    console.log('restaurado a partir de', resto[1])
    return
  }
  const [fonte, lote, arqRefs] = resto
  const aplicar = resto.includes('--aplicar')
  if (!fonte || !lote || !arqRefs) throw new Error('faltam <fonte> <lote> <refs.json>')

  const VISTAS = new Set(['frente', 'traseira', 'lateral', 'painel'])
  const refs = JSON.parse(readFileSync(arqRefs, 'utf8'))
    .filter((f) => f && typeof f.foto_ref === 'string' && /^[A-Za-z0-9._~-]{8,512}$/.test(f.foto_ref))
    .map((f) => ({ ref: f.foto_ref, ordem: Number(f.ordem) || 0, vista: VISTAS.has(String(f.vista || '').toLowerCase()) ? String(f.vista).toLowerCase() : null }))
    .sort((a, b) => a.ordem - b.ordem)
    .slice(0, 4)
  if (!refs.length) throw new Error('nenhum foto_ref valido no arquivo')

  const [row] = await sql(`select token_entrega, relatorio_snapshot from pedidos_premium where token_entrega = ${lit(token)}`)
  if (!row?.relatorio_snapshot) throw new Error('pedido sem snapshot')
  const passagens = row.relatorio_snapshot?.historicoLeilao?.passagens
  if (!Array.isArray(passagens)) throw new Error('snapshot sem historicoLeilao.passagens')
  const i = passagens.findIndex((p) => String(p?.fonte) === fonte && String(p?.lote) === String(lote))
  if (i < 0) throw new Error(`passagem ${fonte} lote ${lote} nao esta no snapshot`)
  const p = passagens[i]
  console.log(`passagem [${i}]: ${p.fonte} lote ${p.lote}, nivel ${p.nivel}, data ${p.data_leilao}`)
  console.log('foto_refs atuais:', JSON.stringify(p.foto_refs ?? null))
  console.log('foto_refs novos :', JSON.stringify(refs.map((r) => ({ ordem: r.ordem, vista: r.vista, ref: `${r.ref.slice(0, 10)}...` }))))
  if (!aplicar) { console.log('\n(dry-run: nada gravado; rode de novo com --aplicar)'); return }

  const arq = `backup-snapshot-${token.slice(0, 6)}-${Date.now()}.json`
  writeFileSync(arq, JSON.stringify({ token_entrega: token, em: new Date().toISOString(), relatorio_snapshot: row.relatorio_snapshot }), { mode: 0o600 })
  console.log('backup:', arq)
  await sql(`update pedidos_premium set relatorio_snapshot = jsonb_set(relatorio_snapshot, ${lit(`{historicoLeilao,passagens,${i},foto_refs}`)}, ${dollar(JSON.stringify(refs))}::jsonb) where token_entrega = ${lit(token)}`)
  const [conf] = await sql(`select relatorio_snapshot->'historicoLeilao'->'passagens'->${i}->'foto_refs' as f from pedidos_premium where token_entrega = ${lit(token)}`)
  console.log('gravado:', (conf?.f || []).length, 'fotos. Para desfazer: --restaurar', arq)
}

main().catch((e) => { console.error(e.message || e); process.exit(1) })
