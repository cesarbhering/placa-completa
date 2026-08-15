-- Log das consultas feitas por agentes/LLMs ao endpoint /llms (reverse mullet).
-- Fire-and-forget: nunca bloqueia a resposta. Serve pra medir se os modelos
-- estao batendo no endpoint e o que perguntam.
create table if not exists public.agent_queries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  query text not null,
  intent text,
  matched boolean not null default false,
  format text,               -- 'text' | 'json'
  user_agent text,
  geo_country text
);

create index if not exists agent_queries_created_at_idx on public.agent_queries (created_at desc);
create index if not exists agent_queries_intent_idx on public.agent_queries (intent);
