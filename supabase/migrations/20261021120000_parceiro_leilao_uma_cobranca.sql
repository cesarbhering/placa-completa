-- Uma cobranca da base parceira por pedido (21/out/2026, caso BCK2C28 cobrado 2x).
-- O codigo tem lock por pedido (server/utils/parceiro-leilao.ts); este indice e a garantia no banco:
-- uma segunda linha cobrada do mesmo pedido e barrada (o codigo grava a tentativa como
-- cobrada=false com motivo "COBRANCA DUPLICADA" e alerta).
-- O corte de data deixa de fora o caso antigo (BCK2C28 ja tem 2 linhas cobradas, que sao verdade).
create unique index if not exists parceiro_leilao_chamadas_uma_cobranca_uq
  on public.parceiro_leilao_chamadas (pedido_id)
  where cobrada and pedido_id is not null and criado_em >= '2026-10-21 15:00:00+00';

notify pgrst, 'reload schema';
