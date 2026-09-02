-- Click ID do Microsoft/Bing Ads na consulta, irmao do gclid do Google.
-- Sem ele, venda vinda do Bing sem utm ficava indistinguivel de organica no
-- report: o auto-tagging do Microsoft manda msclkid e mais nada.

alter table public.consultas
  add column if not exists msclkid text;

create index if not exists idx_consultas_msclkid on public.consultas (msclkid) where msclkid is not null;
