import { describe, it, expect, afterEach, vi } from 'vitest'
import { montarConsulta } from '../../tests/helpers/consulta-harness'

// The caps of the free lookup hold for overlapping requests. The handler
// counts, spends the paid call and writes the row that counts only at the end,
// so every request that passed the check is kept in memory until its row is
// written (server/utils/reserva-teto.ts).
const IP = '203.0.113.10'
const ATRASO = 25 // ms inside the paid call, so the 10 requests really overlap

afterEach(() => { vi.unstubAllGlobals() })

const status = (rs: PromiseSettledResult<any>[]) => rs.map((r) => (r.status === 'fulfilled' ? 200 : (r.reason?.statusCode ?? 'erro')))
const quantos = (lista: any[], valor: any) => lista.filter((v) => v === valor).length

describe('per-IP cap with simultaneous requests', () => {
  it('10 calls at once from one IP with cap 5 spend at most 5 paid calls', async () => {
    const h = await montarConsulta({ atrasoConsultaMs: ATRASO })
    const rs = await Promise.allSettled(Array.from({ length: 10 }, (_, i) =>
      h.chamar({ email: `p${i}@example.com`, placa: `TST0A${String(i).padStart(2, '0')}` }, { ip: IP })))
    const s = status(rs)
    expect(h.estado.consultasPagas).toBe(5)
    expect(quantos(s, 200)).toBe(5)
    expect(quantos(s, 429)).toBe(5)
    expect(h.sb.tab('consultas')).toHaveLength(5)
  })

  it('rows already in the database and requests in flight add up', async () => {
    const h = await montarConsulta({ atrasoConsultaMs: ATRASO })
    h.semear(3, { ip_address: IP, email: 'antes@example.com' })
    const rs = await Promise.allSettled(Array.from({ length: 6 }, (_, i) =>
      h.chamar({ email: `p${i}@example.com`, placa: `TST0A${String(i).padStart(2, '0')}` }, { ip: IP })))
    expect(h.estado.consultasPagas).toBe(2)
    expect(quantos(status(rs), 429)).toBe(4)
  })

  it('other IPs are not affected by the burst', async () => {
    const h = await montarConsulta({ atrasoConsultaMs: ATRASO })
    const rs = await Promise.allSettled([
      ...Array.from({ length: 8 }, (_, i) => h.chamar({ email: `p${i}@example.com`, placa: `TST0A${String(i).padStart(2, '0')}` }, { ip: IP })),
      h.chamar({ email: 'outra@example.com' }, { ip: '198.51.100.20' }),
    ])
    expect(status(rs).at(-1)).toBe(200)
    expect(h.estado.consultasPagas).toBe(6)
  })

  it('one lookup after another is never counted twice: 5 pass, the 6th is blocked', async () => {
    const h = await montarConsulta()
    for (let i = 0; i < 5; i++) {
      const r = await h.tentar({ email: `p${i}@example.com`, placa: `TST0A${String(i).padStart(2, '0')}` }, { ip: IP })
      expect(r.ok, `lookup ${i + 1}`).toBe(true)
    }
    expect((await h.tentar({ email: 'p9@example.com', placa: 'TST0A99' }, { ip: IP })).erro?.statusCode).toBe(429)
    expect(h.estado.consultasPagas).toBe(5)
  })

  it('a request that ends without a paid call gives the slot back at once', async () => {
    const h = await montarConsulta()
    // Same recipient and plate already delivered: the repeated-lookup answer, no paid call, no row.
    h.semear(1, { ip_address: '198.51.100.20', channel: 'email', email: 'pessoa@example.com', email_sent: true })
    for (let i = 0; i < 8; i++) {
      const r = await h.chamar({ channel: 'email', email: 'pessoa@example.com' }, { ip: IP })
      // Answered without a lookup (the earlier one came from another requester, so the text is the neutral one).
      expect(r).toMatchObject({ success: true, emailSent: true, message: 'Consulta realizada! Verifique seu e-mail.' })
      expect(r.basico).toBeUndefined()
    }
    expect(h.estado.consultasPagas).toBe(0)
    expect(h.estado.emails).toHaveLength(0)
    // The IP still has its whole hour.
    for (let i = 0; i < 5; i++) {
      expect((await h.tentar({ email: `p${i}@example.com`, placa: `TST0A${String(i).padStart(2, '0')}` }, { ip: IP })).ok).toBe(true)
    }
  })

  it('a failed plate source still writes its row and still counts', async () => {
    const h = await montarConsulta({ atrasoConsultaMs: ATRASO, veiculo: null })
    const rs = await Promise.allSettled(Array.from({ length: 10 }, (_, i) =>
      h.chamar({ email: `p${i}@example.com`, placa: `TST0A${String(i).padStart(2, '0')}` }, { ip: IP })))
    const s = status(rs)
    expect(quantos(s, 404)).toBe(5)
    expect(quantos(s, 429)).toBe(5)
    expect(h.estado.consultasPagas).toBe(5)
  })
})

describe('per-recipient cap with simultaneous requests', () => {
  it('10 calls at once for one e-mail, each from a different IP, deliver at most 5', async () => {
    const h = await montarConsulta({ atrasoConsultaMs: ATRASO })
    const rs = await Promise.allSettled(Array.from({ length: 10 }, (_, i) =>
      h.chamar({ channel: 'email', email: 'pessoa@example.com', placa: `TST0A${String(i).padStart(2, '0')}` }, { ip: `198.51.100.${i + 1}` })))
    const s = status(rs)
    expect(h.estado.consultasPagas).toBe(5)
    expect(h.estado.emails).toHaveLength(5)
    expect(quantos(s, 429)).toBe(5)
  })
})

describe('e-mail gate with simultaneous requests', () => {
  it('10 calls at once without e-mail from one IP: only the 2 free ones go through', async () => {
    const h = await montarConsulta({ atrasoConsultaMs: ATRASO })
    const rs = await Promise.allSettled(Array.from({ length: 10 }, (_, i) =>
      h.chamar({ placa: `TST0A${String(i).padStart(2, '0')}` }, { ip: IP })))
    const s = status(rs)
    expect(h.estado.consultasPagas).toBe(2)
    expect(quantos(s, 200)).toBe(2)
    expect(quantos(s, 403)).toBe(8)
  })

  it('same device id from rotating IPs: only the 2 free ones go through', async () => {
    const h = await montarConsulta({ atrasoConsultaMs: ATRASO })
    const deviceId = '11111111-2222-4333-8444-555555555555'
    const rs = await Promise.allSettled(Array.from({ length: 6 }, (_, i) =>
      h.chamar({ deviceId, placa: `TST0A${String(i).padStart(2, '0')}` }, { ip: `198.51.100.${i + 1}` })))
    expect(h.estado.consultasPagas).toBe(2)
    expect(quantos(status(rs), 403)).toBe(4)
  })
})

describe('the reservation never gets in the way', () => {
  it('fail open: if the reservation code throws, the lookup goes through', async () => {
    const h = await montarConsulta({
      mocks: {
        '~/server/utils/reserva-teto': (orig) => ({
          ...orig,
          inicioDaContagem: () => { throw new Error('boom') },
          emVooPara: () => { throw new Error('boom') },
          reservar: () => { throw new Error('boom') },
        }),
      },
    })
    expect((await h.tentar({}, { ip: IP })).ok).toBe(true)
    expect((await h.tentar({ channel: 'email', email: 'pessoa@example.com', placa: 'TST0A01' }, { ip: IP })).ok).toBe(true)
    expect(h.estado.consultasPagas).toBe(2)
  })

  it('adds no database query to a normal lookup', async () => {
    const h = await montarConsulta()
    let consultasAoBanco = 0
    const original = h.sb.from
    h.sb.from = ((tabela: string) => { consultasAoBanco++; return original(tabela) }) as any
    await h.chamar({ email: 'pessoa@example.com' }, { ip: IP })
    // Same 6 as before the reservations existed: whitelist read, per-IP cap
    // (2 counts), delivery count by IP, repeated-lookup check, final insert.
    expect(consultasAoBanco).toBe(6)
  })
})
