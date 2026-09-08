-- Marca quando o relatorio foi enviado por e-mail para um pedido que nasceu SEM
-- e-mail e ganhou um depois.
--
-- Contexto: desde que o e-mail saiu da frente do Pix, existe pedido pago sem
-- e-mail. Quando a pessoa informa o e-mail mais tarde, na propria tela do Pix
-- ou pelo suporte, o relatorio precisa sair na hora. Aconteceu de verdade hoje
-- (pedido de KCD1J29) e a entrega teve que ser feita a mao.
--
-- A coluna e a trava de idempotencia: quem consegue carimba-la e quem envia.
-- Sem ela, duas requisicoes ao mesmo tempo (ou a pessoa saindo e voltando do
-- campo) mandariam o mesmo relatorio duas vezes.
alter table public.pedidos_premium add column if not exists email_enviado_em timestamptz;

comment on column public.pedidos_premium.email_enviado_em is
  'Quando o relatorio foi enviado por e-mail depois do pedido ja estar pago. Nulo na entrega normal, que envia dentro do proprio fluxo.';

notify pgrst, 'reload schema';
