-- Atendimento pelo WhatsApp (bot N0 + fila N1 + escalada N2), etapa 1 (11/out/2026).
-- RLS ligada e SEM policy: so o service role (servidor) le e escreve.
-- Sem CPF/CNPJ em lugar nenhum (o texto do cliente e saneado antes de gravar).
-- O numero vai como hash (HMAC) e, para poder responder depois, cifrado
-- (AES-256-GCM, chave so no servidor) mais uma versao mascarada para leitura.

create table if not exists public.suporte_conversas (
  id uuid primary key default gen_random_uuid(),
  -- Uma linha por atendimento (a nota e por atendimento): o mesmo numero
  -- pode ter varias; a atual e a mais recente que nao esta encerrada.
  numero_hash text not null,
  jid_cifrado text not null,
  numero_mascarado text,
  mensagens jsonb not null default '[]'::jsonb,
  nivel text not null default 'N0' check (nivel in ('N0', 'N1', 'N2')),
  status text not null default 'aberta' check (status in ('aberta', 'aguardando_n1', 'escalada', 'silenciada', 'bloqueada', 'encerrada')),
  motivo text,
  pedido_id uuid,
  contadores jsonb not null default '{}'::jsonb,
  silenciado_ate timestamptz,
  ultima_resposta_em timestamptz,
  n2_email_em timestamptz,
  bloqueado_em timestamptz,
  -- Nota 0-5 pedida ao concluir ("De 0 a 5, como foi este atendimento?").
  -- Vale a primeira resposta numerica em 24 h; sem resposta, fica nula.
  nota_pedida_em timestamptz,
  nota smallint check (nota between 0 and 5),
  nota_em timestamptz,
  nivel_final text check (nivel_final in ('N0', 'N1', 'N2')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists suporte_conversas_numero_idx on public.suporte_conversas (numero_hash, criado_em desc);
create index if not exists suporte_conversas_status_idx on public.suporte_conversas (status, atualizado_em desc);
create index if not exists suporte_conversas_nota_idx on public.suporte_conversas (nota_em) where nota is not null;

create table if not exists public.suporte_tarefas (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.suporte_conversas (id) on delete cascade,
  resumo text not null,
  pergunta text,
  resposta text,
  status text not null default 'pendente' check (status in ('pendente', 'respondida', 'repassada', 'erro_repasse', 'descartada')),
  criado_em timestamptz not null default now(),
  respondida_em timestamptz,
  repassada_em timestamptz,
  escalada_em timestamptz,
  -- A equipe marca quando a resposta encerra o caso: o agente pede a nota depois.
  encerrar boolean not null default false
);
create index if not exists suporte_tarefas_status_idx on public.suporte_tarefas (status, criado_em);

create table if not exists public.suporte_bloqueios (
  numero_hash text primary key,
  motivo text not null,
  criado_em timestamptz not null default now(),
  desbloqueado_em timestamptz
);

alter table public.suporte_conversas enable row level security;
alter table public.suporte_tarefas enable row level security;
alter table public.suporte_bloqueios enable row level security;

notify pgrst, 'reload schema';
