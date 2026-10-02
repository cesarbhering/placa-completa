import { destinoRedirect } from '../../shared/redirects-antigos'

// 301 permanente dos enderecos antigos (shared/redirects-antigos.ts). So GET e
// HEAD; preserva a query string.
export default defineEventHandler((event) => {
  const m = getMethod(event)
  if (m !== 'GET' && m !== 'HEAD') return
  const url = event.path || '/'
  const destino = destinoRedirect(url)
  if (!destino) return
  const q = url.includes('?') ? url.slice(url.indexOf('?')) : ''
  return sendRedirect(event, destino + q, 301)
})
