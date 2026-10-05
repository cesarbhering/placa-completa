-- Rastreio do hash GCC gasto + ordem de consumo da reserva (05/out).
--
-- 1) pedido_id: liga o consentimento (hash pago, ~R$7) a venda que o gastou.
--    O hash da reserva nasce sem placa e sem pedido; o update de 'spent' passa
--    a gravar placa, ambiente e pedido_id.
alter table public.gcc_consentimentos
  add column if not exists pedido_id uuid references public.pedidos_premium(id) on delete set null;

comment on column public.gcc_consentimentos.pedido_id is
  'Pedido premium que gastou este hash (null em reserva ainda nao usada e em consultas sem pedido).';

create index if not exists gcc_consentimentos_pedido_idx
  on public.gcc_consentimentos (pedido_id) where pedido_id is not null;

-- 2) Claim pela validade: sempre o hash MAIS PROXIMO de vencer (regra do
--    Cesar: hash vencido sem uso e pago a toa). Antes ordenava por created_at,
--    que so coincidia porque o TTL e fixo. Margem de 1h mantida.
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
        and c.expira_em > now() + interval '1 hour'
      order by c.expira_em asc, c.created_at asc
      limit 1
      for update skip locked
   )
  returning g.id, g.numero_hash_consulta, g.api_key_id;
end;
$$;

revoke execute on function public.reivindicar_hash_reserva(text) from public, anon, authenticated;

create index if not exists gcc_consentimentos_reserva_exp_idx
  on public.gcc_consentimentos (ambiente, expira_em)
  where status = 'reserva';

notify pgrst, 'reload schema';
