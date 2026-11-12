-- NFS-e: dados do tomador (pagador) e estado da nota por pedido.
create table if not exists public.pedidos_tomador (
  pedido_id uuid primary key references public.pedidos_premium(id) on delete cascade,
  documento_cifrado text not null,
  nome_cifrado text,
  tipo text check (tipo in ('CPF', 'CNPJ')),
  origem text,
  criado_em timestamptz default now()
);

-- RLS ligado e sem policies: so a service key do servidor acessa.
alter table public.pedidos_tomador enable row level security;

comment on table public.pedidos_tomador is 'Dados do pagador para a NFS-e (cifrados). Acesso so pelo servidor.';

alter table public.pedidos_premium
  add column if not exists nfse_status text,
  add column if not exists nfse_id text,
  add column if not exists nfse_numero text,
  add column if not exists nfse_serie text,
  add column if not exists nfse_chave text,
  add column if not exists nfse_emitida_em timestamptz,
  add column if not exists nfse_cancelada_em timestamptz,
  add column if not exists nfse_email_em timestamptz,
  add column if not exists nfse_erro text,
  add column if not exists nfse_atualizado_em timestamptz;

create index if not exists pedidos_premium_nfse_pendentes_idx
  on public.pedidos_premium (nfse_atualizado_em)
  where nfse_status in ('a_enfileirar', 'enfileirada');
