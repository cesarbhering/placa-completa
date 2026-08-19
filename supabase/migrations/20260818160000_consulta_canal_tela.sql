-- Consulta gratis sem coleta de e-mail: o resultado aparece na propria tela.
-- Precisa de um canal novo ('tela') porque as CHECK atuais exigem e-mail ou
-- telefone conforme o canal, e agora existe um caso legitimo sem nenhum dos dois.

-- As duas checks que mencionam `channel` (a inline do ADD COLUMN, de nome
-- gerado, e a de destinatario) saem juntas e voltam na versao nova.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.consultas'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%channel%'
  loop
    execute format('alter table public.consultas drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.consultas
  add constraint consultas_channel_chk
  check (channel in ('email', 'whatsapp', 'tela'));

-- 'tela' nao tem destinatario: o dado nao sai daqui, e mostrado e pronto.
alter table public.consultas
  add constraint consultas_channel_recipient_chk
  check (
    (channel = 'email'    and email is not null) or
    (channel = 'whatsapp' and phone is not null) or
    (channel = 'tela')
  );

-- A policy de insert anonimo tambem precisa aceitar o canal novo. O servidor
-- usa service key (que ignora RLS), mas deixar a policy coerente evita
-- surpresa se algum dia o insert vier pelo cliente.
drop policy if exists "Allow validated anonymous inserts" on public.consultas;
create policy "Allow validated anonymous inserts" on public.consultas
  for insert
  with check (
    placa is not null and
    placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' and
    email_sent = false and
    whatsapp_sent = false and
    channel in ('email', 'whatsapp', 'tela') and
    (
      (channel = 'email' and
        email is not null and
        email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' and
        length(email) <= 254)
      or
      (channel = 'whatsapp' and
        phone is not null and
        length(phone) between 10 and 15)
      or
      (channel = 'tela' and email is null and phone is null)
    )
  );
