-- Whitelist do IP da VPS (sonda de checkout pc-checkout-probe + testes de prod)
-- pro limite de consultas SEM destinatario (canal 'tela'). A consulta sem
-- destinatario so tem o teto por IP; o default e 5/h, e a sonda (4/h) + os
-- testes de prod estouram isso e disparam falso alarme "Limite de 5 consultas
-- por hora atingido". Aqui a whitelist passa a casar tambem pela chave
-- 'ip:<IP>' (ver server/api/consulta.post.ts), e este IP ganha 30/h. Sem bypass
-- por header/segredo; o teto wdapi de 15/IP/h continua valendo.
insert into public.rate_limit_whitelist (recipient, hourly_limit)
values ('ip:62.169.22.218', 30)
on conflict (recipient) do update set hourly_limit = excluded.hourly_limit;
