-- Marca se a consulta foi servida pelo cache de placas ou custou uma chamada
-- real a API paga.
--
-- Sem esta coluna, o relatorio de uso so consegue ESTIMAR quantas chamadas
-- pagas cada canal (web, app, agentes) gerou, porque toda consulta parece igual
-- na tabela. Com ela, custo por canal vira contagem.
--
-- Linha antiga fica com null, que le como "nao sabemos", e nao como "bateu na
-- API": inventar false no historico distorceria o numero pra cima.

alter table public.consultas
  add column if not exists cache_hit boolean;

create index if not exists idx_consultas_cache_hit
  on public.consultas (cache_hit)
  where cache_hit is not null;
