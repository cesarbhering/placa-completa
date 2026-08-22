-- Cache das consultas wdapi2. O dado basico da placa (marca/modelo/ano/cor/
-- chassi/fipe) e praticamente estatico, entao guardamos a resposta bruta e
-- servimos dela por um TTL (180 dias), evitando pagar a API a cada consulta,
-- preview e estimativa da mesma placa. O dado oficial SENATRAN do premium NAO
-- passa por aqui: aquele continua consulta real a cada pedido pago.
create table if not exists placa_cache (
  placa text primary key,
  payload jsonb not null,
  encontrado boolean not null default true,
  fetched_at timestamptz not null default now()
);

notify pgrst, 'reload schema';
