import { describe, it, expect, vi, beforeEach } from 'vitest'

// Whitelist de IP no teto wdapi. A linha fica como 'ip:<ip>' (PR #387: VPS a
// 30/h); o teto so olhava o IP cru e a sonda da VPS batia nos 15/h.
const limites = new Map<string, number>()
vi.mock('./rate-limit-whitelist', () => ({
  getHourlyLimit: async (k: string) => (limites.has(k) ? limites.get(k)! : 5),
}))
const { tetoIpWdapi, checarLimiteIpWdapi } = await import('./ip-wdapi-limit')

function sbComTotal(consultas: number, preview = 0) {
  const q = (count: number) => ({
    select: () => ({ eq: () => ({ gte: () => ({ order: () => ({ limit: async () => ({ count, data: [{ created_at: new Date(Date.now() - 10 * 60000).toISOString() }] }) }) }) }) }),
  })
  return { from: (t: string) => q(t === 'consultas' ? consultas : preview) }
}

describe('teto wdapi por IP com whitelist', () => {
  beforeEach(() => limites.clear())

  it('sem whitelist: 15', async () => {
    expect(await tetoIpWdapi('1.2.3.4')).toBe(15)
  })
  it("whitelist 'ip:<ip>' = 30: teto 30 (VPS da sonda)", async () => {
    limites.set('ip:62.169.22.218', 30)
    expect(await tetoIpWdapi('62.169.22.218')).toBe(30)
  })
  it('whitelist menor que 15 nao reduz o teto', async () => {
    limites.set('ip:1.2.3.4', 5)
    expect(await tetoIpWdapi('1.2.3.4')).toBe(15)
  })
  it('chave crua segue valendo (compatibilidade) e ilimitado vira Infinity', async () => {
    limites.set('9.9.9.9', Infinity)
    expect(await tetoIpWdapi('9.9.9.9')).toBe(Infinity)
  })
  it('IP whitelistado a 30 passa com 20 chamadas na hora; sem whitelist bloqueia', async () => {
    limites.set('ip:62.169.22.218', 30)
    expect((await checarLimiteIpWdapi(sbComTotal(15, 5), '62.169.22.218', { janelaInicio: new Date(0).toISOString() })).ok).toBe(true)
    const r = await checarLimiteIpWdapi(sbComTotal(15, 5), '1.2.3.4', { janelaInicio: new Date(0).toISOString() })
    expect(r).toMatchObject({ ok: false, teto: 15 })
  })
})
