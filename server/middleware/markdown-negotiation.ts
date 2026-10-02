import { pathPermiteMarkdown, prefereMarkdown, htmlParaMarkdown, estimarTokens, SECAO_AGENTES_HOME } from '../utils/markdown-agentes'

// "Markdown for Agents" (checklist isitagentready) feito NA ORIGEM.
//
// - Paginas da lista de permissao (server/utils/markdown-agentes.ts) com
//   Accept PREFERINDO text/markdown: busca o HTML renderizado da propria
//   pagina (fetch interno com Accept text/html, que passa pelo SWR normal) e
//   devolve markdown. Navegador e Accept normal: nada muda.
// - CACHE: este middleware roda ANTES do handler/SWR por path, entao a
//   variante markdown nunca entra no SWR (o SWR so ve e guarda HTML). O
//   markdown tem cache PROPRIO em memoria (host+path, 10 min) e sai com
//   Cache-Control private: nenhum cache compartilhado (Cloudflare incluso)
//   guarda markdown. Vary: Accept nas duas variantes.
// - /premium, /api, /admin, checkout etc. nao estao na lista: ignoram o Accept.

const TTL_MS = 10 * 60 * 1000
const cache = new Map<string, { em: number; md: string }>()

export default defineEventHandler(async (event) => {
  if (getMethod(event) !== 'GET' && getMethod(event) !== 'HEAD') return
  const path = (event.path || '/').split('?')[0] || '/'
  if (!pathPermiteMarkdown(path)) return

  // As duas variantes dizem que dependem do Accept.
  appendResponseHeader(event, 'Vary', 'Accept')

  if (getHeader(event, 'x-pc-md-interno')) return
  if (!prefereMarkdown(getHeader(event, 'accept'))) return

  const host = getRequestHost(event, { xForwardedHost: true }) || 'placacompleta.com.br'
  const chave = `${host}${path}`
  const agora = Date.now()
  let item = cache.get(chave)
  if (!item || agora - item.em >= TTL_MS) {
    let res: any
    try {
      res = await $fetch.raw(path, {
        headers: { accept: 'text/html', host, 'x-forwarded-host': host, 'x-pc-md-interno': '1' },
        responseType: 'text',
        ignoreResponseError: true,
      })
    } catch {
      return // fica com o comportamento normal
    }
    const tipo = String(res.headers.get('content-type') || '')
    if (res.status !== 200 || !tipo.includes('text/html') || typeof res._data !== 'string') return
    let md = htmlParaMarkdown(res._data, `https://${host}${path}`)
    // So na home: links do /llms (o que o resumo antigo da home trazia).
    if (path === '/') md = `${md}\n${SECAO_AGENTES_HOME}`
    item = { em: agora, md }
    cache.set(chave, item)
    if (cache.size > 1000) cache.clear()
  }

  setResponseHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'private, max-age=300')
  setResponseHeader(event, 'x-markdown-tokens', String(estimarTokens(item.md)))
  return item.md
})
