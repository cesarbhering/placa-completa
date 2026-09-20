-- Funil do meio do caminho medido no nosso servidor.
--
-- Motivo: a taxa "consulta gratis -> checkout" caiu de ~3% pra ~1% desde
-- 17/set e a unica medicao existente era o gtag, que roda no navegador, e
-- amostrado e some com bloqueador de anuncio. Sem etapa intermediaria gravada
-- aqui nao da pra saber SE o CTA aparece, SE a pessoa clica ou SE desiste na
-- tela de confirmacao.
--
-- LGPD: nada que identifique alguem. Sem e-mail, sem telefone, sem IP cru e
-- sem User-Agent cru. Do aparelho fica so a categoria (celular/computador), e
-- do IP so um hash com sal do servidor, que serve unicamente pra dedupe e nao
-- volta a ser IP. A placa fica porque e dado de veiculo, nao de pessoa, e sem
-- ela nao da pra ligar etapa com etapa.
create table if not exists eventos_funil (
  id bigserial primary key,
  criado_em timestamptz not null default now(),
  evento text not null,
  placa text,
  -- Id anonimo gerado no proprio navegador e guardado em sessionStorage.
  -- Nao e cookie e nao sobrevive ao fechamento da aba: serve pra costurar as
  -- etapas de UMA visita, nao pra reconhecer alguem depois.
  sessao text,
  origem jsonb,
  dispositivo text,
  sistema text,
  -- positivo | negativo | sem_sinal
  leilao_sinal text,
  plano text,
  extra jsonb,
  ip_hash text
);

comment on table eventos_funil is 'Etapas do funil gratis -> pago medidas no servidor. Sem PII: ip_hash e sha256 com sal, nunca reversivel.';

create index if not exists eventos_funil_criado_em_idx on eventos_funil (criado_em desc);
create index if not exists eventos_funil_evento_criado_em_idx on eventos_funil (evento, criado_em desc);

-- Tabela de escrita so pelo servidor (service key). Sem policy nenhuma, anon e
-- authenticated nao leem nem escrevem.
alter table eventos_funil enable row level security;

-- Funil por dia, ja no fuso de Brasilia, com a quebra que decide verba:
-- de onde veio o clique e se a pessoa viu registro de leilao. Conta SESSAO
-- distinta, nao linha: um observer que dispara duas vezes na mesma visita nao
-- pode inflar a etapa.
create or replace view funil_diario as
select
  (e.criado_em at time zone 'America/Sao_Paulo')::date as dia,
  case
    when coalesce(e.origem->>'msclkid', '') <> '' or lower(coalesce(e.origem->>'utm_source', '')) in ('bing', 'microsoft') then 'bing'
    when coalesce(e.origem->>'gclid', '') <> '' or lower(coalesce(e.origem->>'utm_source', '')) = 'google' then 'google'
    when coalesce(e.origem->>'utm_source', '') = '' then 'organico'
    else 'outros'
  end as origem,
  coalesce(e.leilao_sinal, 'sem_sinal') as leilao_sinal,
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
group by 1, 2, 3;

comment on view funil_diario is 'Uma linha por dia BRT x origem x sinal de leilao, com sessoes distintas em cada etapa do funil.';

notify pgrst, 'reload schema';
