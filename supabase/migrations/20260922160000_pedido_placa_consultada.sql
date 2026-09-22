-- Qual placa o registro respondeu (22/set/2026).
--
-- Um pedido pago foi estornado porque a consulta paga perguntou pela placa no
-- formato Mercosul e o registro so conhecia a antiga. Agora a consulta tenta o
-- outro formato antes de desistir, e esta coluna guarda qual deles funcionou:
-- sem ela, um relatorio com placa diferente da digitada vira mistério.

alter table pedidos_premium add column if not exists placa_consultada text;

comment on column pedidos_premium.placa_consultada is 'Placa que o registro respondeu: igual a do pedido, ou a equivalente no outro formato.';

notify pgrst, 'reload schema';
