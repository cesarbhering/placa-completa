-- Mudanca de direcao do Cesar: cupom valida contra a API da AbacatePay
-- (fonte da verdade e la, ele cria os cupons no dashboard dela), nao mais
-- contra a nossa tabela cupons_premium. cupons_premium_usos vira SO log de
-- uso pro P&L do @fin (preco_bruto/valor_desconto/preco_liquido fixados na
-- hora da compra) — cupom_id passa a guardar o codigo/id do cupom NA
-- ABACATEPAY (texto), nao mais uma FK pra cupons_premium.
--
-- cupons_premium/cupons_premium_usos ja existiam (migration da PR #120).
-- Aqui so soltamos a FK e trocamos o tipo da coluna; cupons_premium fica
-- parada (decisao do Lead: nao usar pra validar, decide depois se dropa).
alter table public.cupons_premium_usos
  drop constraint if exists cupons_premium_usos_cupom_id_fkey;

alter table public.cupons_premium_usos
  alter column cupom_id type text using cupom_id::text;

comment on column public.cupons_premium_usos.cupom_id is
  'Codigo/id do cupom NA ABACATEPAY (na API deles, id do cupom = o codigo). '
  'Nao referencia mais cupons_premium: esta tabela e so log de uso pro P&L, '
  'a fonte da verdade do cupom e a API da AbacatePay.';

notify pgrst, 'reload schema';
