import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  motivoForaAvaliacao, selecionarAvaliacao, montarAvaliacaoEmail, rodarAvaliacaoGoogle, enviarAvaliacaoEmail,
  ESPERA_AVALIACAO_MS, type PedidoAvaliacao,
} from './avaliacao-google'

const DIA = 24 * 60 * 60 * 1000
const AGORA = Date.parse('2026-11-20T13:00:00Z')
const DESDE = Date.parse('2026-11-06T00:00:00Z')

const ped = (x: Partial<PedidoAvaliacao> = {}): PedidoAvaliacao => ({
  id: 'p1', email: 'Cliente@Exemplo.com ', placa: 'aaa1a11', status: 'entregue', valor_centavos: 3990,
  entregue_em: new Date(AGORA - 4 * DIA).toISOString(), ...x,
})
const filtro = (x: any = {}) => ({ agora: AGORA, desde: DESDE, excluir: new Set<string>(), jaEnviados: new Set<string>(), ...x })

describe('motivoForaAvaliacao', () => {
  it('pedido entregue, pago, 4 dias atras: recebe', () => {
    expect(motivoForaAvaliacao(ped(), filtro())).toBeNull()
  })
  it('R$ 0 fica fora', () => {
    expect(motivoForaAvaliacao(ped({ valor_centavos: 0 }), filtro())).toBe('gratis')
    expect(motivoForaAvaliacao(ped({ valor_centavos: null }), filtro())).toBe('gratis')
  })
  it('reembolsado/estornado fica fora', () => {
    expect(motivoForaAvaliacao(ped({ status: 'reembolsado' }), filtro())).toBe('reembolsado')
    expect(motivoForaAvaliacao(ped({ status: 'falha' }), filtro())).toBe('nao_entregue')
  })
  it('lista de exclusao (normalizada) fica fora', () => {
    expect(motivoForaAvaliacao(ped(), filtro({ excluir: new Set(['cliente@exemplo.com']) }))).toBe('excluido')
  })
  it('quem ja recebeu nao recebe de novo', () => {
    expect(motivoForaAvaliacao(ped(), filtro({ jaEnviados: new Set(['cliente@exemplo.com']) }))).toBe('ja_enviado')
  })
  it('antes de 3 dias: ainda nao; depois de 10: nao mais', () => {
    expect(motivoForaAvaliacao(ped({ entregue_em: new Date(AGORA - ESPERA_AVALIACAO_MS + 60_000).toISOString() }), filtro())).toBe('cedo')
    expect(motivoForaAvaliacao(ped({ entregue_em: new Date(AGORA - 3 * DIA).toISOString() }), filtro())).toBeNull()
    expect(motivoForaAvaliacao(ped({ entregue_em: new Date(AGORA - 11 * DIA).toISOString() }), filtro({ desde: 0 }))).toBe('tarde')
  })
  it('nada retroativo: entregue antes do corte do deploy fica fora', () => {
    expect(motivoForaAvaliacao(ped({ entregue_em: '2026-11-05T12:00:00Z' }), filtro())).toBe('antes_do_deploy')
  })
  it('sem e-mail fica fora', () => {
    expect(motivoForaAvaliacao(ped({ email: null }), filtro())).toBe('sem_email')
    expect(motivoForaAvaliacao(ped({ email: 'invalido' }), filtro())).toBe('sem_email')
  })
  it('envio nao depende de nota: campos de satisfacao nao mudam nada', () => {
    const comNota = { ...ped(), nota: 1, feedback_nota: 1 } as any
    expect(motivoForaAvaliacao(comNota, filtro())).toBeNull()
  })
})

describe('selecionarAvaliacao', () => {
  it('um e-mail por pessoa, mesmo com 2 pedidos', () => {
    const r = selecionarAvaliacao([
      ped({ id: 'b', entregue_em: new Date(AGORA - 4 * DIA).toISOString() }),
      ped({ id: 'a', email: 'cliente@exemplo.com', entregue_em: new Date(AGORA - 5 * DIA).toISOString() }),
    ], filtro())
    expect(r.map((p) => p.id)).toEqual(['a'])
  })
})

const BASE = 'https://placacompleta.com.br'
const TOK = 'fb_TOKENFICTICIO1234567890'

describe('montarAvaliacaoEmail', () => {
  it('assunto, texto aprovado e cinco links de nota', () => {
    const m = montarAvaliacaoEmail('aaa1a11', BASE, TOK)
    expect(m.assunto).toBe('Como foi a sua consulta no PlacaCompleta?')
    expect(m.texto).toBe([
      'Olá,', '',
      'Há alguns dias você consultou a placa AAA1A11 com a gente. Esperamos que o relatório tenha ajudado na sua decisão.', '',
      'De 1 a 5, como foi a sua experiência? É só clicar:',
      ...[1, 2, 3, 4, 5].map((n) => `${n}: ${BASE}/feedback/${TOK}?nota=${n}`), '',
      'Obrigado,', 'Equipe PlacaCompleta',
    ].join('\n'))
    for (const n of [1, 2, 3, 4, 5]) expect(m.html).toContain(`href="${BASE}/feedback/${TOK}?nota=${n}"`)
    expect(m.html).toContain('AAA1A11')
  })
  it('sem travessao, sem nome de orgao, sem cupom ou desconto, sem link direto do Google', () => {
    const m = montarAvaliacaoEmail('AAA1A11', BASE, TOK)
    for (const s of [m.assunto, m.html, m.texto]) {
      expect(s).not.toContain('—')
      expect(s).not.toMatch(/SENATRAN|DETRAN|cupom|desconto|brinde|g\.page/i)
    }
  })
})

describe('enviarAvaliacaoEmail', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  it('Resend de contato@ com reply_to contato@', async () => {
    const c: any[] = []
    vi.stubGlobal('useRuntimeConfig', () => ({ resendApiKey: 're_x' }))
    vi.stubGlobal('$fetch', vi.fn(async (_u: string, o: any) => { c.push(o); return {} }))
    expect(await enviarAvaliacaoEmail('cliente@exemplo.com', 'AAA1A11', TOK)).toBe(true)
    expect(c[0].body.from).toBe('PlacaCompleta <contato@placacompleta.com.br>')
    expect(c[0].body.reply_to).toBe('contato@placacompleta.com.br')
    expect(c[0].body.subject).toBe('Como foi a sua consulta no PlacaCompleta?')
  })
})

// Supabase de mentira: guarda os filtros da consulta e a tabela de envios.
function sb(pedidos: PedidoAvaliacao[], envios: string[] = [], conflito = false) {
  const tabela = new Set(envios)
  const filtros: any[] = []
  const inseridos: string[] = []
  const removidos: string[] = []
  const solicitacoes: any[] = []
  const cliente = {
    from(t: string) {
      const q: any = {
        select: () => q, order: () => q, limit: () => q,
        eq: (c: string, v: any) => {
          filtros.push(['eq', c, v])
          if (t === 'feedback_solicitacoes') {
            const i = solicitacoes.findIndex((r) => r.token === v)
            if (q._del && i >= 0) solicitacoes.splice(i, 1)
            if (q._upd && i >= 0) Object.assign(solicitacoes[i], q._upd)
            return q
          }
          if (q._del) { removidos.push(v); tabela.delete(v) }
          return q
        },
        gt: (c: string, v: any) => { filtros.push(['gt', c, v]); return q },
        gte: (c: string, v: any) => { filtros.push(['gte', c, v]); return q },
        lte: (c: string, v: any) => { filtros.push(['lte', c, v]); return q },
        not: (...a: any[]) => { filtros.push(['not', ...a]); return q },
        in: (_c: string, v: string[]) => { q._in = v; return q },
        update: (row: any) => { q._upd = row; return q },
        insert: async (row: any) => {
          if (t === 'feedback_solicitacoes') { solicitacoes.push(row); return { error: null } }
          if (conflito || tabela.has(row.email_norm)) return { error: { message: 'duplicate key' } }
          tabela.add(row.email_norm); inseridos.push(row.email_norm); return { error: null }
        },
        delete: () => { q._del = true; return q },
        then: (r: any) => r(t === 'pedidos_premium'
          ? { data: pedidos, error: null }
          : { data: [...tabela].filter((e) => !q._in || q._in.includes(e)).map((e) => ({ email_norm: e })), error: null }),
      }
      return q
    },
  }
  return { cliente, filtros, inseridos, removidos, tabela, solicitacoes }
}

const PROD = { supabaseUrl: 'https://prod.supabase.co', premiumBaseUrl: BASE, public: {} }

describe('rodarAvaliacaoGoogle', () => {
  it('fora de prod nao envia nada', async () => {
    const s = sb([ped()])
    const enviar = vi.fn(async () => true)
    const r = await rodarAvaliacaoGoogle(s.cliente, { agora: AGORA, desde: DESDE, enviar, cfg: { public: { staging: true } } })
    expect(r.fora_de_prod).toBe(true)
    expect(enviar).not.toHaveBeenCalled()
  })

  it('consulta so entregue, valor > 0, entre o corte e 3 dias atras', async () => {
    const s = sb([])
    await rodarAvaliacaoGoogle(s.cliente, { agora: AGORA, desde: DESDE, enviar: async () => true, cfg: PROD })
    expect(s.filtros).toContainEqual(['eq', 'status', 'entregue'])
    expect(s.filtros).toContainEqual(['gt', 'valor_centavos', 0])
    // inicio = o mais recente entre o corte do deploy e 10 dias atras
    expect(s.filtros).toContainEqual(['gte', 'entregue_em', new Date(Math.max(DESDE, AGORA - 10 * DIA)).toISOString()])
    expect(s.filtros).toContainEqual(['lte', 'entregue_em', new Date(AGORA - 3 * DIA).toISOString()])
  })

  it('envia uma vez, respeita exclusao e quem ja recebeu, refiltra R$0 e reembolso', async () => {
    const s = sb([
      ped({ id: 'ok', email: 'ok@exemplo.com' }),
      ped({ id: 'zero', email: 'zero@exemplo.com', valor_centavos: 0 }),
      ped({ id: 'reemb', email: 'reemb@exemplo.com', status: 'reembolsado' }),
      ped({ id: 'excl', email: 'Equipe@Exemplo.com' }),
      ped({ id: 'ja', email: 'ja@exemplo.com' }),
    ], ['ja@exemplo.com'])
    const enviar = vi.fn(async () => true)
    const r = await rodarAvaliacaoGoogle(s.cliente, { agora: AGORA, desde: DESDE, excluir: ['equipe@exemplo.com'], enviar, cfg: PROD })
    expect(r.enviados).toBe(1)
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(enviar).toHaveBeenCalledWith('ok@exemplo.com', 'aaa1a11', expect.stringMatching(/^fb_/))
    // Link proprio gravado em feedback_solicitacoes, com o envio carimbado.
    expect(s.solicitacoes).toHaveLength(1)
    expect(s.solicitacoes[0]).toMatchObject({ email: 'ok@exemplo.com', pedido_id: 'ok', placa: 'AAA1A11' })
    expect(s.solicitacoes[0].link).toBe(`${BASE}/feedback/${s.solicitacoes[0].token}`)
    expect(s.solicitacoes[0].email_enviado_em).toBeTruthy()
    expect(s.inseridos).toEqual(['ok@exemplo.com'])

    // Segunda rodada: o mesmo cliente nao recebe de novo.
    const r2 = await rodarAvaliacaoGoogle(s.cliente, { agora: AGORA, desde: DESDE, excluir: ['equipe@exemplo.com'], enviar, cfg: PROD })
    expect(r2.enviados).toBe(0)
    expect(enviar).toHaveBeenCalledTimes(1)
  })

  it('trava do banco: se outra rodada ja inseriu, nao envia', async () => {
    const s = sb([ped()], [], true)
    const enviar = vi.fn(async () => true)
    await rodarAvaliacaoGoogle(s.cliente, { agora: AGORA, desde: DESDE, enviar, cfg: PROD })
    expect(enviar).not.toHaveBeenCalled()
  })

  it('falha no envio solta a vaga para tentar de novo', async () => {
    const s = sb([ped()])
    const r = await rodarAvaliacaoGoogle(s.cliente, { agora: AGORA, desde: DESDE, enviar: async () => false, cfg: PROD })
    expect(r.falhas).toBe(1)
    expect(s.removidos).toEqual(['cliente@exemplo.com'])
    expect(s.tabela.size).toBe(0)
    expect(s.solicitacoes).toHaveLength(0)
  })

  it('dry-run nao envia nem grava, e a previa nao traz e-mail', async () => {
    const s = sb([ped()])
    const enviar = vi.fn(async () => true)
    const r = await rodarAvaliacaoGoogle(s.cliente, { agora: AGORA, desde: DESDE, dryRun: true, enviar, cfg: PROD })
    expect(r.candidatos).toBe(1)
    expect(enviar).not.toHaveBeenCalled()
    expect(s.inseridos).toEqual([])
    expect(JSON.stringify(r)).not.toContain('@')
  })
})
