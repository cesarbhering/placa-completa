-- Cupom pessoal de recuperacao de Pix abandonado.
--
-- Ate agora todo cupom valia pra qualquer pessoa que soubesse o codigo. Pro
-- e-mail de recuperacao isso nao serve: o desconto e uma oferta pra AQUELA
-- pessoa, naquela placa, e um codigo vazado viraria desconto geral.

alter table public.cupons_premium
  add column if not exists email_restrito text,
  add column if not exists placa_restrita text,
  -- de onde veio o cupom, pra medir a campanha sem depender do codigo.
  add column if not exists origem text;

create index if not exists cupons_premium_origem_idx
  on public.cupons_premium (origem) where origem is not null;
create index if not exists cupons_premium_email_restrito_idx
  on public.cupons_premium (lower(email_restrito)) where email_restrito is not null;

-- Geracao do cupom pelo proprio banco: o script de recuperacao ja fala com o
-- Postgres pela Management API, entao nao precisa de endpoint HTTP novo nem de
-- mais uma chave circulando. Menos superficie e menos segredo pra vazar.
--
-- IDEMPOTENTE por (email, placa, origem): se o script rodar duas vezes pro
-- mesmo abandono, a pessoa recebe o MESMO codigo em vez de acumular cupons.
--
-- O alfabeto do sufixo nao tem 0/O nem 1/I: o codigo vai ser lido de um e-mail
-- e digitado a mao, e esses pares sao onde as pessoas erram.
create or replace function public.criar_cupom_recuperacao(
  p_email text,
  p_placa text,
  p_percentual numeric default 10,
  p_dias integer default 7
) returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_email text := lower(trim(p_email));
  v_placa text := upper(regexp_replace(coalesce(p_placa, ''), '[^A-Za-z0-9]', '', 'g'));
  v_alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo text;
  v_sufixo text;
  v_existente text;
  i integer;
  tentativa integer := 0;
begin
  if v_email = '' or v_email is null then
    raise exception 'email obrigatorio';
  end if;

  -- Ja tem cupom vivo pra esta pessoa e placa? Devolve o mesmo.
  select codigo into v_existente
    from public.cupons_premium
    where origem = 'pix_recover'
      and lower(email_restrito) = v_email
      and coalesce(placa_restrita, '') = v_placa
      and ativo
      and (valido_ate is null or valido_ate > now())
    order by created_at desc
    limit 1;
  if v_existente is not null then
    return v_existente;
  end if;

  loop
    tentativa := tentativa + 1;
    v_sufixo := '';
    for i in 1..5 loop
      v_sufixo := v_sufixo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;
    v_codigo := 'CUPOM' || round(p_percentual)::text || v_sufixo;
    exit when not exists (select 1 from public.cupons_premium where codigo = v_codigo);
    if tentativa > 20 then
      raise exception 'nao foi possivel gerar codigo unico';
    end if;
  end loop;

  insert into public.cupons_premium (
    codigo, tipo, valor, planos, ativo, valido_de, valido_ate,
    limite_uso_global, limite_uso_por_cliente,
    email_restrito, placa_restrita, origem
  ) values (
    v_codigo, 'percentual', p_percentual, '{basica,completa}', true, now(), now() + (p_dias || ' days')::interval,
    1, 1,
    v_email, nullif(v_placa, ''), 'pix_recover'
  );

  return v_codigo;
end;
$$;

revoke all on function public.criar_cupom_recuperacao(text, text, numeric, integer) from public, anon, authenticated;

notify pgrst, 'reload schema';
