-- Origem de trafego no PROPRIO pedido pago.
--
-- Ate agora a origem de uma venda so existia na tabela `consultas` (consulta
-- gratis, com gclid/msclkid/utm) e o caminho pra chegar nela era
-- pedidos_premium.consulta_id. So que esse campo NUNCA apontou pra `consultas`:
-- ele guarda o id da consulta SENATRAN paga (tabela senatran_consultas), que
-- nasce depois do pagamento e nao carrega marca de anuncio nenhuma. O join
-- direto perdia 100% das vendas (36 de 36 pedidos com consulta_id preenchido).
--
-- Com a origem gravada no pedido, a atribuicao para de depender de casar placa
-- com janela de tempo.

alter table public.pedidos_premium
  add column if not exists gclid text,
  add column if not exists msclkid text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

create index if not exists idx_pedidos_premium_gclid on public.pedidos_premium (gclid) where gclid is not null;
create index if not exists idx_pedidos_premium_msclkid on public.pedidos_premium (msclkid) where msclkid is not null;
create index if not exists idx_pedidos_premium_utm_source on public.pedidos_premium (utm_source) where utm_source is not null;
