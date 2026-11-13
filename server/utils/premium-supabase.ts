import { clienteSupabase } from './supabase'

// Cliente Supabase dedicado da v2 Premium (aponta pro projeto de HOMOLOGACAO,
// nqhlxsvggrumgcceamwg). Mantem o Supabase de prod intocado nesta fase.
// The client is reused across calls (see clienteSupabase in ./supabase.ts).
export function usePremiumSupabase() {
  const config = useRuntimeConfig()
  if (!config.premiumSupabaseUrl || !config.premiumSupabaseKey) {
    throw createError({ statusCode: 503, message: 'Premium (homologacao) nao configurado.' })
  }
  return clienteSupabase(config.premiumSupabaseUrl, config.premiumSupabaseKey)
}
