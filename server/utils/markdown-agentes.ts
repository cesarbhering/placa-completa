import { NodeHtmlMarkdown } from 'node-html-markdown'

// "Markdown for Agents" NA ORIGEM (a zona Cloudflare e Free; o conversor deles
// e Pro). Paginas publicas indexaveis, pedidas com Accept preferindo
// text/markdown, saem como markdown do HTML renderizado. Regras e cache no
// server/middleware/markdown-negotiation.ts.

/**
 * Lista de PERMISSAO de paths (nunca de bloqueio): o que nao casa aqui ignora
 * o Accept. /premium, /api, /admin, /dash, checkout e qualquer pagina com dado
 * de cliente ficam de fora por nao estarem na lista.
 */
const PERMITIDOS: RegExp[] = [
  /^\/$/,
  /^\/consulta-placa$/,
  /^\/consulta-gratis$/,
  /^\/como-consultar-placa$/,
  /^\/tabela-fipe-por-placa$/,
  /^\/tabela-fipe(?:\/[a-z0-9-]+)?$/,
  /^\/consultar-placa(?:\/[a-z0-9-]+|\/capital\/[a-z0-9-]+)?$/,
  /^\/consultar-placa-de-[a-z0-9-]+$/,
  /^\/carro-de-leilao(?:\/[a-z0-9-]+)?$/,
  /^\/seguro\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/,
  /^\/ibv(?:\/[a-z0-9-]+)?$/,
  /^\/estudos$/,
  /^\/o-que-e(?:\/[a-z0-9-]+)?$/,
  /^\/(?:laudo-cautelar|historico-veicular|consulta-veicular-completa|consulta-leilao-veiculo)$/,
  /^\/sobre$/,
  /^\/politica-de-privacidade$/,
  /^\/termos-de-uso$/,
]
const NUNCA = /^\/(?:premium|api|admin|dash|checkout|feedback|_nuxt|__nuxt)(?:\/|$)/

export function pathPermiteMarkdown(path: string): boolean {
  const p = (path.split('?')[0] || '/').replace(/\/+$/, '') || '/'
  if (NUNCA.test(p)) return false
  return PERMITIDOS.some((r) => r.test(p))
}

/** q de cada tipo do Accept (sem parametro q = 1). */
function qualidades(accept: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const parte of accept.split(',')) {
    const [tipo, ...params] = parte.split(';').map((s) => s.trim().toLowerCase())
    if (!tipo) continue
    let q = 1
    for (const p of params) if (p.startsWith('q=')) q = Number(p.slice(2))
    if (!Number.isFinite(q)) q = 0
    m.set(tipo, Math.max(m.get(tipo) ?? 0, q))
  }
  return m
}

/**
 * Markdown so quando o cliente PREFERE: text/markdown com q maior que o de
 * text/html (ausente = 0). Empate decide pela ordem (markdown antes). Accept
 * de navegador (text/html,...,*\/*;q=0.8) nunca dispara.
 */
export function prefereMarkdown(accept: string | undefined | null): boolean {
  if (!accept) return false
  const q = qualidades(accept)
  const md = q.get('text/markdown') ?? 0
  if (md <= 0) return false
  const html = q.get('text/html') ?? 0
  if (md !== html) return md > html
  return accept.toLowerCase().indexOf('text/markdown') < accept.toLowerCase().indexOf('text/html')
}

const nhm = new NodeHtmlMarkdown(
  { ignore: ['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header', 'form', 'button', 'iframe', 'template', 'dialog'], maxConsecutiveNewlines: 2 },
)

/** HTML renderizado -> markdown do conteudo principal (main, senao body). */
export function htmlParaMarkdown(html: string, url: string): string {
  const titulo = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim()
  const descricao = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] || ''
  const corpo = html.match(/<main[\s\S]*<\/main>/i)?.[0]
    || html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1]
    || html
  let md = nhm.translate(corpo).replace(/\n{3,}/g, '\n\n').replace(/^[ \t]+/gm, '').trim()
  // H1 primeiro (o da pagina, senao o <title>), depois descricao e fonte.
  let h1 = titulo ? `# ${decodificar(titulo)}` : ''
  if (md.startsWith('# ')) {
    const fim = md.indexOf('\n')
    h1 = fim === -1 ? md : md.slice(0, fim)
    md = fim === -1 ? '' : md.slice(fim + 1).trim()
  }
  const cab = [h1, descricao ? `> ${decodificar(descricao)}` : '', `Fonte: ${url}`].filter(Boolean).join('\n\n')
  return `${cab}\n\n${md}\n`
}

function decodificar(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

export function estimarTokens(md: string): number {
  return Math.ceil(md.length / 4)
}

/** So na HOME: o que o resumo antigo dizia aos agentes (mesmo conteudo do /llms.txt). */
export const SECAO_AGENTES_HOME = `## Para agentes de IA

Consulta direta, sem navegar a interface:

- Texto: https://placacompleta.com.br/llms?query=SUA_PERGUNTA
- JSON: https://placacompleta.com.br/llms/json?query=SUA_PERGUNTA
- Guia completo: https://placacompleta.com.br/llms.txt

Exemplos:

- https://placacompleta.com.br/llms?query=valor%20fipe%20do%20gol%202018
- https://placacompleta.com.br/llms?query=seguro%20medio%20no%20rio%20de%20janeiro
`
