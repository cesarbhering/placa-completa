-- Lock entre containers pra job periodico do site (Cesar 18/out/2026: fotos do lote que chegam depois).
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

notify pgrst, 'reload schema';
