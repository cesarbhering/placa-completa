/**
 * Classifica o aparelho do comprador a partir do User-Agent (e dos Client
 * Hints quando o navegador manda). Guarda so a CATEGORIA, nunca o UA cru:
 * o objetivo e responder "quem compra usa celular ou computador?" pra
 * decidir lance por aparelho nos ads, nao identificar ninguem.
 *
 * dispositivo: celular | tablet | computador | desconhecido
 * sistema:     android | ios | windows | mac | linux | outro | desconhecido
 */
import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'

export interface Dispositivo { dispositivo: string; sistema: string }

export function classificarUA(ua: string, chMobile?: string, chPlatform?: string): Dispositivo {
  const u = (ua || '').toLowerCase()
  const plat = (chPlatform || '').replace(/"/g, '').toLowerCase()

  let sistema = 'desconhecido'
  if (plat) {
    sistema = plat === 'macos' ? 'mac' : ['android', 'ios', 'windows', 'linux'].includes(plat) ? plat : 'outro'
  } else if (u) {
    if (/iphone|ipad|ipod/.test(u)) sistema = 'ios'
    else if (/android/.test(u)) sistema = 'android'
    else if (/windows/.test(u)) sistema = 'windows'
    // iPadOS 13+ se apresenta como Macintosh; o toque abaixo desempata.
    else if (/macintosh|mac os x/.test(u)) sistema = 'mac'
    else if (/linux|cros/.test(u)) sistema = 'linux'
    else sistema = 'outro'
  }

  let dispositivo = 'desconhecido'
  if (/ipad|tablet|kindle|silk/.test(u) || (/android/.test(u) && !/mobile/.test(u))) dispositivo = 'tablet'
  else if (chMobile === '?1' || /mobile|iphone|ipod|android/.test(u)) dispositivo = 'celular'
  else if (chMobile === '?0' || u) dispositivo = 'computador'

  return { dispositivo, sistema }
}

export function getDispositivo(event: H3Event): Dispositivo {
  return classificarUA(
    getRequestHeader(event, 'user-agent') || '',
    getRequestHeader(event, 'sec-ch-ua-mobile'),
    getRequestHeader(event, 'sec-ch-ua-platform'),
  )
}
