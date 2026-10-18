#!/usr/bin/env node
// Corrige os pedidos do app (Google Play) gravados antes de 18/out/2026:
//   - forma_pagamento 'pix' (default da coluna) -> 'google_play';
//   - compra de TESTE da Play (purchaseType 0, ex.: QNA9303 de 22/09 e 13/10) -> ambiente 'teste' (fora das vendas);
//   - valor_centavos -> o que a Play cobrou de verdade (orders.get), so nas compras reais;
//   - google_play_compras ganha a linha do comprovante de cada pedido (se ainda nao tiver).
// Pergunta a Google (purchases.products.get e orders.get, so leitura) por cada token.
//
// Uso (na VPS, raiz do repo):
//   SUPABASE_ACCESS_TOKEN=$(cat ~/.supabase/access-token) GOOGLE_PLAY_SA_B64=<base64 do JSON da conta de servico> \
//     node scripts/corrigir-pedidos-app.mjs <project_ref>              (dry-run: so mostra)
//   ... node scripts/corrigir-pedidos-app.mjs <project_ref> --aplicar   (grava backup 0600 antes)
//   ... node scripts/corrigir-pedidos-app.mjs <project_ref> --restaurar <backup.json>
// Nunca imprime purchase_token nem e-mail.

import crypto from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const [ref, ...resto] = process.argv.slice(2)
const pat = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !pat) {
  console.error('uso: SUPABASE_ACCESS_TOKEN=... GOOGLE_PLAY_SA_B64=... node scripts/corrigir-pedidos-app.mjs <project_ref> [--aplicar | --restaurar <backup.json>]')
  process.exit(1)
}
const lit = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`)

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
  })
  const j = await r.json()
  if (!r.ok || !Array.isArray(j)) throw new Error(`sql ${r.status}: ${JSON.stringify(j).slice(0, 300)}`)
  return j
}

const PKG = 'br.com.placacompleta'
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`

async function tokenGoogle() {
  const b64 = process.env.GOOGLE_PLAY_SA_B64
  if (!b64) throw new Error('falta GOOGLE_PLAY_SA_B64')
  const sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
  const agora = Math.floor(Date.now() / 1000)
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const h = enc({ alg: 'RS256', typ: 'JWT' })
  const c = enc({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600 })
  const s = crypto.createSign('RSA-SHA256').update(`${h}.${c}`).sign(sa.private_key).toString('base64url')
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${c}.${s}` }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error('falha ao autenticar na Google')
  return j.access_token
}

const centavos = (m) => (m && m.currencyCode === 'BRL' && (m.units !== undefined || m.nanos !== undefined)
  ? Math.round(Number(m.units || 0) * 100 + Number(m.nanos || 0) / 1e7) : null)

async function main() {
  if (resto[0] === '--restaurar') {
    const bk = JSON.parse(readFileSync(resto[1], 'utf8'))
    for (const p of bk.pedidos) {
      await sql(`update pedidos_premium set forma_pagamento = ${lit(p.forma_pagamento)}, ambiente = ${lit(p.ambiente)}, valor_centavos = ${Number(p.valor_centavos)} where id = ${lit(p.id)}`)
    }
    if (bk.compras_criadas?.length) await sql(`delete from google_play_compras where id in (${bk.compras_criadas.map(lit).join(',')})`)
    console.log(`restaurados ${bk.pedidos.length} pedidos e removidas ${bk.compras_criadas?.length || 0} linhas de google_play_compras (${resto[1]})`)
    return
  }
  const aplicar = resto.includes('--aplicar')
  const pedidos = await sql(`select id, placa, criado_em, status, ambiente, valor_centavos, forma_pagamento, email, google_play_order_id, google_play_product_id, google_play_purchase_token
    from pedidos_premium where pix_provider = 'google_play' and google_play_purchase_token is not null order by criado_em`)
  let jaTem = new Set()
  try {
    jaTem = new Set((await sql(`select purchase_token from google_play_compras`)).map((r) => r.purchase_token))
  } catch {
    if (aplicar) throw new Error('google_play_compras nao existe: aplique a migration 20261018230000 antes')
    console.log('(google_play_compras ainda nao existe: a migration nao foi aplicada; o dry-run segue)')
  }
  const at = await tokenGoogle()
  const planos = []
  for (const p of pedidos) {
    const prod = p.google_play_product_id || 'consulta_completa'
    const g = await (await fetch(`${API}/purchases/products/${encodeURIComponent(prod)}/tokens/${encodeURIComponent(p.google_play_purchase_token)}`, { headers: { authorization: `Bearer ${at}` } })).json()
    const o = p.google_play_order_id
      ? await (await fetch(`${API}/orders/${encodeURIComponent(p.google_play_order_id)}`, { headers: { authorization: `Bearer ${at}` } })).json()
      : null
    if (typeof g?.purchaseState !== 'number') throw new Error(`Google nao respondeu a compra do pedido ${p.id}: ${JSON.stringify(g).slice(0, 200)}`)
    const teste = g.purchaseType === 0
    const valorPlay = centavos(o?.total)
    const novo = {
      forma_pagamento: 'google_play',
      ambiente: teste ? 'teste' : p.ambiente,
      valor_centavos: !teste && valorPlay ? valorPlay : Number(p.valor_centavos),
    }
    planos.push({ p, g, o, teste, novo, liquido: centavos(o?.developerRevenueInBuyerCurrency), criarCompra: !jaTem.has(p.google_play_purchase_token) })
    console.log(`${p.criado_em.slice(0, 16)} ${p.placa} ${p.google_play_order_id} | ${teste ? 'TESTE' : 'real '} | forma ${p.forma_pagamento} -> ${novo.forma_pagamento} | ambiente ${p.ambiente} -> ${novo.ambiente} | valor ${p.valor_centavos} -> ${novo.valor_centavos} | comprovante ${jaTem.has(p.google_play_purchase_token) ? 'ja existe' : 'criar'}`)
  }
  if (!aplicar) { console.log(`\n(dry-run: ${planos.length} pedidos, nada gravado; rode de novo com --aplicar)`); return }

  const arq = `backup-pedidos-app-${ref}-${Date.now()}.json`
  const bk = { em: new Date().toISOString(), pedidos: planos.map(({ p }) => ({ id: p.id, forma_pagamento: p.forma_pagamento, ambiente: p.ambiente, valor_centavos: p.valor_centavos })), compras_criadas: [] }
  writeFileSync(arq, JSON.stringify(bk), { mode: 0o600 })
  for (const { p, g, teste, novo, liquido, criarCompra } of planos) {
    await sql(`update pedidos_premium set forma_pagamento = ${lit(novo.forma_pagamento)}, ambiente = ${lit(novo.ambiente)}, valor_centavos = ${Number(novo.valor_centavos)} where id = ${lit(p.id)}`)
    if (criarCompra) {
      const [c] = await sql(`insert into google_play_compras (purchase_token, order_id, product_id, placa, email, estado_google, teste, valor_centavos, liquido_centavos, origem, pedido_id, recebido_em, atualizado_em)
        values (${lit(p.google_play_purchase_token)}, ${lit(p.google_play_order_id)}, ${lit(p.google_play_product_id || 'consulta_completa')}, ${lit(p.placa)}, ${lit(p.email)},
          ${lit(g.purchaseState === 0 ? 'pago' : g.purchaseState === 2 ? 'pendente' : 'cancelada')}, ${teste}, ${Number(novo.valor_centavos)}, ${liquido ?? 'null'}, 'correcao', ${lit(p.id)}, ${lit(p.criado_em)}, now())
        on conflict (purchase_token) do nothing returning id`)
      if (c?.id) bk.compras_criadas.push(c.id)
      writeFileSync(arq, JSON.stringify(bk), { mode: 0o600 })
    }
  }
  console.log(`aplicado em ${planos.length} pedidos. Backup: ${arq} (desfazer: --restaurar ${arq})`)
}

main().catch((e) => { console.error(e.message || e); process.exit(1) })
