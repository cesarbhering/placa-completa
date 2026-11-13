import { describe, it, expect, vi, afterEach } from 'vitest'
import { getClientIp, normalizarIp, chaveTetoIp, filtroIp, condicaoOrIp, filtrarPorIp, IP_DESCONHECIDO } from './client-ip'

// The client address is read from request headers, then used as a cap key, in
// database filters and in URLs. It is only ever used after it parses as an
// IPv4 or IPv6 address; anything else counts as "unknown".
// Addresses below are from the documentation ranges.
function evento(headers: Record<string, string>) {
  vi.stubGlobal('getRequestHeaders', () => headers)
  return {} as any
}
afterEach(() => vi.unstubAllGlobals())

describe('normalizarIp', () => {
  it('accepts IPv4 as written', () => {
    expect(normalizarIp('203.0.113.7')).toBe('203.0.113.7')
    expect(normalizarIp(' 198.51.100.20 ')).toBe('198.51.100.20')
  })

  it('writes IPv6 with its 8 groups, lower case, no leading zeros', () => {
    expect(normalizarIp('2001:db8:1:2:a:b:c:d')).toBe('2001:db8:1:2:a:b:c:d')
    expect(normalizarIp('2001:DB8::1')).toBe('2001:db8:0:0:0:0:0:1')
    expect(normalizarIp('2001:0db8:0001:0002:0000:0000:0000:0001')).toBe('2001:db8:1:2:0:0:0:1')
    expect(normalizarIp('2001:db8::')).toBe('2001:db8:0:0:0:0:0:0')
  })

  it('reads the port and bracket forms some proxies write', () => {
    expect(normalizarIp('203.0.113.7:51234')).toBe('203.0.113.7')
    expect(normalizarIp('[2001:db8::1]')).toBe('2001:db8:0:0:0:0:0:1')
    expect(normalizarIp('[2001:db8::1]:443')).toBe('2001:db8:0:0:0:0:0:1')
  })

  it('an IPv4-mapped IPv6 address is the IPv4 address', () => {
    expect(normalizarIp('::ffff:203.0.113.7')).toBe('203.0.113.7')
    expect(normalizarIp('::ffff:cb00:7107')).toBe('203.0.113.7')
  })

  it('rejects everything that is not an address', () => {
    const ruins: unknown[] = [
      '', ' ', 'unknown', 'localhost', '203.0.113', '203.0.113.7.1', '256.0.0.1', '01.2.3.4', '1.2.3.4/24',
      '203.0.113.7,ip_address.not.is.null', '203.0.113.7)', '203.0.113.7 or 1=1', '"203.0.113.7"', '203.0.113.7%',
      'fe80::1%eth0', '2001:db8::1%25', '2001:db8:::1', '2001:db8::g', ':', '::ffff:999.1.1.1', '[203.0.113.7]x',
      'x'.repeat(200), '2001:db8::1' + ':1'.repeat(40), null, undefined, 42, {}, ['203.0.113.7'],
    ]
    for (const v of ruins) expect(normalizarIp(v), JSON.stringify(v)).toBeNull()
  })
})

describe('getClientIp', () => {
  it('keeps the header order: edge header, then the first public forwarded address, then x-real-ip', () => {
    expect(getClientIp(evento({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.20', 'x-real-ip': '192.0.2.9' }))).toBe('203.0.113.7')
    expect(getClientIp(evento({ 'x-forwarded-for': '10.0.0.1, 198.51.100.20, 192.0.2.9', 'x-real-ip': '192.0.2.9' }))).toBe('198.51.100.20')
    expect(getClientIp(evento({ 'x-forwarded-for': 'fd78:1234::1', 'x-real-ip': '192.0.2.9' }))).toBe('192.0.2.9')
    expect(getClientIp(evento({}))).toBe('unknown')
  })

  it('a value that is not an address is skipped, never returned', () => {
    expect(getClientIp(evento({ 'cf-connecting-ip': '203.0.113.7,ip_address.not.is.null' }))).toBe('unknown')
    expect(getClientIp(evento({ 'cf-connecting-ip': 'x)', 'x-forwarded-for': 'drop table, 198.51.100.20' }))).toBe('198.51.100.20')
    expect(getClientIp(evento({ 'x-forwarded-for': '<script>', 'x-real-ip': 'http://example.test/' }))).toBe('unknown')
  })

  it('private, loopback and link-local addresses are never returned, in any spelling', () => {
    for (const ip of ['127.0.0.1', '127.9.9.9', '10.1.2.3', '192.168.0.1', '172.16.0.1', '172.31.255.1', '169.254.1.1', '0.0.0.0',
      '::1', '0:0:0:0:0:0:0:1', '::', 'fd78:1234::1', 'FC00::1', 'fe80::1', '::ffff:10.0.0.1', '::ffff:127.0.0.1']) {
      expect(getClientIp(evento({ 'cf-connecting-ip': ip })), ip).toBe('unknown')
    }
    expect(getClientIp(evento({ 'cf-connecting-ip': '172.32.0.1' }))).toBe('172.32.0.1')
  })

  it('returns IPv6 in the canonical spelling, so the same address always compares equal', () => {
    const a = getClientIp(evento({ 'cf-connecting-ip': '2001:DB8:0:0:0:0:0:1' }))
    const b = getClientIp(evento({ 'cf-connecting-ip': '2001:db8::1' }))
    expect(a).toBe('2001:db8:0:0:0:0:0:1')
    expect(b).toBe(a)
  })
})

describe('chaveTetoIp: the key the caps count by', () => {
  it('an IPv4 address is its own key', () => {
    expect(chaveTetoIp('203.0.113.7')).toBe('203.0.113.7')
  })

  it('IPv6 addresses of the same /64 share one key', () => {
    const a = chaveTetoIp('2001:db8:1:2:a:b:c:d')
    expect(a).toBe('2001:db8:1:2::/64')
    expect(chaveTetoIp('2001:db8:1:2::1')).toBe(a)
    expect(chaveTetoIp('2001:0DB8:0001:0002:ffff:ffff:ffff:ffff')).toBe(a)
    expect(chaveTetoIp('2001:db8:1:3::1')).not.toBe(a)
    expect(chaveTetoIp('2001:db8::1')).toBe('2001:db8:0:0::/64')
  })

  it('anything that is not an address falls in the single "unknown" bucket', () => {
    for (const v of ['unknown', '', null, undefined, 'x,y', '203.0.113.7)']) expect(chaveTetoIp(v as any)).toBe(IP_DESCONHECIDO)
    expect(IP_DESCONHECIDO).toBe('unknown')
  })
})

describe('database filters by address', () => {
  it('IPv4: equality on the address', () => {
    expect(filtroIp('203.0.113.7')).toEqual({ op: 'eq', valor: '203.0.113.7' })
    expect(condicaoOrIp('ip_address', '203.0.113.7')).toBe('ip_address.eq.203.0.113.7')
  })

  it('IPv6: every address of the /64', () => {
    expect(filtroIp('2001:db8:1:2:a:b:c:d')).toEqual({ op: 'like', valor: '2001:db8:1:2:%' })
    expect(condicaoOrIp('ip_address', '2001:db8:1:2::9')).toBe('ip_address.like.2001:db8:1:2:*')
  })

  it('a value that is not an address never reaches the filter text', () => {
    for (const v of ['203.0.113.7,email.not.is.null', 'x)', '%', '*', 'unknown', '']) {
      expect(filtroIp(v)).toEqual({ op: 'eq', valor: 'unknown' })
      expect(condicaoOrIp('ip_address', v)).toBe('ip_address.eq.unknown')
    }
  })

  it('filtrarPorIp applies the right operator to a query builder', () => {
    const chamadas: any[] = []
    const q = { eq: (c: string, v: string) => { chamadas.push(['eq', c, v]); return q }, like: (c: string, v: string) => { chamadas.push(['like', c, v]); return q } }
    filtrarPorIp(q, 'ip_address', '203.0.113.7')
    filtrarPorIp(q, 'ip_address', '2001:db8:1:2::9')
    expect(chamadas).toEqual([['eq', 'ip_address', '203.0.113.7'], ['like', 'ip_address', '2001:db8:1:2:%']])
  })
})
