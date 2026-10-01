-- Hook de recall da consulta gratis (pedido do Cesar, 01/out): o que a pessoa
-- viu (firme/suave = frase na tela; negativo; fora_escopo = marca sem base;
-- sem_sinal = erro/timeout) e a marca, no funil e no pedido. Igual ao
-- leilao_sinal/ab_bloco. Colunas nulas: eventos/pedidos antigos ficam null.
-- RLS: as duas tabelas ja tem RLS ligado (so service_role escreve/le); coluna
-- nova herda.

alter table public.eventos_funil
  add column if not exists recall_sinal text,
  add column if not exists recall_marca text;

alter table public.pedidos_premium
  add column if not exists recall_sinal text,
  add column if not exists recall_marca text;

do $$ begin
  alter table public.eventos_funil add constraint eventos_funil_recall_sinal_chk
    check (recall_sinal is null or recall_sinal in ('firme', 'suave', 'negativo', 'fora_escopo', 'sem_sinal'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.pedidos_premium add constraint pedidos_premium_recall_sinal_chk
    check (recall_sinal is null or recall_sinal in ('firme', 'suave', 'negativo', 'fora_escopo', 'sem_sinal'));
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
