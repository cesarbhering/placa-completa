-- Enriquecimento da origem do chassi em relatorio ja vendido.
--
-- O snapshot antigo tem chassiOrigem preenchido, mas sem a planta: a tabela de
-- fabricas nao existia quando ele foi gerado. Diferente do lazy fill de campo
-- vazio, aqui o campo TEM valor e precisa ser substituido por um decode novo do
-- mesmo chassi. Continua sendo o mesmo veiculo e a mesma fonte: o que mudou foi
-- o que a gente sabe ler dele.
--
-- Roda uma vez por relatorio (marcador planta_em) e nao toca em mais nada.

create or replace function public.enriquecer_snapshot_planta(
  p_token text,
  p_valor jsonb,
  p_marcador_em timestamptz default now()
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_linhas integer := 0;
begin
  update public.pedidos_premium
     set relatorio_snapshot = jsonb_set(
           jsonb_set(relatorio_snapshot, '{chassiOrigem}', coalesce(p_valor, 'null'::jsonb), true),
           '{planta_em}', to_jsonb(p_marcador_em), true)
   where token_entrega = p_token
     and relatorio_snapshot is not null
     and (relatorio_snapshot -> 'planta_em') is null;

  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

revoke all on function public.enriquecer_snapshot_planta(text, jsonb, timestamptz) from public, anon, authenticated;

notify pgrst, 'reload schema';
