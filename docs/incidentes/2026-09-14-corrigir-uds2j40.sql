-- Pedido 362f040a (placa UDS2J40): o estorno foi confirmado na AbacatePay, mas
-- o pedido ficou com status 'falha', entao a tela diz "nao foi possivel
-- concluir" sem dizer que o dinheiro voltou.
--
-- Nao vem com migration de proposito: e correcao de UM registro, nao mudanca de
-- esquema. Rodar uma vez, em producao.
update public.pedidos_premium
   set status = 'reembolsado',
       erro = coalesce(erro, '') || ' | reembolso: confirmado na AbacatePay (REFUNDED), status corrigido a mao em 14/set'
 where id = '362f040a-7a0c-4fe1-aaa9-9b64724437bc'
   and status = 'falha'
returning id, placa, status;
