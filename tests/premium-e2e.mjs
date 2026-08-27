#!/usr/bin/env node
// ============================================================
// E2E do fluxo premium — API-level, Node puro (fetch nativo, sem Playwright).
//
// Roda o caminho pago inteiro contra um container de homolog:
//   gate -> checkout (basica E completa) -> simular pagamento -> poll status
//   ate 'entregue' -> report (valida o corte por plano) -> negativos.
//
// So funciona em HOMOLOG: usa 'Confirmar pagamento (simular)', que exige a
// chave dev da AbacatePay (abc_dev_) e o gate de senha ligado. Em prod isso
// nao existe (Pix real), entao NUNCA aponte este script pra producao.
//
// Config por ambiente (nada hardcoded de segredo):
//   E2E_BASE_URL       default http://127.0.0.1:8395
//   E2E_GATE_PASSWORD  senha do gate premium do homolog (obrigatoria)
//   E2E_PLACA          placa de teste do SENATRAN de homolog (obrigatoria)
//   E2E_EMAIL          default e2e@placacompleta.com.br
//   E2E_TIMEOUT_MS     default 120000 (timeout do poll de status)
// ============================================================

const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:8395').replace(/\/$/, '')
const GATE_PASSWORD = process.env.E2E_GATE_PASSWORD || ''
const PLACA = (process.env.E2E_PLACA || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
const EMAIL = process.env.E2E_EMAIL || 'e2e@placacompleta.com.br'
const POLL_TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS || 120000)
const POLL_INTERVAL_MS = 3000

// Espelha CAMPOS_BASICA de shared/planos.ts. Mantido inline pra rodar com
// `node` puro (sem loader de TS). Se a whitelist mudar la, atualizar aqui.
const CAMPOS_BASICA = [
  'placa', 'descricaoMarcaModelo', 'anoFabricacao', 'anoModelo', 'descricaoCor',
  'chassi',
  'descricaoEspecie', 'descricaoTipoVeiculo', 'descricaoCategoria', 'procedencia',
  'situacao', 'ufJurisdicao', 'municipio',
  'potencia', 'cilindrada', 'quantidadeDeEixos', 'lotacao',
  'pesoBruto', 'capacidadeMaximaDeCarga', 'capacidadeMaximaDeTracao',
  'codigoCombustivel', 'codigoTipoCarroceria',
  'indicadorRecall',
]

// -------------------- infra de log/asserts --------------------
let failures = 0
let stepN = 0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function pass(msg) { console.log(`  ✓ PASS  ${msg}`) }
function fail(msg) { failures++; console.log(`  ✗ FAIL  ${msg}`) }
function step(msg) { stepN++; console.log(`\n[${stepN}] ${msg}`) }
function assert(cond, msg) { cond ? pass(msg) : fail(msg) }

function die(msg) {
  console.error(`\n✗ ABORT  ${msg}`)
  process.exit(1)
}

// Cookie jar minimo: guarda o premium_gate do set-cookie e reenvia.
let cookieJar = ''
function captureCookies(res) {
  const set = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean)
  for (const c of set) {
    const m = /^([^=]+)=([^;]*)/.exec(c)
    if (m && m[1] === 'premium_gate') cookieJar = `premium_gate=${m[2]}`
  }
}

async function api(method, path, { body, cookie = true } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (cookie && cookieJar) headers.cookie = cookieJar
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  captureCookies(res)
  let data = null
  const text = await res.text()
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, data }
}

// -------------------- etapas --------------------
async function gate() {
  step('Gate: autentica e captura cookie premium_gate')
  const r = await api('POST', '/api/premium/gate', { body: { password: GATE_PASSWORD }, cookie: false })
  if (r.status !== 200) die(`gate retornou ${r.status} (esperado 200). Senha errada ou nao-gated? ${JSON.stringify(r.data)}`)
  if (!cookieJar) die('gate nao devolveu cookie premium_gate no set-cookie')
  pass('gate 200 + cookie premium_gate capturado')
}

async function comprarPlano(plano) {
  step(`Checkout ${plano}: cria pedido + Pix`)
  const co = await api('POST', '/api/premium/checkout', {
    body: { placa: PLACA, email: EMAIL, plano, ambiente: 'homolog' },
  })
  assert(co.status === 200, `checkout ${plano} -> 200 (foi ${co.status})`)
  const token = co.data?.token
  assert(!!token, `checkout ${plano} devolveu token`)
  assert(!!co.data?.brCode, `checkout ${plano} devolveu brCode`)
  if (!token) die(`sem token no checkout ${plano}, nao da pra seguir: ${JSON.stringify(co.data)}`)

  step(`Simular pagamento ${plano}`)
  const sim = await api('POST', '/api/premium/simular-pagamento', { body: { token } })
  assert(sim.status === 200 && sim.data?.ok === true, `simular-pagamento ${plano} -> ok (status ${sim.status})`)

  step(`Poll status ${plano} ate 'entregue' (timeout ${POLL_TIMEOUT_MS / 1000}s)`)
  const deadline = Date.now() + POLL_TIMEOUT_MS
  let last = null
  while (Date.now() < deadline) {
    const st = await api('GET', `/api/premium/status?token=${encodeURIComponent(token)}`)
    last = st.data?.status
    if (last === 'entregue') break
    if (['falha', 'reembolsado', 'expirado'].includes(last)) {
      die(`status ${plano} terminou em '${last}' antes de entregar`)
    }
    await sleep(POLL_INTERVAL_MS)
  }
  assert(last === 'entregue', `status ${plano} chegou em 'entregue' (ultimo: '${last}')`)

  step(`Report ${plano}`)
  const rep = await api('GET', `/api/premium/report?token=${encodeURIComponent(token)}`)
  assert(rep.status === 200, `report ${plano} -> 200 (foi ${rep.status})`)
  assert(rep.data?.plano === plano, `report ${plano} tem plano='${plano}' (veio '${rep.data?.plano}')`)
  const campos = rep.data?.consulta?.response || {}
  assert(Object.keys(campos).length > 0, `report ${plano} tem campos na consulta (${Object.keys(campos).length})`)
  return { token, campos }
}

// -------------------- main --------------------
async function main() {
  console.log(`# premium-e2e  ->  ${BASE}`)
  if (!GATE_PASSWORD) die('E2E_GATE_PASSWORD nao definido')
  if (PLACA.length < 7) die('E2E_PLACA invalida/ausente (precisa de 7 caracteres, placa de teste do homolog)')
  console.log(`# placa=${PLACA}  email=${EMAIL}`)

  await gate()

  const basica = await comprarPlano('basica')
  const completa = await comprarPlano('completa')

  step('Corte por plano: basica nao vaza campo exclusivo da completa')
  const basicaKeys = Object.keys(basica.campos)
  const completaKeys = Object.keys(completa.campos)
  // Campos da completa que NAO estao na whitelist da basica = exclusivos.
  const exclusivos = completaKeys.filter((k) => !CAMPOS_BASICA.includes(k))
  assert(exclusivos.length > 0, `completa entrega campo(s) exclusivo(s): [${exclusivos.slice(0, 8).join(', ')}${exclusivos.length > 8 ? ', ...' : ''}]`)
  // basica: nenhuma chave pode estar fora da whitelist
  const vazados = basicaKeys.filter((k) => !CAMPOS_BASICA.includes(k))
  assert(vazados.length === 0, `basica nao vaza campo fora da whitelist${vazados.length ? ` (VAZOU: ${vazados.join(', ')})` : ''}`)
  // e nenhum exclusivo da completa aparece na basica
  const vazadosExcl = exclusivos.filter((k) => k in basica.campos)
  assert(vazadosExcl.length === 0, `basica nao contem nenhum exclusivo da completa${vazadosExcl.length ? ` (VAZOU: ${vazadosExcl.join(', ')})` : ''}`)
  // completa deve ser superconjunto da basica
  const faltando = basicaKeys.filter((k) => !(k in completa.campos))
  assert(faltando.length === 0, `completa contem tudo que a basica tem${faltando.length ? ` (faltou: ${faltando.join(', ')})` : ''}`)

  step('Negativo: status com token invalido -> 404')
  const bad = await api('GET', '/api/premium/status?token=token-que-nao-existe-xyz')
  assert(bad.status === 404, `status token invalido -> 404 (foi ${bad.status})`)

  step('Negativo: checkout SEM cookie -> 401')
  const noCookie = await api('POST', '/api/premium/checkout', {
    body: { placa: PLACA, email: EMAIL, plano: 'basica', ambiente: 'homolog' },
    cookie: false,
  })
  assert(noCookie.status === 401, `checkout sem cookie -> 401 (foi ${noCookie.status})`)

  console.log(`\n${'='.repeat(48)}`)
  if (failures === 0) {
    console.log('✓ TODOS OS CHECKS PASSARAM')
    process.exit(0)
  } else {
    console.log(`✗ ${failures} CHECK(S) FALHARAM`)
    process.exit(1)
  }
}

main().catch((e) => die(e?.stack || String(e)))
