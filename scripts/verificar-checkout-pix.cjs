// Verificacao ponta a ponta do checkout (Pix em um clique), com rotas simuladas:
// nenhuma cobranca real. Uso: node scripts/verificar-checkout-pix.cjs <dir-dos-prints> (sobe antes/depois nas portas 8545/8546).
const { chromium } = require('/root/pc-wt-go/node_modules/playwright')
const SP = process.argv[2]
const basico = { placa: 'TST1A23', marca: 'FIAT', modelo: '500 CULT', ano: '2012', anoFabricacao: '2012', cor: 'Preta', combustivel: 'Flex', origem: 'Importado', municipio: 'Belo Horizonte', uf: 'MG', chassiParcial: 'ZFA312***', fipe: 'R$ 35.000,00', fipeNota: null }
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
async function abrir(b, porta, w, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } })
  await ctx.addInitScript((em) => { try { localStorage.setItem('homolog_ok', '1'); if (em) localStorage.setItem('pc_email', em); else localStorage.removeItem('pc_email') } catch {} }, opts.email ?? 'cliente.teste@exemplo.com')
  const p = await ctx.newPage()
  const st = { checkout: 0, gratis: 0, eventos: [] }
  await p.exposeFunction('__ev', (e) => st.eventos.push(e))
  await p.addInitScript(() => { window.gtag = (...a) => { if (a[0] === 'event') window.__ev(a[1]) } })
  await p.route('**/api/**', async (route) => {
    const u = route.request().url()
    if (u.includes('/api/consulta')) return route.fulfill({ json: { success: true, emailSent: false, message: 'ok', basico, share: { marca: 'FIAT', modelo: '500', ano: '2012' } } })
    if (u.includes('/api/premium/preview')) return route.fulfill({ json: { placa: 'TST1A23', encontrado: true, marca: 'FIAT', modelo: '500 CULT', ano: '2012', cor: 'Preta', municipio: 'Belo Horizonte', uf: 'MG', raw: { placa: 'TST1A23' } } })
    if (u.includes('/api/premium/checkout')) { st.checkout++; await new Promise((r) => setTimeout(r, 600)); const gr = opts.gratis; if (gr) st.gratis++; return route.fulfill({ json: gr ? { token: 'TokFicticio000000000001', valor: 0, gratis: true } : { brCode: '00020101021226FICTICIO', brCodeBase64: 'data:image/png;base64,' + PNG, token: 'TokFicticio000000000001', valor: 3990, expiresAt: new Date(Date.now() + 3600e3).toISOString() } }) }
    if (u.includes('/api/premium/status')) return route.fulfill({ json: { status: 'aguardando_pagamento' } })
    if (u.includes('/api/geo')) return route.fulfill({ json: { uf: 'MG' } })
    return route.fulfill({ json: {} })
  })
  await p.goto(`http://127.0.0.1:${porta}/`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200)
  await p.fill('#placa', 'TST1A23'); await p.locator('button[type=submit]').first().click(); await p.waitForTimeout(2200)
  const cta = p.locator('.cb-sticky-upsell__cta:visible, button:has-text("Relatório completo"):visible, button:has-text("Ver relatório completo"):visible').first()
  await cta.click(); await p.waitForTimeout(1800)
  return { ctx, p, st }
}
;(async () => {
  const b = await chromium.launch()
  for (const [porta, nome] of [[8545, 'antes'], [8546, 'depois']]) for (const w of [390, 1280]) {
    const { ctx, p, st } = await abrir(b, porta, w)
    const painel = p.locator('.pic-conf').first()
    await painel.scrollIntoViewIfNeeded()
    const gap = await p.evaluate(() => { const c = document.querySelector('.pic-conf'); const bt = c && c.parentElement.querySelector('.pic-btn--primary'); return c && bt ? Math.round(bt.getBoundingClientRect().top - c.getBoundingClientRect().bottom) : null })
    await p.locator('.pic-modal, .pic-overlay, .pic-body').first().screenshot({ path: `${SP}/pixd-${nome}-${w}.png` })
    // duplo clique na aba Pix (ja selecionada)
    await p.locator('.pic-tab', { hasText: 'Pix' }).dblclick(); await p.waitForTimeout(1800)
    const qr = await p.locator('img[src^="data:image/png"]').count()
    if (w === 390) await p.locator('.pic-modal, .pic-overlay, .pic-body').first().screenshot({ path: `${SP}/pixd-${nome}-qr-${w}.png` })
    console.log(nome, w, '| gap card->botao:', gap, 'px | POST checkout:', st.checkout, '| QR na tela:', qr, '| eventos:', [...new Set(st.eventos)].filter((e) => /pix|payment|checkout/.test(e)).join(','), '| overflow', await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth))
    await ctx.close()
  }
  // depois: cartao so seleciona; cupom 100% vai pelo gratis
  { const { ctx, p, st } = await abrir(b, 8546, 1280); await p.locator('.pic-tab', { hasText: 'Cartão' }).click(); await p.waitForTimeout(800); console.log('depois cartao | POST checkout:', st.checkout, '| aba cartao on:', await p.locator('.pic-tab--on', { hasText: 'Cartão' }).count()); await ctx.close() }
  { const { ctx, p, st } = await abrir(b, 8546, 1280, { gratis: true }); await p.locator('.pic-tab', { hasText: 'Pix' }).click(); await p.waitForTimeout(1500); console.log('depois gratis (servidor devolve gratis) | POST:', st.checkout, 'gratis:', st.gratis, '| QR:', await p.locator('img[src^="data:image/png"]').count()); await ctx.close() }
  await b.close()
})()
