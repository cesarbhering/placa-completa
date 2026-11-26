import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PAGINA_CHECKOUT,
  PAGINA_OUTRA,
  PRESENCA_INTERVALO_MS,
  PRESENCA_MIN_ENVIO_MS,
  ROTAS_PRESENCA,
  criarEmissorPresenca,
  idPresencaValido,
  normalizarCaminho,
  novoIdPresenca,
  paginaPresenca,
  type PaginaPresenca,
} from './presenca'

// Made-up values only: nothing here is a real plate or a real order token.
const PLACA = 'ABC1D23'
const TOKEN = 'tok-de-teste-0000'

describe('normalizarCaminho: the page leaves the browser as its route pattern', () => {
  it.each([
    ['/', '/'],
    ['', PAGINA_OUTRA],
    ['/?utm_source=x', '/'],
    ['/#topo', '/'],
    [`/placa/${PLACA}`, '/placa/:placa'],
    [`/placa/${PLACA.toLowerCase()}/`, '/placa/:placa'],
    [`/placa/${PLACA}?utm_source=google&gclid=x#resultado`, '/placa/:placa'],
    ['/premium', '/premium'],
    [`/premium?placa=${PLACA}`, '/premium'],
    [`/premium/${TOKEN}`, '/premium/:token'],
    [`/premium/${TOKEN}?cupom=X`, '/premium/:token'],
    [`/feedback/${TOKEN}`, '/feedback/:token'],
    ['/blog', '/blog'],
    ['/blog/como-evitar-golpe', '/blog/:slug'],
    ['/blog/tag/leilao', '/blog/tag/:tag'],
    ['/carro-de-leilao/como-saber', '/carro-de-leilao/como-saber'],
    ['/carro-de-leilao/gol', '/carro-de-leilao/:slug'],
    ['/consultar-placa', '/consultar-placa'],
    ['/consultar-placa-de-moto', '/consultar-placa-de-:tipo'],
    ['/consultar-placa/bahia', '/consultar-placa/:estado'],
    ['/consultar-placa/capital/salvador', '/consultar-placa/capital/:slug'],
    ['/tabela-fipe-por-placa', '/tabela-fipe-por-placa'],
    ['/tabela-fipe/fiat', '/tabela-fipe/:slug'],
    ['/SOBRE', '/sobre'],
    ['/en', '/'],
    ['/en/sobre', '/sobre'],
    [`/en/placa/${PLACA}`, '/placa/:placa'],
  ])('%s -> %s', (entrada, saida) => {
    expect(normalizarCaminho(entrada)).toBe(saida)
  })

  it.each([
    ['an unknown page', '/wp-admin'],
    ['a dynamic route without its value', '/placa'],
    ['a dynamic route with one segment too many', `/placa/${PLACA}/extra`],
    ['a typed prefix with no value', '/consultar-placa-de-'],
    ['a full URL', `https://example.com/placa/${PLACA}`],
    ['a protocol-relative URL', `//example.com/placa/${PLACA}`],
    ['no leading slash', `placa/${PLACA}`],
    ['a deep path', '/a/b/c/d/e/f'],
    ['a huge path', '/' + 'a'.repeat(400)],
    ['an API route', '/api/presenca'],
  ])('%s is "outra"', (_caso, entrada) => {
    expect(normalizarCaminho(entrada)).toBe(PAGINA_OUTRA)
  })

  it.each([[null], [undefined], [42], [{ path: '/' }], [['/']]])('not a string (%j) is "outra"', (v) => {
    expect(normalizarCaminho(v)).toBe(PAGINA_OUTRA)
  })

  it('is idempotent: every pattern normalizes to itself (the server runs it again)', () => {
    for (const rota of ROTAS_PRESENCA) expect(normalizarCaminho(rota)).toBe(rota)
    expect(normalizarCaminho(PAGINA_OUTRA)).toBe(PAGINA_OUTRA)
  })

  it('never returns anything the visitor typed: only a pattern, "checkout" or "outra"', () => {
    const permitidos = new Set<string>([...ROTAS_PRESENCA, PAGINA_CHECKOUT, PAGINA_OUTRA])
    const valores = [PLACA, TOKEN, 'joao@example.com', '<script>', '..', '%2F', 'x'.repeat(60)]
    for (const base of ['', '/placa', '/premium', '/feedback', '/blog', '/consultar-placa-de', '/en']) {
      for (const v of valores) {
        for (const sufixo of ['', '/', `?q=${v}`, `#${v}`, `/${v}`]) {
          const saida = paginaPresenca(`${base}/${v}${sufixo}`)
          expect(permitidos.has(saida), saida).toBe(true)
          expect(saida).not.toContain(v.toLowerCase())
        }
      }
    }
  })
})

describe('paginaPresenca: what the server accepts as a page', () => {
  it('"checkout" is the one key that is not a path', () => {
    expect(paginaPresenca(PAGINA_CHECKOUT)).toBe(PAGINA_CHECKOUT)
    expect(paginaPresenca('CHECKOUT')).toBe(PAGINA_OUTRA)
    expect(paginaPresenca('/checkout')).toBe(PAGINA_OUTRA)
  })

  it('anything else goes through the normalization again', () => {
    expect(paginaPresenca(`/placa/${PLACA}`)).toBe('/placa/:placa')
    expect(paginaPresenca('/placa/:placa')).toBe('/placa/:placa')
    expect(paginaPresenca(PAGINA_OUTRA)).toBe(PAGINA_OUTRA)
  })
})

describe('tab id', () => {
  it('a new id is 32 hex characters, different each time, and valid', () => {
    const a = novoIdPresenca()
    const b = novoIdPresenca()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(a).not.toBe(b)
    expect(idPresencaValido(a)).toBe(true)
  })

  it.each([[''], ['curto'], ['a'.repeat(65)], ['com espaco 0123456789'], ['<script>alert(1)</script>'], [null], [123]])('%j is not a valid id', (v) => {
    expect(idPresencaValido(v)).toBe(false)
  })
})

// The whitelist has to follow pages/: a page left out counts as "outra" on the TV.
describe('ROTAS_PRESENCA follows pages/', () => {
  const RAIZ = join(__dirname, '..')
  const PAGINAS = join(RAIZ, 'pages')
  // Test screen, not a page for visitors.
  const FORA = new Set(['/woovi-teste'])
  // Registered in app/router.options.ts, not in pages/.
  const EXTRAS = new Set(['/placa/:placa'])

  const arquivos = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? arquivos(join(dir, n)) : [join(dir, n)]))
  const rotaDoArquivo = (arquivo: string) => {
    const partes = relative(PAGINAS, arquivo).replace(/\.vue$/, '').split('/')
    if (partes[partes.length - 1] === 'index') partes.pop()
    return '/' + partes.map((p) => p.replace(/\[(\w+)\]/g, ':$1')).join('/')
  }
  const rotasDasPaginas = arquivos(PAGINAS).filter((f) => f.endsWith('.vue')).map(rotaDoArquivo)

  it('every page is in the list', () => {
    const faltando = rotasDasPaginas.filter((r) => !FORA.has(r) && !(ROTAS_PRESENCA as readonly string[]).includes(r))
    expect(faltando, 'add these to ROTAS_PRESENCA in shared/presenca.ts').toEqual([])
  })

  it('every entry of the list is a page', () => {
    const sobrando = ROTAS_PRESENCA.filter((r) => !EXTRAS.has(r) && !rotasDasPaginas.includes(r))
    expect(sobrando).toEqual([])
  })

  it('the checkout overlay the plugin reads is still .pic-overlay', () => {
    const vue = readFileSync(join(RAIZ, 'components', 'PremiumInlineCheckout.vue'), 'utf8')
    expect(vue).toMatch(/<template>\s*<div class="pic-overlay"/)
  })
})

describe('criarEmissorPresenca: the client schedule', () => {
  let enviados: { id: string; pagina: string }[]
  let pagina: PaginaPresenca
  let visivel: boolean
  const criar = () =>
    criarEmissorPresenca({
      id: 'a'.repeat(32),
      pagina: () => pagina,
      enviar: (corpo) => enviados.push(JSON.parse(corpo)),
      visivel: () => visivel,
    })

  beforeEach(() => {
    vi.useFakeTimers()
    enviados = []
    pagina = '/'
    visivel = true
  })
  afterEach(() => vi.useRealTimers())

  it('sends the id and the page, then every 30 s while visible', () => {
    const e = criar()
    e.cutucar()
    vi.advanceTimersByTime(0)
    expect(enviados).toEqual([{ id: 'a'.repeat(32), pagina: '/' }])
    vi.advanceTimersByTime(PRESENCA_INTERVALO_MS * 3)
    expect(enviados).toHaveLength(4)
  })

  it('a burst of route changes becomes one send with the last page, 10 s after the previous send', () => {
    const e = criar()
    e.cutucar()
    vi.advanceTimersByTime(0)
    pagina = '/placa/:placa'
    e.cutucar()
    vi.advanceTimersByTime(2_000)
    pagina = PAGINA_CHECKOUT
    e.cutucar()
    vi.advanceTimersByTime(PRESENCA_MIN_ENVIO_MS - 2_000 - 1)
    expect(enviados).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(enviados.map((x) => x.pagina)).toEqual(['/', PAGINA_CHECKOUT])
  })

  it('a hidden tab sends nothing, and stops when it goes hidden', () => {
    visivel = false
    const e = criar()
    e.cutucar()
    vi.advanceTimersByTime(PRESENCA_INTERVALO_MS * 2)
    expect(enviados).toHaveLength(0)

    visivel = true
    e.cutucar()
    vi.advanceTimersByTime(0)
    expect(enviados).toHaveLength(1)
    e.parar()
    vi.advanceTimersByTime(PRESENCA_INTERVALO_MS * 4)
    expect(enviados).toHaveLength(1)
  })

  it('a failing send never throws into the page', () => {
    const e = criarEmissorPresenca({
      id: 'a'.repeat(32),
      pagina: () => { throw new Error('boom') },
      enviar: () => { throw new Error('boom') },
      visivel: () => true,
    })
    expect(() => {
      e.cutucar()
      vi.advanceTimersByTime(PRESENCA_INTERVALO_MS * 2)
      e.parar()
    }).not.toThrow()
  })
})
