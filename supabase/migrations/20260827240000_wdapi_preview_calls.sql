-- Rate-limit de 15/IP/hora pra wdapi (API paga) tinha um furo: cobria so
-- /api/consulta (grava em `consultas`), mas /api/premium/preview.post.ts
-- tambem dispara a wdapi (passo "confirmar veiculo" do checkout) e nao tinha
-- teto nenhum -- um bot podia raspar placas por ali sem limite. Tabela leve
-- so pra contar essas chamadas por IP; o teto combinado soma esta tabela +
-- `consultas` (ver server/utils/ip-wdapi-limit.ts). Idempotente.
create table if not exists public.wdapi_preview_calls (
  id bigint generated always as identity primary key,
  ip_address text not null,
  created_at timestamptz not null default now()
);

comment on table public.wdapi_preview_calls is
  'Marcador leve de chamada a /api/premium/preview, so pra somar no teto de 15/IP/hora da wdapi junto com a tabela consultas. Sem dado de veiculo aqui de proposito.';

create index if not exists wdapi_preview_calls_ip_created_idx
  on public.wdapi_preview_calls (ip_address, created_at);

-- Sem RLS de leitura/escrita publica: so o service_role (server) acessa.
alter table public.wdapi_preview_calls enable row level security;

notify pgrst, 'reload schema';
