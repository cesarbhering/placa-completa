-- Teste A/B do LAYOUT da consulta gratis (25/set/2026): 'A' = pagina nova de
-- pagina inteira, 'B' = pagina de hoje (com a copy personalizada do #338).
--
-- Problema: o ab_bloco='A'/'B' ja existia em eventos_funil desde o #338
-- (21/set), onde significava so a COPY do bloco. Agora 'A'/'B' significam
-- LAYOUT. Sem separar, a funil_diario somaria os dois testes na mesma linha e a
-- leitura ficaria impossivel.
--
-- Solucao (sem apagar nada): coluna `fase` por CONSTANTE do cutover (o instante
-- do deploy-live do layout A). Eventos ANTES do cutover = 'pre_layout_a' (o
-- #338); DEPOIS = 'layout_a' (o teste novo). A raw eventos_funil fica intacta; a
-- leitura do teste novo e filtrar fase='layout_a'. A atribuicao de VENDA por
-- variante nao precisa disso: pedidos_premium.ab_bloco e coluna nova, so tem
-- valor em pedido pos-cutover (filtra `ab_bloco is not null`).
--
-- IMPORTANTE: parte da view ATUAL (com `canal`, da migration canal_app_web) +
-- so ADICIONA a coluna `fase`. NAO derruba o canal (regressao evitada) --
-- group by 1..6 (dia, origem, canal, leilao_sinal, ab_bloco, fase).
-- Drop + create (nao replace): a coluna nova entra no meio da lista.
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
  -- Fase do teste A/B: separa o #338 (copy) do teste de LAYOUT novo pelo instante
  -- do cutover (deploy-live do layout A, 25/set/2026 19:37:40 UTC).
  case when e.criado_em >= timestamptz '2026-09-25T19:37:40Z' then 'layout_a' else 'pre_layout_a' end as fase,
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

comment on view funil_diario is 'Uma linha por dia BRT x origem x canal (app/web) x sinal de leilao x variante A/B x fase (pre_layout_a=#338 copy / layout_a=layout novo, cutover 25/set 19:37:40 UTC), com sessoes distintas em cada etapa do funil.';

notify pgrst, 'reload schema';
