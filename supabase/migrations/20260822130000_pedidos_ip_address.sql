-- IP do comprador no pedido premium. Usado pra "resetar" o limite de 5 consultas
-- gratis por hora: uma compra paga zera o contador do usuario (casado por IP OU
-- email). Nullable: pedidos antigos ficam sem IP, sem reset retroativo.
alter table pedidos_premium add column if not exists ip_address text;

notify pgrst, 'reload schema';
