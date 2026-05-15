export default defineEventHandler(async (event) => {
  // Edge-cache for 60s + stale-while-revalidate so the counter is "near live"
  // without hammering Supabase on every page load.
  setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300')

  const supabase = useSupabaseServer()
  const { count } = await supabase
    .from('consultas')
    .select('*', { count: 'exact', head: true })

  return { count: count || 0 }
})
