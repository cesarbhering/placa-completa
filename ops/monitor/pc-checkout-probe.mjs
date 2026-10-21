#!/usr/bin/env node
// CHECKOUT (pc-monitor, ordem do Cesar 12/out/2026). Fluxo real num Chromium: consulta uma placa, clica na
// Completa e exige o botao de pagar. Nao gera Pix, nao cria pedido.
// Roda pelo pc-checkout-probe.timer (30 min) e apos todo deploy (pc-deploy-watch, nao mexer).
//
// Confiabilidade:
//  - so alerta apos 3 falhas seguidas com 60 s entre elas (pc-monitor alerta checkout falha ...).
//  - motivo classificado: "api" (4xx/5xx em /api/premium ou /api/consulta), "fluxo_timeout", "fluxo_travado",
//    "tela_erro". Se o problema e o SITE (home nao abre), nao manda "checkout com erro": isso e do pc-site-check.
//  - roda com prioridade baixa (nice 10); se a CPU estiver com menos de 10% ociosa, espera 2 min e tenta de novo
//    (ate 3x) em vez de alertar. Nunca diagnostica "VPS sobrecarregada" como desculpa: home > 20 s = incidente.
// Compat: segue gravando ultimoOk em /root/.checkout-probe.json e imprimindo "OK ..." / "FALHA ..." no journal.
// Codigo de saida: 0 sempre que a rodada terminou (ok, falha ja registrada no pc-monitor, adiada). Saida != 0 =
// a SONDA quebrou (crash), e o `pc-monitor meta` transforma isso em "MONITOR QUEBRADO".
// Dependencias PROPRIAS em /opt/pc-checkout-probe (playwright + Chromium), nunca o node_modules do checkout de
// trabalho do site: em 15/out um agente esvaziou /root/placa-completa/node_modules e a sonda quebrou calada.
const PROBE_HOME = process.env.PROBE_HOME || '/opt/pc-checkout-probe'
process.env.PLAYWRIGHT_BROWSERS_PATH ||= `${PROBE_HOME}/browsers`
const { chromium } = await import(`${PROBE_HOME}/node_modules/playwright/index.mjs`)
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'

const URL = process.env.PROBE_URL || 'https://placacompleta.com.br/'
const PLACA = process.env.PROBE_PLACA || 'ABC1D23'
const COMPAT = '/root/.checkout-probe.json'
const LOCK = process.env.PROBE_LOCK || '/run/pc-checkout-probe.lock'
const TENTATIVAS = 3
const ESPERA_MS = 60_000
const sleep = ms => new Promise(r => setTimeout(r, ms))

try { os.setPriority(10) } catch {}

// uma sonda por vez (timer e pc-deploy-watch podem coincidir)
try {
  const pid = Number(fs.readFileSync(LOCK, 'utf8'))
  if (pid && pid !== process.pid) { try { process.kill(pid, 0); console.log('outra sonda rodando, saindo'); process.exit(0) } catch {} }
} catch {}
fs.writeFileSync(LOCK, String(process.pid))
const soltar = () => { try { if (Number(fs.readFileSync(LOCK, 'utf8')) === process.pid) fs.unlinkSync(LOCK) } catch {} }

function monitor(...args) {
  try { execFileSync(process.env.PCMON_BIN || '/usr/local/bin/pc-monitor', ['alerta', 'checkout', ...args], { stdio: 'inherit', timeout: 120_000 }) }
  catch (e) { console.log('pc-monitor falhou:', e.message) }
}
// CPU saturada = menos de 10% ociosa numa amostra de 2 s (/proc/stat). NAO usa load: com teto de CPU nos
// containers (21/out), threads presas na quota contam no load (load 20 com 47% ociosa) e a sonda adiava a toa.
const POS_DEPLOY = process.argv.includes('--pos-deploy')
function amostraCpu() {
  const v = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/).slice(1).map(Number)
  return { total: v.reduce((a, b) => a + b, 0), ocioso: v[3] + (v[4] || 0) }
}
async function cpuOciosaPct() {
  const a = amostraCpu(); await sleep(2000); const b = amostraCpu()
  return 100 * (b.ocioso - a.ocioso) / Math.max(1, b.total - a.total)
}
const cpuSaturada = async () => (await cpuOciosaPct()) < 10

// Pos-deploy (chamada pelo pc-deploy-watch com --pos-deploy): espera o deployment do site sair de
// in_progress no Coolify (ate 20 min) e depois roda SEM adiar, para todo deploy ter veredito.
async function esperarDeployTerminar() {
  try {
    const env = Object.fromEntries(fs.readFileSync('/root/.coolify-api.env', 'utf8').split('\n')
      .map(l => l.match(/^(?:export\s+)?(\w+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]))
    const url = `${env.COOLIFY_URL.replace(/\/+$/, '')}/api/v1/deployments/applications/gvw73er3wq20ydyytrg5ygdt?skip=0&take=5`
    for (let i = 0; i < 40; i++) {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${env.COOLIFY_API_TOKEN}` }, signal: AbortSignal.timeout(15_000) })
      const ds = (await r.json())?.deployments || []
      if (!ds.some(d => d.status === 'in_progress' || d.status === 'queued')) return
      if (i === 0) console.log('pos-deploy: esperando o deploy do Coolify terminar')
      await sleep(30_000)
    }
    console.log('pos-deploy: deploy ainda em andamento apos 20 min; rodando assim mesmo')
  } catch (e) { console.log('pos-deploy: sem leitura do Coolify (' + e.message + '); rodando assim mesmo') }
}

async function homeResponde() {
  const t0 = Date.now()
  try {
    const r = await fetch(URL, { signal: AbortSignal.timeout(20_000) })
    return { ok: r.ok && Date.now() - t0 <= 20_000, msg: `home ${r.status} em ${((Date.now() - t0) / 1000).toFixed(1)}s` }
  } catch (e) { return { ok: false, msg: `home sem resposta (${String(e.cause?.code || e.name)})` } }
}

async function rodada() {
  const erros = [], apiErros = []
  let etapa = 'abrir a home'
  const b = await chromium.launch({ args: ['--no-sandbox'] })
  try {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } })
    p.on('pageerror', e => erros.push('PAGEERROR ' + String(e.message).slice(0, 200)))
    p.on('response', r => {
      if (/\/api\/(premium|consulta)/.test(r.url()) && r.status() >= 400) apiErros.push(`${r.status()} ${new URL(r.url()).pathname}`)
    })
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await p.waitForSelector('input', { timeout: 30_000 })
    // espera o Vue montar antes de preencher (se o fill cai antes da hidratacao, o campo e zerado)
    await p.waitForFunction(() => !!document.querySelector('#__nuxt')?.__vue_app__, { timeout: 30_000 }).catch(() => {})
    await p.waitForTimeout(800)
    etapa = 'consulta gratis'
    for (let i = 0; i < 3; i++) {
      await p.fill('input', PLACA)
      await p.waitForTimeout(400)
      if ((await p.inputValue('input')).toUpperCase() === PLACA) break
    }
    const btnConsultar = await p.$('button:has-text("Consultar placa")')
    if (btnConsultar) await btnConsultar.click(); else await p.keyboard.press('Enter')
    // marcadores de RESULTADO dos dois layouts do A/B (ver historico no git)
    await p.waitForFunction(() => /Risco oculto nesta placa|pode ter restrição|A consulta grátis não mostra|Libere o relatório|Libere o leilão|Você viu o que é o carro/.test(document.body.innerText), { timeout: 90_000 })
    etapa = 'abrir o checkout'
    let btnCompleta = null
    for (const bt of await p.$$('button')) {
      const t = ((await bt.textContent()) || '').trim()
      if (/essa placa revela|leil[aã]o no relat[oó]rio completo|confiar neste carro|Ver relat[oó]rio completo|Ver o leil[aã]o e o relat[oó]rio/i.test(t)) { btnCompleta = bt; break }
    }
    if (!btnCompleta) return { ok: false, tipo: 'fluxo_travado', motivo: 'botao da Completa nao apareceu apos a consulta gratis', det: erros.join('\n') }
    await btnCompleta.click()
    let ok = false, txt = ''
    for (let i = 0; i < 15 && !ok; i++) {
      await p.waitForTimeout(1000)
      txt = (await p.textContent('body')) || ''
      ok = /Pagar e liberar o relat[oó]rio|Liberar meu relat[oó]rio|Liberar minha consulta|Liberar relat[oó]rio gr[aá]tis|Pagar R\$|Comprar Consulta Completa/.test(txt)
    }
    if (ok) return { ok: true }
    if (apiErros.length) return { ok: false, tipo: 'api', motivo: `erro de API no checkout: ${apiErros.slice(0, 3).join(', ')}`, det: erros.join('\n') }
    if (/N[aã]o conseguimos/.test(txt)) return { ok: false, tipo: 'tela_erro', motivo: 'checkout mostrou tela de erro', det: erros.join('\n') }
    return { ok: false, tipo: 'fluxo_travado', motivo: /S[oó] um instante/.test(txt) ? 'checkout preso em loading (So um instante...)' : 'checkout sem botao de pagar em 15 s', det: erros.join('\n') }
  } catch (e) {
    if (etapa === 'abrir a home') {
      const h = await homeResponde()
      if (!h.ok) return { ok: false, tipo: 'site', motivo: `site nao abre (${h.msg})`, det: String(e.message).slice(0, 200) }
    }
    if (apiErros.length) return { ok: false, tipo: 'api', motivo: `erro de API em "${etapa}": ${apiErros.slice(0, 3).join(', ')}`, det: erros.join('\n') }
    return { ok: false, tipo: 'fluxo_timeout', motivo: `timeout em "${etapa}": ${String(e.message).split('\n')[0].slice(0, 120)}`, det: erros.join('\n') }
  } finally {
    await b.close()
  }
}

let ultima = null
if (POS_DEPLOY) await esperarDeployTerminar()
try {
  for (let i = 1; i <= TENTATIVAS; i++) {
    if (!POS_DEPLOY) {
      let adiada = 0
      while ((await cpuSaturada()) && adiada < 3) { console.log('CPU com menos de 10% ociosa: adiando 2 min'); adiada++; await sleep(120_000) }
      if (await cpuSaturada()) { console.log('ADIADA CPU saturada (< 10% ociosa) por 6 min; sem veredito nesta rodada'); process.exit(0) }
    }
    ultima = await rodada()
    if (ultima.ok) {
      try { const s = JSON.parse(fs.readFileSync(COMPAT, 'utf8')); fs.writeFileSync(COMPAT, JSON.stringify({ ...s, ultimoOk: Date.now() })) } catch { fs.writeFileSync(COMPAT, JSON.stringify({ ultimoOk: Date.now() })) }
      console.log(`OK checkout chegou na confirmacao${i > 1 ? ` (na tentativa ${i})` : ''}`)
      monitor('ok', i > 1 ? `ok na tentativa ${i}` : 'checkout abre e mostra o botao de pagar')
      process.exitCode = 0
      break
    }
    console.log(`tentativa ${i}/${TENTATIVAS} falhou: [${ultima.tipo}] ${ultima.motivo}`)
    if (ultima.tipo === 'site') { console.log('FALHA site fora do ar: alerta fica com o pc-site-check'); break }
    if (i < TENTATIVAS) await sleep(ESPERA_MS)
  }
  if (ultima && !ultima.ok && ultima.tipo !== 'site') {
    console.log(`FALHA [${ultima.tipo}] ${ultima.motivo} (confirmada em ${TENTATIVAS} tentativas)`)
    monitor('falha', ultima.tipo, ultima.motivo, ultima.det || '')
  }
} finally {
  soltar()
}
