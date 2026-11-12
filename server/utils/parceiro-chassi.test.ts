import { describe, it, expect, beforeEach, vi } from 'vitest'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'
import {
  PARCEIRO_LIMITE_HORA, PARCEIRO_TOKEN_TTL_MS, _zerarCacheParceiro, assinarCookie, chassiDoParceiro, decidirParceiro,
  dominioDoCookie, entrarComCodigo, entrarComToken, hashSegredo, lerCookie, normalizarCodigo, novoCookie, solicitarLink,
} from './parceiro-chassi'

// Parceiros com chassi completo na consulta gratis: link/codigo de uso unico,
// cookie assinado, revogacao imediata e limite de 20/h. Nenhum e-mail real aqui.

const PID = '11111111-1111-4111-8111-111111111111'
const EMAIL = 'parceiro@exemplo.invalid'
const CONFIG = { parceiroChassi: 'on', parceiroChassiSecret: 'segredo-de-teste', funilIpSalt: 'sal' }
const SEGREDO = CONFIG.parceiroChassiSecret
let sb: ReturnType<typeof supabaseMemoria>
const T0 = Date.parse('2026-11-12T12:00:00Z')

beforeEach(() => {
  _zerarCacheParceiro()
  sb = supabaseMemoria()
  sb.tab('parceiros_chassi').push({ id: PID, email_normalizado: EMAIL, ativo: true })
})

async function pedirLink(agora = T0) {
  const enviados: any[] = []
  await solicitarLink(sb, EMAIL, async (para, cred) => { enviados.push({ para, ...cred }) }, agora)
  return enviados
}

describe('pedido de link', () => {
  it('e-mail cadastrado (qualquer caixa) recebe link e codigo; o banco guarda so hashes', async () => {
    const enviados: any[] = []
    await solicitarLink(sb, '  Parceiro@Exemplo.INVALID ', async (para, cred) => { enviados.push({ para, ...cred }) }, T0)
    expect(enviados).toHaveLength(1)
    const linha = sb.tab('parceiros_chassi_tokens')[0]
    expect(linha.hash).toBe(hashSegredo(enviados[0].token))
    expect(linha.codigo_hash).toBe(hashSegredo(enviados[0].codigo))
    expect(JSON.stringify(linha)).not.toContain(enviados[0].token)
    expect(enviados[0].codigo).toMatch(/^[A-Z2-9]{8}$/)
  })

  it('e-mail fora da lista ou parceiro desativado: nada e enviado (a rota responde igual)', async () => {
    const enviar = vi.fn(async () => {})
    expect(await solicitarLink(sb, 'outro@exemplo.invalid', enviar, T0)).toBe(false)
    sb.tab('parceiros_chassi')[0].ativo = false
    expect(await solicitarLink(sb, EMAIL, enviar, T0)).toBe(false)
    expect(enviar).not.toHaveBeenCalled()
    expect(sb.tab('parceiros_chassi_tokens')).toHaveLength(0)
  })
})

describe('entrar pelo link', () => {
  it('token valido entra uma vez; reusado nao entra', async () => {
    const [{ token }] = await pedirLink()
    expect(await entrarComToken(sb, token, T0 + 1000)).toBe(PID)
    expect(await entrarComToken(sb, token, T0 + 2000)).toBeNull()
  })

  it('token vencido (30 min) nao entra', async () => {
    const [{ token }] = await pedirLink()
    expect(await entrarComToken(sb, token, T0 + PARCEIRO_TOKEN_TTL_MS + 1)).toBeNull()
  })

  it('parceiro desativado depois do pedido nao entra', async () => {
    const [{ token }] = await pedirLink()
    sb.tab('parceiros_chassi')[0].ativo = false
    expect(await entrarComToken(sb, token, T0 + 1000)).toBeNull()
  })

  it('token inventado nao entra', async () => {
    await pedirLink()
    expect(await entrarComToken(sb, 'x'.repeat(43), T0)).toBeNull()
  })
})

describe('entrar pelo codigo (app)', () => {
  it('codigo certo entra uma vez, com qualquer caixa e separador', async () => {
    const [{ codigo }] = await pedirLink()
    const digitado = codigo.toLowerCase().slice(0, 4) + '-' + codigo.toLowerCase().slice(4)
    expect(await entrarComCodigo(sb, EMAIL, digitado, T0 + 1000)).toBe(PID)
    expect(await entrarComCodigo(sb, EMAIL, codigo, T0 + 2000)).toBeNull()
  })

  it('5 codigos errados matam o pedido, mesmo o certo depois', async () => {
    const [{ codigo }] = await pedirLink()
    for (let i = 0; i < 5; i++) expect(await entrarComCodigo(sb, EMAIL, 'ZZZZZZZZ', T0 + 1000)).toBeNull()
    expect(await entrarComCodigo(sb, EMAIL, codigo, T0 + 2000)).toBeNull()
  })

  it('codigo de outro e-mail nao entra', async () => {
    const [{ codigo }] = await pedirLink()
    expect(await entrarComCodigo(sb, 'outro@exemplo.invalid', codigo, T0 + 1000)).toBeNull()
  })

  it('normaliza o codigo digitado', () => {
    expect(normalizarCodigo(' ab cd-23 45 ')).toBe('ABCD2345')
  })
})

describe('cookie', () => {
  it('assinado e valido por 180 dias', () => {
    const v = novoCookie(SEGREDO, PID, T0)
    expect(lerCookie(SEGREDO, v, T0 + 1000)?.parceiroId).toBe(PID)
    expect(lerCookie(SEGREDO, v, T0 + 181 * 24 * 60 * 60 * 1000)).toBeNull()
  })

  it('adulterado ou com outro segredo nao vale', () => {
    const v = novoCookie(SEGREDO, PID, T0)
    const outroId = '22222222-2222-4222-8222-222222222222'
    expect(lerCookie(SEGREDO, v.replace(PID, outroId), T0)).toBeNull()
    expect(lerCookie(SEGREDO, v.slice(0, -2) + 'xx', T0)).toBeNull()
    expect(lerCookie('outro-segredo', v, T0)).toBeNull()
    expect(lerCookie(SEGREDO, 'lixo', T0)).toBeNull()
    expect(lerCookie(SEGREDO, assinarCookie('outro', PID, PID, T0), T0)).toBeNull()
  })

  it('vale no dominio-mae (www, app.) e so nos nossos dominios', () => {
    expect(dominioDoCookie('app.placacompleta.com.br')).toBe('placacompleta.com.br')
    expect(dominioDoCookie('placacompleta.com.br:443')).toBe('placacompleta.com.br')
    expect(dominioDoCookie('localhost:3000')).toBeUndefined()
  })
})

describe('decisao na consulta gratis', () => {
  const decidir = (cookie: unknown, agora = T0, config: any = CONFIG) =>
    decidirParceiro({ config, cookie, sb, placa: 'TST1A23', ip: '203.0.113.9', canal: 'web', agora })

  it('cookie valido + ativo: parceiro, e o uso fica registrado sem IP cru', async () => {
    const r = await decidir(novoCookie(SEGREDO, PID, T0))
    expect(r?.parceiroId).toBe(PID)
    const uso = sb.tab('parceiros_chassi_uso')
    expect(uso).toHaveLength(1)
    expect(JSON.stringify(uso[0])).not.toContain('203.0.113.9')
  })

  it('sem cookie, cookie adulterado ou flag desligada: visitante comum', async () => {
    expect(await decidir(undefined)).toBeNull()
    expect(await decidir(novoCookie('outro', PID, T0))).toBeNull()
    expect(await decidir(novoCookie(SEGREDO, PID, T0), T0, { ...CONFIG, parceiroChassi: '' })).toBeNull()
    expect(sb.tab('parceiros_chassi_uso')).toHaveLength(0)
  })

  it('revogado (ativo=false): para de valer depois do cache curto', async () => {
    const c = novoCookie(SEGREDO, PID, T0)
    expect(await decidir(c, T0)).not.toBeNull()
    sb.tab('parceiros_chassi')[0].ativo = false
    expect(await decidir(c, T0 + 31_000)).toBeNull()
  })

  it('limite de 20 por hora; na hora seguinte volta', async () => {
    const c = novoCookie(SEGREDO, PID, T0)
    for (let i = 0; i < PARCEIRO_LIMITE_HORA; i++) expect(await decidir(c, T0 + i * 1000)).not.toBeNull()
    expect(await decidir(c, T0 + 30_000)).toBeNull()
    expect(await decidir(c, T0 + 61 * 60 * 1000)).not.toBeNull()
  })

  it('banco fora: visitante comum (fail-closed)', async () => {
    const quebrado: any = { from: () => { throw new Error('fora') } }
    expect(await decidirParceiro({ config: CONFIG, cookie: novoCookie(SEGREDO, PID, T0), sb: quebrado, placa: 'TST1A23', ip: 'x', canal: 'web', agora: T0 })).toBeNull()
  })
})

describe('chassi do parceiro', () => {
  const CHASSI = '9BWZZZ377VT004251'
  it('inteiro quando a fonte mandou 17 caracteres', () => {
    expect(chassiDoParceiro({ extra: { chassi: CHASSI } })).toBe(CHASSI)
  })
  it('parcial da WDAPI sai como veio, sem inventar', () => {
    expect(chassiDoParceiro({ chassi: '*****04251' })).toBe('*****04251')
    expect(chassiDoParceiro({})).toBeNull()
  })
})
