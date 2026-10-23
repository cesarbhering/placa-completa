import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'

// KZH9386 (23/out/2026): mesma pessoa pagou duas vezes a mesma placa em 16 min.
// Bloqueia so com IP + aparelho (ou obref) batendo; nunca so pelo IP.

let homolog = false
let status: number | undefined
vi.stubGlobal('useRuntimeConfig', () => ({ public: { homolog } }))
vi.stubGlobal('setResponseStatus', (_e: any, s: number) => { status = s })
const { compraRepetida, respostaCompraRepetida, mesmoComprador, JANELA_COMPRA_REPETIDA_MS } = await import('./compra-repetida')

const AGORA = Date.parse('2026-10-23T13:00:00Z')
const antigo = (extra: Record<string, any> = {}) => ({
  id: 'p1', token_entrega: 'entrega-1', placa: 'KZH9386', plano: 'completa', status: 'entregue', ambiente: 'producao',
  ip_address: '177.1.2.3', dispositivo: 'celular', sistema: 'Android', canal: 'web', obref: 'ob-1',
  criado_em: new Date(AGORA - 16 * 60_000).toISOString(), ...extra,
})
const atual = (extra: Record<string, any> = {}) => ({
  placa: 'KZH9386', plano: 'completa', ip: '177.1.2.3', dispositivo: 'celular', sistema: 'Android', canal: 'web', obref: null, ...extra,
})

let sb: ReturnType<typeof supabaseMemoria>
const buscar = (a = atual(), opts: any = {}) => compraRepetida(sb, a, { ambiente: 'producao', agora: AGORA, ...opts })

describe('compraRepetida', () => {
  beforeEach(() => { sb = supabaseMemoria(); homolog = false; status = undefined })

  it('mesma placa, IP e aparelho em 24 h: acha o pedido (caso KZH9386)', async () => {
    sb.tab('pedidos_premium').push(antigo())
    expect(await buscar()).toEqual({ id: 'p1', token_entrega: 'entrega-1' })
  })

  it('IP igual com aparelho diferente nao bloqueia (rede de operadora)', async () => {
    sb.tab('pedidos_premium').push(antigo({ dispositivo: 'computador', sistema: 'Windows', obref: null }))
    expect(await buscar()).toBeNull()
    sb.tab('pedidos_premium').push(antigo({ id: 'p2', sistema: 'iOS', obref: null }))
    expect(await buscar()).toBeNull()
  })

  it('aparelho diferente mas mesmo obref (mesmo clique): bloqueia', async () => {
    sb.tab('pedidos_premium').push(antigo({ dispositivo: 'computador', sistema: 'Windows' }))
    expect(await buscar(atual({ obref: 'ob-1' }))).not.toBeNull()
  })

  it('IP diferente nunca bloqueia, nem com obref igual', async () => {
    sb.tab('pedidos_premium').push(antigo())
    expect(await buscar(atual({ ip: '200.9.9.9', obref: 'ob-1' }))).toBeNull()
  })

  it('mais de 24 h nao bloqueia', async () => {
    sb.tab('pedidos_premium').push(antigo({ criado_em: new Date(AGORA - JANELA_COMPRA_REPETIDA_MS - 60_000).toISOString() }))
    expect(await buscar()).toBeNull()
  })

  it('homolog e ambiente de teste nao bloqueiam', async () => {
    sb.tab('pedidos_premium').push(antigo())
    expect(await buscar(atual(), { homolog: true })).toBeNull()
    expect(await buscar(atual(), { ambiente: 'homolog' })).toBeNull()
    sb.tab('pedidos_premium')[0].ambiente = 'teste'
    expect(await buscar()).toBeNull()
  })

  it('pedido nao pago (aguardando, falha, reembolsado) nao conta', async () => {
    for (const st of ['aguardando_pagamento', 'falha', 'reembolsado', 'expirado']) sb.tab('pedidos_premium').push(antigo({ id: st, status: st }))
    expect(await buscar()).toBeNull()
  })

  it('plano: completa cobre basica, basica nao cobre completa', async () => {
    sb.tab('pedidos_premium').push(antigo({ plano: 'basica' }))
    expect(await buscar()).toBeNull()
    expect(await buscar(atual({ plano: 'basica' }))).not.toBeNull()
    sb = supabaseMemoria()
    sb.tab('pedidos_premium').push(antigo({ plano: 'completa' }))
    expect(await buscar(atual({ plano: 'basica' }))).not.toBeNull()
  })

  it('outra placa nao bloqueia', async () => {
    sb.tab('pedidos_premium').push(antigo())
    expect(await buscar(atual({ placa: 'ABC1D23' }))).toBeNull()
  })

  it('IP desconhecido nunca casa', () => {
    expect(mesmoComprador(antigo({ ip_address: 'unknown' }), atual({ ip: 'unknown' }))).toBe(false)
  })
})

describe('respostaCompraRepetida', () => {
  beforeEach(() => { sb = supabaseMemoria(); homolog = false; status = undefined; sb.tab('pedidos_premium').push(antigo({ criado_em: new Date().toISOString() })) })

  it('409 { ja_comprado, token_entrega }', async () => {
    expect(await respostaCompraRepetida({}, sb, atual(), 'producao', undefined)).toEqual({ ja_comprado: true, token_entrega: 'entrega-1' })
    expect(status).toBe(409)
  })

  it('forcar_nova_compra pula a checagem', async () => {
    expect(await respostaCompraRepetida({}, sb, atual(), 'producao', true)).toBeNull()
    expect(status).toBeUndefined()
  })

  it('build de homolog nao bloqueia mesmo com ambiente producao', async () => {
    homolog = true
    expect(await respostaCompraRepetida({}, sb, atual(), 'producao', undefined)).toBeNull()
  })
})

describe('pedidoQueFicou (link do duplicado reembolsado)', () => {
  const reemb = (extra: Record<string, any> = {}) => antigo({ id: 'r1', token_entrega: 'wt87', status: 'reembolsado', criado_em: '2026-10-23T12:59:00Z', ...extra })
  const ficou = (extra: Record<string, any> = {}) => antigo({ id: 'f1', token_entrega: 'jFQk', status: 'entregue', criado_em: '2026-10-23T12:43:00Z', ...extra })
  beforeEach(() => { sb = supabaseMemoria() })

  it('caso KZH9386: reembolsado aponta pro entregue do mesmo IP + aparelho', async () => {
    const { pedidoQueFicou } = await import('./compra-repetida')
    sb.tab('pedidos_premium').push(ficou(), reemb())
    expect(await pedidoQueFicou(sb, reemb())).toEqual({ token_entrega: 'jFQk' })
  })

  it('o que ficou pode ser o mais novo (janela pros dois lados)', async () => {
    const { pedidoQueFicou } = await import('./compra-repetida')
    sb.tab('pedidos_premium').push(ficou({ criado_em: '2026-10-23T20:00:00Z' }))
    expect(await pedidoQueFicou(sb, reemb())).toEqual({ token_entrega: 'jFQk' })
  })

  it('nao redireciona: aparelho diferente, mais de 24 h, outra placa, nao reembolsado', async () => {
    const { pedidoQueFicou } = await import('./compra-repetida')
    sb.tab('pedidos_premium').push(
      ficou({ id: 'a', dispositivo: 'computador', sistema: 'Windows', obref: null }),
      ficou({ id: 'b', criado_em: '2026-10-21T12:00:00Z' }),
      ficou({ id: 'c', placa: 'ABC1D23' }),
      ficou({ id: 'd', status: 'reembolsado' }),
    )
    expect(await pedidoQueFicou(sb, reemb())).toBeNull()
    expect(await pedidoQueFicou(sb, reemb({ status: 'entregue' }))).toBeNull()
  })
})
