import { describe, it, expect, vi, afterEach } from 'vitest'
import { reporReservaGcc, reivindicarReserva, limparReservaVencida } from './gcc-reserva'

// Testa o repositor (top-up ate 2, teto duro, deteccao de GCC fora + alerta) e o
// claim atomico (wrapper da RPC). A concorrencia real e garantida no SQL
// (`for update skip locked`); aqui cobrimos a logica volta.

// Mock encadeavel do supabase: cada .from(x) devolve um proxy thenable; o
// resolver decide o valor resolvido pelo table + metodos chamados.
function makeSupabase(cfg: {
  count?: number
  estado?: any
  insertError?: any
  updateData?: any[]
  rpc?: { data?: any; error?: any }
}) {
  const resolver = (table: string, names: string[]) => {
    if (table.startsWith('rpc:')) return cfg.rpc ?? { data: null, error: null }
    if (table === 'gcc_reserva_estado') {
      if (names.includes('upsert')) return {}
      return { data: cfg.estado ?? null }
    }
    // gcc_consentimentos
    if (names.includes('insert')) return { error: cfg.insertError ?? null }
    if (names.includes('update')) return { data: cfg.updateData ?? [] }
    return { count: cfg.count ?? 0 }
  }
  const chain = (table: string) => {
    const names: string[] = []
    const p: any = new Proxy(() => {}, {
      get(_t, prop: string) {
        if (prop === 'then') {
          const res = resolver(table, names)
          return (onF: any, onR: any) => Promise.resolve(res).then(onF, onR)
        }
        return (..._a: any[]) => { names.push(prop); return p }
      },
    })
    return p
  }
  return {
    from: (t: string) => chain(t),
    rpc: (fn: string, _args: any) => chain('rpc:' + fn),
  }
}

function stubGlobais(fetchImpl: any, sendSpy: any) {
  vi.stubGlobal('useRuntimeConfig', () => ({}))
  vi.stubGlobal('configPorAmbiente', () => ({ gccBase: 'https://gcc.example', cnpj: '123', template: 't-1' }))
  vi.stubGlobal('chavesCandidatas', async () => [{ id: 'key-1', api_key: 'ak_live' }])
  vi.stubGlobal('findHash', (o: any) => o?.numero_hash_consulta ?? null)
  vi.stubGlobal('sendErrorEmail', sendSpy)
  vi.stubGlobal('fetch', fetchImpl)
}

const HASH_OK = 'h.eyJleHAiOjk5OTk5OTk5OTl9.s' // exp la no futuro (2286)

afterEach(() => vi.unstubAllGlobals())

describe('reporReservaGcc', () => {
  it('reserva vazia: compra 2 (alvo 2)', async () => {
    const send = vi.fn(async () => {})
    const fetchImpl = vi.fn(async () => ({ status: 201, text: async () => JSON.stringify({ numero_hash_consulta: HASH_OK }) }))
    stubGlobais(fetchImpl, send)
    const supabase = makeSupabase({ count: 0, estado: { gcc_ok: true } })
    const r = await reporReservaGcc(supabase as any, 'producao')
    expect(r.criados).toBe(2)
    expect(r.reservaAtual).toBe(2)
    expect(r.gccOk).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(2) // teto duro: 2 POSTs
    expect(send).not.toHaveBeenCalled()        // GCC ok: sem alerta
  })

  it('com 2 validos na reserva nao gera nada (nao chama o GCC)', async () => {
    const send = vi.fn(async () => {})
    const fetchImpl = vi.fn()
    stubGlobais(fetchImpl, send)
    const supabase = makeSupabase({ count: 2, estado: { gcc_ok: true } })
    const r = await reporReservaGcc(supabase as any, 'producao')
    expect(r.criados).toBe(0)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('GCC fora ("03 Enfileirado", sem hash): gccOk=false e ALERTA (transicao ok->fora)', async () => {
    const send = vi.fn(async () => {})
    // 201 mas sem numero_hash_consulta (o modo de falha real do incidente)
    const fetchImpl = vi.fn(async () => ({ status: 201, text: async () => JSON.stringify({ id: null, status: '03', critica: 'Enfileirado para processamento' }) }))
    stubGlobais(fetchImpl, send)
    const supabase = makeSupabase({ count: 0, estado: { gcc_ok: true } })
    const r = await reporReservaGcc(supabase as any, 'producao')
    expect(r.criados).toBe(0)
    expect(r.gccOk).toBe(false)
    expect(send).toHaveBeenCalledTimes(1) // e-mail de "GCC sem gerar hash"
  })

  it('homolog nao dispara alerta (so producao)', async () => {
    const send = vi.fn(async () => {})
    const fetchImpl = vi.fn(async () => ({ status: 500, text: async () => 'erro' }))
    stubGlobais(fetchImpl, send)
    const supabase = makeSupabase({ count: 0, estado: { gcc_ok: true } })
    const r = await reporReservaGcc(supabase as any, 'homolog')
    expect(r.gccOk).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })
})

describe('reivindicarReserva', () => {
  it('devolve a linha quando a RPC acha um hash', async () => {
    const supabase = makeSupabase({ rpc: { data: [{ id: 'c1', numero_hash_consulta: 'h', api_key_id: 'k1' }] } })
    const r = await reivindicarReserva(supabase as any, 'producao')
    expect(r?.numero_hash_consulta).toBe('h')
  })
  it('null quando a reserva esta vazia', async () => {
    const supabase = makeSupabase({ rpc: { data: [] } })
    expect(await reivindicarReserva(supabase as any, 'producao')).toBeNull()
  })
  it('null (fail-open) quando a RPC erra', async () => {
    const supabase = makeSupabase({ rpc: { data: null, error: { message: 'boom' } } })
    expect(await reivindicarReserva(supabase as any, 'producao')).toBeNull()
  })
})

describe('limparReservaVencida', () => {
  it('conta as reservas vencidas marcadas', async () => {
    const supabase = makeSupabase({ updateData: [{ id: 'a' }, { id: 'b' }] })
    expect(await limparReservaVencida(supabase as any, 'producao')).toBe(2)
  })
})


// Regra do Cesar (05/out): consumir os hashes abertos em ordem (o que vence
// primeiro) antes de comprar outro; so compra quando a reserva zera.
describe('reserva com 3 validos: venda consome o mais antigo e NAO compra (sobram 2)', () => {
  // Banco em memoria com o mesmo criterio do SQL: claim = status reserva,
  // expira_em > agora+10min, ordem expira_em asc; contagem = mesmo filtro.
  function bancoEmMemoria(linhas: any[]) {
    const filtros: any[] = []
    const consulta = () => {
      const q: any = {
        select: () => q,
        eq: (c: string, v: any) => { filtros.push(['eq', c, v]); return q },
        gt: (c: string, v: any) => { filtros.push(['gt', c, v]); return q },
        then: (onF: any) => {
          const lim = filtros.find((f) => f[0] === 'gt')?.[2]
          const n = linhas.filter((l) => l.status === 'reserva' && l.expira_em > lim).length
          filtros.length = 0
          return Promise.resolve({ count: n }).then(onF)
        },
      }
      return q
    }
    const estado: any = {
      select: () => estado, eq: () => estado,
      maybeSingle: async () => ({ data: { gcc_ok: true } }),
      upsert: async () => ({}),
    }
    return {
      linhas,
      from: (t: string) => (t === 'gcc_reserva_estado' ? estado : consulta()),
      rpc: async (_fn: string, { p_ambiente }: any) => {
        const lim = new Date(Date.now() + 10 * 60_000).toISOString()
        const l = linhas
          .filter((x) => x.status === 'reserva' && x.ambiente === p_ambiente && x.expira_em > lim)
          .sort((a, b) => a.expira_em.localeCompare(b.expira_em))[0]
        if (!l) return { data: [], error: null }
        l.status = 'em_uso'
        return { data: [{ id: l.id, numero_hash_consulta: l.numero_hash_consulta, api_key_id: 'k' }], error: null }
      },
    }
  }
  const em = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()

  it('pega o que vence primeiro e a reposicao nao chama o GCC', async () => {
    const fetchImpl = vi.fn()
    stubGlobais(fetchImpl, vi.fn(async () => {}))
    const db = bancoEmMemoria([
      { id: 'novo', status: 'reserva', ambiente: 'producao', expira_em: em(20), numero_hash_consulta: 'h-novo' },
      { id: 'meio', status: 'reserva', ambiente: 'producao', expira_em: em(12), numero_hash_consulta: 'h-meio' },
      { id: 'velho', status: 'reserva', ambiente: 'producao', expira_em: em(5), numero_hash_consulta: 'h-velho' },
    ])
    const usado = await reivindicarReserva(db as any, 'producao')
    expect(usado?.id).toBe('velho')
    const r = await reporReservaGcc(db as any, 'producao')
    expect(r.criados).toBe(0)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(db.linhas.find((l) => l.id === 'novo')?.status).toBe('reserva')
  })

  it('1 valido (com 21 min de vida, caso do 41502): a venda consome e a reposicao compra 2 porque zerou', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 201, text: async () => JSON.stringify({ numero_hash_consulta: HASH_OK }) }))
    stubGlobais(fetchImpl, vi.fn(async () => {}))
    const db: any = bancoEmMemoria([
      { id: 'unico', status: 'reserva', ambiente: 'producao', expira_em: em(21 / 60), numero_hash_consulta: 'h-unico' },
    ])
    db.from = ((orig) => (t: string) => {
      const q = orig(t)
      if (t === 'gcc_consentimentos') q.insert = async () => ({ error: null })
      return q
    })(db.from)
    expect((await reivindicarReserva(db, 'producao'))?.id).toBe('unico')
    const r = await reporReservaGcc(db, 'producao')
    expect(r.criados).toBe(2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('hash com menos de 10 min nao conta: a venda nao usa e a reposicao compra 2', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 201, text: async () => JSON.stringify({ numero_hash_consulta: HASH_OK }) }))
    stubGlobais(fetchImpl, vi.fn(async () => {}))
    const db: any = bancoEmMemoria([
      { id: 'quase', status: 'reserva', ambiente: 'producao', expira_em: em(5 / 60), numero_hash_consulta: 'h-quase' },
    ])
    db.from = ((orig) => (t: string) => {
      const q = orig(t)
      if (t === 'gcc_consentimentos') q.insert = async () => ({ error: null })
      return q
    })(db.from)
    expect(await reivindicarReserva(db, 'producao')).toBeNull()
    const r = await reporReservaGcc(db, 'producao')
    expect(r.criados).toBe(2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
