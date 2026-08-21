alter table public.gcc_api_keys add column if not exists ambiente text not null default 'homolog';
alter table public.pedidos_premium add column if not exists ambiente text not null default 'homolog';
create index if not exists gcc_api_keys_ambiente_idx on public.gcc_api_keys (ambiente, status);
notify pgrst, 'reload schema';
