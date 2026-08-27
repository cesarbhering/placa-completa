-- PoC SENATRAN: log de TODA chamada externa (GCC + SENATRAN) pra alimentar o
-- dashboard web (chamadas realizadas e respostas recebidas), inclusive erros.
-- Api-Key sempre mascarada no campo request.
create table if not exists public.senatran_api_calls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  step text,             -- rotate-key | hash | consulta-senatran | seed
  method text,
  url text,
  request jsonb,
  http_status int,
  ok boolean,
  response jsonb,
  error text
);
create index if not exists senatran_api_calls_created_idx on public.senatran_api_calls (created_at desc);
