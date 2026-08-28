-- Snapshot imutavel do relatorio premium: o relatorio serve sempre da MESMA
-- fonte da verdade depois de montado uma vez, sem refazer chamadas externas
-- (vin-decoder/FIPE/seguro) a cada visualizacao. Uma nova consulta = novo
-- pedido pago, nunca reescreve um snapshot ja gravado.
--
-- relatorio_snapshot: payload agregado ja cortado pelo plano (filtrarPorPlano)
-- + valorCusto + chassiOrigem + camposRestantes -- tudo que report.get monta
-- hoje pra um pedido entregue, exceto os campos volateis de fluxo (status,
-- brCode, expiraEm), que continuam dinamicos e fora do snapshot.
-- snapshot_em: quando foi gravado (null = ainda nao existe, pedidos antigos
-- fazem backfill automatico na 1a visualizacao apos o deploy).
alter table public.pedidos_premium
  add column if not exists relatorio_snapshot jsonb,
  add column if not exists snapshot_em timestamptz;

comment on column public.pedidos_premium.relatorio_snapshot is
  'Payload agregado imutavel do relatorio (ja filtrado por plano). Gravado uma vez na entrega; nunca remontado por cima de um snapshot existente.';
comment on column public.pedidos_premium.snapshot_em is
  'Quando o snapshot foi gravado. Null = pedido entregue antigo, sem snapshot ainda (backfill lazy na 1a visualizacao).';

notify pgrst, 'reload schema';
