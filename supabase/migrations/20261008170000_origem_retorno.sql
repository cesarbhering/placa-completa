-- Origem de anuncio lembrada por 30 dias (08/out/2026).
-- O clique em anuncio (gclid/msclkid/oppref ou utm de midia paga) fica 30 dias
-- no localStorage do navegador; numa sessao nova sem marca na URL a origem
-- volta e a linha grava origem_retorno = true. false = a marca veio na URL
-- desta visita (ou nao ha marca). Linhas antigas ficam false.
-- RLS: as duas tabelas ja tem RLS ligado; coluna nova herda.
alter table public.consultas
  add column if not exists origem_retorno boolean not null default false;
alter table public.pedidos_premium
  add column if not exists origem_retorno boolean not null default false;

notify pgrst, 'reload schema';
