/**
 * Extrai o IP real do visitante atras da nossa cadeia de proxies
 * (Cloudflare -> cloudflared tunnel -> Traefik/Coolify -> Nitro).
 *
 * O Traefik nao confia no peer interno (cloudflared) e reescreve o
 * X-Forwarded-For com o IP de socket da rede Docker (fd78:...), entao
 * XFF sozinho e inutil aqui. O header confiavel e o CF-Connecting-IP,
 * setado pela Cloudflare na borda e repassado intacto pelo tunnel.
 *
 * Ordem: cf-connecting-ip -> primeiro IP publico do x-forwarded-for ->
 * x-real-ip (se publico) -> 'unknown'. Enderecos privados/ULA nunca sao
 * retornados: melhor 'unknown' (rate limit por IP vira no-op pra essa
 * request) do que agrupar todos os usuarios num bucket so.
 */
import type { H3Event } from 'h3'

function isPrivateOrLocal(ip: string): boolean {
  const v = ip.toLowerCase()
  return (
    v === '127.0.0.1' || v === '::1' || v === 'unknown' || v === '' ||
    v.startsWith('10.') ||
    v.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v) ||
    v.startsWith('fd') || v.startsWith('fc') ||   // IPv6 ULA (fc00::/7) — inclui a rede Docker fd78:...
    v.startsWith('fe80') ||                       // link-local
    v.startsWith('169.254.')
  )
}

export function getClientIp(event: H3Event): string {
  const headers = getRequestHeaders(event)

  const cfIp = headers['cf-connecting-ip']?.trim()
  if (cfIp && !isPrivateOrLocal(cfIp)) return cfIp

  const xff = headers['x-forwarded-for']
  if (xff) {
    for (const part of xff.split(',')) {
      const candidate = part.trim()
      if (candidate && !isPrivateOrLocal(candidate)) return candidate
    }
  }

  const realIp = headers['x-real-ip']?.trim()
  if (realIp && !isPrivateOrLocal(realIp)) return realIp

  return 'unknown'
}
