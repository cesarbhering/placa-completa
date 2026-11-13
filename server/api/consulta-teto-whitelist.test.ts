import { describe, it, expect, afterEach, vi } from 'vitest'
import { montarConsulta } from '../../tests/helpers/consulta-harness'

// Two caps on the free lookup, and what an allowlist entry changes in each:
//   per RECIPIENT: default 5/h, or the recipient's own entry (N/h, or no cap).
//   per IP: always on. The `ip:<address>` entry when there is one, else the
//           default; 20/h for a request whose recipient is allowlisted with no
//           cap (raised, never removed).
// A recipient entry only moves the per-recipient cap: typing an allowlisted
// e-mail is not proof of owning it.
const IP = '203.0.113.10'
const OUTRO_IP = '198.51.100.20'
const LIBERADO = 'liberado@example.com'
const COMUM = 'pessoa@example.com'
const FONE_LIBERADO = '5511999990000'

afterEach(() => { vi.unstubAllGlobals() })

describe('no allowlist entry', () => {
  it('the 5th lookup of the hour from an IP passes, the 6th gets 429 and no paid call', async () => {
    const h = await montarConsulta()
    h.semear(4, { ip_address: IP, email: COMUM })
    expect((await h.tentar({ email: COMUM }, { ip: IP })).ok).toBe(true)
    const r = await h.tentar({ email: COMUM }, { ip: IP })
    expect(r.erro?.statusCode).toBe(429)
    expect(r.erro?.message).toContain('limite de 5 consultas')
    expect(h.estado.consultasPagas).toBe(1)
  })

  it('the per-recipient cap blocks an e-mail that already got 5 deliveries, from any IP', async () => {
    const h = await montarConsulta()
    h.semear(5, { ip_address: OUTRO_IP, channel: 'email', email: COMUM, email_sent: true, placa: 'TST0B00' })
    const r = await h.tentar({ channel: 'email', email: COMUM }, { ip: IP })
    expect(r.erro?.statusCode).toBe(429)
    expect(h.sb.tab('blocked_requests').at(-1)?.reason).toBe('rate_limit_recipient')
    expect(h.estado.consultasPagas).toBe(0)
  })
})

describe('recipient allowlisted with no cap', () => {
  const whitelist = [{ recipient: LIBERADO, hourly_limit: null }, { recipient: FONE_LIBERADO, hourly_limit: null }]

  it('has no per-recipient cap', async () => {
    const h = await montarConsulta({ whitelist })
    h.semear(30, { ip_address: OUTRO_IP, channel: 'email', email: LIBERADO, email_sent: true, placa: 'TST0B00' })
    expect((await h.tentar({ channel: 'email', email: LIBERADO }, { ip: IP })).ok).toBe(true)
  })

  it('keeps a per-IP cap, raised to 20/h: the 20th lookup passes, the 21st gets 429', async () => {
    const h = await montarConsulta({ whitelist })
    h.semear(19, { ip_address: IP, channel: 'email', email: LIBERADO, email_sent: true, placa: 'TST0B00' })
    expect((await h.tentar({ channel: 'email', email: LIBERADO }, { ip: IP })).ok).toBe(true)
    const r = await h.tentar({ channel: 'email', email: LIBERADO, placa: 'TST0C00' }, { ip: IP })
    expect(r.erro?.statusCode).toBe(429)
    expect(r.erro?.message).toContain('limite de 20 consultas')
    expect(h.estado.consultasPagas).toBe(1)
  })

  it('the raise is for the request that carries that recipient: another e-mail from the same IP stays at 5', async () => {
    const h = await montarConsulta({ whitelist })
    h.semear(5, { ip_address: IP, channel: 'email', email: LIBERADO, email_sent: true, placa: 'TST0B00' })
    expect((await h.tentar({ channel: 'email', email: COMUM }, { ip: IP })).erro?.statusCode).toBe(429)
    // On screen the e-mail is not a recipient: typing the allowlisted one there changes nothing.
    expect((await h.tentar({ email: LIBERADO }, { ip: IP })).erro?.statusCode).toBe(429)
    expect((await h.tentar({ channel: 'email', email: LIBERADO }, { ip: IP })).ok).toBe(true)
  })

  it('does not skip the e-mail gate (WhatsApp recipient, no e-mail, third lookup of the day)', async () => {
    const h = await montarConsulta({ whitelist, config: { public: { whatsappEnabled: true } } })
    h.semear(2, { ip_address: IP, channel: 'whatsapp', phone: FONE_LIBERADO, whatsapp_sent: true, placa: 'TST0B00' }, 120)
    const r = await h.tentar({ channel: 'whatsapp', phone: '11999990000' }, { ip: IP })
    expect(r.erro?.statusCode).toBe(403)
    expect(r.erro?.data?.code).toBe('email_obrigatorio')
    expect(h.estado.consultasPagas).toBe(0)
  })
})

describe('recipient allowlisted with a number', () => {
  it('moves the per-recipient cap to that number and leaves the per-IP cap at the default', async () => {
    const whitelist = [{ recipient: LIBERADO, hourly_limit: 10 }]
    const h = await montarConsulta({ whitelist })
    h.semear(9, { ip_address: OUTRO_IP, channel: 'email', email: LIBERADO, email_sent: true, placa: 'TST0B00' })
    expect((await h.tentar({ channel: 'email', email: LIBERADO }, { ip: IP })).ok).toBe(true)
    const r = await h.tentar({ channel: 'email', email: LIBERADO, placa: 'TST0C00' }, { ip: IP })
    expect(r.erro?.statusCode).toBe(429)
    expect(r.erro?.message).toContain('limite de 10 consultas')

    const h2 = await montarConsulta({ whitelist })
    h2.semear(5, { ip_address: IP })
    const r2 = await h2.tentar({ channel: 'email', email: LIBERADO }, { ip: IP })
    expect(r2.erro?.statusCode).toBe(429)
    expect(r2.erro?.message).toContain('limite de 5 consultas')
  })
})

describe('IP allowlisted', () => {
  const whitelist = [{ recipient: `ip:${IP}`, hourly_limit: 30 }]

  it('uses the number of its entry as the per-IP cap', async () => {
    const h = await montarConsulta({ whitelist })
    h.semear(29, { ip_address: IP })
    expect((await h.tentar({}, { ip: IP })).ok).toBe(true)
    const r = await h.tentar({}, { ip: IP })
    expect(r.erro?.statusCode).toBe(429)
    expect(r.erro?.message).toContain('limite de 30 consultas')
  })

  it('the number applies in every channel, not only on screen', async () => {
    const h = await montarConsulta({ whitelist })
    for (let i = 0; i < 6; i++) h.semear(1, { ip_address: IP, channel: 'email', email: `p${i}@example.com`, email_sent: true, placa: 'TST0B00' })
    expect((await h.tentar({ channel: 'email', email: COMUM }, { ip: IP })).ok).toBe(true)
  })

  it('does not change the per-recipient cap', async () => {
    const h = await montarConsulta({ whitelist })
    h.semear(5, { ip_address: OUTRO_IP, channel: 'email', email: COMUM, email_sent: true, placa: 'TST0B00' })
    expect((await h.tentar({ channel: 'email', email: COMUM }, { ip: IP })).erro?.statusCode).toBe(429)
  })

  it('stays out of the e-mail gate, as before', async () => {
    const h = await montarConsulta({ whitelist })
    h.semear(10, { ip_address: IP })
    expect((await h.tentar({}, { ip: IP })).ok).toBe(true)
  })

  it('an entry with no number means no per-IP cap for that address', async () => {
    const h = await montarConsulta({ whitelist: [{ recipient: `ip:${IP}`, hourly_limit: null }] })
    h.semear(200, { ip_address: IP })
    expect((await h.tentar({}, { ip: IP })).ok).toBe(true)
    expect((await h.tentar({}, { ip: OUTRO_IP })).ok).toBe(true)
  })
})

describe('authenticated partner', () => {
  it('stays outside both caps and the gate', async () => {
    const h = await montarConsulta({
      mocks: { '~/server/utils/parceiro-chassi': (orig) => ({ ...orig, decidirParceiro: async () => ({ parceiroId: 'parceiro-1' }) }) },
    })
    h.semear(50, { ip_address: IP })
    const r = await h.tentar({}, { ip: IP })
    expect(r.ok).toBe(true)
    expect(r.resposta.parceiro).toBe(true)
  })
})
