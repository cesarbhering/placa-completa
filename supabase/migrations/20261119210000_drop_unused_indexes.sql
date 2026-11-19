-- Unused or duplicated indexes (Supabase size audit, 19/nov/2026).
-- Usage counted from pg_stat_user_indexes, statistics kept since 08/dec/2025.
--
-- idx_consultas_ip_address (2.6 MB): every lookup by ip also filters or orders
--   by created_at and uses idx_consultas_ip_created (ip_address, created_at desc),
--   which has the same leading column. Last scan on 09/nov.
-- idx_consultas_cache_hit (0.6 MB): never scanned.
-- cupons_premium_codigo_idx: same btree (codigo) as the unique cupons_premium_codigo_key.
-- usuarios_email_idx: same btree (email) as the unique usuarios_email_key.
--
-- Plain DROP INDEX: migrations run inside a transaction, where CONCURRENTLY is
-- not allowed. The lock only lasts while the catalog entry is removed, but
-- while the DROP waits for it every new read and insert on consultas queues
-- behind it; the lock timeout gives up after 3 s (nothing dropped, try again).
-- Apply in a quiet window, e.g. 02h00 to 02h30.
set local lock_timeout = '3s';

drop index if exists public.idx_consultas_ip_address;
drop index if exists public.idx_consultas_cache_hit;
drop index if exists public.cupons_premium_codigo_idx;
drop index if exists public.usuarios_email_idx;
