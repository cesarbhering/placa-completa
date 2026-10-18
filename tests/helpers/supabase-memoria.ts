// Supabase em memoria pros testes: so o subconjunto do query builder que o
// codigo de compras do app usa (select/insert/update, eq/is/lt, order, limit,
// maybeSingle/single, rpc). Unique opcional por tabela.
type Linha = Record<string, any>

export function supabaseMemoria(opts: { unicos?: Record<string, string[]>; rpc?: (nome: string, args: any) => any } = {}) {
  const tabelas: Record<string, Linha[]> = {}
  let seq = 0
  const tab = (n: string) => (tabelas[n] ||= [])

  function builder(nome: string) {
    let op: 'select' | 'insert' | 'update' = 'select'
    let payload: any = null
    const filtros: ((l: Linha) => boolean)[] = []
    let ordem: { col: string; asc: boolean } | null = null
    let lim = Infinity
    const run = (): { data: any; error: any } => {
      const t = tab(nome)
      if (op === 'insert') {
        const linha = { id: `id-${++seq}`, ...payload }
        for (const col of opts.unicos?.[nome] || []) {
          if (linha[col] != null && t.some((l) => l[col] === linha[col])) return { data: null, error: { code: '23505', message: `duplicate ${col}` } }
        }
        t.push(linha)
        return { data: [linha], error: null }
      }
      let sel = t.filter((l) => filtros.every((f) => f(l)))
      if (op === 'update') { sel.forEach((l) => Object.assign(l, payload)); return { data: sel, error: null } }
      if (ordem) { const o = ordem; sel = [...sel].sort((a, b) => (a[o.col] < b[o.col] ? -1 : a[o.col] > b[o.col] ? 1 : 0) * (o.asc ? 1 : -1)) }
      return { data: sel.slice(0, lim).map((l) => ({ ...l })), error: null }
    }
    const b: any = {
      select: () => b,
      insert: (p: any) => { op = 'insert'; payload = p; return b },
      update: (p: any) => { op = 'update'; payload = p; return b },
      eq: (c: string, v: any) => { filtros.push((l) => l[c] === v); return b },
      is: (c: string, v: any) => { filtros.push((l) => (l[c] ?? null) === v); return b },
      lt: (c: string, v: any) => { filtros.push((l) => l[c] < v); return b },
      order: (col: string, o?: { ascending?: boolean }) => { ordem = { col, asc: o?.ascending !== false }; return b },
      limit: (n: number) => { lim = n; return b },
      maybeSingle: async () => { const r = run(); return { data: r.data?.[0] ?? null, error: r.error } },
      single: async () => { const r = run(); return r.error ? { data: null, error: r.error } : { data: r.data?.[0] ?? null, error: r.data?.length ? null : { message: 'sem linha' } } },
      then: (ok: any, err: any) => Promise.resolve(run()).then(ok, err),
    }
    return b
  }

  return {
    tabelas,
    tab,
    from: (n: string) => builder(n),
    rpc: async (nome: string, args: any) => ({ data: opts.rpc ? opts.rpc(nome, args) : true, error: null }),
  }
}
