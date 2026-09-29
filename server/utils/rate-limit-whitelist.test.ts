import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getHourlyLimit, DEFAULT_HOURLY_LIMIT } from './rate-limit-whitelist'

// getHourlyLimit le a tabela rate_limit_whitelist via useSupabaseServer (global
// do Nuxt). Aqui stubamos ela pra devolver uma whitelist fixa (com uma chave
// 'ip:<IP>') e testamos o caminho whitelist-POR-IP -- que e o que faz a sonda
// de checkout (canal 'tela', sem destinatario) nao estourar o teto de 5/h.
describe('getHourlyLimit — whitelist por IP', () => {
  beforeEach(() => {
    vi.stubGlobal('useSupabaseServer', () => ({
      from: () => ({
        select: async () => ({
          data: [
            { recipient: 'ip:62.169.22.218', hourly_limit: 30 }, // IP da VPS: 30/h
            { recipient: 'parceiro@ex.com', hourly_limit: null }, // ilimitado
          ],
          error: null,
        }),
      }),
    }))
  })

  it('IP whitelistado (chave ip:) usa o limite dele, nao o default', async () => {
    expect(await getHourlyLimit('ip:62.169.22.218')).toBe(30)
  })

  it('IP NAO whitelistado cai no default', async () => {
    expect(await getHourlyLimit('ip:9.9.9.9')).toBe(DEFAULT_HOURLY_LIMIT)
  })

  it('recipient vazio cai no default (nao toca a whitelist)', async () => {
    expect(await getHourlyLimit('')).toBe(DEFAULT_HOURLY_LIMIT)
    expect(await getHourlyLimit(null)).toBe(DEFAULT_HOURLY_LIMIT)
  })

  it('hourly_limit null = ilimitado (Infinity)', async () => {
    expect(await getHourlyLimit('parceiro@ex.com')).toBe(Infinity)
  })
})
