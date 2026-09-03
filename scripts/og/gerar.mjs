// Gera as imagens de Open Graph a partir dos templates HTML deste diretorio.
// Rodar: node scripts/og/gerar.mjs
//
// Existe porque as imagens sao copy: quando o preco muda ou uma palavra sai do
// vocabulario do produto (foi o caso de "gratis" e de "leilao" sem "registro"),
// a imagem precisa mudar junto, e refazer no editor a cada vez nao escala.
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const aqui = dirname(fileURLToPath(import.meta.url))
const publico = join(aqui, '..', '..', 'public')

const PAGINAS = [
  { html: 'og-image.html', saida: 'og-image.png' },
  { html: 'og-home.html', saida: 'og-home.png' },
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
for (const { html, saida } of PAGINAS) {
  await page.goto('file://' + join(aqui, html), { waitUntil: 'networkidle' })
  await page.waitForTimeout(600) // as fontes do Google terminam de assentar
  await page.screenshot({ path: join(publico, saida) })
  console.log('gerado', saida)
}
await browser.close()
