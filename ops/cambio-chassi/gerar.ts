// Regenera shared/cambio-chassi.json (camada 2 do cambio) a partir de:
//   1. lotes de leilao com cambio no texto do modelo (extrair.sh, de madrugada);
//   2. escolhas dos clientes na tela (valorCusto.fipeEscolhaCliente, prod).
// Regra: prefixo pos 1-8 unanime, minimo 5 chassis, 0 conflito. Mede a
// validacao cruzada (5-fold) e grava as metricas no JSON. Nao publica nada:
// quem abre o PR e o rodar.sh.
// Uso: npx jiti ops/cambio-chassi/gerar.ts <lotes.csv> <escolhas.json> <saida.json>
import { readFileSync, writeFileSync } from 'node:fs'
import { cambioDoNome, type Cambio } from '../../shared/cambio-nome'

const [csv, escolhasArq, saida] = process.argv.slice(2)
const MINIMO = 5

const dados = new Map<string, Cambio>()
const conflitoChassi = new Set<string>()
function add(chassi: string, c: Cambio | null) {
  const ch = String(chassi || '').toUpperCase()
  if (ch.length !== 17 || !c) return
  const ja = dados.get(ch)
  if (ja && ja !== c) conflitoChassi.add(ch)
  dados.set(ch, c)
}
for (const l of readFileSync(csv, 'utf8').split('\n')) {
  const c = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((x) => x.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')) || []
  const [, , chassi, marca, modelo] = c
  if (chassi) add(chassi, cambioDoNome(`${marca}/${modelo}`))
}
let escolhas = 0
for (const e of JSON.parse(readFileSync(escolhasArq, 'utf8')) as { chassi: string; cambio: Cambio }[]) {
  if (e?.cambio === 'manual' || e?.cambio === 'automatico') { add(e.chassi, e.cambio); escolhas++ }
}
for (const ch of conflitoChassi) dados.delete(ch)

function treinar(lista: [string, Cambio][]) {
  const g = new Map<string, { m: number; a: number }>()
  for (const [ch, c] of lista) { const k = ch.slice(0, 8); const v = g.get(k) || { m: 0, a: 0 }; c === 'manual' ? v.m++ : v.a++; g.set(k, v) }
  const r: Record<string, Cambio> = {}
  for (const [k, v] of [...g.entries()].sort()) if (v.m + v.a >= MINIMO && (v.m === 0 || v.a === 0)) r[k] = v.m ? 'manual' : 'automatico'
  return r
}
const todos = [...dados.entries()].sort((x, y) => (x[0].split('').reverse().join('') < y[0].split('').reverse().join('') ? -1 : 1))
let prev = 0, ok = 0
for (let f = 0; f < 5; f++) {
  const r = treinar(todos.filter((_, i) => i % 5 !== f))
  for (const [ch, c] of todos.filter((_, i) => i % 5 === f)) { const p = r[ch.slice(0, 8)]; if (p) { prev++; if (p === c) ok++ } }
}
const regras = treinar(todos)
const anterior = (() => { try { return JSON.parse(readFileSync(saida, 'utf8')) } catch { return { versao: 0 } } })()
const acerto = prev ? ok / prev : 0
const out = {
  versao: (anterior.versao || 0) + 1,
  geradoEm: new Date().toISOString().slice(0, 10),
  chave: 'pos1-8', minimo: MINIMO, conflitos: 0,
  fonte: `base de leiloes (cambio no texto do modelo do lote) + ${escolhas} escolhas dos clientes (fipeEscolhaCliente); validacao cruzada 5-fold: acerto ${(100 * acerto).toFixed(2).replace('.', ',')}%, cobertura ${(100 * prev / Math.max(todos.length, 1)).toFixed(1).replace('.', ',')}% de ${todos.length} chassis`,
  regras,
}
// Trava de qualidade: com acerto abaixo de 99%, nao gera (o PR mostraria a queda).
if (acerto < 0.99) { console.error(`acerto ${acerto} abaixo de 99%: nao gera`); process.exit(2) }
writeFileSync(saida, JSON.stringify(out, null, 1) + '\n')
console.log(JSON.stringify({ chassis: todos.length, escolhas, regras: Object.keys(regras).length, acerto, cobertura: prev / Math.max(todos.length, 1) }))
