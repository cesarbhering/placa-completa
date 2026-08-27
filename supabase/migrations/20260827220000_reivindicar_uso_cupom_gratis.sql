-- Reivindicacao atomica de uso de cupom GRATIS (bypass do Pix). Sem isto,
-- checagem "conta quantos usos existem" + decisao no app tem uma janela de
-- corrida: duas requisicoes concorrentes podem ler o mesmo contador ANTES de
-- qualquer uma delas gravar, e as duas passam — cada resgate da completa
-- custa ~R$5 de SERPRO real, entao o teto tem que segurar de verdade.
--
-- A funcao trava a linha do cupom (FOR UPDATE), o que serializa QUALQUER
-- concorrencia pro MESMO cupom: a segunda chamada so roda depois que a
-- primeira commitou (ou desistiu). Dentro da secao travada, confere limite
-- global (usos_atual x limite_uso_global) e limite por-cliente (contagem em
-- cupons_premium_usos pro mesmo email) e, se os dois passarem, incrementa
-- usos_atual e devolve true. Qualquer motivo de recusa devolve false — quem
-- chama decide o que fazer (nao criar pedido gratis, cair pro preco cheio etc).
--
-- SECURITY DEFINER com search_path fixo (padrao do lockdown de seguranca) —
-- so o service_role do server chama isto, nunca client direto.
create or replace function public.reivindicar_uso_cupom_gratis(
  p_cupom_id uuid,
  p_email text,
  p_limite_por_cliente integer
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_usos_atual integer;
  v_limite_global integer;
  v_usos_cliente integer;
begin
  select usos_atual, limite_uso_global
    into v_usos_atual, v_limite_global
    from public.cupons_premium
    where id = p_cupom_id
    for update;

  if not found then
    return false;
  end if;

  if v_limite_global is not null and v_usos_atual >= v_limite_global then
    return false;
  end if;

  select count(*) into v_usos_cliente
    from public.cupons_premium_usos
    where cupom_id = p_cupom_id and email = p_email;

  if p_limite_por_cliente is not null and v_usos_cliente >= p_limite_por_cliente then
    return false;
  end if;

  update public.cupons_premium
    set usos_atual = usos_atual + 1, updated_at = now()
    where id = p_cupom_id;

  return true;
end;
$$;

-- Contrapartida: solta a reivindicacao se, por algum motivo, o pedido nao
-- puder ser criado depois de reivindicar (fail-safe, nao deve acontecer no
-- fluxo normal). Decrementa sem deixar negativo.
create or replace function public.liberar_uso_cupom_gratis(p_cupom_id uuid) returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  update public.cupons_premium
    set usos_atual = greatest(0, usos_atual - 1), updated_at = now()
    where id = p_cupom_id;
$$;

revoke execute on function public.reivindicar_uso_cupom_gratis(uuid, text, integer) from anon, authenticated, public;
revoke execute on function public.liberar_uso_cupom_gratis(uuid) from anon, authenticated, public;

notify pgrst, 'reload schema';
