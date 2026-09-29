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
  it('repoe ate 2 quando o GCC devolve hash', async () => {
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

  it('teto DURO: com 2 na reserva nao gera nada (nao chama o GCC)', async () => {
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
