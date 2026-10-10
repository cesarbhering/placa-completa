import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { COLUNAS_RODAPE } from '../shared/rodape-links'

const destinos = COLUNAS_RODAPE.flatMap((c) => c.links.map((l) => l.to))
const app = readFileSync('app.vue', 'utf8')

describe('rodape em colunas', () => {
  it('4 colunas na ordem pedida', () => {
    expect(COLUNAS_RODAPE.map((c) => c.titulo)).toEqual(['Consultas', 'Preços e FIPE', 'Aprenda', 'Empresa'])
  })
  it('nenhum link do rodape antigo some (SEO)', () => {
    for (const to of ['/consultar-placa', '/tabela-fipe', '/tabela-fipe-por-placa', '/como-consultar-placa', '/carro-de-leilao/como-saber', '/ibv', '/estudos', '/blog', '/sobre', '/contato']) {
      expect(destinos).toContain(to)
    }
    for (const t of ['/termos-de-uso', '/politica-de-privacidade', 'play.google.com', 'linkedin.com/company/placacompleta', 'x.com/PlacaCompleta', 'tiktok.com/@placacompleta', 'CNPJ 62.569.152/0001-67', '<LogosPagamento']) {
      expect(app).toContain(t)
    }
  })
  it('nunca /premium bare; sem travessao', () => {
    expect(destinos.some((d) => /^\/premium\/?$/.test(d))).toBe(false)
    expect(JSON.stringify(COLUNAS_RODAPE)).not.toContain('—')
  })
  it('sanfona acessivel: details/summary', () => {
    expect(app).toMatch(/<details[^>]*class="footer__col"[\s\S]*<summary/)
  })
})

describe('Termos e Politica sempre visiveis (exigencia do Cesar)', () => {
  it('ficam na barra inferior, fora de qualquer <details>', () => {
    const footer = app.slice(app.indexOf('<footer class="footer">'), app.indexOf('</footer>'))
    const semDetails = footer.replace(/<details[\s\S]*?<\/details>/g, '')
    expect(semDetails).toContain('to="/termos-de-uso"')
    expect(semDetails).toContain('to="/politica-de-privacidade"')
    const base = footer.slice(footer.indexOf('class="footer__base"'))
    expect(base).toContain('to="/termos-de-uso"')
    expect(base).toContain('to="/politica-de-privacidade"')
    expect(base).toContain('CNPJ 62.569.152/0001-67')
    expect(base).not.toContain('<details')
  })
})

// A Cloudflare (Email Obfuscation ligado) reescreve mailto e e-mail em texto
// pra /cdn-cgi/l/email-protection#..., 404 pra crawler. Com isso no rodape,
// TODA pagina tinha um link quebrado (~380 no Ahrefs). Contato e /contato.
describe('rodape sem mailto', () => {
  it('nenhum link do rodape e mailto; Contato aponta pra /contato', async () => {
    const { COLUNAS_RODAPE } = await import('../shared/rodape-links') as any
    const links = (COLUNAS_RODAPE || []).flatMap((c: any) => c.links)
    expect(links.length).toBeGreaterThan(5)
    expect(links.filter((l: any) => /^mailto:/i.test(l.to))).toEqual([])
    expect(links.find((l: any) => l.rotulo === 'Contato')?.to).toBe('/contato')
  })
  it('layout (app.vue) e componentes de cabecalho/rodape sem mailto nem e-mail cru', async () => {
    const { readFileSync, readdirSync } = await import('node:fs')
    const { join } = await import('node:path')
    const raiz = join(__dirname, '..')
    const arquivos = [join(raiz, 'app.vue'), ...readdirSync(join(raiz, 'components')).filter((f) => /header|footer|rodape|cabecalho|nav/i.test(f)).map((f) => join(raiz, 'components', f))]
    for (const a of arquivos) {
      const src = readFileSync(a, 'utf8')
      expect(src, a).not.toMatch(/mailto:/i)
      expect(src, a).not.toMatch(/[a-z0-9._-]+@placacompleta\.com\.br/i)
    }
  })
  it('/contato: e-mail so dentro de email_off (a Cloudflare nao reescreve)', async () => {
    const { emailContatoHtml, EMAIL_CONTATO } = await import('../shared/contato')
    expect(emailContatoHtml.startsWith('<!--email_off-->')).toBe(true)
    expect(emailContatoHtml.endsWith('<!--/email_off-->')).toBe(true)
    expect(emailContatoHtml).toContain(`mailto:${EMAIL_CONTATO}`)
  })
})
