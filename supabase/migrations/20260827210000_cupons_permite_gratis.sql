-- Cupom 100%/gratis: alguns cupons podem furar o piso e zerar o preco do
-- relatorio (bypass do Pix no checkout). Default false: cupom comum continua
-- travado no piso (basica >= R$9,90 / completa >= R$14,90) como sempre foi.
alter table public.cupons_premium
  add column if not exists permite_gratis boolean not null default false;

notify pgrst, 'reload schema';
