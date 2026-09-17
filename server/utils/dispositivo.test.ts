import { describe, it, expect } from 'vitest'
import { classificarUA } from './dispositivo'

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X510) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
}

describe('classificarUA', () => {
  it('celulares', () => {
    expect(classificarUA(UA.iphone)).toEqual({ dispositivo: 'celular', sistema: 'ios' })
    expect(classificarUA(UA.android)).toEqual({ dispositivo: 'celular', sistema: 'android' })
  })
  it('tablets', () => {
    expect(classificarUA(UA.ipad)).toEqual({ dispositivo: 'tablet', sistema: 'ios' })
    expect(classificarUA(UA.androidTablet)).toEqual({ dispositivo: 'tablet', sistema: 'android' })
  })
  it('computadores', () => {
    expect(classificarUA(UA.windows)).toEqual({ dispositivo: 'computador', sistema: 'windows' })
    expect(classificarUA(UA.mac)).toEqual({ dispositivo: 'computador', sistema: 'mac' })
    expect(classificarUA(UA.linux)).toEqual({ dispositivo: 'computador', sistema: 'linux' })
  })
  it('client hints tem prioridade sobre o UA', () => {
    expect(classificarUA(UA.windows, '?1', '"Android"')).toEqual({ dispositivo: 'celular', sistema: 'android' })
    expect(classificarUA(UA.mac, '?0', '"macOS"')).toEqual({ dispositivo: 'computador', sistema: 'mac' })
  })
  it('sem nada = desconhecido', () => {
    expect(classificarUA('')).toEqual({ dispositivo: 'desconhecido', sistema: 'desconhecido' })
  })
})
