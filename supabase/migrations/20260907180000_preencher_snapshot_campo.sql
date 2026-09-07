-- Preenche UM campo do snapshot do relatorio, sem reescrever o resto.
--
-- O snapshot e imutavel de proposito: e a prova do que o cliente comprou. O
-- unico caso em que ele muda e este: o campo ficou vazio porque um servico
-- auxiliar falhou na entrega, e a proxima abertura do relatorio tenta de novo.
-- Por isso a funcao so escreve onde ainda esta null, e sempre carimba o
-- marcador, mesmo quando a nova tentativa tambem volta vazia (senao um veiculo
-- que legitimamente nao tem o dado dispararia consulta nova pra sempre).
--
-- Escrever o objeto inteiro de volta pelo app leria e regravaria o snapshot
-- todo, com janela pra sobrescrever o que outra requisicao acabou de preencher.
-- jsonb_set no campo nao tem essa janela.

create or replace function public.preencher_snapshot_campo(
  p_token text,
  p_campo text,
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
  if p_campo not in ('chassiOrigem', 'valorCusto', 'historicoLeilao') then
    raise exception 'campo nao permitido: %', p_campo;
  end if;

  update public.pedidos_premium
     set relatorio_snapshot = jsonb_set(
           jsonb_set(relatorio_snapshot, array[p_campo], coalesce(p_valor, 'null'::jsonb), true),
           array[p_campo || '_em'], to_jsonb(p_marcador_em), true)
   where token_entrega = p_token
     and relatorio_snapshot is not null
     -- `->` de uma chave ausente devolve SQL null, e de uma chave gravada com
     -- valor nulo devolve o jsonb 'null'. Os dois contam como vazio aqui.
     and coalesce(relatorio_snapshot -> p_campo, 'null'::jsonb) = 'null'::jsonb
     and (relatorio_snapshot -> (p_campo || '_em')) is null;

  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

revoke all on function public.preencher_snapshot_campo(text, text, jsonb, timestamptz) from public, anon, authenticated;

notify pgrst, 'reload schema';
