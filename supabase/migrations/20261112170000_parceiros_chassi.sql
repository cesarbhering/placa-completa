-- Partners that see the full chassis number on the free lookup (Cesar, 12/nov/2026).
-- Access by magic link (or a short code typed inside the app): a signed cookie
-- per device, checked against parceiros_chassi.ativo on every lookup.
-- Revoke = ativo false. RLS on with no policy: service role only.

create table if not exists public.parceiros_chassi (
  id                uuid primary key default gen_random_uuid(),
  email_normalizado text not null unique check (email_normalizado = lower(btrim(email_normalizado))),
  nome_empresa      text,
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now()
);

-- One row per link request. Only hashes are stored: the link token and the
-- 8-character code that goes in the same e-mail (for the Android app, whose
-- WebView does not share cookies with Chrome). Single use, 30 min.
create table if not exists public.parceiros_chassi_tokens (
  hash        text primary key,
  codigo_hash text not null,
  parceiro_id uuid not null references public.parceiros_chassi(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null,
  usado_em    timestamptz,
  tentativas  int not null default 0
);
create index if not exists parceiros_chassi_tokens_parceiro_idx on public.parceiros_chassi_tokens (parceiro_id, criado_em desc);

-- Each lookup served with the partner rule: the 20/hour limit and the audit trail.
create table if not exists public.parceiros_chassi_uso (
  id          bigint generated always as identity primary key,
  parceiro_id uuid not null references public.parceiros_chassi(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  placa       text,
  ip_hash     text,
  canal       text
);
create index if not exists parceiros_chassi_uso_parceiro_idx on public.parceiros_chassi_uso (parceiro_id, criado_em desc);

alter table public.parceiros_chassi enable row level security;
alter table public.parceiros_chassi_tokens enable row level security;
alter table public.parceiros_chassi_uso enable row level security;

comment on table public.parceiros_chassi is 'Partners that get the full chassis on the free lookup. Revoke with ativo=false.';
comment on table public.parceiros_chassi_tokens is 'Single-use login links/codes for partners (sha256 only), 30 min.';
comment on table public.parceiros_chassi_uso is 'Free lookups served with the partner rule (20/hour limit, audit).';

notify pgrst, 'reload schema';
