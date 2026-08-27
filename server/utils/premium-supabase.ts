import { createClient } from '@supabase/supabase-js'

// Cliente Supabase dedicado da v2 Premium (aponta pro projeto de HOMOLOGACAO,
// nqhlxsvggrumgcceamwg). Mantem o Supabase de prod intocado nesta fase.
export function usePremiumSupabase() {
  const config = useRuntimeConfig()
  if (!config.premiumSupabaseUrl || !config.premiumSupabaseKey) {
    throw createError({ statusCode: 503, message: 'Premium (homologacao) nao configurado.' })
  }
  return createClient(config.premiumSupabaseUrl, config.premiumSupabaseKey, {
    auth: { persistSession: false },
  })
}
