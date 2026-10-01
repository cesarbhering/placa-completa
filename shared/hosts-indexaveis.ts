// Os UNICOS hosts indexaveis (pedido do Cesar, 01/out): o dominio principal e
// o www. Qualquer outro host (app., homolog., staging., IP, dominio interno)
// responde noindex (server/plugins/nao-indexar-ambiente-protegido.ts).
const HOSTS_PRINCIPAIS = new Set(['placacompleta.com.br', 'www.placacompleta.com.br'])

/** Host da requisicao (o tunel do Cloudflare repassa o Host original), sem porta nem ponto final. */
export function hostIndexavel(host: string | null | undefined): boolean {
  const h = String(host || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
  return HOSTS_PRINCIPAIS.has(h)
}
