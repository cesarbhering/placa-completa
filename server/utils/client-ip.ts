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
 * retornados.
 *
 * O valor so e usado depois de passar como IPv4 ou IPv6 (normalizarIp): ele
 * vira chave de teto, entra em filtro de banco e em URL, entao texto que nao e
 * endereco conta como ausente. IPv6 sai sempre na mesma grafia (8 grupos,
 * minusculas, sem zero a esquerda), pra o mesmo endereco comparar igual em
 * todo lugar e o prefixo /64 ser um prefixo do texto.
 *
 * 'unknown' nao pula teto: quem conta por IP usa chaveTetoIp, que poe todo
 * mundo sem endereco conhecido num balde unico.
 */
import type { H3Event } from 'h3'
import { isIP } from 'node:net'

/** O que getClientIp devolve quando nenhum cabecalho traz um endereco publico valido. */
export const IP_DESCONHECIDO = 'unknown'

/** Os 8 grupos de um IPv6 ja validado, ou null. */
function gruposIpv6(v: string): number[] | null {
  let texto = v
  // Final em IPv4 ("::ffff:203.0.113.7"): vira dois grupos.
  const ponto = texto.lastIndexOf(':')
  const cauda = texto.slice(ponto + 1)
  if (cauda.includes('.')) {
    const o = cauda.split('.').map(Number)
    if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
    texto = `${texto.slice(0, ponto + 1)}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`
  }
  const lados = texto.split('::')
  if (lados.length > 2) return null
  const parte = (s: string) => (s ? s.split(':') : [])
  const esquerda = parte(lados[0])
  const direita = lados.length === 2 ? parte(lados[1]) : []
  const faltam = 8 - esquerda.length - direita.length
  if (lados.length === 2 ? faltam < 1 : faltam !== 0) return null
  const todos = [...esquerda, ...Array(lados.length === 2 ? faltam : 0).fill('0'), ...direita]
  const grupos = todos.map((g) => (/^[0-9a-fA-F]{1,4}$/.test(g) ? parseInt(g, 16) : NaN))
  return grupos.length === 8 && grupos.every((n) => Number.isInteger(n)) ? grupos : null
}

/**
 * Endereco valido em grafia unica, ou null quando o valor nao e um endereco.
 * IPv4 como veio; IPv6 com os 8 grupos escritos; IPv4 mapeado em IPv6
 * (::ffff:a.b.c.d) vira o IPv4. Aceita as formas com porta e colchetes que
 * alguns proxies escrevem ("a.b.c.d:porta", "[v6]:porta").
 */
export function normalizarIp(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  let v = valor.trim()
  if (!v || v.length > 60) return null
  const colchetes = /^\[([0-9a-fA-F:.]+)\](?::\d{1,5})?$/.exec(v)
  if (colchetes) v = colchetes[1]
  else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d{1,5}$/.test(v)) v = v.slice(0, v.lastIndexOf(':'))
  // So os caracteres de um endereco: nada de zona (%eth0), espaco, virgula, parentese.
  if (!/^[0-9a-fA-F:.]+$/.test(v)) return null
  const tipo = isIP(v)
  if (tipo === 4) return v
  if (tipo !== 6) return null
  const g = gruposIpv6(v)
  if (!g) return null
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) {
    return `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`
  }
  return g.map((n) => n.toString(16)).join(':')
}

/** Recebe o endereco ja normalizado. */
function isPrivateOrLocal(ip: string): boolean {
  if (!ip.includes(':')) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 || a === 127 || a === 10 ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 169 && b === 254)
    )
  }
  const g = ip.split(':').map((x) => parseInt(x, 16))
  if (g.slice(0, 7).every((n) => n === 0) && (g[7] === 0 || g[7] === 1)) return true   // :: e ::1
  return (
    (g[0] & 0xfe00) === 0xfc00 ||   // IPv6 ULA (fc00::/7) — inclui a rede Docker fd78:...
    (g[0] & 0xffc0) === 0xfe80      // link-local
  )
}

/** Endereco publico valido do valor de um cabecalho, ou null. */
function publico(valor: string | undefined): string | null {
  const ip = normalizarIp(valor)
  return ip && !isPrivateOrLocal(ip) ? ip : null
}

export function getClientIp(event: H3Event): string {
  const headers = getRequestHeaders(event)

  const cfIp = publico(headers['cf-connecting-ip'])
  if (cfIp) return cfIp

  const xff = headers['x-forwarded-for']
  if (xff) {
    for (const part of xff.split(',')) {
      const candidate = publico(part)
      if (candidate) return candidate
    }
  }

  const realIp = publico(headers['x-real-ip'])
  if (realIp) return realIp

  return IP_DESCONHECIDO
}

/** Os 4 primeiros grupos de um IPv6 normalizado ("2001:db8:1:2"), ou null se nao for IPv6. */
function prefixo64(ip: unknown): string | null {
  const n = normalizarIp(ip)
  return n && n.includes(':') ? n.split(':').slice(0, 4).join(':') : null
}

/**
 * Chave de teto do endereco. IPv4: o proprio endereco. IPv6: o prefixo /64
 * (quem recebe um /64 inteiro troca de endereco a vontade dentro dele, entao
 * contar por endereco nao limita nada). Qualquer outra coisa: o balde unico
 * 'unknown', que todo mundo sem endereco conhecido divide.
 */
export function chaveTetoIp(ip: string | null | undefined): string {
  const n = normalizarIp(ip)
  if (!n) return IP_DESCONHECIDO
  const p = prefixo64(n)
  return p ? `${p}::/64` : n
}

/**
 * Filtro de banco para "as linhas deste solicitante" numa coluna de IP: o
 * endereco exato no IPv4, o /64 inteiro no IPv6, e o literal 'unknown' pra
 * todo o resto. O texto de entrada nunca vai cru para o filtro.
 */
export function filtroIp(ip: string | null | undefined): { op: 'eq' | 'like'; valor: string } {
  const p = prefixo64(ip)
  if (p) return { op: 'like', valor: `${p}:%` }
  return { op: 'eq', valor: normalizarIp(ip) ?? IP_DESCONHECIDO }
}

/** Aplica o filtro de `filtroIp` num query builder do Supabase. */
export function filtrarPorIp<Q extends { eq: (c: string, v: string) => any; like: (c: string, v: string) => any }>(
  q: Q, coluna: string, ip: string | null | undefined,
): Q {
  const f = filtroIp(ip)
  return f.op === 'like' ? q.like(coluna, f.valor) : q.eq(coluna, f.valor)
}

/** O mesmo filtro como condicao de um `.or()` do PostgREST (curinga `*`). */
export function condicaoOrIp(coluna: string, ip: string | null | undefined): string {
  const f = filtroIp(ip)
  return f.op === 'like' ? `${coluna}.like.${f.valor.slice(0, -1)}*` : `${coluna}.eq.${f.valor}`
}
