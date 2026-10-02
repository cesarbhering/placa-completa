-- Teste A/B do resultado, RODADA 3 (02/out/2026, decisao do Cesar): A venceu
-- a rodada 2 (A x B); agora A x A2 (A2 = card de oferta logo abaixo dos dados,
-- antes da ancora FIPE). Mesma view, so a coluna `fase` ganha 'rodada3', lida
-- do carimbo extra.ab_rodada que o client poe junto do ab_bloco. Parte da view
-- ATUAL (com canal), group by 1..6 igual.
drop view if exists funil_diario;

create view funil_diario as
select
  (e.criado_em at time zone 'America/Sao_Paulo')::date as dia,
  case
    when coalesce(e.origem->>'msclkid', '') <> '' or lower(coalesce(e.origem->>'utm_source', '')) in ('bing', 'microsoft') then 'bing'
    when coalesce(e.origem->>'gclid', '') <> '' or lower(coalesce(e.origem->>'utm_source', '')) = 'google' then 'google'
    when coalesce(e.origem->>'utm_source', '') = '' then 'organico'
    else 'outros'
  end as origem,
  -- 'sem_canal' cobre tudo que e anterior a migration do canal, pelo mesmo motivo
  -- do 'sem_ab': evento sem canal viraria uma linha de rotulo vazio.
  coalesce(nullif(e.canal, ''), 'sem_canal') as canal,
  coalesce(e.leilao_sinal, 'sem_sinal') as leilao_sinal,
  coalesce(nullif(e.extra->>'ab_bloco', ''), 'sem_ab') as ab_bloco,
  -- Fase do teste A/B. rodada3 (A x A2, 02/out/2026) vem do carimbo
  -- extra.ab_rodada='3' que o client poe em todo evento com variante: e exato
  -- (sessao aberta antes do deploy nao entra por engano) e nao depende do
  -- horario do deploy. layout_a = rodada 2 (A x B) pelo cutover de 25/set.
  case
    when e.extra->>'ab_rodada' = '3' then 'rodada3'
    when e.criado_em >= timestamptz '2026-09-25T19:37:40Z' then 'layout_a'
    else 'pre_layout_a'
  end as fase,
  count(distinct e.sessao) filter (where e.evento = 'resultado_exibido') as resultado_exibido,
  count(distinct e.sessao) filter (where e.evento = 'leilao_sinal_visto') as leilao_sinal_visto,
  count(distinct e.sessao) filter (where e.evento = 'cta_completa_visto') as cta_visto,
  count(distinct e.sessao) filter (where e.evento = 'cta_completa_click') as cta_click,
  count(distinct e.sessao) filter (where e.evento = 'premium_checkout_open') as checkout_open,
  count(distinct e.sessao) filter (where e.evento = 'checkout_confirm_visto') as confirm_visto,
  count(distinct e.sessao) filter (where e.evento = 'email_informado') as email_informado,
  count(distinct e.sessao) filter (where e.evento = 'pix_gerado') as pix_gerado,
  count(distinct e.sessao) filter (where e.evento = 'checkout_fechado_sem_pagar') as fechou_sem_pagar
from eventos_funil e
group by 1, 2, 3, 4, 5, 6;

comment on view funil_diario is 'Uma linha por dia BRT x origem x canal (app/web) x sinal de leilao x variante A/B x fase (pre_layout_a=#338 copy / layout_a=rodada 2 A x B, cutover 25/set 19:37:40 UTC / rodada3=A x A2, carimbo extra.ab_rodada=3), com sessoes distintas em cada etapa do funil.';

-- Recriar a view zera as opcoes: repoe o security_invoker da auditoria de RLS
-- de 30/set (20260930033000), senao a view volta a rodar como definer.
alter view public.funil_diario set (security_invoker = on);

notify pgrst, 'reload schema';
