import { describe, it, expect } from 'vitest'
import { rodarFotosDepois, sanearRespostaFotos, ehRotaAusente, FOTOS_MAX_PEDIDOS, FOTOS_NOME_LOCK, FOTOS_LEASE_S, FOTOS_INTERVALO_MS } from './fotos-depois'
import { fotosPendentes } from '../../shared/foto-lote'

const REF = (n: number) => `ref${n}.abcdefABCDEF0123456789`
const AGORA = Date.parse('2026-10-18T12:00:00Z')
const DIA = 24 * 60 * 60 * 1000

function passagem(extra: any = {}) {
  return { nivel: 'possivel', fonte: 'copart', fonte_tipo: 'privado', lote: '123', ref: 'L1', detalhes: { fotos_pendente: true }, foto_refs: [], fotos: [], ...extra }
}

/** Supabase de mentira: pedidos em memoria, lock com lease de verdade. */
function fakeSupabase(pedidos: any[], opts: { lockErro?: boolean } = {}) {
  const lock: { dono?: string; ate?: number } = {}
  const updates: { id: string; snap: any }[] = []
  let agora = AGORA
  // Espelho da RPC fotos_passagem_gravar (migration 20261018120000): mexe SO
  // na passagem, no snapshot ATUAL da linha (jsonb_set), nunca no resto.
  const gravarPassagem = (a: any): string => {
    const ped = pedidos.find((x) => x.id === a.p_pedido)
    const lista = ped?.relatorio_snapshot?.historicoLeilao?.passagens
    if (!Array.isArray(lista)) return 'sem_snapshot'
    const k = (e: any) => [e?.fonte, e?.lote, e?.ref].map((v) => (v == null ? '' : String(v))).join('|')
    const i = lista.findIndex((e: any) => k(e) === [a.p_fonte, a.p_lote, a.p_ref].map((v) => (v == null ? '' : String(v))).join('|'))
    if (i < 0) return 'sem_passagem'
    const p = lista[i]
    if ((Array.isArray(p.foto_refs) && p.foto_refs.length) || (p.detalhes?.fotos || []).some((x: any) => typeof x?.foto_ref === 'string')) return 'ja_tem_foto'
    let novo: any
    if (a.p_foto_refs) { novo = { ...p, foto_refs: a.p_foto_refs, fotos_pendente: false }; delete novo.fotos_busca }
    else if (a.p_fotos_busca) { if (p.fotos_busca?.status === a.p_fotos_busca.status) return 'igual'; novo = { ...p, fotos_busca: a.p_fotos_busca } }
    else return 'invalido'
    lista[i] = novo
    updates.push({ id: ped.id, snap: ped.relatorio_snapshot })
    return 'gravado'
  }
  const sb: any = {
    updates,
    lock,
    setAgora: (t: number) => { agora = t },
    async rpc(nome: string, a: any) {
      if (nome === 'fotos_passagem_gravar') return { data: gravarPassagem(a), error: null }
      if (opts.lockErro) return { data: null, error: { message: 'Could not find the function public.job_lock_pegar' } }
      if (nome !== 'job_lock_pegar' || a.p_nome !== FOTOS_NOME_LOCK) return { data: null, error: { message: 'rpc?' } }
      if (!lock.dono || (lock.ate ?? 0) < agora || lock.dono === a.p_dono) {
        lock.dono = a.p_dono; lock.ate = agora + a.p_segundos * 1000
        return { data: true, error: null }
      }
      return { data: false, error: null }
    },
    from(tabela: string) {
      expect(tabela).toBe('pedidos_premium')
      const filtros: Record<string, any> = {}
      const q: any = {
        _sel: '',
        select(s: string) { q._sel = s; return q },
        eq(c: string, v: any) { filtros[c] = v; return q },
        gte(c: string, v: any) { filtros[`>=${c}`] = v; return q },
        order() { return q },
        limit() {
          const data = pedidos
            .filter((p) => p.status === filtros.status && p.plano === filtros.plano && p.entregue_em >= filtros['>=entregue_em'])
            .map((p) => ({ id: p.id, token_entrega: p.token_entrega, entregue_em: p.entregue_em, passagens: p.relatorio_snapshot?.historicoLeilao?.passagens ?? null }))
          return Promise.resolve({ data, error: null })
        },
        // O job nunca le-e-regrava o snapshot inteiro: so a RPC.
        maybeSingle() { throw new Error('nao deveria ler o snapshot inteiro') },
        update() { throw new Error('nao deveria regravar o snapshot inteiro') },
      }
      return q
    },
  }
  return sb
}

function pedido(id: string, passagens: any[], extra: any = {}) {
  return {
    id, token_entrega: `tok${id}abcdefgh`, status: 'entregue', plano: 'completa',
    entregue_em: new Date(AGORA - 2 * DIA).toISOString(),
    relatorio_snapshot: { recallBase: { x: 1 }, historicoLeilao: { resumo: {}, passagens } },
    ...extra,
  }
}

// $fetch (ofetch) poe o corpo parseado em e.data.
const erro404Rota = () => Object.assign(new Error('Not Found'), { statusCode: 404, data: { detail: 'Not Found' } })
const erro404Outro = () => Object.assign(new Error('Not Found'), { statusCode: 404, data: { detail: 'lote desconhecido' } })

describe('lock entre containers', () => {
  it('lease menor que o intervalo: a proxima rodada pode pegar de novo', () => {
    expect(FOTOS_LEASE_S * 1000).toBeLessThan(FOTOS_INTERVALO_MS)
  })

  it('so um container roda; o outro pula sem chamar a API', async () => {
    const pedidos = [pedido('a', [passagem()])]
    const sb = fakeSupabase(pedidos)
    const chamadas: string[] = []
    const buscar = async (b: any) => { chamadas.push(b.lote); return { status: 'buscando', fotos: [] } }
    const r1 = await rodarFotosDepois({ supabase: sb, buscar, dono: 'c1', agora: AGORA, log: () => {} })
    const r2 = await rodarFotosDepois({ supabase: sb, buscar, dono: 'c2', agora: AGORA, log: () => {} })
    expect(r1.rodou).toBe(true)
    expect(r2).toMatchObject({ rodou: false, motivo: 'lock com outro container' })
    expect(chamadas).toEqual(['123'])
  })

  it('lease vencido (container morreu): outro container assume', async () => {
    const sb = fakeSupabase([pedido('a', [passagem()])])
    const buscar = async () => ({ status: 'buscando', fotos: [] })
    await rodarFotosDepois({ supabase: sb, buscar, dono: 'c1', agora: AGORA, log: () => {} })
    sb.setAgora(AGORA + FOTOS_LEASE_S * 1000 + 1)
    const r = await rodarFotosDepois({ supabase: sb, buscar, dono: 'c2', agora: AGORA + FOTOS_LEASE_S * 1000 + 1, log: () => {} })
    expect(r.rodou).toBe(true)
  })

  it('sem a funcao de lock (migration nao aplicada): nao roda nada', async () => {
    const sb = fakeSupabase([pedido('a', [passagem()])], { lockErro: true })
    let chamou = false
    const r = await rodarFotosDepois({ supabase: sb, buscar: async () => { chamou = true; return {} }, dono: 'c1', agora: AGORA, log: () => {} })
    expect(r).toMatchObject({ rodou: false, motivo: 'lock indisponivel' })
    expect(chamou).toBe(false)
  })
})

describe('rodarFotosDepois', () => {
  it('ok com fotos: grava foto_refs SO na passagem certa e preserva o resto do snapshot', async () => {
    const outra = passagem({ fonte: 'superbid', lote: '9', ref: 'X' })
    const pedidos = [pedido('a', [outra, passagem()])]
    const sb = fakeSupabase(pedidos)
    const buscar = async (b: any) => b.fonte === 'copart'
      ? { status: 'ok', fotos: [{ ordem: 2, vista: 'traseira', foto_ref: REF(2) }, { ordem: 1, vista: 'frente', foto_ref: REF(1) }] }
      : { status: 'buscando', fotos: [] }
    const logs: string[] = []
    const r = await rodarFotosDepois({ supabase: sb, buscar, dono: 'c1', agora: AGORA, log: (m) => logs.push(m) })
    expect(r).toMatchObject({ rodou: true, pedidos: 1, chamadas: 2, gravados: 1 })
    const snap = pedidos[0].relatorio_snapshot
    expect(snap.recallBase).toEqual({ x: 1 })
    expect(snap.historicoLeilao.passagens[0]).toEqual(outra)
    expect(snap.historicoLeilao.passagens[1].foto_refs).toEqual([
      { ref: REF(1), ordem: 1, vista: 'frente' },
      { ref: REF(2), ordem: 2, vista: 'traseira' },
    ])
    expect(fotosPendentes(snap.historicoLeilao.passagens[1])).toBe(false)
    expect(logs.some((l) => l.includes('pedido a') && l.includes('copart:123=ok 2 fotos') && l.includes('superbid:9=buscando'))).toBe(true)
  })

  it('grava so na passagem: nao pisa no bloco que outro processo gravou no meio', async () => {
    const pedidos = [pedido('a', [passagem()])]
    const sb = fakeSupabase(pedidos)
    const buscar = async () => {
      // Enquanto a API responde, o bloco de multas e gravado por outro fluxo.
      pedidos[0].relatorio_snapshot = { ...pedidos[0].relatorio_snapshot, multas: { status: 'ok' } }
      return { status: 'ok', fotos: [{ ordem: 1, vista: 'frente', foto_ref: REF(1) }] }
    }
    await rodarFotosDepois({ supabase: sb, buscar, dono: 'c1', agora: AGORA, log: () => {} })
    expect(pedidos[0].relatorio_snapshot.multas).toEqual({ status: 'ok' })
    expect(pedidos[0].relatorio_snapshot.historicoLeilao.passagens[0].foto_refs).toHaveLength(1)
  })

  it('404 de ROTA (endpoint ainda nao no ar): para a rodada, sem erro e sem gravar', async () => {
    const pedidos = [pedido('a', [passagem()]), pedido('b', [passagem({ lote: '7' })])]
    const sb = fakeSupabase(pedidos)
    let n = 0
    const logs: string[] = []
    const r = await rodarFotosDepois({ supabase: sb, buscar: async () => { n++; throw erro404Rota() }, dono: 'c1', agora: AGORA, log: (m) => logs.push(m) })
    expect(r).toMatchObject({ rodou: true, apiAusente: true, gravados: 0 })
    expect(n).toBe(1)
    expect(sb.updates).toEqual([])
    expect(logs.join('\n')).toContain('ainda nao disponivel')
  })

  it('404 com outro corpo (lote que a API nao conhece): pula so aquela passagem', async () => {
    const pedidos = [pedido('a', [passagem()]), pedido('b', [passagem({ lote: '7' })])]
    const sb = fakeSupabase(pedidos)
    const buscar = async (b: any) => {
      if (b.lote === '123') throw erro404Outro()
      return { status: 'ok', fotos: [{ ordem: 1, vista: null, foto_ref: REF(7) }] }
    }
    const r = await rodarFotosDepois({ supabase: sb, buscar, dono: 'c1', agora: AGORA, log: () => {} })
    expect(r.apiAusente).toBeUndefined()
    expect(r).toMatchObject({ chamadas: 2, gravados: 1 })
  })

  it('erro 5xx/timeout: fail-open, segue pros outros pedidos', async () => {
    const pedidos = [pedido('a', [passagem()]), pedido('b', [passagem({ lote: '7' })])]
    const sb = fakeSupabase(pedidos)
    const buscar = async (b: any) => {
      if (b.lote === '123') throw Object.assign(new Error('boom'), { statusCode: 502 })
      return { status: 'ok', fotos: [{ ordem: 1, vista: null, foto_ref: REF(7) }] }
    }
    const r = await rodarFotosDepois({ supabase: sb, buscar, dono: 'c1', agora: AGORA, log: () => {} })
    expect(r.gravados).toBe(1)
    expect(pedidos[1].relatorio_snapshot.historicoLeilao.passagens[0].foto_refs).toHaveLength(1)
  })

  it('sem_foto e fonte_sem_foto: grava fotos_busca (o aviso some) e nao pergunta de novo', async () => {
    const pedidos = [pedido('a', [passagem({ fonte: 'vip', lote: '1' }), passagem({ fonte: 'sodre', lote: '2' }), passagem({ fonte: 'sodre', lote: '3' })])]
    const sb = fakeSupabase(pedidos)
    const chamadas: string[] = []
    const buscar = async (b: any) => { chamadas.push(`${b.fonte}:${b.lote}`); return { status: b.fonte === 'vip' ? 'sem_foto' : 'fonte_sem_foto', fotos: [] } }
    const fontesSemFoto = new Set<string>()
    await rodarFotosDepois({ supabase: sb, buscar, dono: 'c1', agora: AGORA, log: () => {}, fontesSemFoto })
    // sodre:3 nem e perguntado: a fonte ja respondeu que nao publica foto.
    expect(chamadas).toEqual(['vip:1', 'sodre:2'])
    const ps = pedidos[0].relatorio_snapshot.historicoLeilao.passagens
    expect(ps[0].fotos_busca.status).toBe('sem_foto')
    expect(ps[1].fotos_busca.status).toBe('fonte_sem_foto')
    expect(fotosPendentes(ps[0])).toBe(false)
    // Rodada seguinte (lease vencido): nada a perguntar pra vip:1 e sodre:2.
    sb.setAgora(AGORA + FOTOS_INTERVALO_MS)
    chamadas.length = 0
    await rodarFotosDepois({ supabase: sb, buscar, dono: 'c1', agora: AGORA + FOTOS_INTERVALO_MS, log: () => {}, fontesSemFoto: new Set() })
    expect(chamadas).toEqual(['sodre:3'])
  })

  it('buscando: nao grava nada; fotos que chegam depois entram na rodada seguinte', async () => {
    const pedidos = [pedido('a', [passagem()], { entregue_em: new Date(AGORA - 10 * DIA).toISOString() })]
    const sb = fakeSupabase(pedidos)
    await rodarFotosDepois({ supabase: sb, buscar: async () => ({ status: 'buscando', fotos: [] }), dono: 'c1', agora: AGORA, log: () => {} })
    expect(sb.updates).toEqual([])
    sb.setAgora(AGORA + FOTOS_INTERVALO_MS)
    await rodarFotosDepois({ supabase: sb, buscar: async () => ({ status: 'ok', fotos: [{ ordem: 1, vista: 'frente', foto_ref: REF(1) }] }), dono: 'c1', agora: AGORA + FOTOS_INTERVALO_MS, log: () => {} })
    expect(pedidos[0].relatorio_snapshot.historicoLeilao.passagens[0].foto_refs).toHaveLength(1)
  })

  it('so pedidos entregues, do plano completa, dos ultimos 90 dias, e passagem que precisa de foto', async () => {
    const pedidos = [
      pedido('velho', [passagem()], { entregue_em: new Date(AGORA - 91 * DIA).toISOString() }),
      pedido('pago', [passagem()], { status: 'pago' }),
      pedido('essencial', [passagem()], { plano: 'essencial' }),
      pedido('com-foto', [passagem({ foto_refs: [{ ref: REF(1), ordem: 1, vista: null }] })]),
      pedido('notificacao', [passagem({ fonte: 'detran_sp', fonte_tipo: 'detran', situacao: 'notificado' })]),
      pedido('detran-sem-pendente', [passagem({ fonte: 'detran_mg', fonte_tipo: 'detran', detalhes: {} })]),
      pedido('sem-lote', [passagem({ lote: null })]),
      pedido('ok', [passagem()]),
    ]
    const sb = fakeSupabase(pedidos)
    const vistos: string[] = []
    const logs: string[] = []
    await rodarFotosDepois({ supabase: sb, buscar: async () => ({ status: 'buscando', fotos: [] }), dono: 'c1', agora: AGORA, log: (m) => logs.push(m) })
    for (const l of logs) { const m = l.match(/pedido (\S+)/); if (m) vistos.push(m[1]) }
    expect(vistos).toEqual(['ok'])
  })

  it(`no maximo ${FOTOS_MAX_PEDIDOS} pedidos por rodada, revezando quem ficou "buscando"`, async () => {
    const pedidos = Array.from({ length: FOTOS_MAX_PEDIDOS + 5 }, (_, i) => pedido(`p${i}`, [passagem({ lote: String(i) })]))
    const sb = fakeSupabase(pedidos)
    const tentadoEm = new Map<string, number>()
    const buscar = async () => ({ status: 'buscando', fotos: [] })
    const r1 = await rodarFotosDepois({ supabase: sb, buscar, dono: 'c1', agora: AGORA, log: () => {}, tentadoEm })
    expect(r1.pedidos).toBe(FOTOS_MAX_PEDIDOS)
    sb.setAgora(AGORA + FOTOS_INTERVALO_MS)
    const logs: string[] = []
    await rodarFotosDepois({ supabase: sb, buscar, dono: 'c1', agora: AGORA + FOTOS_INTERVALO_MS, log: (m) => logs.push(m), tentadoEm })
    // Os 5 que ficaram de fora entram primeiro na rodada seguinte.
    const primeiros = logs.slice(0, 5).map((l) => l.match(/pedido (\S+)/)?.[1])
    expect(primeiros.every((id) => !tentadoEm.has(id!) || tentadoEm.get(id!) === AGORA + FOTOS_INTERVALO_MS)).toBe(true)
    expect(new Set(primeiros)).toEqual(new Set(pedidos.slice(FOTOS_MAX_PEDIDOS).map((p) => p.id)))
  })

  it('nunca manda e-mail: a unica escrita e o update do snapshot', async () => {
    const pedidos = [pedido('a', [passagem()])]
    const sb = fakeSupabase(pedidos)
    await rodarFotosDepois({ supabase: sb, buscar: async () => ({ status: 'ok', fotos: [{ ordem: 1, vista: 'frente', foto_ref: REF(1) }] }), dono: 'c1', agora: AGORA, log: () => {} })
    expect(sb.updates).toHaveLength(1)
    expect(Object.keys(sb.updates[0].snap)).toEqual(['recallBase', 'historicoLeilao'])
    expect(sb.updates[0].snap.recallBase).toEqual({ x: 1 })
  })
})

describe('gravacao, 404 e resposta', () => {
  it('passagem que ja ganhou foto no meio do caminho: nao sobrescreve', async () => {
    const ja = [{ ref: REF(9), ordem: 1, vista: null }]
    const pedidos = [pedido('a', [passagem()])]
    const sb = fakeSupabase(pedidos)
    const buscar = async () => {
      pedidos[0].relatorio_snapshot.historicoLeilao.passagens[0].foto_refs = ja
      return { status: 'ok', fotos: [{ ordem: 1, vista: 'frente', foto_ref: REF(1) }] }
    }
    const logs: string[] = []
    const r = await rodarFotosDepois({ supabase: sb, buscar, dono: 'c1', agora: AGORA, log: (m) => logs.push(m) })
    expect(r.gravados).toBe(0)
    expect(pedidos[0].relatorio_snapshot.historicoLeilao.passagens[0].foto_refs).toEqual(ja)
    expect(logs.join('\n')).toContain('nao gravou: ja_tem_foto')
  })

  it('ehRotaAusente: so o 404 do FastAPI pra rota inexistente', () => {
    expect(ehRotaAusente(erro404Rota())).toBe(true)
    expect(ehRotaAusente({ statusCode: 404, data: '{"detail":"Not Found"}' })).toBe(true)
    expect(ehRotaAusente(erro404Outro())).toBe(false)
    expect(ehRotaAusente({ statusCode: 404 })).toBe(false)
    expect(ehRotaAusente({ statusCode: 500, data: { detail: 'Not Found' } })).toBe(false)
  })

  it('resposta torta vira null; foto_ref invalido cai; ate 4', () => {
    expect(sanearRespostaFotos(null)).toBeNull()
    expect(sanearRespostaFotos({ status: 'talvez' })).toBeNull()
    const r = sanearRespostaFotos({ status: 'ok', fotos: [
      ...[1, 2, 3, 4, 5].map((n) => ({ ordem: n, vista: 'frente', foto_ref: REF(n) })),
      { ordem: 0, vista: 'frente', foto_ref: 'tem espaco <x>' },
    ] })
    expect(r!.fotos.map((f) => f.ordem)).toEqual([1, 2, 3, 4])
  })
})
