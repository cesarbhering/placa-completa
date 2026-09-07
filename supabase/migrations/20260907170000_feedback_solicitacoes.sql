-- Pesquisa de satisfacao pos-compra. Cada cliente recebe um link proprio com
-- token nao adivinhavel: nada de formulario publico, porque a nota so vale se
-- vier de quem comprou de verdade, e o link tambem e o que amarra a resposta ao
-- pedido sem pedir dado nenhum de volta pra pessoa.
--
-- Esta migration cria SO a estrutura. O envio do e-mail e a geracao do cupom de
-- 50% ficam pra depois, quando a pagina for aprovada; as colunas ja existem
-- (cupom_codigo / cupom_enviado_em / cupom_usado_em) pro momento em que entrar.

create table if not exists public.feedback_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  email text not null,
  pedido_id uuid references public.pedidos_premium (id) on delete set null,
  placa text,
  link text,
  email_enviado_em timestamptz,
  respondido_em timestamptz,
  nota smallint check (nota between 1 and 5),
  comentario text,
  cupom_codigo text,
  cupom_enviado_em timestamptz,
  cupom_usado_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists feedback_solicitacoes_token_idx on public.feedback_solicitacoes (token);
create index if not exists feedback_solicitacoes_email_idx on public.feedback_solicitacoes (lower(email));

-- Sem policy nenhuma e com RLS ligado, so a service role (que passa por cima da
-- RLS) enxerga a tabela. A pagina fala com o banco pelo servidor, nunca do
-- browser: o token e a credencial e ele nao pode virar chave de leitura da
-- tabela inteira pra quem abrir o devtools.
alter table public.feedback_solicitacoes enable row level security;

notify pgrst, 'reload schema';
