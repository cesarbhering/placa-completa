-- Plano SEO 02/out, item #13: pagina de entrada e referrer da sessao na
-- consulta gratis, pra separar organico de direto nas vendas. Capturados no
-- 1o acesso da sessao (plugins/track-origin.client.ts), saneados em
-- shared/origem-trafego.ts: referrer so o host (sem path/query), entrada so o
-- path. Colunas nulas: consultas antigas ficam null.
-- RLS: consultas ja tem RLS ligado; coluna nova herda (nada aberto aqui).
alter table public.consultas
  add column if not exists referrer text,
  add column if not exists landing_path text;

notify pgrst, 'reload schema';
