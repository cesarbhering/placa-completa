-- Valor da cotacao REAL fechada pelo corretor (preenchido manualmente no
-- Studio pos-contato). Vai construindo a base proprietaria de precos
-- modernos (BYD/GWM etc) que a base SUSEP 2021 nao cobre.

alter table public.cotacoes_seguro
  add column if not exists premio_cotado numeric,
  add column if not exists seguradora text;
