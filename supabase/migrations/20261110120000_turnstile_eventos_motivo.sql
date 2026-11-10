-- Turnstile: por que a consulta gratis chegou sem token (10/nov/2026).
--
-- Em modo log, ~50% das consultas reais vinham 'ausente' sem dizer o motivo. O client
-- agora manda o motivo (timeout, interacao, sem_script, sem_widget, erro_<codigo>) e
-- quanto esperou pelo token. Sem PII. O codigo grava sem estas colunas enquanto a
-- migration nao roda (server/utils/turnstile.ts, gravarEventoTurnstile).
alter table public.turnstile_eventos
  add column if not exists motivo text check (motivo is null or motivo ~ '^[a-z_0-9]{1,24}$'),
  add column if not exists espera_ms integer check (espera_ms is null or espera_ms between 0 and 60000);

comment on column public.turnstile_eventos.motivo is 'So com resultado ausente: motivo informado pelo client (timeout, interacao, sem_script, sem_widget, erro_<codigo>).';
comment on column public.turnstile_eventos.espera_ms is 'Quanto o envio esperou pelo token no client (0 = ja estava pronto).';

notify pgrst, 'reload schema';
