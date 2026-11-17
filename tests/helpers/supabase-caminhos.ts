// Fake of pedidos_premium over supabaseMemoria for the code that reads and
// filters JSON paths of relatorio_snapshot (the auction partner retry job):
// filters (eq/in/gte/is) and select aliases ("alias:relatorio_snapshot->a->b",
// "->>" as text) are applied as PostgREST does, and the filters are recorded,
// so a test can check the query that was built as well. Every other table goes
// to supabaseMemoria as is.
//
// Limitations (enough for the retry job, not a full PostgREST):
//  - order() does nothing: rows come in insertion order;
//  - a select awaited directly (without limit() or maybeSingle()) returns data null;
//  - rpc() always returns { data: true } (every named lock is taken);
//  - only eq() and in() go to the recorded filter list (gte() and is() are
//    applied, not recorded).
import type { supabaseMemoria } from './supabase-memoria'

/** Value of a column or JSON path of a row ("a->b->>c": the last step as text). */
export function valorDoCaminho(linha: any, col: string): any {
  const texto = col.includes('->>')
  let v: any = linha
  for (const k of col.split(/->>?/)) v = v == null ? undefined : v[k]
  if (!texto) return v
  return v == null ? null : typeof v === 'object' ? JSON.stringify(v) : String(v)
}

export function pedidosComCaminhos(base: ReturnType<typeof supabaseMemoria>) {
  const filtros: string[] = []
  const fake: any = { ...base, rpc: async () => ({ data: true, error: null }) }
  fake.from = (t: string) => {
    if (t !== 'pedidos_premium') return base.from(t)
    let sel = ''
    let upd: any = null
    const fs: ((l: any) => boolean)[] = []
    const linhas = () => base.tab('pedidos_premium').filter((l) => fs.every((f) => f(l)))
    const projetar = (l: any) => {
      if (!sel) return { ...l }
      const out: any = {}
      for (const c of sel.split(',')) {
        const [alias, col] = c.includes(':') ? c.split(':') : [c, c]
        out[alias] = valorDoCaminho(l, col)
      }
      return out
    }
    const q: any = {
      select: (c: string) => { sel = c; return q },
      eq: (c: string, v: any) => { filtros.push(`eq ${c} ${v}`); fs.push((l) => valorDoCaminho(l, c) === v); return q },
      gte: (c: string, v: any) => { fs.push((l) => valorDoCaminho(l, c) >= v); return q },
      in: (c: string, vs: any[]) => { filtros.push(`in ${c} ${vs.join('|')}`); fs.push((l) => vs.includes(valorDoCaminho(l, c))); return q },
      is: (c: string, v: any) => { fs.push((l) => (valorDoCaminho(l, c) ?? null) === v); return q },
      order: () => q,
      limit: async (n: number) => ({ data: linhas().slice(0, n).map(projetar), error: null }),
      update: (u: any) => { upd = u; return q },
      maybeSingle: async () => ({ data: linhas().map(projetar)[0] ?? null, error: null }),
      then: (ok: any, err: any) => {
        const alvo = linhas()
        if (upd) alvo.forEach((l) => Object.assign(l, upd))
        return Promise.resolve({ data: upd ? alvo.map((l) => ({ id: l.id })) : null, error: null }).then(ok, err)
      },
    }
    return q
  }
  return { fake, filtros }
}
