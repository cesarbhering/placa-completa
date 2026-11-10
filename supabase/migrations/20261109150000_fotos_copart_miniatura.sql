-- Copart lot with only the thumbnail (09/nov/2026): the HD gallery that arrives
-- later must reach the report that was already sold.
--
-- Same signature, grants and return values as 20261030150000_fotos_passagem_todas.sql.
-- Unchanged for every other passage: a bigger list replaces, an equal or smaller
-- one only marks fotos_lote_completo, then 'ja_tem_foto'.
--
-- New: "copart thumbnail only" passage = fonte 'copart', at most 1 photo
-- (foto_refs or detalhes.fotos) and that photo is the thumbnail (url_origem with
-- imageType=thumbnail) or the top-level fotos_pendente is true (detalhes.fotos_pendente
-- is not a signal: this function clears only the top-level flag when it writes refs).
-- Same rule as copartSoMiniatura() in shared/foto-lote.ts. For it:
--   - p_foto_refs with more refs than it has (up to 300): replaces, even when
--     fotos_lote_completo was set by an older answer that only had the thumbnail;
--   - a final answer that adds nothing (p_foto_refs with <= refs, or p_fotos_busca):
--     keeps the thumbnail and writes fotos_busca, so the site job stops asking.
create or replace function public.fotos_passagem_gravar(
  p_pedido uuid, p_fonte text, p_lote text, p_ref text,
  p_foto_refs jsonb default null, p_fotos_busca jsonb default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  snap jsonb; i int; p jsonb; novo jsonb; n_atual int; n_novo int; res text := 'gravado';
  n_gravadas int; det jsonb; so_miniatura boolean;
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
  n_gravadas := case when jsonb_typeof(p->'foto_refs') = 'array' then jsonb_array_length(p->'foto_refs') else 0 end;
  det := case when jsonb_typeof(p->'detalhes'->'fotos') = 'array' then p->'detalhes'->'fotos' else '[]'::jsonb end;
  n_atual := greatest(n_gravadas,
    (select count(*)::int from jsonb_array_elements(det) f where jsonb_typeof(f->'foto_ref') = 'string'));

  so_miniatura := coalesce(p->>'fonte', '') = 'copart'
    and n_gravadas <= 1 and jsonb_array_length(det) <= 1
    and ((jsonb_array_length(det) = 1 and coalesce(det->0->>'url_origem', '') ilike '%imageType=thumbnail%')
         or (p->>'fotos_pendente') is not distinct from 'true');

  if p_foto_refs is not null then
    if jsonb_typeof(p_foto_refs) <> 'array' then return 'invalido'; end if;
    n_novo := jsonb_array_length(p_foto_refs);
    if n_novo = 0 or n_novo > 300 then return 'invalido'; end if;
    if exists (select 1 from jsonb_array_elements(p_foto_refs) f
                where jsonb_typeof(f) is distinct from 'object' or jsonb_typeof(f->'ref') is distinct from 'string') then
      return 'invalido';
    end if;
    if n_atual > 0 and n_novo <= n_atual then
      if so_miniatura then
        -- A galeria nao trouxe mais que a miniatura: fica a miniatura e a busca termina.
        if (p->'fotos_busca'->>'status') is not distinct from 'sem_foto' then return 'igual'; end if;
        novo := p || jsonb_build_object('fotos_lote_completo', true,
          'fotos_busca', jsonb_build_object('status', 'sem_foto', 'em', to_jsonb(now())));
        res := 'completo';
      else
        if (p->>'fotos_lote_completo') is not distinct from 'true' then return 'ja_tem_foto'; end if;
        novo := p || jsonb_build_object('fotos_lote_completo', true); res := 'completo';
      end if;
    else
      novo := (p - 'fotos_busca') || jsonb_build_object('foto_refs', p_foto_refs, 'fotos_pendente', false, 'fotos_lote_completo', true);
    end if;
  elsif p_fotos_busca is not null then
    if jsonb_typeof(p_fotos_busca) <> 'object' then return 'invalido'; end if;
    if n_atual > 0 and so_miniatura then
      -- Busca da galeria terminou sem foto nova: grava o status pra o job parar.
      if p->'fotos_busca'->>'status' is not distinct from p_fotos_busca->>'status' then return 'igual'; end if;
      novo := p || jsonb_build_object('fotos_lote_completo', true, 'fotos_busca', p_fotos_busca);
      res := 'completo';
    elsif n_atual > 0 then
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
