import { describe, it, expect, vi, afterEach } from 'vitest'
import { getClientIp } from './client-ip'
import { dentroDoTetoDeSinal, _limparTetoDeSinal } from './sinal-leilao'

// O bug de prod (01/out): atras do cloudflared + Traefik, o X-Forwarded-For
// chega reescrito com o IP interno da rede Docker, igual pra todo mundo.
// getRequestIP(xForwardedFor) devolvia esse IP e o teto de 60/h virava global.
// getClientIp usa o cf-connecting-ip (IP real) e nunca devolve IP privado.
function evento(headers: Record<string, string>) {
  vi.stubGlobal('getRequestHeaders', () => headers)
  return {} as any
}
afterEach(() => vi.unstubAllGlobals())

describe('teto dos sinais com o IP real (cadeia de prod)', () => {
  it('cada visitante tem a sua cota, mesmo com o XFF interno igual pra todos', () => {
    _limparTetoDeSinal()
    const xffInterno = 'fd78:1234::1'
    const ipA = getClientIp(evento({ 'cf-connecting-ip': '200.1.1.1', 'x-forwarded-for': xffInterno }))
    const ipB = getClientIp(evento({ 'cf-connecting-ip': '200.2.2.2', 'x-forwarded-for': xffInterno }))
    expect([ipA, ipB]).toEqual(['200.1.1.1', '200.2.2.2'])
    for (let i = 0; i < 61; i++) dentroDoTetoDeSinal(ipA, Date.now(), 'recall')
    expect(dentroDoTetoDeSinal(ipA, Date.now(), 'recall')).toBe(false)
    expect(dentroDoTetoDeSinal(ipB, Date.now(), 'recall')).toBe(true)
  })
  it('so IP interno (sem cf-connecting-ip): unknown, que nao bloqueia', () => {
    const ip = getClientIp(evento({ 'x-forwarded-for': 'fd78:1234::1' }))
    expect(ip).toBe('unknown')
    for (let i = 0; i < 100; i++) expect(dentroDoTetoDeSinal(ip, Date.now(), 'leilao')).toBe(true)
  })
})
