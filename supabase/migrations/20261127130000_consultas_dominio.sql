-- Which of our domains the visitor was on when the free check ran (Cesar, 27/11/2026):
-- placacompleta, olhonamoto, olhonocaminhao, app, staging, homolog. Read server-side from the
-- request Host. Before this, a sale coming through olhonamoto.com.br or olhonocaminhao.com.br
-- could not be told apart from one through placacompleta.com.br.
alter table public.consultas add column if not exists dominio text;
