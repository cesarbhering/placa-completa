-- Price A/B test of the Completa (12/nov/2026, shared/ab-preco.ts).
-- 'A' = table price (R$ 44,90); 'B' = R$ 39,90, same presentation.
-- Null = order outside the test (flag off, app, missing/invalid variant) or
-- older than the test. Funnel events carry eventos_funil.extra->>'ab_preco'.
-- The site only writes/reads this column with NUXT_PUBLIC_AB_PRECO=on, so the
-- code can ship before this migration; apply it (prod AND staging) before
-- turning the flag on. RLS: pedidos_premium already has RLS on; inherited.
alter table public.pedidos_premium
  add column if not exists ab_preco text
    check (ab_preco is null or ab_preco in ('A', 'B'));

-- Daily report filters paid orders by arm and day.
create index if not exists pedidos_premium_ab_preco_idx
  on public.pedidos_premium (ab_preco, criado_em)
  where ab_preco is not null;

notify pgrst, 'reload schema';
