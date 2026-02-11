import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * SEO and Open Graph Metadata Tests
 * Validates canonical tags, OG metadata, and image specifications
 */

const SITE_URL = 'https://placacompleta.com.br'
const DIST_DIR = path.join(__dirname, '../dist')

// Test pages
const PAGES = [
  { path: '/', name: 'Homepage' },
  { path: '/consulta-placa/', name: 'Consulta Placa' },
  { path: '/como-consultar-placa/', name: 'Como Consultar' },
  { path: '/tabela-fipe/', name: 'Tabela FIPE' },
  { path: '/tabela-fipe-por-placa/', name: 'FIPE por Placa' },
  { path: '/termos-de-uso/', name: 'Termos de Uso' },
  { path: '/politica-de-privacidade/', name: 'Política de Privacidade' },
]

test.describe('SEO Canonical Tags', () => {
  PAGES.forEach(({ path: pagePath, name }) => {
    test(`${name} should have canonical tag`, async () => {
      const htmlPath = path.join(DIST_DIR, pagePath, 'index.html')
      const html = fs.readFileSync(htmlPath, 'utf-8')

      // Check for canonical link
      const canonicalRegex = /<link rel="canonical" href="([^"]+)">/
      const match = html.match(canonicalRegex)

      expect(match).not.toBeNull()
      expect(match![1]).toBe(`${SITE_URL}${pagePath}`)
    })

    test(`${name} should have og:url meta tag`, async () => {
      const htmlPath = path.join(DIST_DIR, pagePath, 'index.html')
      const html = fs.readFileSync(htmlPath, 'utf-8')

      // Check for og:url
      const ogUrlRegex = /<meta property="og:url" content="([^"]+)">/
      const match = html.match(ogUrlRegex)

      expect(match).not.toBeNull()
      expect(match![1]).toBe(`${SITE_URL}${pagePath}`)
    })
  })
})

test.describe('HTML Language Tag', () => {
  test('All pages should have pt-BR language', async () => {
    for (const { path: pagePath, name } of PAGES) {
      const htmlPath = path.join(DIST_DIR, pagePath, 'index.html')
      const html = fs.readFileSync(htmlPath, 'utf-8')

      // Check for lang="pt-BR"
      expect(html).toContain('lang="pt-BR"')
    }
  })
})

test.describe('Open Graph Metadata', () => {
  test('Homepage should have optimized OG title (50-60 chars)', async () => {
    const htmlPath = path.join(DIST_DIR, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')

    const ogTitleRegex = /<meta property="og:title" content="([^"]+)">/
    const match = html.match(ogTitleRegex)

    expect(match).not.toBeNull()
    const title = match![1]

    expect(title.length).toBeGreaterThanOrEqual(50)
    expect(title.length).toBeLessThanOrEqual(60)
  })

  test('Homepage should have optimized OG description (110-160 chars)', async () => {
    const htmlPath = path.join(DIST_DIR, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')

    const ogDescRegex = /<meta property="og:description" content="([^"]+)">/
    const match = html.match(ogDescRegex)

    expect(match).not.toBeNull()
    const description = match![1]

    expect(description.length).toBeGreaterThanOrEqual(110)
    expect(description.length).toBeLessThanOrEqual(160)
  })

  test('Homepage should have OG image with correct URL', async () => {
    const htmlPath = path.join(DIST_DIR, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')

    const ogImageRegex = /<meta property="og:image" content="([^"]+)">/
    const match = html.match(ogImageRegex)

    expect(match).not.toBeNull()
    expect(match![1]).toBe(`${SITE_URL}/og-image.png`)
  })

  test('Homepage should have OG image dimensions', async () => {
    const htmlPath = path.join(DIST_DIR, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')

    // Check width
    expect(html).toContain('<meta property="og:image:width" content="1200">')
    // Check height
    expect(html).toContain('<meta property="og:image:height" content="630">')
  })

  test('Homepage should have OG image alt text', async () => {
    const htmlPath = path.join(DIST_DIR, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')

    const ogImageAltRegex = /<meta property="og:image:alt" content="([^"]+)">/
    const match = html.match(ogImageAltRegex)

    expect(match).not.toBeNull()
    expect(match![1].length).toBeGreaterThan(0)
  })

  test('Homepage should have og:type as website', async () => {
    const htmlPath = path.join(DIST_DIR, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')

    expect(html).toContain('<meta property="og:type" content="website">')
  })

  test('Homepage should have og:locale as pt_BR', async () => {
    const htmlPath = path.join(DIST_DIR, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')

    expect(html).toContain('<meta property="og:locale" content="pt_BR">')
  })

  test('Homepage should have og:site_name', async () => {
    const htmlPath = path.join(DIST_DIR, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')

    const ogSiteNameRegex = /<meta property="og:site_name" content="([^"]+)">/
    const match = html.match(ogSiteNameRegex)

    expect(match).not.toBeNull()
  })
})

test.describe('Twitter Card Metadata', () => {
  test('Homepage should have Twitter card type', async () => {
    const htmlPath = path.join(DIST_DIR, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')

    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
  })

  test('Homepage should have Twitter title', async () => {
    const htmlPath = path.join(DIST_DIR, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')

    const twitterTitleRegex = /<meta name="twitter:title" content="([^"]+)">/
    const match = html.match(twitterTitleRegex)

    expect(match).not.toBeNull()
    expect(match![1].length).toBeGreaterThan(0)
  })

  test('Homepage should have Twitter description', async () => {
    const htmlPath = path.join(DIST_DIR, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')

    const twitterDescRegex = /<meta name="twitter:description" content="([^"]+)">/
    const match = html.match(twitterDescRegex)

    expect(match).not.toBeNull()
    expect(match![1].length).toBeGreaterThan(0)
  })

  test('Homepage should have Twitter image', async () => {
    const htmlPath = path.join(DIST_DIR, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')

    const twitterImageRegex = /<meta name="twitter:image" content="([^"]+)">/
    const match = html.match(twitterImageRegex)

    expect(match).not.toBeNull()
    expect(match![1]).toBe(`${SITE_URL}/og-image.png`)
  })
})

test.describe('Robots Meta Tags', () => {
  test('Homepage should have robots meta with correct directives', async () => {
    const htmlPath = path.join(DIST_DIR, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')

    const robotsRegex = /<meta name="robots" content="([^"]+)">/
    const match = html.match(robotsRegex)

    expect(match).not.toBeNull()
    expect(match![1]).toContain('index')
    expect(match![1]).toContain('follow')
  })
})

test.describe('OG Image File', () => {
  test('og-image.png should exist in public folder', () => {
    const imagePath = path.join(DIST_DIR, 'og-image.png')
    expect(fs.existsSync(imagePath)).toBe(true)
  })

  test('og-image.png should be PNG format', () => {
    const imagePath = path.join(DIST_DIR, 'og-image.png')
    const buffer = fs.readFileSync(imagePath)

    // Check PNG signature
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const fileSignature = buffer.slice(0, 8)

    expect(fileSignature.equals(pngSignature)).toBe(true)
  })

  test('og-image.png should have correct dimensions (1200x630)', () => {
    const imagePath = path.join(DIST_DIR, 'og-image.png')
    const buffer = fs.readFileSync(imagePath)

    // Read PNG IHDR chunk to get dimensions
    // PNG structure: signature (8) + IHDR length (4) + "IHDR" (4) + width (4) + height (4)
    const width = buffer.readUInt32BE(16)
    const height = buffer.readUInt32BE(20)

    expect(width).toBe(1200)
    expect(height).toBe(630)
  })

  test('og-image.png should be under 1MB', () => {
    const imagePath = path.join(DIST_DIR, 'og-image.png')
    const stats = fs.statSync(imagePath)
    const sizeInMB = stats.size / (1024 * 1024)

    expect(sizeInMB).toBeLessThan(1)
  })
})

test.describe('Schema.org Structured Data', () => {
  test('Homepage should have WebApplication schema', async () => {
    const htmlPath = path.join(DIST_DIR, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')

    const schemaRegex = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
    let match
    let foundWebApplication = false

    while ((match = schemaRegex.exec(html)) !== null) {
      const jsonContent = match[1]
      try {
        const schema = JSON.parse(jsonContent)
        if (schema['@type'] === 'WebApplication' ||
            (schema['@graph'] && schema['@graph'].some((item: any) => item['@type'] === 'WebApplication'))) {
          foundWebApplication = true
          break
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }

    expect(foundWebApplication).toBe(true)
  })

  test('Homepage should have WebPage schema', async () => {
    const htmlPath = path.join(DIST_DIR, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf-8')

    const schemaRegex = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
    let match
    let foundWebPage = false

    while ((match = schemaRegex.exec(html)) !== null) {
      const jsonContent = match[1]
      try {
        const schema = JSON.parse(jsonContent)
        if (schema['@graph'] && schema['@graph'].some((item: any) => item['@type'] === 'WebPage')) {
          foundWebPage = true
          break
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }

    expect(foundWebPage).toBe(true)
  })
})
