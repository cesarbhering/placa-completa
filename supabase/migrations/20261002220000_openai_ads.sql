-- OpenAI Ads (ChatGPT Ads), 02/out/2026. oppref (id de atribuicao do clique,
-- vem na URL de entrada) e obref (cookie __obref do pixel) gravados na
-- consulta e no pedido pelo mesmo caminho do gclid (origem da sessao).
-- openai_capi_em / openai_capi_erro: controle do envio server-side do
-- order_created (Conversions API), feito por um worker separado do fluxo de
-- pagamento; retry idempotente pelo mesmo id (token do pedido).
-- RLS: as duas tabelas ja tem RLS ligado; coluna nova herda.
alter table public.consultas
  add column if not exists oppref text,
  add column if not exists obref text;

alter table public.pedidos_premium
  add column if not exists oppref text,
  add column if not exists obref text,
  add column if not exists openai_capi_em timestamptz,
  add column if not exists openai_capi_erro text;

notify pgrst, 'reload schema';
