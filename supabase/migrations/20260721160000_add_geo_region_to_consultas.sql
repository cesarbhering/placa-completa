-- Codigo de regiao de circulacao (tabela REGSUSEP, 41 codigos) derivado
-- deterministicamente de UF+cidade do IP (server/utils/regiao-susep.ts).
-- Herda a precisao do geo por IP: em mobile/CGNAT e "regiao provavel".

alter table public.consultas
  add column if not exists geo_region_code text;
