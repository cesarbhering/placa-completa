-- De onde veio o oppref do pedido (27/out/2026): 'link' = origem da sessao
-- (URL desta visita ou clique lembrado, ver origem_retorno); 'cookie' = so o
-- cookie __oppref do SDK oaiq (clique no ChatGPT Ads ate 30 dias antes).
-- RLS: pedidos_premium ja tem RLS ligado; coluna nova herda.
alter table public.pedidos_premium
  add column if not exists oppref_origem text
    check (oppref_origem is null or oppref_origem in ('link', 'cookie'));

notify pgrst, 'reload schema';
