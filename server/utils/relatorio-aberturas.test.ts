import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'

// Aberturas do relatorio pago (PGB7E23, 24/out/2026): quem abriu e de onde,
// sem token nem IP crus, uma linha por pedido + ip + origem a cada 30 min.

let headers: Record<string, string> = {}
const geo = vi.fn(async () => ({ uf: 'TO', city: 'Colinas do Tocantins', country: 'BR' }))
vi.mock('./ip-geo', () => ({ lookupIpGeo: (...a: any[]) => geo(...(a as [])) }))
vi.mock('./client-ip', () => ({ getClientIp: () => headers['x-ip'] || 'unknown' }))
vi.mock('./dispositivo', () => ({ getDispositivo: () => ({ dispositivo: 'celular', sistema: 'Android', canal: 'web', app_versao: null }) }))
vi.stubGlobal('useRuntimeConfig', () => ({ funilIpSalt: 'sal' }))
vi.stubGlobal('getRequestHeader', (_e: any, n: string) => headers[n])
const { registrarAbertura, linhaAbertura, origemDaAbertura, hashIp, JANELA_ABERTURA_MS } = await import('./relatorio-aberturas')

const TOKEN = 'tokPGB7E23xxxxxxxxxxxxxx'
const pedido = { id: '11111111-1111-1111-1111-111111111111', status: 'entregue', ip_address: '177.10.0.1' }
const UA_CEL = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'
let sb: ReturnType<typeof supabaseMemoria>
const linhas = () => sb.tab('relatorio_aberturas')

describe('relatorio_aberturas', () => {
  beforeEach(() => { sb = supabaseMemoria(); headers = { 'user-agent': UA_CEL, 'x-ip': '200.1.2.3' }; geo.mockClear() })

  it('grava geo, hashes (nunca token/IP crus), aparelho e se e o IP da compra', async () => {
    expect(await registrarAbertura(sb, {}, pedido, TOKEN)).toBe(true)
    const l = linhas()[0]
    expect(l).toMatchObject({
      pedido_id: pedido.id, geo_uf: 'TO', geo_cidade: 'Colinas do Tocantins', geo_pais: 'BR',
      dispositivo: 'celular', sistema: 'Android', mesmo_ip_da_compra: false, origem: 'pagina',
      token_hash: createHash('sha256').update(TOKEN).digest('hex'), ip_hash: hashIp('200.1.2.3', 'sal'),
    })
    expect(JSON.stringify(l)).not.toContain(TOKEN)
    expect(JSON.stringify(l)).not.toContain('200.1.2.3')
  })

  it('mesmo IP da compra = true', async () => {
    headers['x-ip'] = '177.10.0.1'
    await registrarAbertura(sb, {}, pedido, TOKEN)
    expect(linhas()[0].mesmo_ip_da_compra).toBe(true)
  })

  it('reload e polling em 30 min nao inflam; outro IP, outra origem ou depois de 30 min grava', async () => {
    const t0 = Date.parse('2026-10-24T15:00:00Z')
    await registrarAbertura(sb, {}, pedido, TOKEN, undefined, t0)
    await registrarAbertura(sb, {}, pedido, TOKEN, undefined, t0 + 60_000)
    expect(linhas()).toHaveLength(1)
    await registrarAbertura(sb, {}, pedido, TOKEN, 'pdf', t0 + 120_000)
    headers['x-ip'] = '200.9.9.9'
    await registrarAbertura(sb, {}, pedido, TOKEN, undefined, t0 + 180_000)
    headers['x-ip'] = '200.1.2.3'
    await registrarAbertura(sb, {}, pedido, TOKEN, undefined, t0 + JANELA_ABERTURA_MS + 1000)
    expect(linhas().map((l) => l.origem)).toEqual(['pagina', 'pdf', 'pagina', 'pagina'])
  })

  it('preview de WhatsApp/Telegram e robo: grava como preview, sem gastar geo', async () => {
    headers['user-agent'] = 'WhatsApp/2.23.20.0 A'
    await registrarAbertura(sb, {}, pedido, TOKEN)
    expect(linhas()[0].origem).toBe('preview')
    expect(geo).not.toHaveBeenCalled()
    expect(origemDaAbertura('TelegramBot (like TwitterBot)', undefined)).toBe('preview')
    expect(origemDaAbertura('facebookexternalhit/1.1', undefined)).toBe('preview')
    expect(origemDaAbertura('Mozilla/5.0 (compatible; Googlebot/2.1)', undefined)).toBe('preview')
    expect(origemDaAbertura(null, undefined)).toBe('preview')
  })

  it('origem: link do e-mail e PDF', () => {
    expect(origemDaAbertura(UA_CEL, 'email')).toBe('email_link')
    expect(origemDaAbertura(UA_CEL, 'pdf')).toBe('pdf')
    expect(origemDaAbertura(UA_CEL, 'qualquer')).toBe('pagina')
  })

  it('pedido nao pago nao registra; erro do banco nunca lanca', async () => {
    expect(linhaAbertura({ pedido: { ...pedido, status: 'aguardando_pagamento' }, token: TOKEN, ip: '1.1.1.1', sal: 's', userAgent: UA_CEL })).toBeNull()
    expect(await registrarAbertura({ from: () => { throw new Error('fora') } }, {}, pedido, TOKEN)).toBe(false)
  })

  it('sem sal nao guarda hash de IP (como o eventos_funil)', () => {
    expect(hashIp('200.1.2.3', '')).toBeNull()
  })
})
