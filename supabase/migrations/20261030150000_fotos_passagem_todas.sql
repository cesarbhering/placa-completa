-- Fotos do lote: todas as fotos, nao so 4 (Cesar, 30/out/2026).
-- fotos_passagem_gravar passa a aceitar ate 300 refs e SUBSTITUI a lista gravada quando a nova e maior
-- (antes devolvia 'ja_tem_foto' e um lote gravado com 4 nunca ganhava o resto).
--   p_foto_refs   -> lista de 1 a 300 FotoRef {ref, ordem, vista}:
--                    passagem sem foto: grava (fotos_pendente=false, sai fotos_busca);
--                    passagem com MENOS fotos que a lista nova: substitui;
--                    passagem com o mesmo numero ou mais: nao mexe nas fotos.
--   p_fotos_busca -> {status, em} quando a busca terminou sem foto (passagem sem foto).
-- Em todo caso de resposta final da API sobre passagem que ja tem foto, marca fotos_lote_completo=true:
-- o job (server/utils/fotos-depois.ts) para de perguntar por essa passagem.
-- Mesma assinatura da versao de 18/out (create or replace): grants e chamadas seguem iguais.
-- Retornos: 'gravado' | 'completo' (so marcou) | 'ja_tem_foto' | 'igual' | 'invalido' | 'sem_passagem' | 'sem_snapshot'.
create or replace function public.fotos_passagem_gravar(
  p_pedido uuid, p_fonte text, p_lote text, p_ref text,
  p_foto_refs jsonb default null, p_fotos_busca jsonb default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  snap jsonb; i int; p jsonb; novo jsonb; n_atual int; n_novo int; res text := 'gravado';
begin
  select relatorio_snapshot into snap from public.pedidos_premium where id = p_pedido for update;
  if snap is null or jsonb_typeof(snap->'historicoLeilao'->'passagens') is distinct from 'array' then
    return 'sem_snapshot';
  end if;
  select (t.o - 1)::int, t.e into i, p
    from jsonb_array_elements(snap->'historicoLeilao'->'passagens') with ordinality as t(e, o)
   where coalesce(t.e->>'fonte', '') = coalesce(p_fonte, '')
     and coalesce(t.e->>'lote', '') = coalesce(p_lote, '')
     and coalesce(t.e->>'ref', '') = coalesce(p_ref, '')
   order by t.o limit 1;
  if p is null then return 'sem_passagem'; end if;

  -- Fotos que a passagem ja mostra: foto_refs gravado ou refs vindos no detalhe.
  n_atual := greatest(
    case when jsonb_typeof(p->'foto_refs') = 'array' then jsonb_array_length(p->'foto_refs') else 0 end,
    case when jsonb_typeof(p->'detalhes'->'fotos') = 'array' then (
      select count(*)::int from jsonb_array_elements(p->'detalhes'->'fotos') f where jsonb_typeof(f->'foto_ref') = 'string')
    else 0 end);

  if p_foto_refs is not null then
    if jsonb_typeof(p_foto_refs) <> 'array' then return 'invalido'; end if;
    n_novo := jsonb_array_length(p_foto_refs);
    if n_novo = 0 or n_novo > 300 then return 'invalido'; end if;
    if exists (select 1 from jsonb_array_elements(p_foto_refs) f
                where jsonb_typeof(f) is distinct from 'object' or jsonb_typeof(f->'ref') is distinct from 'string') then
      return 'invalido';
    end if;
    if n_atual > 0 and n_novo <= n_atual then
      if (p->>'fotos_lote_completo') is not distinct from 'true' then return 'ja_tem_foto'; end if;
      novo := p || jsonb_build_object('fotos_lote_completo', true); res := 'completo';
    else
      novo := (p - 'fotos_busca') || jsonb_build_object('foto_refs', p_foto_refs, 'fotos_pendente', false, 'fotos_lote_completo', true);
    end if;
  elsif p_fotos_busca is not null then
    if jsonb_typeof(p_fotos_busca) <> 'object' then return 'invalido'; end if;
    if n_atual > 0 then
      -- Ja tem foto e a API diz que nao ha mais: so marca, as fotos ficam.
      if (p->>'fotos_lote_completo') is not distinct from 'true' then return 'ja_tem_foto'; end if;
      novo := p || jsonb_build_object('fotos_lote_completo', true); res := 'completo';
    else
      if p->'fotos_busca'->>'status' is not distinct from p_fotos_busca->>'status' then return 'igual'; end if;
      novo := p || jsonb_build_object('fotos_busca', p_fotos_busca);
    end if;
  else
    return 'invalido';
  end if;

  update public.pedidos_premium
     set relatorio_snapshot = jsonb_set(relatorio_snapshot, array['historicoLeilao', 'passagens', i::text], novo)
   where id = p_pedido;
  return res;
end $$;

revoke all on function public.fotos_passagem_gravar(uuid, text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.fotos_passagem_gravar(uuid, text, text, text, jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';
