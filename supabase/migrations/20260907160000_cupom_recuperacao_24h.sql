-- Ajustes do cupom de recuperacao, pedidos depois do primeiro corte:
--
-- 1. A restricao e o E-MAIL, nao a placa. A pessoa pode ter desistido de uma
--    placa e comprar outra; o que nao pode e o codigo dela virar desconto pra
--    qualquer um. Cupom novo nasce sem placa_restrita (a coluna fica, porque
--    ainda serve pra campanha futura que queira prender numa placa).
-- 2. Validade de 24 HORAS, contada da geracao. O e-mail vai dizer "vence em 24
--    horas" e isso precisa ser verdade no banco, nao so no texto.
-- 3. A funcao passa a devolver TAMBEM o vencimento, pra quem dispara o e-mail
--    escrever a data certa sem recalcular por fora.

drop function if exists public.criar_cupom_recuperacao(text, text, numeric, integer);

create or replace function public.criar_cupom_recuperacao(
  p_email text,
  p_percentual numeric default 10,
  p_horas integer default 24,
  p_origem text default 'pix_recover'
) returns table (codigo text, expira_em timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_email text := lower(trim(p_email));
  v_alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo text;
  v_sufixo text;
  v_expira timestamptz := now() + (p_horas || ' hours')::interval;
  i integer;
  tentativa integer := 0;
begin
  if v_email = '' or v_email is null then
    raise exception 'email obrigatorio';
  end if;

  -- Ja tem cupom VIVO pra esta pessoa nesta campanha? Devolve o mesmo, com o
  -- vencimento que ele ja tem. Sem isto, reenviar o e-mail daria a ela um
  -- cupom novo por cima do antigo e o "vence em 24 horas" viraria mentira.
  select c.codigo, c.valido_ate into v_codigo, v_expira
    from public.cupons_premium c
    where c.origem = p_origem
      and lower(c.email_restrito) = v_email
      and c.ativo
      and (c.valido_ate is null or c.valido_ate > now())
      and not exists (select 1 from public.cupons_premium_usos u where u.cupom_id = c.id)
    order by c.created_at desc
    limit 1;
  if v_codigo is not null then
    return query select v_codigo, v_expira;
    return;
  end if;

  loop
    tentativa := tentativa + 1;
    v_sufixo := '';
    for i in 1..5 loop
      v_sufixo := v_sufixo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;
    v_codigo := 'CUPOM' || round(p_percentual)::text || v_sufixo;
    exit when not exists (select 1 from public.cupons_premium where cupons_premium.codigo = v_codigo);
    if tentativa > 20 then
      raise exception 'nao foi possivel gerar codigo unico';
    end if;
  end loop;

  v_expira := now() + (p_horas || ' hours')::interval;

  insert into public.cupons_premium (
    codigo, tipo, valor, planos, ativo, valido_de, valido_ate,
    limite_uso_global, limite_uso_por_cliente, email_restrito, origem
  ) values (
    v_codigo, 'percentual', p_percentual, '{basica,completa}', true, now(), v_expira,
    1, 1, v_email, p_origem
  );

  return query select v_codigo, v_expira;
end;
$$;

revoke all on function public.criar_cupom_recuperacao(text, numeric, integer, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
