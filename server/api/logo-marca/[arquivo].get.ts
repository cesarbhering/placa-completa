import { arquivoLogoValido, urlOrigemLogo } from '../../utils/logo-marca'

// Proxy do logo de montadora da apiplacas (ver server/utils/logo-marca.ts).
// So serve PNG de https://apiplacas.com.br/logos/logosMarcas/<arquivo>, com
// cache em memoria (acerto 7 dias, falha 1 hora) e cache longo no navegador.
// Falhou: 404, e a tela cai no monograma (nunca imagem quebrada).

const MAX_BYTES = 300 * 1024
const TTL_OK = 7 * 24 * 60 * 60 * 1000
const TTL_FALHA = 60 * 60 * 1000
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const cache = new Map<string, { em: number; png: Buffer | null }>()

async function baixar(arquivo: string): Promise<Buffer | null> {
  try {
    const r = await fetch(urlOrigemLogo(arquivo), { redirect: 'error', signal: AbortSignal.timeout(5000) })
    if (r.status !== 200 || !String(r.headers.get('content-type') || '').startsWith('image/png')) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > MAX_BYTES || !PNG.every((b, i) => buf[i] === b)) return null
    return buf
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const arquivo = String(getRouterParam(event, 'arquivo') || '').toLowerCase()
  if (!arquivoLogoValido(arquivo)) throw createError({ statusCode: 404 })

  const agora = Date.now()
  let item = cache.get(arquivo)
  if (!item || agora - item.em >= (item.png ? TTL_OK : TTL_FALHA)) {
    item = { em: agora, png: await baixar(arquivo) }
    cache.set(arquivo, item)
    if (cache.size > 500) cache.clear()
  }
  if (!item.png) throw createError({ statusCode: 404 })

  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=604800')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  return item.png
})
