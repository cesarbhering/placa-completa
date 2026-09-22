-- Canal da venda e da consulta: app ou web (22/set/2026).
--
-- Ate aqui a unica marca de que algo veio do app era pix_provider =
-- 'google_play', que so existe DEPOIS da compra, e is_pwa em consultas, que
-- vem do client e, desde que a WebView do app entrou em modo PWA, nao separa
-- mais o app novo de uma PWA instalada pelo navegador. Quem le o e-mail de
-- venda ou o funil precisa saber de onde veio cada linha.
--
-- O valor e escrito no servidor, a partir do marcador que o app injeta no
-- user-agent. Campo do client nao decide isto.

alter table pedidos_premium add column if not exists canal text;
alter table pedidos_premium add column if not exists app_versao text;

alter table consultas add column if not exists canal text;
alter table consultas add column if not exists app_versao text;

alter table eventos_funil add column if not exists canal text;
alter table eventos_funil add column if not exists app_versao text;

comment on column pedidos_premium.canal is 'app ou web, lido do user-agent da requisicao no servidor.';
comment on column consultas.canal is 'app ou web, lido do user-agent da requisicao no servidor.';
comment on column eventos_funil.canal is 'app ou web, lido do user-agent da requisicao no servidor.';

-- Backfill do que ja existe: compra pelo Google Play so acontece dentro do
-- app. A versao fica nula porque ela nao foi gravada na epoca, e chutar um
-- numero seria pior do que deixar vazio.
update pedidos_premium
   set canal = 'app'
 where canal is null
   and pix_provider = 'google_play';

-- O resto do historico nao tem como ser reconstruido linha a linha, entao
-- fica nulo de proposito: 'web' ali seria afirmacao sem lastro. Quem consulta
-- trata nulo como "antes da marcacao".

-- funil_diario ganha o canal ao lado da variante A/B. Drop + create porque a
-- coluna nova entra no meio da lista de quebras e `replace` so aceita coluna
-- no fim; a view nao guarda dado, le eventos_funil.
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
  -- 'sem_canal' cobre tudo que e anterior a esta migration, pelo mesmo motivo
  -- do 'sem_ab': evento sem canal viraria uma linha de rotulo vazio.
  coalesce(nullif(e.canal, ''), 'sem_canal') as canal,
  coalesce(e.leilao_sinal, 'sem_sinal') as leilao_sinal,
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
group by 1, 2, 3, 4, 5;

comment on view funil_diario is 'Uma linha por dia BRT x origem x canal (app/web) x sinal de leilao x variante A/B, com sessoes distintas em cada etapa do funil.';

-- Sem isto o PostgREST segue com o cache antigo e responde 400 na coluna nova.
notify pgrst, 'reload schema';
