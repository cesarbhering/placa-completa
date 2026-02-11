export default defineEventHandler(async () => {
  const supabase = useSupabaseServer()
  const { count } = await supabase
    .from('consultas')
    .select('*', { count: 'exact', head: true })

  return { count: count || 0 }
})
