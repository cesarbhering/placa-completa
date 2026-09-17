-- Aparelho do comprador no pedido premium (so a categoria, sem User-Agent cru).
-- Motivo: no Bing 100% das vendas vieram de computador e no Google 82% dos cliques
-- sao de celular; sem saber de onde o COMPRADOR vem nao da pra ajustar lance por
-- aparelho. Nullable: pedidos antigos ficam sem.
alter table pedidos_premium add column if not exists dispositivo text;
alter table pedidos_premium add column if not exists sistema text;

notify pgrst, 'reload schema';
