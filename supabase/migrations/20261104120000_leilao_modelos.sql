-- Gancho por modelo na consulta gratis (04/nov/2026): quantas passagens por
-- leilao cada MARCA + MODELO tem na nossa base. A equipe de leiloes popula de
-- madrugada (upsert por marca+modelo). O site so le no servidor, com a service
-- key, e cacheia 24 h; a tela mostra uma frase sem numero quando qtd > 0.
-- Sem placa, sem chassi, sem nada de pessoa: e agregado por modelo.
create table if not exists public.leilao_modelos (
  id bigserial primary key,
  marca text not null,
  modelo text not null,
  qtd integer not null default 0 check (qtd >= 0),
  atualizado_em timestamptz not null default now(),
  unique (marca, modelo)
);

comment on table public.leilao_modelos is 'Passagens por leilao por marca+modelo (agregado). Populada pela equipe de leiloes; lida so pelo servidor (service role).';

-- RLS ligado e nenhuma policy: anon e authenticated nao leem nem escrevem.
-- So a service role (que ignora RLS) acessa, no servidor.
alter table public.leilao_modelos enable row level security;
revoke all on table public.leilao_modelos from anon, authenticated;

notify pgrst, 'reload schema';
