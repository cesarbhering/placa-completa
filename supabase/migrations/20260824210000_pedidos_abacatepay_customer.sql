-- Id do cliente na AbacatePay (customer) associado ao pedido premium: rastreia
-- quem comprou, reaproveitavel entre cobrancas. Nullable (fail-open no checkout).
alter table pedidos_premium add column if not exists abacatepay_customer_id text;

notify pgrst, 'reload schema';
