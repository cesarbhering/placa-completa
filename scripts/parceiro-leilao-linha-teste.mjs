#!/usr/bin/env node
// Grava em parceiro_leilao_chamadas a linha do TESTE pago de 20/out/2026 (MSH9001),
// feito a mao antes da integracao. O JSON da resposta fica fora do repo (tem chassi real);
// o caminho vem por argumento.
//
// Uso (na VPS, depois da migration 20261020200000):
//   SUPABASE_ACCESS_TOKEN=$(cat ~/.supabase/access-token) node scripts/parceiro-leilao-linha-teste.mjs <project_ref> <resposta.json> [--aplicar]
// Sem --aplicar: so mostra a linha. Idempotente (nao duplica o idConsulta).
import { readFileSync } from 'node:fs'

const [ref, arq, flag] = process.argv.slice(2)
const pat = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !arq || !pat) { console.error('uso: SUPABASE_ACCESS_TOKEN=... node scripts/parceiro-leilao-linha-teste.mjs <project_ref> <resposta.json> [--aplicar]'); process.exit(1) }
const bruto = JSON.parse(readFileSync(arq, 'utf8'))
const cab = bruto.consulta || bruto.resposta || {}
const res = bruto.resultados || bruto.retorno?.resultados || bruto.retorno || {}
const leiloes = Array.isArray(res.leilao?.leiloes) ? res.leilao.leiloes : []
const linha = {
  pedido_id: null, placa: String(cab.parametro || 'MSH9001'), parametro_enviado: String(cab.parametro || 'MSH9001'), tipo_parametro: 'placa',
  id_consulta_parceiro: cab.idConsulta, data_consulta_parceiro: cab.dataConsulta, tempo_parceiro_ms: cab.tempoTotalMs ?? null, tempo_total_ms: cab.tempoTotalMs ?? null,
  http_status: 200, cobrada: true, preco_centavos: 600, motivo_erro: null,
  tem_registro_leilao: res.leilao?.temRegistro === true || leiloes.length > 0, n_leiloes: leiloes.length,
  indicio_sinistro: Number(res.sinistro?.indicioDeSinistro) === 1, mensagem_sinistro: res.sinistro?.mensagemSinistro ?? res.sinistro?.mensagem ?? null,
  nossa_base_vazia: true, cache_hit: false,
}
console.log({ ...linha, n_leiloes: linha.n_leiloes })
if (flag !== '--aplicar') { console.log('\n(dry-run: nada gravado; rode com --aplicar)'); process.exit(0) }
const tag = `$b${Math.random().toString(36).slice(2, 8)}$`
const lit = (v) => (v == null ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)
const cols = Object.keys(linha)
const q = `insert into public.parceiro_leilao_chamadas (${cols.join(',')}, resposta_bruta, criado_em)
  select ${cols.map((c) => lit(linha[c])).join(',')}, ${tag}${JSON.stringify(bruto)}${tag}::jsonb, '2026-10-20T19:00:58Z'
  where not exists (select 1 from public.parceiro_leilao_chamadas where id_consulta_parceiro = ${lit(linha.id_consulta_parceiro)})
  returning id`
const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) })
console.log(r.status, await r.text())
