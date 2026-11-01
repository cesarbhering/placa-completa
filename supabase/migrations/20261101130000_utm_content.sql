-- utm_content (01/nov/2026): variacao do anuncio, pras 100 variacoes do OpenAI
-- Ads. Mesmo caminho do utm_source/medium/campaign (shared/origem-trafego.ts):
-- texto saneado, ate 120 caracteres, nullable.
-- APLICAR ANTES DO DEPLOY: o servidor passa a mandar utm_content no insert de
-- consultas e pedidos_premium; sem a coluna o PostgREST recusa o insert.
-- RLS: as duas tabelas ja tem RLS ligado; coluna nova herda.
alter table public.consultas
  add column if not exists utm_content text
    check (utm_content is null or char_length(utm_content) <= 120);

alter table public.pedidos_premium
  add column if not exists utm_content text
    check (utm_content is null or char_length(utm_content) <= 120);

notify pgrst, 'reload schema';
