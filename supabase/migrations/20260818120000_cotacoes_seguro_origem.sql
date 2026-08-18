-- Diferenciacao de origem do lead de seguro: consulta gratis vs consulta
-- paga (premium). Lead premium = usuario que pagou o relatorio completo,
-- intencao mais alta, deve ser priorizado na fila do corretor.
alter table public.cotacoes_seguro
  add column if not exists origem text not null default 'gratis';

alter table public.cotacoes_seguro
  drop constraint if exists cotacoes_seguro_origem_check;
alter table public.cotacoes_seguro
  add constraint cotacoes_seguro_origem_check
  check (origem in ('gratis', 'premium'));

-- priorizar/filtrar leads por origem na fila do corretor
create index if not exists idx_cotacoes_seguro_origem
  on public.cotacoes_seguro (origem, created_at desc);

notify pgrst, 'reload schema';
