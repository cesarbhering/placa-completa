#!/usr/bin/env node
// Verificacao da migracao do IBV Auto para o blog (16/out/2026).
//
// Uso:  node scripts/verificar-blog-ibv.mjs [base]        (padrao: https://placacompleta.com.br)
//       BASE local: node scripts/verificar-blog-ibv.mjs http://127.0.0.1:3000
//
// Confere, sem dependencia nenhuma (Node 18+, fetch nativo):
//  1. Sitemap: toda URL responde 200 (sem redirect), nenhuma /ibv, tem /blog/tag/ibv-auto e os posts.
//  2. Crawl: todo link interno (href="/..." e absolutos do site) das paginas do sitemap
//     responde sem 404/5xx, e nenhum aponta para /ibv.
//  3. Redirects: cada /ibv/<slug antigo> da 301 direto (1 salto) para /blog/<slug novo>, que da 200.
//  4. Canonical, og:url e schema (BlogPosting/Breadcrumb) dos posts e da tag apontam para /blog.
//  5. Imagens (<img src> e og:image) do blog carregam (200, content-type image/*).
// Sai com codigo 1 se houver qualquer falha.

const BASE = (process.argv[2] || 'https://placacompleta.com.br').replace(/\/+$/, '')
const SITE = 'https://placacompleta.com.br'
const CONC = Number(process.env.CONC || 6)

// Slugs antigos (/ibv/<antigo>) -> novos (/blog/<novo>), igual a IBV_SLUG_ANTIGO (data/ibv-posts.ts).
const REDIRECTS = {
  'setembro-2026': 'ibv-auto-setembro-2026',
  'vencedores-perdedores-setembro-2026': 'vencedores-perdedores-setembro-2026',
  'eletricos-setembro-2026': 'eletricos-setembro-2026',
  'agosto-2026': 'ibv-auto-agosto-2026',
  'vencedores-perdedores-agosto-2026': 'vencedores-perdedores-agosto-2026',
  'eletricos-agosto-2026': 'eletricos-agosto-2026',
  'julho-2026': 'ibv-auto-julho-2026',
  'vencedores-perdedores-julho-2026': 'vencedores-perdedores-julho-2026',
  'eletricos-julho-2026': 'eletricos-julho-2026',
  'seguro-mais-caro-brasil-2026': 'seguro-mais-caro-brasil-2026',
  'abril-2026': 'ibv-auto-abril-2026',
  'vencedores-perdedores-abril-2026': 'vencedores-perdedores-abril-2026',
  'vencedores-perdedores-marco-2026': 'vencedores-perdedores-marco-2026',
  'marco-2026': 'ibv-auto-marco-2026',
  'maio-2026': 'ibv-auto-maio-2026',
  'vencedores-perdedores-maio-2026': 'vencedores-perdedores-maio-2026',
  'junho-2026': 'ibv-auto-junho-2026',
  'vencedores-perdedores-junho-2026': 'vencedores-perdedores-junho-2026',
  'eletricos-junho-2026': 'eletricos-junho-2026',
}

const falhas = []
const falha = (tipo, msg) => { falhas.push(`[${tipo}] ${msg}`) }
const local = (u) => (u.startsWith(SITE) ? BASE + u.slice(SITE.length) : u)

async function get(url, opts = {}) {
  for (let t = 0; t < 3; t++) {
    try {
      return await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'pc-verificar-blog-ibv/1' }, ...opts })
    } catch (e) {
      if (t === 2) return { status: 0, headers: new Map(), text: async () => '', erro: String(e) }
      await new Promise((r) => setTimeout(r, 800))
    }
  }
}

async function emLotes(itens, fn) {
  const fila = [...itens]
  await Promise.all(Array.from({ length: CONC }, async () => { while (fila.length) await fn(fila.shift()) }))
}

async function urlsDoSitemap() {
  const vistos = new Set()
  const urls = []
  async function ler(u) {
    if (vistos.has(u)) return
    vistos.add(u)
    const r = await get(local(u))
    if (r.status !== 200) return falha('sitemap', `${u} -> ${r.status}`)
    const xml = await r.text()
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'))
    if (/<sitemapindex/i.test(xml)) { for (const l of locs) await ler(l) } else urls.push(...locs)
  }
  await ler(`${SITE}/sitemap.xml`)
  return [...new Set(urls)]
}

const caminho = (u) => { try { return new URL(u, SITE).pathname } catch { return u } }

async function main() {
  console.log(`Base: ${BASE}`)
  // 1. sitemap
  const sitemap = await urlsDoSitemap()
  console.log(`Sitemap: ${sitemap.length} URLs`)
  const paths = sitemap.map(caminho)
  for (const p of paths) if (p === '/ibv' || p.startsWith('/ibv/')) falha('sitemap', `URL /ibv no sitemap: ${p}`)
  if (!paths.includes('/blog/tag/ibv-auto')) falha('sitemap', 'falta /blog/tag/ibv-auto')
  for (const novo of Object.values(REDIRECTS)) if (!paths.includes(`/blog/${novo}`)) falha('sitemap', `falta /blog/${novo}`)

  const html = new Map()
  await emLotes(sitemap, async (u) => {
    const r = await get(local(u))
    if (r.status !== 200) return falha('sitemap-status', `${caminho(u)} -> ${r.status}${r.headers.get?.('location') ? ` (${r.headers.get('location')})` : ''}`)
    const ct = r.headers.get('content-type') || ''
    if (ct.includes('text/html')) html.set(caminho(u), await r.text())
  })
  console.log(`Páginas HTML lidas: ${html.size}`)

  // 2. crawl de links internos
  const links = new Map() // destino -> origem (uma)
  for (const [origem, h] of html) {
    for (const m of h.matchAll(/<a\b[^>]*\shref="([^"#]+)(?:#[^"]*)?"/g)) {
      let href = m[1].replace(/&amp;/g, '&')
      if (href.startsWith(SITE)) href = href.slice(SITE.length) || '/'
      if (!href.startsWith('/') || href.startsWith('//')) continue
      if (/^\/(api|_nuxt|cdn-cgi)\//.test(href)) continue
      if (href === '/ibv' || href.startsWith('/ibv/') || href.startsWith('/ibv?')) falha('link-ibv', `${origem} -> ${href}`)
      if (!links.has(href)) links.set(href, origem)
    }
  }
  console.log(`Links internos distintos: ${links.size}`)
  await emLotes([...links.keys()], async (href) => {
    const r = await get(BASE + href)
    let st = r.status
    let destino = href
    // link para redirect: segue 1 salto e confere o destino (link interno nao deveria precisar, mas nao e 404)
    if (st >= 300 && st < 400) {
      destino = r.headers.get('location') || ''
      const r2 = await get(local(new URL(destino, BASE + '/').href))
      st = r2.status
    }
    if (st === 0 || st >= 400) falha('link-quebrado', `${links.get(href)} -> ${href} (${destino}) = ${st}`)
  })

  // 3. redirects
  const casos = [['/ibv', '/blog/tag/ibv-auto'], ['/ibv/slug-que-nao-existe', '/blog/tag/ibv-auto'],
    ...Object.entries(REDIRECTS).map(([a, n]) => [`/ibv/${a}`, `/blog/${n}`])]
  let okRedir = 0
  for (const [de, para] of casos) {
    const r = await get(BASE + de)
    const loc = r.headers.get?.('location') || ''
    if (r.status !== 301) { falha('redirect', `${de} -> ${r.status} (esperado 301)`); continue }
    if (caminho(loc) !== para) { falha('redirect', `${de} -> ${loc} (esperado ${para})`); continue }
    const r2 = await get(local(new URL(loc, BASE + '/').href))
    if (r2.status !== 200) { falha('redirect', `${de} -> ${para} = ${r2.status} (mais de 1 salto ou quebrado)`); continue }
    okRedir++
  }
  console.log(`Redirects ok: ${okRedir}/${casos.length}`)

  // 4. canonical, og:url e schema; 5. imagens
  const alvos = ['/blog', '/blog/tag/ibv-auto', ...Object.values(REDIRECTS).map((n) => `/blog/${n}`)]
  const imagens = new Map()
  for (const p of alvos) {
    const h = html.get(p) ?? await (await get(BASE + p)).text()
    if (p !== '/blog') {
      const can = h.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1]
      if (can !== SITE + p) falha('canonical', `${p}: ${can}`)
    }
    if (p.startsWith('/blog/') && !p.startsWith('/blog/tag/')) {
      const ogu = h.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/)?.[1]
      if (ogu !== SITE + p) falha('og:url', `${p}: ${ogu}`)
      const ld = [...h.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n')
      if (!ld.includes(`"@id":"${SITE}${p}"`)) falha('schema', `${p}: BlogPosting sem mainEntityOfPage em /blog`)
      if (!ld.includes(`"item":"${SITE}/blog"`)) falha('schema', `${p}: Breadcrumb sem Blog`)
      if (/placacompleta\.com\.br\/ibv/.test(ld)) falha('schema', `${p}: schema com /ibv`)
    }
    for (const m of h.matchAll(/<img\b[^>]*\ssrc="([^"]+)"/g)) imagens.set(m[1], p)
    const og = h.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)?.[1]
    if (og) imagens.set(og, p)
  }
  await emLotes([...imagens.keys()], async (src) => {
    if (src.startsWith('data:')) return
    const u = src.startsWith('http') ? local(src) : BASE + src
    const r = await get(u)
    const ct = r.headers.get?.('content-type') || ''
    if (r.status !== 200 || !ct.startsWith('image/')) falha('imagem', `${imagens.get(src)}: ${src} = ${r.status} ${ct}`)
  })
  console.log(`Imagens conferidas: ${imagens.size}`)

  if (falhas.length) {
    console.log(`\nFALHAS (${falhas.length}):`)
    for (const f of falhas) console.log(' ', f)
    process.exit(1)
  }
  console.log('\nOK: zero 404, zero 5xx, zero link para /ibv, redirects em 1 salto, canonical/og:url/schema no /blog, imagens carregando.')
}

main().catch((e) => { console.error(e); process.exit(1) })
