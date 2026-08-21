alter table public.pedidos_premium add column if not exists debug_trace jsonb;
notify pgrst, 'reload schema';
