-- cupons_premium_usos.liberado_em (23/nov/2026).
--
-- A card attempt that will never be paid (declined, 3DS failed, or opened
-- over 30 min ago without a charge) no longer spends a limited coupon. When a
-- coupon validation hits the limit, the server cancels that attempt's
-- PaymentIntent at Stripe and only then sets liberado_em on its use, so the
-- order can never be paid with the coupon afterwards. The row stays (history);
-- the counts ignore released rows: server/utils/cupons.ts and the free-path
-- claim below. Until this runs, the code counts every use, as before.
set local lock_timeout = '3s';

alter table public.cupons_premium_usos add column if not exists liberado_em timestamptz;

comment on column public.cupons_premium_usos.liberado_em is
  'Card attempt of this order will never be paid (its PaymentIntent was canceled first). Released uses do not count against the coupon limits.';

-- Free path: the same per-customer count, without released uses. Body
-- otherwise unchanged from 20260827220000_reivindicar_uso_cupom_gratis.sql.
create or replace function public.reivindicar_uso_cupom_gratis(
  p_cupom_id uuid,
  p_email text,
  p_limite_por_cliente integer
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_usos_atual integer;
  v_limite_global integer;
  v_usos_cliente integer;
begin
  select usos_atual, limite_uso_global
    into v_usos_atual, v_limite_global
    from public.cupons_premium
    where id = p_cupom_id
    for update;

  if not found then
    return false;
  end if;

  if v_limite_global is not null and v_usos_atual >= v_limite_global then
    return false;
  end if;

  select count(*) into v_usos_cliente
    from public.cupons_premium_usos
    where cupom_id = p_cupom_id and email = p_email and liberado_em is null;

  if p_limite_por_cliente is not null and v_usos_cliente >= p_limite_por_cliente then
    return false;
  end if;

  update public.cupons_premium
    set usos_atual = usos_atual + 1, updated_at = now()
    where id = p_cupom_id;

  return true;
end;
$$;

revoke execute on function public.reivindicar_uso_cupom_gratis(uuid, text, integer) from anon, authenticated, public;

notify pgrst, 'reload schema';
