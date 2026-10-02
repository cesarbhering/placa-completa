// 301 dos enderecos antigos que hoje dao 404 (plano SEO 02/out, item #4).
// Lista explicita do que o GSC mostrou + regra generica com checagem de
// existencia, pra nao redirecionar pra uma pagina que tambem nao existe.
import { fipeBrands, findBrandModel } from '../data/fipe-brands'

export const REDIRECTS_FIXOS: Record<string, string> = {
  '/tabela-fiat-siena': '/tabela-fipe/fiat-siena',
  '/tabela-fiorino': '/tabela-fipe/fiat-fiorino',
  '/tabela-fipe-honda-motos-nxr-160-bros': '/tabela-fipe/honda-motos-nxr-160-bros',
  '/tabela-fipe-honda-xre-300': '/tabela-fipe/honda-motos-xre-300',
  '/tabela-fipe/motos/honda-motos-biz': '/tabela-fipe/honda-motos-biz',
  '/consultar-bahia': '/consultar-placa/bahia',
  '/consultar-parana': '/consultar-placa/parana',
  '/consultar-rio-de-janeiro': '/consultar-placa/rio-de-janeiro',
  '/consultar-mato-grosso-do-sul': '/consultar-placa/mato-grosso-do-sul',
  '/consultar-salvador': '/consultar-placa/capital/salvador',
  '/consultar-onibus': '/consultar-placa-de-onibus',
  '/consultar-onibus-gratis-dados-completos-por-e-mail': '/consultar-placa-de-onibus',
  '/consultar-placacompleta.com.br/consultar-placa-de-onibus': '/consultar-placa-de-onibus',
  '/consultar-pelo-celular': '/',
  '/pt-br': '/',
}

const existeFipe = (slug: string) => !!findBrandModel(slug) || !!(fipeBrands as Record<string, unknown>)[slug]

/** Destino do 301, ou null (segue o fluxo normal). Ignora query e barra final. */
export function destinoRedirect(pathBruto: string): string | null {
  const path = (pathBruto.split('?')[0] || '/').replace(/\/+$/, '').toLowerCase() || '/'
  if (REDIRECTS_FIXOS[path]) return REDIRECTS_FIXOS[path]

  // /tabela-fipe/<marca>/<modelo> -> /tabela-fipe/<marca>-<modelo>
  const m2 = path.match(/^\/tabela-fipe\/([a-z0-9-]+)\/([a-z0-9-]+)$/)
  if (m2) {
    for (const slug of [`${m2[1]}-${m2[2]}`, m2[2]]) if (existeFipe(slug)) return `/tabela-fipe/${slug}`
    return null
  }

  // /<marca>-<modelo> -> /tabela-fipe/<marca>-<modelo> (so 1 segmento, so se a pagina existe)
  const m1 = path.match(/^\/([a-z0-9-]+)$/)
  if (m1 && findBrandModel(m1[1])) return `/tabela-fipe/${m1[1]}`
  return null
}
