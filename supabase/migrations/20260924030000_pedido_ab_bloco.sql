-- Variante do teste A/B (bloco/layout da consulta gratis) gravada NO PEDIDO.
--
-- Ate agora a variante ('A'/'B') so viajava nos eventos de funil
-- (extra->>'ab_bloco'), e a atribuicao de venda paga por variante saia de um
-- join fragil por placa. Com a coluna no pedido, o checkout carimba a variante
-- que a pessoa viu na hora da compra e a leitura A/B -> venda fica exata.
--
-- Nullable: pedidos anteriores ao teste ficam sem. O checkout so escreve 'A' ou
-- 'B' (valida antes); qualquer outra coisa vira null.
alter table pedidos_premium add column if not exists ab_bloco text;

notify pgrst, 'reload schema';
