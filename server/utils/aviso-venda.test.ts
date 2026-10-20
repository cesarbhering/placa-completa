// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  origemDaConsulta, origemDoPedido, montarAvisoVenda, avisarVenda,
  rotuloLeilao, rotuloRecall, formaPagamento, canalDoPedido, brlCentavos,
  DESTINO_AVISO_VENDA, linhaRecompra, recompraDoPedido,
} from './aviso-venda'

const PEDIDO = {
  id: 'p1', placa: 'ABC1D23', plano: 'completa', valor_centavos: 3990,
  pago_em: '2026-10-08T18:00:00Z', email: 'comprador@exemplo.com', consulta_id: 'c1',
  token_entrega: 'TOK123', status: 'entregue', entregue_em: '2026-10-08T18:00:40Z',
  dispositivo: 'mobile', sistema: 'android', pix_provider: 'woovi', forma_pagamento: 'pix',
  canal: null, recall_sinal: null, recall_marca: null, cupom_origem: null, ambiente: 'producao',
  pagador_hash: 'h4sh-que-nao-pode-ir',
}

describe('origem (mesma regra do pc-venda-origem)', () => {
  it('ordem ChatGPT > Google > Bing > e-mail > utm > organico', () => {
    expect(origemDaConsulta({ oppref: 'x', gclid: 'g' })).toBe('ChatGPT Ads (OpenAI)')
    expect(origemDaConsulta({ gclid: 'g', msclkid: 'm', utm_campaign: 'Leilao' })).toBe('Google Ads / Leilao')
    expect(origemDaConsulta({ msclkid: 'm' })).toBe('Bing Ads')
    expect(origemDaConsulta({ utm_source: 'bing' })).toBe('Bing Ads')
    expect(origemDaConsulta({ utm_source: 'email' })).toBe('E-mail marketing (sem campanha)')
    expect(origemDaConsulta({ utm_source: 'Instagram', utm_campaign: 'c' })).toBe('instagram / c')
    expect(origemDaConsulta({})).toBe('Organico (direto/SEO, sem marca de anuncio)')
    expect(origemDaConsulta(null)).toBe('Indeterminada (sem consulta associada)')
  })
  it('cupom de recompra entra junto', () => {
    expect(origemDoPedido({ cupom_origem: 'cupom_recompra' }, { msclkid: 'm' })).toBe('Bing Ads + cupom de recompra 10%')
  })
  it('rotulos, pagamento, canal, valor', () => {
    expect(rotuloLeilao('positivo')).toBe('SIM, viu o sinal de leilao')
    expect(rotuloLeilao(null)).toMatch(/^sem registro/)
    expect(rotuloRecall('firme', 'VW')).toBe('SIM, viu (chassi na faixa da campanha) [VW]')
    expect(formaPagamento({ ...PEDIDO, forma_pagamento: 'cartao' })).toBe('Cartao (Stripe)')
    expect(formaPagamento({ ...PEDIDO, pix_provider: 'google_play' })).toBe('Google Play')
    expect(formaPagamento(PEDIDO)).toBe('Pix (woovi)')
    expect(canalDoPedido({ ...PEDIDO, pix_provider: 'google_play' })).toBe('APP Android (Google Play)')
    expect(brlCentavos(3990)).toBe('R$ 39,90')
  })
})

describe('montarAvisoVenda', () => {
  it('Botão: a porta de entrada do checkout; pedido antigo = não medido', () => {
    const x = { consulta: null, ab: null, leilaoSinal: null, recallSinal: null, recallMarca: null }
    expect(montarAvisoVenda({ ...PEDIDO, origem_checkout: 'barra_fixa' }, x).text).toContain('Botão: Barra fixa')
    expect(montarAvisoVenda({ ...PEDIDO, origem_checkout: 'pix_recovery' }, x).text).toContain('Botão: Recuperação de Pix')
    expect(montarAvisoVenda({ ...PEDIDO, origem_checkout: null }, x).text).toContain('Botão: não medido')
    expect(montarAvisoVenda({ ...PEDIDO, origem_checkout: 'lixo' }, x).text).toContain('Botão: não medido')
  })
  it('assunto e corpo com tudo que o e-mail de hoje tem, sem hash', () => {
    const { subject, text } = montarAvisoVenda({ ...PEDIDO, forma_pagamento: 'cartao' }, {
      consulta: { msclkid: 'm', utm_campaign: 'Leilao' }, ab: 'A2', leilaoSinal: 'positivo', recallSinal: 'suave', recallMarca: 'FIAT',
    })
    expect(subject).toBe('Venda: Bing Ads - ABC1D23 [CARTAO]')
    expect(text).toContain('Origem: Bing Ads / Leilao')
    expect(text).toContain('Valor: R$ 39,90')
    expect(text).toContain('E-mail do comprador: comprador@exemplo.com')
    expect(text).toContain('Relatorio: https://placacompleta.com.br/premium/TOK123')
    expect(text).toContain('Entrega: entregue em 2026-10-08T18:00:40Z UTC')
    expect(text).toContain('Teste A/B do bloco: A2')
    expect(text).toContain('Viu sinal de leilao na consulta gratis: SIM, viu o sinal de leilao')
    expect(text).toContain('[FIAT]')
    expect(text).not.toContain('h4sh')
    expect(text).not.toMatch(/CPF/i)
    expect(text).not.toContain('—')
  })
})

// Supabase falso: guarda os filtros de cada chamada e responde por tabela.
function supabaseFalso(opts: { jaAvisado?: boolean; ambiente?: string } = {}) {
  const estado = { aviso_venda_em: opts.jaAvisado ? 'x' : null as string | null, updates: [] as any[] }
  const builder = (tabela: string) => {
    const f: any = { tabela, filtros: [] as any[], update: null as any }
    const b: any = {
      update(v: any) { f.update = v; return b },
      select() { return b },
      eq(c: string, v: any) { f.filtros.push(['eq', c, v]); return b },
      is(c: string, v: any) { f.filtros.push(['is', c, v]); return b },
      ilike() { return b }, lte() { return b }, not() { return b }, order() { return b },
      limit() { return Promise.resolve({ data: tabela === 'eventos_funil' ? [{ extra: { ab_bloco: 'A' }, leilao_sinal: 'negativo' }] : [] }) },
      maybeSingle() { return Promise.resolve({ data: { gclid: 'g1' }, error: null }) },
      then(res: any, rej: any) {
        let out: any = { data: null, error: null }
        if (tabela === 'pedidos_premium' && f.update) {
          estado.updates.push(f.update)
          if (f.update.aviso_venda_em) {
            const ok = estado.aviso_venda_em === null && (opts.ambiente ?? 'producao') === 'producao'
            if (ok) estado.aviso_venda_em = f.update.aviso_venda_em
            out = { data: ok ? [{ ...PEDIDO, ambiente: opts.ambiente ?? 'producao' }] : [], error: null }
          } else {
            estado.aviso_venda_em = null
          }
        }
        return Promise.resolve(out).then(res, rej)
      },
    }
    return b
  }
  return { cliente: { from: builder }, estado }
}

describe('avisarVenda', () => {
  const config = { resendApiKey: 'k', public: {}, supabaseUrl: 'https://fivalpkfneadngxiflea.supabase.co' }
  beforeEach(() => { vi.restoreAllMocks() })

  it('marca aviso_venda_em e envia pro Cesar', async () => {
    const { cliente, estado } = supabaseFalso()
    const enviar = vi.fn(async () => {})
    const ok = await avisarVenda(cliente, 'p1', { config, supabaseConsultas: cliente, enviar })
    expect(ok).toBe(true)
    expect(estado.aviso_venda_em).not.toBeNull()
    expect(enviar).toHaveBeenCalledTimes(1)
    const msg = (enviar.mock.calls[0] as any)[0]
    expect(msg.to).toEqual([DESTINO_AVISO_VENDA])
    expect(msg.subject).toBe('Venda: Google Ads - ABC1D23')
    expect(msg.text).toContain('Teste A/B do bloco: A')
  })

  it('ja avisado (pelo timer ou por outra entrega): nao envia de novo', async () => {
    const { cliente } = supabaseFalso({ jaAvisado: true })
    const enviar = vi.fn(async () => {})
    expect(await avisarVenda(cliente, 'p1', { config, supabaseConsultas: cliente, enviar })).toBe(false)
    expect(enviar).not.toHaveBeenCalled()
  })

  it('envio falhou: desmarca pro timer mandar depois, e nao lanca', async () => {
    const { cliente, estado } = supabaseFalso()
    const enviar = vi.fn(async () => { throw new Error('resend fora') })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await avisarVenda(cliente, 'p1', { config, supabaseConsultas: cliente, enviar })).toBe(false)
    expect(estado.aviso_venda_em).toBeNull()
  })

  it('fora de prod (homolog/staging) nao envia', async () => {
    const { cliente, estado } = supabaseFalso()
    const enviar = vi.fn(async () => {})
    const staging = { ...config, supabaseUrl: 'https://nqhlxsvggrumgcceamwg.supabase.co' }
    expect(await avisarVenda(cliente, 'p1', { config: staging, supabaseConsultas: cliente, enviar })).toBe(false)
    expect(enviar).not.toHaveBeenCalled()
    expect(estado.updates).toHaveLength(0)
  })

  it('pedido de teste (ambiente homolog) nao e marcado nem enviado', async () => {
    const { cliente, estado } = supabaseFalso({ ambiente: 'homolog' })
    const enviar = vi.fn(async () => {})
    expect(await avisarVenda(cliente, 'p1', { config, supabaseConsultas: cliente, enviar })).toBe(false)
    expect(estado.aviso_venda_em).toBeNull()
    expect(enviar).not.toHaveBeenCalled()
  })
})

describe('recompra pelo pagador', () => {
  const HASH = 'a'.repeat(64)
  function sbAnteriores(linhas: any[], erro = false) {
    const chamadas: any[] = []
    const b: any = {
      select(c: string) { chamadas.push(['select', c]); return b },
      or(v: string) { chamadas.push(['or', v]); return b },
      eq(c: string, v: any) { chamadas.push(['eq', c, v]); return b },
      neq(c: string, v: any) { chamadas.push(['neq', c, v]); return b },
      not() { return b }, lt(c: string, v: any) { chamadas.push(['lt', c, v]); return b }, order() { return b },
      ilike() { return b }, lte() { return b },
      limit() { return Promise.resolve(erro ? { data: null, error: { message: 'x' } } : { data: linhas, error: null }) },
      maybeSingle() { return Promise.resolve({ data: { utm_source: 'bing' }, error: null }) },
    }
    return { cliente: { from: () => b }, chamadas }
  }

  it('sem hash nem fingerprint: nao identificado, sem consultar o banco', async () => {
    const { cliente, chamadas } = sbAnteriores([])
    expect(await recompraDoPedido(cliente, cliente, { id: 'p1', pago_em: 'x' })).toEqual({ identificado: false, anteriores: 0, primeira: null })
    expect(chamadas).toHaveLength(0)
  })

  it('hash invalido (com caractere estranho) nao entra no filtro', async () => {
    const { cliente, chamadas } = sbAnteriores([])
    await recompraDoPedido(cliente, cliente, { id: 'p1', pago_em: 'x', pagador_hash: 'a,b.eq.c' })
    expect(chamadas).toHaveLength(0)
  })

  it('1a compra: identificado, zero anteriores; filtra prod, sem o proprio pedido, pago antes', async () => {
    const { cliente, chamadas } = sbAnteriores([])
    const r = await recompraDoPedido(cliente, cliente, { id: 'p9', pago_em: '2026-10-08T18:00:00Z', pagador_hash: HASH, pagador_hash_cartao: 'Xt5EWLLDS7FJjR1c' })
    expect(r).toEqual({ identificado: true, anteriores: 0, primeira: null })
    expect(chamadas).toContainEqual(['or', `pagador_hash.eq.${HASH},pagador_hash_cartao.eq.Xt5EWLLDS7FJjR1c`])
    expect(chamadas).toContainEqual(['eq', 'ambiente', 'producao'])
    expect(chamadas).toContainEqual(['neq', 'id', 'p9'])
    expect(chamadas).toContainEqual(['lt', 'pago_em', '2026-10-08T18:00:00Z'])
  })

  it('recompra: conta as anteriores e usa a origem gravada no 1o pedido', async () => {
    const { cliente } = sbAnteriores([
      { id: 'a', pago_em: '2026-09-20T15:00:00Z', msclkid: 'm1' },
      { id: 'b', pago_em: '2026-10-01T15:00:00Z', gclid: 'g' },
    ])
    expect(await recompraDoPedido(cliente, cliente, { id: 'p9', pago_em: '2026-10-08T18:00:00Z', pagador_hash: HASH }))
      .toEqual({ identificado: true, anteriores: 2, primeira: { pago_em: '2026-09-20T15:00:00Z', origem: 'Bing Ads' } })
  })

  it('1o pedido sem origem propria: cai na consulta gratis dele', async () => {
    const { cliente } = sbAnteriores([{ id: 'a', pago_em: '2026-08-20T15:00:00Z', consulta_id: 'c0' }])
    const r = await recompraDoPedido(cliente, cliente, { id: 'p9', pago_em: '2026-10-08T18:00:00Z', pagador_hash: HASH })
    expect(r?.primeira?.origem).toBe('Bing Ads')
  })

  it('erro no banco: null (e-mail sai sem a linha quebrar nada)', async () => {
    const { cliente } = sbAnteriores([], true)
    expect(await recompraDoPedido(cliente, cliente, { id: 'p9', pago_em: '2026-10-08T18:00:00Z', pagador_hash: HASH })).toBeNull()
  })

  it('linha e assunto no e-mail, sem hash', () => {
    expect(linhaRecompra(null)).toBe('Recompra: sem identificador do pagador (nao da pra saber)')
    expect(linhaRecompra({ identificado: true, anteriores: 0, primeira: null })).toBe('Recompra: nao, 1a compra deste pagador')
    const rec = { identificado: true, anteriores: 2, primeira: { pago_em: '2026-09-20T15:00:00Z', origem: 'Bing Ads' } }
    expect(linhaRecompra(rec)).toBe('Recompra: SIM, 3a compra do mesmo pagador. 1a compra em 20/09/2026, origem: Bing Ads')
    const { subject, text } = montarAvisoVenda({ ...PEDIDO, pagador_hash: HASH }, {
      consulta: {}, ab: null, leilaoSinal: null, recallSinal: null, recallMarca: null, recompra: rec,
    })
    expect(subject).toBe('Venda: Organico - ABC1D23 [RECOMPRA]')
    expect(text).toContain('Recompra: SIM, 3a compra')
    expect(text).not.toContain(HASH)
    expect(text).not.toContain('—')
  })
})
