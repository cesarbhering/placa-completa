import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { mascararChassi, chassiParaExibicao, comChassiParcial } from './chassi-livre'

// The free lookup only ever shows part of the VIN; the full one is paid content.
// VINs below are invented.
const VIN = '9ZZTESTE000000001'

describe('partial VIN on the free lookup', () => {
  it('masks a full VIN keeping the first 5 characters', () => {
    expect(mascararChassi(VIN)).toBe('9ZZTE************')
    expect(mascararChassi('123')).toBeNull()
  })

  it('uses extra.chassi when present', () => {
    expect(chassiParaExibicao({ extra: { chassi: VIN } })).toBe('9ZZTE************')
  })

  it('keeps a root VIN already masked by the source as it came', () => {
    expect(chassiParaExibicao({ chassi: '*****00001' })).toBe('*****00001')
  })

  it('masks a root VIN that came unmasked', () => {
    expect(chassiParaExibicao({ chassi: VIN })).toBe('9ZZTE************')
  })

  it('returns null without a VIN', () => {
    expect(chassiParaExibicao({})).toBeNull()
    expect(chassiParaExibicao(null)).toBeNull()
  })

  it('app payload carries only the partial VIN, everything else intact', () => {
    const original = { MARCA: 'VW', chassi: '*****00001', extra: { chassi: VIN, combustivel: 'Flex' }, fipe: { dados: [{ codigo_fipe: '000000-0' }] } }
    const livre = comChassiParcial(original)
    expect(JSON.stringify(livre)).not.toContain(VIN)
    expect(livre.extra.chassi).toBe('9ZZTE************')
    expect(livre.chassi).toBe('9ZZTE************')
    expect(livre.extra.combustivel).toBe('Flex')
    expect(livre.fipe).toBe(original.fipe)
    // does not mutate what gets stored server side
    expect(original.extra.chassi).toBe(VIN)
  })

  it('app payload without any VIN stays without one', () => {
    const livre = comChassiParcial({ MARCA: 'VW', extra: { combustivel: 'Flex' } })
    expect('chassi' in livre).toBe(false)
    expect('chassi' in livre.extra).toBe(false)
    expect(comChassiParcial(null)).toBeNull()
  })
})

describe('free lookup delivery uses the partial VIN', () => {
  const src = readFileSync('server/api/consulta.post.ts', 'utf8')
  const email = src.slice(src.indexOf('function buildEmailHtml'), src.indexOf('function buildWhatsAppText'))
  const whats = src.slice(src.indexOf('function buildWhatsAppText'))

  it('e-mail shows the partial VIN', () => {
    expect(email).toContain('chassiParaExibicao(data)')
    expect(email).not.toMatch(/data\.extra\?\.chassi/)
  })

  it('WhatsApp shows the partial VIN', () => {
    expect(whats).toContain('chassiParaExibicao(data)')
    expect(whats).not.toMatch(/data\.extra\?\.chassi/)
  })

  it('app response goes through comChassiParcial', () => {
    // Only a server-verified partner gets the source chassis (server/utils/parceiro-chassi.ts).
    expect(src).toContain('data: isPWA ? (parceiro ? apiResponse : comChassiParcial(apiResponse)) : undefined,')
  })
})
