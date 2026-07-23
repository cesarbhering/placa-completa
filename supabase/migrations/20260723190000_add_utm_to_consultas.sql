-- Origem de trafego da consulta: gclid (Google Ads auto-tagging) + utm_*.
-- Permite contar USUARIOS UNICOS vindos de anuncio e calcular custo de
-- aquisicao por pessoa (nao por consulta) no report diario.

alter table public.consultas
  add column if not exists gclid text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

create index if not exists idx_consultas_gclid on public.consultas (gclid) where gclid is not null;
