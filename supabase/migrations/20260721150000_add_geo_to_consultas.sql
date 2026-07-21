-- Cidade/UF/pais do visitante (geolocalizacao por IP via ip-api) na consulta.
-- Precisao: boa em banda larga fixa; em 4G/5G o CGNAT costuma resolver pra
-- cidade do gateway da operadora - tratar como "regiao provavel", nao endereco.

alter table public.consultas
  add column if not exists geo_city text,
  add column if not exists geo_uf text,
  add column if not exists geo_country text;
