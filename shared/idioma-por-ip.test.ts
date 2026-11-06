import { describe, it, expect } from 'vitest'
import { destinoPorIdioma, ehRobo, rotaExcluida, type PedidoIdioma } from './idioma-por-ip'

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const HTML = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

function pedido(over: Partial<PedidoIdioma> = {}): PedidoIdioma {
  return { metodo: 'GET', url: '/sobre', host: 'placacompleta.com.br', accept: HTML, userAgent: CHROME, pais: 'US', ...over }
}

describe('language by IP: Brazil', () => {
  it('BR on a PT page: no redirect', () => {
    expect(destinoPorIdioma(pedido({ pais: 'BR' }))).toBeNull()
  })
  it('BR on every bilingual page: no redirect', () => {
    for (const url of ['/sobre', '/contato', '/para-empresas', '/consulta-veicular-completa', '/termos-de-uso', '/politica-de-privacidade']) {
      expect(destinoPorIdioma(pedido({ pais: 'BR', url }))).toBeNull()
    }
  })
  it('BR on an /en page (shared link): stays in EN', () => {
    expect(destinoPorIdioma(pedido({ pais: 'BR', url: '/en/sobre' }))).toBeNull()
  })
  it('lowercase country code is still Brazil', () => {
    expect(destinoPorIdioma(pedido({ pais: 'br' }))).toBeNull()
  })
})

describe('language by IP: abroad', () => {
  it('US on a PT page with an EN twin: 302 to /en', () => {
    expect(destinoPorIdioma(pedido())).toBe('/en/sobre')
  })
  it('PT, DE, AR also go to /en', () => {
    for (const pais of ['PT', 'DE', 'AR']) expect(destinoPorIdioma(pedido({ pais }))).toBe('/en/sobre')
  })
  it('keeps the query string (UTMs, gclid, msclkid)', () => {
    const q = '?utm_source=google&utm_medium=cpc&gclid=abc123&msclkid=xyz'
    expect(destinoPorIdioma(pedido({ url: `/contato${q}` }))).toBe(`/en/contato${q}`)
  })
  it('trailing slash still finds the page', () => {
    expect(destinoPorIdioma(pedido({ url: '/sobre/' }))).toBe('/en/sobre')
  })
  it('already on /en: no loop', () => {
    expect(destinoPorIdioma(pedido({ url: '/en/sobre' }))).toBeNull()
  })
  it('PT-only pages (blog, tabela-fipe, pSEO) never move', () => {
    for (const url of ['/blog', '/blog/um-post', '/tabela-fipe', '/tabela-fipe/fiat-uno', '/carro-de-leilao', '/o-que-e/renavam', '/seguro/carro-eletrico', '/consultar-placa/sao-paulo', '/estudos']) {
      expect(destinoPorIdioma(pedido({ url }))).toBeNull()
    }
  })
})

describe('language by IP: unknown country', () => {
  it('missing header, XX and T1 (Tor) do not move', () => {
    for (const pais of [undefined, '', 'XX', 'T1', 'xx', 'nonsense']) {
      expect(destinoPorIdioma(pedido({ pais }))).toBeNull()
    }
  })
})

describe('language by IP: crawlers (SEO)', () => {
  // Google crawls from US IPs. If Googlebot gets redirected, the PT site
  // disappears from search. These must NEVER move, from any country.
  const ROBOS = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'WhatsApp/2.23.20.0 A',
    'AdsBot-Google (+http://www.google.com/adsbot.html)',
    'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
    'Mozilla/5.0 (compatible; PerplexityBot/1.0)',
    'Twitterbot/1.0',
    'LinkedInBot/1.0',
    'Slackbot-LinkExpanding 1.0',
    'TelegramBot (like TwitterBot)',
    'SomeLinkPreview/1.0',
    'MyCrawler/2.0',
    'Spider-X',
    '',
  ]
  it('no crawler is redirected from the US', () => {
    for (const userAgent of ROBOS) {
      expect(ehRobo(userAgent), userAgent).toBe(true)
      expect(destinoPorIdioma(pedido({ userAgent, pais: 'US' })), userAgent).toBeNull()
    }
  })
  it('a crawler with a cookie still does not move', () => {
    expect(destinoPorIdioma(pedido({ userAgent: ROBOS[0], cookieIdioma: 'en' }))).toBeNull()
    expect(destinoPorIdioma(pedido({ userAgent: ROBOS[0], cookieIdioma: 'pt', url: '/en/sobre' }))).toBeNull()
  })
  it('regular browsers are not crawlers', () => {
    expect(ehRobo(CHROME)).toBe(false)
    expect(ehRobo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe(false)
    expect(ehRobo('Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0')).toBe(false)
  })
})

describe('language by IP: manual choice (cookie pc_lang)', () => {
  it('foreigner who chose PT stays in PT', () => {
    expect(destinoPorIdioma(pedido({ cookieIdioma: 'pt' }))).toBeNull()
  })
  it('foreigner who chose PT and opens an /en link goes back to PT', () => {
    expect(destinoPorIdioma(pedido({ cookieIdioma: 'pt', url: '/en/sobre?utm_source=x' }))).toBe('/sobre?utm_source=x')
  })
  it('Brazilian who chose EN goes to /en', () => {
    expect(destinoPorIdioma(pedido({ pais: 'BR', cookieIdioma: 'en' }))).toBe('/en/sobre')
  })
  it('EN choice on /en: nothing to do', () => {
    expect(destinoPorIdioma(pedido({ pais: 'BR', cookieIdioma: 'en', url: '/en/sobre' }))).toBeNull()
  })
  it('cookie wins even without a country', () => {
    expect(destinoPorIdioma(pedido({ pais: undefined, cookieIdioma: 'en' }))).toBe('/en/sobre')
  })
  it('garbage cookie is ignored (falls back to the IP)', () => {
    expect(destinoPorIdioma(pedido({ cookieIdioma: 'fr' }))).toBe('/en/sobre')
    expect(destinoPorIdioma(pedido({ pais: 'BR', cookieIdioma: 'fr' }))).toBeNull()
  })
  it('cookie never moves a PT-only page', () => {
    expect(destinoPorIdioma(pedido({ cookieIdioma: 'en', url: '/blog' }))).toBeNull()
  })
})

describe('language by IP: excluded routes', () => {
  const FORA = [
    '/api/consulta', '/api/premium/webhook', '/_nuxt/entry.js', '/__nuxt_error', '/_ipx/w_640/logo.png',
    '/sitemap.xml', '/__sitemap__/pages.xml', '/robots.txt', '/llms', '/llms.txt', '/llms/json',
    '/premium/TOKENFICTICIO123', '/en/premium/TOKENFICTICIO123', '/feedback/TOKENFICTICIO123', '/en/feedback/TOKENFICTICIO123',
    '/admin', '/dash', '/woovi-teste', '/favicon.ico', '/logo-horizontal-600.png', '/manifest.json', '/sw.js',
    '/.well-known/api-catalog', '/webhook/abacatepay', '/api/premium/stripe/callback',
  ]
  it('never redirected, from abroad or with a cookie', () => {
    for (const url of FORA) {
      expect(rotaExcluida(url), url).toBe(true)
      expect(destinoPorIdioma(pedido({ url })), url).toBeNull()
      expect(destinoPorIdioma(pedido({ url, cookieIdioma: 'en' })), url).toBeNull()
      expect(destinoPorIdioma(pedido({ url, cookieIdioma: 'pt' })), url).toBeNull()
    }
  })
  it('bilingual pages are not excluded', () => {
    expect(rotaExcluida('/sobre')).toBe(false)
    expect(rotaExcluida('/en/termos-de-uso')).toBe(false)
  })
})

describe('language by IP: request shape', () => {
  it('only GET', () => {
    for (const metodo of ['POST', 'HEAD', 'PUT', 'OPTIONS', 'DELETE']) {
      expect(destinoPorIdioma(pedido({ metodo })), metodo).toBeNull()
    }
  })
  it('only HTML (an asset or JSON fetch does not move)', () => {
    expect(destinoPorIdioma(pedido({ accept: 'application/json' }))).toBeNull()
    expect(destinoPorIdioma(pedido({ accept: '*/*' }))).toBeNull()
    expect(destinoPorIdioma(pedido({ accept: 'text/markdown' }))).toBeNull()
    expect(destinoPorIdioma(pedido({ accept: undefined }))).toBeNull()
  })
  it('internal fetch (markdown for agents) does not move', () => {
    expect(destinoPorIdioma(pedido({ interno: true }))).toBeNull()
  })
  it('only on the main host (olhonamoto, olhonocaminhao, app. stay as they are)', () => {
    for (const host of ['olhonamoto.com.br', 'www.olhonamoto.com.br', 'olhonocaminhao.com.br', 'www.olhonocaminhao.com.br', 'app.placacompleta.com.br', 'homolog.placacompleta.com.br', 'localhost']) {
      expect(destinoPorIdioma(pedido({ host })), host).toBeNull()
    }
    expect(destinoPorIdioma(pedido({ host: 'www.placacompleta.com.br' }))).toBe('/en/sobre')
    expect(destinoPorIdioma(pedido({ host: 'placacompleta.com.br:443' }))).toBe('/en/sobre')
  })
  it('staging redirects too (to test before production)', () => {
    expect(destinoPorIdioma(pedido({ host: 'staging.placacompleta.com.br' }))).toBe('/en/sobre')
  })
  it('extra hosts come from config', () => {
    expect(destinoPorIdioma(pedido({ host: 'teste.exemplo.com' }), ['teste.exemplo.com'])).toBe('/en/sobre')
  })
})
