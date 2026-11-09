-- Which source answered each free lookup, so cost per source is a count and
-- not an estimate (Nov 9, 2026: a flat-fee provider became the primary plate
-- source and the per-call provider became the fallback).
--
--   'cache'     served from placa_cache, no provider call
--   'placafipe' primary provider (flat monthly fee, daily quota)
--   'wdapi'     fallback provider (charged per call)
--   null        nobody returned a vehicle (not found / sources down) or the
--               row predates this column
--
-- Adding a column to an existing table keeps its RLS as is (consultas is only
-- written and read by the service role). The app tolerates the column being
-- absent until this runs.

alter table public.consultas
  add column if not exists fonte_dados text;

alter table public.consultas
  drop constraint if exists consultas_fonte_dados_check;
alter table public.consultas
  add constraint consultas_fonte_dados_check
  check (fonte_dados is null or fonte_dados in ('cache', 'placafipe', 'wdapi'));

create index if not exists idx_consultas_fonte_dados
  on public.consultas (fonte_dados, created_at)
  where fonte_dados is not null;

notify pgrst, 'reload schema';
