-- Motivo da recusa da Infosimples quando code != 200 (11/out/2026). Os 608 de
-- SP (BVV4005, CDR2189) ficaram sem rastro de qual parametro o DETRAN recusou.
-- Texto saneado no servidor (sem placa, renavam, CPF ou nome).
alter table public.premium_custos
  add column if not exists detalhe text;

notify pgrst, 'reload schema';
