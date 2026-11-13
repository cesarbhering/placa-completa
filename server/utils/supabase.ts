import { createClient } from '@supabase/supabase-js'

type ClienteSupabase = ReturnType<typeof createClient>

// One database client per process for each URL and key, reused by every call.
//
// These clients only ever use a fixed key: there is no session to keep, to
// refresh or to read from a URL, so the three are turned off and a client
// holds no timer.
//
// The client is kept by URL and key, so another configuration (another
// environment, a test) gets a client of its own.
const clientes = new Map<string, ClienteSupabase>()

/** The client of this process for the given URL and key, created on first use. */
export function clienteSupabase(url: string, chave: string): ClienteSupabase {
  const id = `${url}\n${chave}`
  let cliente = clientes.get(id)
  if (!cliente) {
    cliente = createClient(url, chave, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    clientes.set(id, cliente)
  }
  return cliente
}

export function useSupabaseServer() {
  const config = useRuntimeConfig()
  return clienteSupabase(config.supabaseUrl, config.supabaseKey)
}
