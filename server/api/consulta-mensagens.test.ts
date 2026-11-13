import { describe, it, expect, afterEach, vi } from 'vitest'
import { montarConsulta, UA_NAVEGADOR } from '../../tests/helpers/consulta-harness'
import { mensagemLimiteGratis, mensagemLimiteNeutra } from '../utils/ip-wdapi-limit'

// Two answers of the free lookup talk about what a RECIPIENT did before: the
// repeated-lookup message and the per-recipient 429. They keep their detail
// for the requester that made those lookups (same IP key or same device) and
// are neutral for anyone else who types that e-mail or phone.
const IP = '203.0.113.10'
const OUTRO_IP = '198.51.100.20'
const EMAIL = 'pessoa@example.com'
const DEVICE = '11111111-2222-4333-8444-555555555555'
const OUTRO_DEVICE = '99999999-2222-4333-8444-555555555555'

afterEach(() => { vi.unstubAllGlobals() })

describe('repeated lookup (same recipient and plate within the hour)', () => {
  const anterior = (extra: Record<string, any> = {}) => ({ channel: 'email', email: EMAIL, email_sent: true, ip_address: IP, device_id: DEVICE, ...extra })

  it('same IP: says when it was sent and where, as before', async () => {
    const h = await montarConsulta()
    h.semear(1, anterior(), 12)
    const r = await h.chamar({ channel: 'email', email: EMAIL }, { ip: IP })
    expect(r).toMatchObject({ success: true, emailSent: true, whatsappSent: false, channel: 'email' })
    expect(r.message).toBe(`Você já consultou essa placa há 12 min. O resultado foi enviado para ${EMAIL}: verifique seu histórico.`)
    expect(h.estado.consultasPagas).toBe(0)
    expect(h.estado.emails).toHaveLength(0)
  })

  it('same device from another IP: same detailed message', async () => {
    const h = await montarConsulta()
    h.semear(1, anterior(), 12)
    const r = await h.chamar({ channel: 'email', email: EMAIL, deviceId: DEVICE }, { ip: OUTRO_IP })
    expect(r.message).toContain('Você já consultou essa placa há 12 min')
  })

  it('same /64 on IPv6 counts as the same requester', async () => {
    const h = await montarConsulta()
    h.semear(1, anterior({ ip_address: '2001:db8:aa:bb:0:0:0:1', device_id: null }), 12)
    const r = await h.chamar({ channel: 'email', email: EMAIL }, { ip: '2001:db8:aa:bb::99' })
    expect(r.message).toContain('Você já consultou essa placa')
  })

  it('another IP and another device: neutral answer, nothing about the earlier lookup', async () => {
    const h = await montarConsulta()
    h.semear(1, anterior(), 12)
    const r = await h.chamar({ channel: 'email', email: EMAIL, deviceId: OUTRO_DEVICE }, { ip: OUTRO_IP })
    expect(r).toMatchObject({ success: true, emailSent: true, whatsappSent: false, channel: 'email' })
    expect(r.message).toBe('Consulta realizada! Verifique seu e-mail.')
    expect(r.message).not.toContain(EMAIL)
    expect(r.message).not.toMatch(/\d/)
    // Still no second paid call and no second e-mail.
    expect(h.estado.consultasPagas).toBe(0)
    expect(h.estado.emails).toHaveLength(0)
  })

  it('another IP and no device id: neutral too', async () => {
    const h = await montarConsulta()
    h.semear(1, anterior(), 12)
    const r = await h.chamar({ channel: 'email', email: EMAIL }, { ip: OUTRO_IP })
    expect(r.message).toBe('Consulta realizada! Verifique seu e-mail.')
  })

  it('no known address on either side is not "the same requester"', async () => {
    const h = await montarConsulta()
    h.semear(1, anterior({ ip_address: 'unknown', device_id: null }), 12)
    const r = await h.chamar({ channel: 'email', email: EMAIL }, { ip: null })
    expect(r.message).toBe('Consulta realizada! Verifique seu e-mail.')
  })

  it('WhatsApp channel: neutral answer in its own words', async () => {
    const h = await montarConsulta({ config: { public: { whatsappEnabled: true } } })
    h.semear(1, { channel: 'whatsapp', phone: '5511999990000', whatsapp_sent: true, ip_address: IP, device_id: null }, 5)
    const mesmo = await h.chamar({ channel: 'whatsapp', phone: '11999990000' }, { ip: IP })
    expect(mesmo.message).toContain('enviado por WhatsApp para o número informado')
    const outro = await h.chamar({ channel: 'whatsapp', phone: '11999990000', email: 'p@example.com' }, { ip: OUTRO_IP })
    expect(outro).toMatchObject({ success: true, emailSent: false, whatsappSent: true, channel: 'whatsapp' })
    expect(outro.message).toBe('Consulta realizada! Verifique seu WhatsApp.')
    expect(h.estado.whatsapp).toHaveLength(0)
  })
})

describe('per-recipient 429', () => {
  const entregues = (n: number, extra: Record<string, any> = {}) => ({ n, linha: { channel: 'email', email: EMAIL, email_sent: true, placa: 'TST0B00', ip_address: OUTRO_IP, device_id: null, ...extra } })

  it('requester that made those lookups (same device): limit and minutes, as before', async () => {
    const h = await montarConsulta()
    const s = entregues(5, { device_id: DEVICE })
    h.semear(s.n, s.linha, 20)
    const r = await h.tentar({ channel: 'email', email: EMAIL, deviceId: DEVICE }, { ip: IP })
    expect(r.erro?.statusCode).toBe(429)
    expect(r.erro?.message).toBe(mensagemLimiteGratis(5, 40))
  })

  it('anyone else typing that e-mail: 429 with a neutral message (no count, no minutes)', async () => {
    const h = await montarConsulta()
    const s = entregues(5, { device_id: DEVICE })
    h.semear(s.n, s.linha, 20)
    const r = await h.tentar({ channel: 'email', email: EMAIL, deviceId: OUTRO_DEVICE }, { ip: IP })
    expect(r.erro?.statusCode).toBe(429)
    expect(r.erro?.message).toBe(mensagemLimiteNeutra())
    expect(r.erro?.message).not.toMatch(/\d/)
    expect(h.sb.tab('blocked_requests').at(-1)?.reason).toBe('rate_limit_recipient')
    expect(h.estado.consultasPagas).toBe(0)
  })

  it('the neutral message has no dash and no number', () => {
    expect(mensagemLimiteNeutra()).toBe('Não foi possível fazer esta consulta agora. Tente novamente mais tarde.')
    expect(mensagemLimiteNeutra()).not.toMatch(/—|\d/)
  })

  it('the per-IP 429 is about the requester itself and keeps its detail', async () => {
    const h = await montarConsulta()
    h.semear(5, { ip_address: IP })
    const r = await h.tentar({ channel: 'email', email: EMAIL }, { ip: IP })
    expect(r.erro?.message).toContain('limite de 5 consultas')
  })
})

describe('user agent stored with a ceiling', () => {
  const UA_LONGO = `${UA_NAVEGADOR} ${'x'.repeat(3000)}`

  it('the lookup row keeps at most 300 characters', async () => {
    const h = await montarConsulta()
    await h.chamar({ email: EMAIL }, { ip: IP, ua: UA_LONGO })
    expect(h.sb.tab('consultas')[0].user_agent).toBe(UA_LONGO.slice(0, 300))
  })

  it('a normal user agent is stored whole', async () => {
    const h = await montarConsulta()
    await h.chamar({ email: EMAIL }, { ip: IP })
    expect(h.sb.tab('consultas')[0].user_agent).toBe(UA_NAVEGADOR)
  })

  it('blocked requests keep at most 300 characters (gate, per-IP cap, per-recipient cap)', async () => {
    const h = await montarConsulta()
    h.semear(2, { ip_address: IP }, 120)
    await h.tentar({}, { ip: IP, ua: UA_LONGO })                                            // e-mail gate
    h.semear(5, { ip_address: OUTRO_IP })
    await h.tentar({ email: EMAIL }, { ip: OUTRO_IP, ua: UA_LONGO })                        // per-IP cap
    h.semear(5, { channel: 'email', email: EMAIL, email_sent: true, placa: 'TST0B00', ip_address: '192.0.2.9' })
    await h.tentar({ channel: 'email', email: EMAIL }, { ip: '192.0.2.77', ua: UA_LONGO }) // per-recipient cap
    const bloqueios = h.sb.tab('blocked_requests')
    expect(bloqueios.map((b) => b.reason)).toEqual(['email_obrigatorio', 'rate_limit_ip_wdapi', 'rate_limit_recipient'])
    for (const b of bloqueios) expect(b.user_agent.length).toBeLessThanOrEqual(300)
  })

  it('the app is still recognised when its marker comes after the 300th character', async () => {
    const h = await montarConsulta()
    await h.chamar({ email: EMAIL }, { ip: IP, ua: `${UA_NAVEGADOR} ${'y'.repeat(400)} PlacaCompletaApp/3.1.0` })
    expect(h.sb.tab('consultas')[0]).toMatchObject({ canal: 'app', app_versao: '3.1.0' })
    expect(h.sb.tab('consultas')[0].user_agent.length).toBe(300)
  })
})
