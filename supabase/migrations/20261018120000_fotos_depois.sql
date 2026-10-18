-- Fotos do lote que chegam depois da venda (Cesar 18/out/2026): lock do job + gravacao so na passagem.
--
-- Lock entre containers pra job periodico do site.
-- O site roda em mais de um container durante a troca do Coolify (rolling) e o staging fala com o banco de prod:
-- um setInterval por container rodaria o mesmo job em dobro. Lease com dono e prazo:
--   job_lock_pegar -> true so pra quem pegou (linha nova, lease vencido ou o proprio dono renovando).
-- O job nao solta o lease no fim: ele segura a "vez" do intervalo (1 rodada a cada ~30 min no total).
-- Container que morre no meio nao trava nada: o lease vence sozinho (prazo curto, menor que o intervalo do job).
-- Advisory lock do Postgres nao serve aqui: o PostgREST nao mantem sessao entre chamadas.

create table if not exists public.job_lock (
  nome          text primary key check (length(nome) between 1 and 80),
  dono          text not null check (length(dono) between 1 and 200),
  ate           timestamptz not null,
  atualizado_em timestamptz not null default now()
);

-- regra da auditoria RLS de 30/set: toda tabela nova com RLS; sem policy = so service_role acessa
alter table public.job_lock enable row level security;

create or replace function public.job_lock_pegar(p_nome text, p_dono text, p_segundos int default 1200)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.job_lock as l (nome, dono, ate, atualizado_em)
  values (p_nome, p_dono, now() + make_interval(secs => greatest(30, least(p_segundos, 3600))), now())
  on conflict (nome) do update
     set dono = excluded.dono, ate = excluded.ate, atualizado_em = now()
   where l.ate < now() or l.dono = excluded.dono;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.job_lock_pegar(text, text, int) from public, anon, authenticated;
grant execute on function public.job_lock_pegar(text, text, int) to service_role;

-- Grava o resultado da busca de fotos SO numa passagem do snapshot (fonte, lote, ref), com jsonb_set dentro
-- da linha travada: nao pisa no que outro escritor (DETRAN tardio, recallBase...) gravou no resto do snapshot.
--   p_foto_refs   -> foto_refs da passagem (e fotos_pendente=false, sai fotos_busca);
--   p_fotos_busca -> {status, em} quando a busca terminou sem foto.
-- Passagem que ja tem foto nunca e mexida. Devolve 'gravado' ou o motivo de nao ter gravado.
create or replace function public.fotos_passagem_gravar(
  p_pedido uuid, p_fonte text, p_lote text, p_ref text,
  p_foto_refs jsonb default null, p_fotos_busca jsonb default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  snap jsonb; i int; p jsonb; novo jsonb;
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
  if (jsonb_typeof(p->'foto_refs') = 'array' and jsonb_array_length(p->'foto_refs') > 0)
     or (jsonb_typeof(p->'detalhes'->'fotos') = 'array' and exists (
           select 1 from jsonb_array_elements(p->'detalhes'->'fotos') f where jsonb_typeof(f->'foto_ref') = 'string')) then
    return 'ja_tem_foto';
  end if;
  if p_foto_refs is not null then
    if jsonb_typeof(p_foto_refs) <> 'array' or jsonb_array_length(p_foto_refs) = 0 or jsonb_array_length(p_foto_refs) > 4 then
      return 'invalido';
    end if;
    novo := (p - 'fotos_busca') || jsonb_build_object('foto_refs', p_foto_refs, 'fotos_pendente', false);
  elsif p_fotos_busca is not null then
    if jsonb_typeof(p_fotos_busca) <> 'object' then return 'invalido'; end if;
    if p->'fotos_busca'->>'status' is not distinct from p_fotos_busca->>'status' then return 'igual'; end if;
    novo := p || jsonb_build_object('fotos_busca', p_fotos_busca);
  else
    return 'invalido';
  end if;
  update public.pedidos_premium
     set relatorio_snapshot = jsonb_set(relatorio_snapshot, array['historicoLeilao', 'passagens', i::text], novo)
   where id = p_pedido;
  return 'gravado';
end $$;

revoke all on function public.fotos_passagem_gravar(uuid, text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.fotos_passagem_gravar(uuid, text, text, text, jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';
