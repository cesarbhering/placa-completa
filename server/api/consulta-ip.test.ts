import { describe, it, expect, afterEach, vi } from 'vitest'
import { montarConsulta } from '../../tests/helpers/consulta-harness'
import { montarSinais } from '../../tests/helpers/sinais-harness'

// How the caps of the free lookup and of the signal routes treat the client
// address: IPv6 counts by /64, and a request with no known address shares one
// conservative bucket instead of skipping the cap.
// Addresses are from the documentation ranges (2001:db8::/32, 203.0.113.0/24).
const v6 = (rede: string, host: number) => `2001:db8:${rede}:${host.toString(16)}:1:2:${(host + 7).toString(16)}`
const placa = (i: number) => `TST0A${String(i).padStart(2, '0')}`

afterEach(() => { vi.unstubAllGlobals() })

describe('free lookup: IPv6 counts by /64', () => {
  it('5 lookups from 5 addresses of one /64 use up the hour for the whole /64', async () => {
    const h = await montarConsulta()
    for (let i = 0; i < 5; i++) {
      expect((await h.tentar({ email: `p${i}@example.com`, placa: placa(i) }, { ip: v6('aa:bb', i + 1) })).ok, `lookup ${i + 1}`).toBe(true)
    }
    const r = await h.tentar({ email: 'p9@example.com', placa: placa(9) }, { ip: v6('aa:bb', 99) })
    expect(r.erro?.statusCode).toBe(429)
    expect(h.estado.consultasPagas).toBe(5)
  })

  it('another /64 has its own hour', async () => {
    const h = await montarConsulta()
    for (let i = 0; i < 5; i++) await h.chamar({ email: `p${i}@example.com`, placa: placa(i) }, { ip: v6('aa:bb', i + 1) })
    expect((await h.tentar({ email: 'p9@example.com', placa: placa(9) }, { ip: v6('aa:cc', 1) })).ok).toBe(true)
  })

  it('the e-mail gate also counts the /64: third lookup without e-mail from a third address asks for it', async () => {
    const h = await montarConsulta()
    expect((await h.tentar({ placa: placa(1) }, { ip: v6('aa:bb', 1) })).ok).toBe(true)
    expect((await h.tentar({ placa: placa(2) }, { ip: v6('aa:bb', 2) })).ok).toBe(true)
    const r = await h.tentar({ placa: placa(3) }, { ip: v6('aa:bb', 3) })
    expect(r.erro?.statusCode).toBe(403)
    expect(r.erro?.data?.code).toBe('email_obrigatorio')
  })

  it('the address is stored in one spelling, whatever spelling the header used', async () => {
    const h = await montarConsulta()
    await h.chamar({ email: 'p@example.com' }, { ip: '2001:DB8:AA:BB::1' })
    expect(h.sb.tab('consultas')[0].ip_address).toBe('2001:db8:aa:bb:0:0:0:1')
  })

  it('an allowlist entry written for an IPv6 address raises the cap of its /64', async () => {
    const h = await montarConsulta({ whitelist: [{ recipient: 'ip:2001:DB8:AA:BB::1', hourly_limit: 30 }] })
    h.semear(10, { ip_address: '2001:db8:aa:bb:0:0:0:1' })
    expect((await h.tentar({ email: 'p@example.com' }, { ip: '2001:db8:aa:bb::1' })).ok).toBe(true)
  })

  it('IPv4 keeps counting by the exact address', async () => {
    const h = await montarConsulta()
    for (let i = 0; i < 5; i++) await h.chamar({ email: `p${i}@example.com`, placa: placa(i) }, { ip: '203.0.113.10' })
    expect((await h.tentar({ email: 'p9@example.com', placa: placa(9) }, { ip: '203.0.113.10' })).erro?.statusCode).toBe(429)
    expect((await h.tentar({ email: 'p9@example.com', placa: placa(9) }, { ip: '203.0.113.11' })).ok).toBe(true)
    expect((await h.tentar({ email: 'p8@example.com', placa: placa(8) }, { ip: '203.0.113.1' })).ok).toBe(true)
  })
})

describe('free lookup: no known address', () => {
  it('shares one bucket with the default cap instead of having no cap', async () => {
    const h = await montarConsulta()
    for (let i = 0; i < 5; i++) {
      expect((await h.tentar({ email: `p${i}@example.com`, placa: placa(i) }, { ip: null })).ok, `lookup ${i + 1}`).toBe(true)
    }
    const r = await h.tentar({ email: 'p9@example.com', placa: placa(9) }, { ip: null })
    expect(r.erro?.statusCode).toBe(429)
    expect(h.estado.consultasPagas).toBe(5)
    expect(h.sb.tab('consultas').every((l) => l.ip_address === 'unknown')).toBe(true)
  })

  it('a header that is not an address is the same as no header', async () => {
    const h = await montarConsulta()
    h.semear(5, { ip_address: 'unknown' })
    const r = await h.tentar({ email: 'p@example.com' }, { ip: null, cabecalhos: { 'cf-connecting-ip': '203.0.113.10,email.not.is.null', 'x-forwarded-for': 'x)' } })
    expect(r.erro?.statusCode).toBe(429)
  })

  it('the e-mail gate applies to the bucket too', async () => {
    const h = await montarConsulta()
    expect((await h.tentar({ placa: placa(1) }, { ip: null })).ok).toBe(true)
    expect((await h.tentar({ placa: placa(2) }, { ip: null })).ok).toBe(true)
    expect((await h.tentar({ placa: placa(3) }, { ip: null })).erro?.data?.code).toBe('email_obrigatorio')
  })

  it('10 at once with no known address: 5 paid calls', async () => {
    const h = await montarConsulta({ atrasoConsultaMs: 20 })
    await Promise.allSettled(Array.from({ length: 10 }, (_, i) => h.chamar({ email: `p${i}@example.com`, placa: placa(i) }, { ip: null })))
    expect(h.estado.consultasPagas).toBe(5)
  })

  it('visitors with a known address are not affected by the bucket', async () => {
    const h = await montarConsulta()
    h.semear(50, { ip_address: 'unknown' })
    expect((await h.tentar({ email: 'p@example.com' }, { ip: '203.0.113.10' })).ok).toBe(true)
  })

  it('an `ip:unknown` allowlist entry sets the size of the bucket', async () => {
    const h = await montarConsulta({ whitelist: [{ recipient: 'ip:unknown', hourly_limit: 40 }] })
    h.semear(20, { ip_address: 'unknown' })
    expect((await h.tentar({ email: 'p@example.com' }, { ip: null })).ok).toBe(true)
  })

  it('homolog still has no hourly cap', async () => {
    const h = await montarConsulta({ config: { public: { homolog: true } } })
    h.semear(50, { ip_address: 'unknown' })
    expect((await h.tentar({ email: 'p@example.com' }, { ip: null })).ok).toBe(true)
  })
})

describe('signal routes: the same treatment of the address', () => {
  const PLACA = 'TST1A23'
  const ate = async (n: number, fn: (i: number) => Promise<any>) => { const rs = []; for (let i = 0; i < n; i++) rs.push(await fn(i)); return rs }

  it('IPv6: the 60 per hour are per /64, not per address', async () => {
    const h = await montarSinais()
    await ate(60, (i) => h.leilao({ placa: PLACA }, { ip: v6('aa:bb', i + 1) }))
    expect(await h.leilao({ placa: PLACA }, { ip: v6('aa:bb', 500) })).toEqual({ positivo: null, quantidade: 0 })
    expect(await h.leilao({ placa: PLACA }, { ip: v6('aa:cc', 1) })).toMatchObject({ positivo: true })
  })

  it('no known address: one shared window of 60 per hour for each signal', async () => {
    const h = await montarSinais()
    const rs = await ate(61, () => h.leilao({ placa: PLACA }, { ip: null }))
    expect(rs.slice(0, 60).every((r) => r.positivo === true)).toBe(true)
    expect(rs[60]).toEqual({ positivo: null, quantidade: 0 })
    // The recall signal has its own window, and a known address is not affected.
    expect(await h.recall({ placa: PLACA, marca: 'TOYOTA' }, { ip: null })).toMatchObject({ consta: true })
    expect(await h.leilao({ placa: PLACA }, { ip: '203.0.113.10' })).toMatchObject({ positivo: true })
  })
})
