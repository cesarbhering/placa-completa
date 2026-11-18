-- Late notice of an auction or damage sign (Cesar, 18/11/2026, "Avisar sempre"):
-- aviso_leilao_em marks only the AUCTION notice (at most one per order); a
-- notice that had only the damage sign goes to aviso_sinistro_em, so an
-- auction found later still gets its notice (server/utils/aviso-leilao.ts).
alter table public.pedidos_premium add column if not exists aviso_sinistro_em timestamptz;
notify pgrst, 'reload schema';
