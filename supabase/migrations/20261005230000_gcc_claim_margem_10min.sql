-- Claim da reserva GCC com margem de 10 min (era 1h). A consulta leva
-- segundos; com 1h, um hash com 21 min de vida foi pulado e venceu sem uso
-- (GCC id 41502, 03/out, ~R$7). Ordem: o que vence primeiro. O repositor
-- (contarReserva) usa o mesmo criterio pra decidir se compra.
create or replace function public.reivindicar_hash_reserva(p_ambiente text)
returns table (id uuid, numero_hash_consulta text, api_key_id uuid)
language plpgsql
as $$
begin
  return query
  update public.gcc_consentimentos g
     set status = 'em_uso'
   where g.id = (
     select c.id
       from public.gcc_consentimentos c
      where c.status = 'reserva'
        and c.ambiente = p_ambiente
        and c.expira_em > now() + interval '10 minutes'
      order by c.expira_em asc, c.created_at asc
      limit 1
      for update skip locked
   )
  returning g.id, g.numero_hash_consulta, g.api_key_id;
end;
$$;

revoke execute on function public.reivindicar_hash_reserva(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
