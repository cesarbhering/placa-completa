// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import {
  PRESENCA_JANELA_MS,
  PRESENCA_MIN_INTERVALO_MS,
  PRESENCA_TETO,
  _zerarPresenca,
  dispositivoPresenca,
  pareceRobo,
  registrarPresenca,
  resumoPresenca,
} from './presenca'

const T0 = Date.UTC(2026, 10, 25, 23, 0, 0)
const id = (n: number) => `aba${String(n).padStart(29, '0')}`

beforeEach(() => _zerarPresenca())

describe('presence store: counts', () => {
  it('counts tabs per page (most first) and per device', () => {
    registrarPresenca(id(1), '/placa/:placa', 'celular', T0)
    registrarPresenca(id(2), '/placa/:placa', 'computador', T0)
    registrarPresenca(id(3), '/', 'celular', T0)
    registrarPresenca(id(4), 'checkout', 'tablet', T0)

    const r = resumoPresenca(T0 + 1_000)
    expect(r.online).toBe(4)
    expect(r.por_pagina).toEqual([
      { path: '/placa/:placa', n: 2 },
      { path: '/', n: 1 },
      { path: 'checkout', n: 1 },
    ])
    expect(r.por_dispositivo).toEqual({ celular: 2, tablet: 1, computador: 1, desconhecido: 0 })
    expect(r.janela_s).toBe(120)
    expect(r.atualizado_em).toBe(new Date(T0 + 1_000).toISOString())
  })

  it('an empty site is zero, not an error', () => {
    expect(resumoPresenca(T0)).toMatchObject({ online: 0, por_pagina: [], por_dispositivo: { celular: 0, tablet: 0, computador: 0, desconhecido: 0 } })
  })

  it('the same tab moving counts once, on its last page', () => {
    registrarPresenca(id(1), '/', 'celular', T0)
    registrarPresenca(id(1), '/placa/:placa', 'celular', T0 + PRESENCA_MIN_INTERVALO_MS)
    expect(resumoPresenca(T0 + PRESENCA_MIN_INTERVALO_MS).por_pagina).toEqual([{ path: '/placa/:placa', n: 1 }])
  })
})

describe('presence store: expiry', () => {
  it('a tab not seen for 2 minutes is gone', () => {
    registrarPresenca(id(1), '/', 'celular', T0)
    expect(resumoPresenca(T0 + PRESENCA_JANELA_MS).online).toBe(1)
    expect(resumoPresenca(T0 + PRESENCA_JANELA_MS + 1).online).toBe(0)
  })

  it('a heartbeat keeps the tab in', () => {
    registrarPresenca(id(1), '/', 'celular', T0)
    registrarPresenca(id(1), '/', 'celular', T0 + 90_000)
    expect(resumoPresenca(T0 + 90_000 + PRESENCA_JANELA_MS).online).toBe(1)
  })

  it('a tab that comes back after expiring is counted again', () => {
    registrarPresenca(id(1), '/', 'celular', T0)
    expect(resumoPresenca(T0 + PRESENCA_JANELA_MS + 1).online).toBe(0)
    expect(registrarPresenca(id(1), '/blog', 'celular', T0 + PRESENCA_JANELA_MS + 2)).toBe('ok')
    expect(resumoPresenca(T0 + PRESENCA_JANELA_MS + 2).por_pagina).toEqual([{ path: '/blog', n: 1 }])
  })
})

describe('presence store: minimum interval per id', () => {
  it('an update sooner than the minimum is ignored', () => {
    registrarPresenca(id(1), '/', 'celular', T0)
    expect(registrarPresenca(id(1), '/blog', 'celular', T0 + PRESENCA_MIN_INTERVALO_MS - 1)).toBe('cedo')
    expect(resumoPresenca(T0 + PRESENCA_MIN_INTERVALO_MS).por_pagina).toEqual([{ path: '/', n: 1 }])
  })

  it('an ignored update does not extend the tab either', () => {
    registrarPresenca(id(1), '/', 'celular', T0)
    registrarPresenca(id(1), '/', 'celular', T0 + 1_000)
    expect(resumoPresenca(T0 + PRESENCA_JANELA_MS + 1).online).toBe(0)
  })
})

describe('presence store: hard cap', () => {
  const encher = (agora: number) => {
    for (let i = 0; i < PRESENCA_TETO; i++) expect(registrarPresenca(id(i), '/', 'computador', agora)).toBe('ok')
  }

  it('never holds more than the cap: a new id is dropped when full', () => {
    encher(T0)
    expect(registrarPresenca(id(PRESENCA_TETO), '/', 'computador', T0 + 1)).toBe('cheio')
    expect(resumoPresenca(T0 + 1).online).toBe(PRESENCA_TETO)
    expect(resumoPresenca(T0 + 1).cheio).toBe(true)                // the TV can tell the count is a floor (rev-804)
  })

  it('when full, tabs already in keep refreshing', () => {
    encher(T0)
    expect(registrarPresenca(id(0), '/blog', 'computador', T0 + PRESENCA_MIN_INTERVALO_MS)).toBe('ok')
    expect(resumoPresenca(T0 + PRESENCA_MIN_INTERVALO_MS).por_pagina).toContainEqual({ path: '/blog', n: 1 })
  })

  it('room comes back as soon as the old entries expire', () => {
    encher(T0)
    expect(registrarPresenca(id(PRESENCA_TETO), '/', 'computador', T0 + PRESENCA_JANELA_MS + 1)).toBe('ok')
    expect(resumoPresenca(T0 + PRESENCA_JANELA_MS + 1).online).toBe(1)
  })
})

describe('presence helpers', () => {
  it.each([
    ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', true],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0)', true],
    ['AdsBot-Google (+http://www.google.com/adsbot.html)', true],
    ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36', true],
    ['Mozilla/5.0 (Linux; Android 11; moto g) Chrome-Lighthouse', true],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', false],
    ['Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36', false],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 PlacaCompletaApp/3', false],
  ])('pareceRobo(%s) = %s', (ua, robo) => {
    expect(pareceRobo(ua)).toBe(robo)
  })

  it('an unexpected device category counts as unknown', () => {
    expect(dispositivoPresenca('celular')).toBe('celular')
    expect(dispositivoPresenca('geladeira')).toBe('desconhecido')
    expect(dispositivoPresenca(undefined)).toBe('desconhecido')
  })
})
