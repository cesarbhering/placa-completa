-- Qual adquirente criou a cobranca deste pedido.
--
-- A coluna abacatepay_id NAO foi renomeada de proposito: ela guarda o id da
-- cobranca no provedor, e renomear obrigaria a mexer em todo o fluxo de
-- pagamento por uma questao de nome. O que faltava era saber A QUEM perguntar
-- o status e a quem pedir o estorno.
--
-- Sem esta coluna, trocar a env de provedor faria os pedidos antigos baterem na
-- porta errada: a cobranca vive num adquirente e a consulta iria no outro.
-- Default 'abacatepay' porque e o que todo pedido existente usou.
alter table public.pedidos_premium
  add column if not exists pix_provider text not null default 'abacatepay';

comment on column public.pedidos_premium.pix_provider is
  'Adquirente que criou a cobranca: abacatepay ou woovi. Decide onde consultar status e pedir estorno.';

notify pgrst, 'reload schema';
