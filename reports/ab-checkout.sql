-- Teste A/B da confirmacao do checkout (27/out/2026, shared/ab-checkout.ts).
-- Mesma query do /usr/local/bin/pc-ab-checkout-report (e-mail 21h) e da secao
-- "Checkout A x B" do pc-ab-funil. Uma linha por variante e dia (BRT):
-- aberto = sessoes com premium_checkout_open/checkout_confirm_visto carimbadas;
-- iniciado = pedidos com ab_checkout (Pix gerado ou cartao), 1 por placa e dia;
-- pago = desses, pagos e nao reembolsados. Rodar no prod (fivalp).
with ab as (
  select extra->>'ab_checkout' v, (criado_em at time zone 'America/Sao_Paulo')::date dia, sessao
  from eventos_funil
  where extra->>'ab_checkout' in ('A','B')
    and evento in ('premium_checkout_open','checkout_confirm_visto')
    and coalesce(plano,'completa') = 'completa'
),
aberto as (select v, dia, count(distinct sessao) n from ab group by 1,2),
ped as (
  select ab_checkout v, (criado_em at time zone 'America/Sao_Paulo')::date dia, placa,
         bool_or(pago_em is not null and status <> 'reembolsado') pago,
         max(case when pago_em is not null and status <> 'reembolsado' then valor_centavos else 0 end) receita
  from pedidos_premium
  where ab_checkout in ('A','B') and coalesce(ambiente,'producao') = 'producao'
  group by 1,2,3
),
ini as (select v, dia, count(*) n, count(*) filter (where pago) pagos, coalesce(sum(receita),0) receita
        from ped group by 1,2)
select coalesce(a.v,i.v) v, coalesce(a.dia,i.dia)::text dia,
       coalesce(a.n,0) aberto, coalesce(i.n,0) iniciado, coalesce(i.pagos,0) pago, coalesce(i.receita,0) receita
from aberto a full join ini i on a.v = i.v and a.dia = i.dia
order by 2, 1;
