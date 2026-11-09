-- Gate de e-mail da consulta gratis (09/nov/2026): a partir da terceira
-- consulta gratis em 24h (mesmo IP OU mesmo aparelho), o e-mail passa a ser
-- obrigatorio. O IP gira na mao de bot, entao a consulta passa a gravar tambem
-- um id aleatorio do navegador (UUID gerado no localStorage, sem dado pessoal).
--
-- Nullable: linhas antigas e clientes que nao mandam o id ficam com null e o
-- gate conta so pelo IP. O codigo tolera a coluna ainda nao existir (grava
-- sem ela e conta so pelo IP), entao a ordem deploy/migration nao quebra nada.

alter table public.consultas add column if not exists device_id text;

-- Contagem do gate: device + janela de 24h. Parcial porque so linhas novas tem
-- o id; o build e rapido com a coluna recem-criada (tudo null).
create index if not exists idx_consultas_device_created
  on public.consultas (device_id, created_at desc)
  where device_id is not null;

-- Contagem do gate por IP em 24h (e o teto de 5/IP/hora, que ja contava por
-- IP). Nenhuma migration do repo cria esse indice; se ja existir com outro
-- nome no banco, este fica redundante e pode ser dropado. Sem CONCURRENTLY
-- (migration roda em transacao): trava escrita em consultas durante o build.
create index if not exists idx_consultas_ip_created
  on public.consultas (ip_address, created_at desc);

notify pgrst, 'reload schema';
