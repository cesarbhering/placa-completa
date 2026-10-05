import { describe, it, expect } from 'vitest'
import { gerarCodigoRecompra, gerarCupomRecompra, origemDoCupom, textoCupomRecompra, VALIDADE_RECOMPRA_MS } from './cupom-recompra'
import { aplicarCupom } from '../../shared/planos'

function fakeSb(existente: any = null) {
  const inserts: any[] = []
  return {
    inserts,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existente }) }) }),
      insert: async (row: any) => { inserts.push(row); return { error: null } },
    }),
  }
}

describe('cupom de recompra', () => {
  it('codigo CARRO + 5 sem caracteres ambiguos', () => {
    const c = gerarCodigoRecompra()
    expect(c).toMatch(/^CARRO[A-HJ-NP-Z2-9]{5}$/)
  })
  it('gera 20%, 7 dias da entrega, uso livre, nunca gratis, ligado ao pedido', async () => {
    const sb = fakeSb()
    const ent = new Date('2026-10-05T12:00:00Z')
    const c = await gerarCupomRecompra(sb, { id: 'ped1', valor_centavos: 3990 }, ent)
    expect(c?.validoAte).toBe(new Date(ent.getTime() + VALIDADE_RECOMPRA_MS).toISOString())
    expect(sb.inserts[0]).toMatchObject({
      tipo: 'percentual', valor: 20, planos: ['basica', 'completa'], ativo: true,
      limite_uso_global: null, limite_uso_por_cliente: null, permite_gratis: false,
      origem: 'recompra', pedido_origem_id: 'ped1', valido_de: ent.toISOString(),
    })
  })
  it('idempotente: pedido que ja gerou devolve o mesmo codigo', async () => {
    const sb = fakeSb({ codigo: 'CARROABCDE', valido_ate: '2026-10-12T12:00:00Z' })
    expect(await gerarCupomRecompra(sb, { id: 'ped1', valor_centavos: 3990 })).toEqual({ codigo: 'CARROABCDE', validoAte: '2026-10-12T12:00:00Z' })
    expect(sb.inserts).toHaveLength(0)
  })
  it('valor zero e app (Google Play) nao geram', async () => {
    expect(await gerarCupomRecompra(fakeSb(), { id: 'p', valor_centavos: 0 })).toBeNull()
    expect(await gerarCupomRecompra(fakeSb(), { id: 'p', valor_centavos: 3990, google_play_order_id: 'GPA.1' })).toBeNull()
  })
  it('20% respeita o piso: nunca zera o preco', () => {
    const r = aplicarCupom('completa', { tipo: 'percentual', valor: 20, planos: ['basica', 'completa'], permiteGratis: false })
    expect(r.precoLiquidoCentavos).toBeGreaterThan(0)
    expect(r.descontoCentavos).toBe(Math.round(r.precoBrutoCentavos * 0.2))
  })
  it('origem no pedido que usou: so cupom de recompra aplicado', () => {
    expect(origemDoCupom({ ok: true, origem: 'recompra', pedidoOrigemId: 'ped1' })).toEqual({ cupom_origem: 'cupom_recompra', cupom_pedido_origem_id: 'ped1' })
    expect(origemDoCupom({ ok: true, origem: 'volta' })).toEqual({})
    expect(origemDoCupom({ ok: false, origem: 'recompra' })).toEqual({})
    expect(origemDoCupom(null)).toEqual({})
  })
  it('texto da faixa e do e-mail', () => {
    const t = textoCupomRecompra({ codigo: 'CARROABCDE', validoAte: '2026-10-12T14:00:00Z' })
    expect(t).toBe('Use CARROABCDE e ganhe 20% na próxima consulta. Pode compartilhar com quem também está comprando carro. Válido até 12/10.')
    expect(t).not.toContain('—')
  })
})

describe('cupom sem e-mail', () => {
  const sbCom = (origem: string | null) => ({ from: () => ({ select: () => ({ eq: (_c: string, cod: string) => ({ maybeSingle: async () => ({ data: cod === 'CARROABCDE' ? { origem } : null }) }) }) }) })
  it('cupom de recompra: dispensa e-mail (decidido no servidor pela origem)', async () => {
    const { cupomDispensaEmail } = await import('./cupom-recompra')
    expect(await cupomDispensaEmail(sbCom('recompra'), ' carroabcde ')).toBe(true)
  })
  it('outros cupons (VOLTA15, recuperacao de Pix): continuam exigindo e-mail', async () => {
    const { cupomDispensaEmail } = await import('./cupom-recompra')
    expect(await cupomDispensaEmail(sbCom('volta'), 'CARROABCDE')).toBe(false)
    expect(await cupomDispensaEmail(sbCom(null), 'CARROABCDE')).toBe(false)
    expect(await cupomDispensaEmail(sbCom('recompra'), 'NAOEXISTE')).toBe(false)
    expect(await cupomDispensaEmail(sbCom('recompra'), '')).toBe(false)
  })
})
