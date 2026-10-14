-- Bruto SANEADO da resposta do Infosimples (DETRAN das 18 UFs, complementos e
-- RENAJUD) junto do custo de cada chamada (14/out, aprovado pelo Lead/Cesar;
-- caso PVT3J49: sem o bruto nao dava pra ver o que o DETRAN devolveu).
-- Saneado no servidor antes de gravar (server/utils/infosimples-detran.ts,
-- sanearBruto): sem proprietario, nomes, CPF/CNPJ, condutor, contrato/credor,
-- endereco/contato, receipts, URLs, Pix ou boleto. Acima de 256 KB grava so a
-- estrutura de chaves. Linhas antigas ficam null.
-- RLS: premium_custos ja tem RLS ligado; coluna nova herda (nada aberto aqui).
alter table public.premium_custos
  add column if not exists bruto jsonb;

notify pgrst, 'reload schema';
