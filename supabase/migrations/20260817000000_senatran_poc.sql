-- PoC SENATRAN (homologacao): gestao das chaves GCC (Quem Me Viu), dos hashes
-- de consentimento e das consultas de veiculo. Tabelas usadas pela ferramenta
-- em /opt/senatran-poc (fora do repo). Sem dado de producao por enquanto.

-- Chaves da API GCC. Uma 'active' por vez; historico das rotacionadas fica.
create table if not exists public.gcc_api_keys (
  id uuid primary key default gen_random_uuid(),
  api_key text not null,
  status text not null default 'active',      -- active | rotated | expired
  created_at timestamptz not null default now(),
  expires_at timestamptz,                     -- created + 3 meses (vencimento)
  rotate_after timestamptz,                   -- created + 2 meses (hora de rotacionar)
  rotated_at timestamptz,
  raw_response jsonb,                          -- resposta crua do /chaves-api/gerar
  note text
);
create index if not exists gcc_api_keys_status_idx on public.gcc_api_keys (status);

-- Hashes de consentimento (numero_hash_consulta) gerados pra gastar no SENATRAN.
create table if not exists public.gcc_consentimentos (
  id uuid primary key default gen_random_uuid(),
  numero_hash_consulta text not null,
  status text not null default 'created',     -- created | spent | error
  placa text,
  api_key_id uuid references public.gcc_api_keys (id),
  created_at timestamptz not null default now(),
  spent_at timestamptz,
  raw_response jsonb                           -- resposta crua do /consentimentos-ciencias
);
create index if not exists gcc_consentimentos_status_idx on public.gcc_consentimentos (status);

-- Resultado das consultas de veiculo no SENATRAN (gastando o hash).
create table if not exists public.senatran_consultas (
  id uuid primary key default gen_random_uuid(),
  placa text not null,
  consentimento_id uuid references public.gcc_consentimentos (id),
  numero_hash_consulta text,
  http_status int,
  ok boolean,
  response jsonb,
  created_at timestamptz not null default now()
);
create index if not exists senatran_consultas_placa_idx on public.senatran_consultas (placa);
