-- Teste A/B do bloco bloqueado da consulta gratis (21/set/2026, 5 dias).
--
-- A variante ('A' = tela de hoje, 'B' = copy do veiculo especifico) e sorteada
-- no navegador e viaja em extra->>'ab_bloco' de TODO evento da visita. Sem ela
-- como coluna da view, o funil continuaria somando as duas variantes na mesma
-- linha e o teste nao teria leitura: o que decide e cta_visto -> cta_click e
-- checkout_open -> pix_gerado POR variante.
--
-- Drop + create em vez de create or replace: a coluna nova entra no meio da
-- lista (ao lado das outras quebras) e replace so aceita coluna no fim.
-- Nenhuma linha e perdida: a view nao guarda dado, le eventos_funil.
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
  coalesce(e.leilao_sinal, 'sem_sinal') as leilao_sinal,
  -- 'sem_ab' cobre tudo que e anterior ao teste e tudo que rodou com o kill
  -- switch ligado: sem isso, evento sem variante viraria uma linha de rotulo
  -- vazio, dificil de ler meses depois.
  coalesce(nullif(e.extra->>'ab_bloco', ''), 'sem_ab') as ab_bloco,
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
group by 1, 2, 3, 4;

comment on view funil_diario is 'Uma linha por dia BRT x origem x sinal de leilao x variante A/B do bloco bloqueado, com sessoes distintas em cada etapa do funil.';

notify pgrst, 'reload schema';
