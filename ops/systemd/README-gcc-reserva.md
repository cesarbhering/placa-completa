# Timer da reserva de hash GCC (pc-gcc-reserva)

Mantem 1 hash de consentimento GCC "de frente" pra a venda consumir na hora,
imune a uma queda do GCC (que enfileira sem devolver hash). Ver
`server/utils/gcc-reserva.ts` e `server/api/premium/gcc-reserva.post.ts`.

## Instalar (na VPS, como root)

1. Segredo: o unit le direto do cofre, `/root/.secrets/admin-secret.env`
   (600, root, linha `NUXT_ADMIN_SECRET=...`, o mesmo do Coolify de prod).
   Nao existe mais copia em `/etc/pc-gcc-reserva.env`: quando o segredo gira,
   basta atualizar o cofre. Depois de instalar, o arquivo antigo pode ser
   apagado.

2. Copiar os units e habilitar o timer:

   ```
   cp ops/systemd/pc-gcc-reserva.service /etc/systemd/system/
   cp ops/systemd/pc-gcc-reserva.timer   /etc/systemd/system/
   systemctl daemon-reload
   systemctl enable --now pc-gcc-reserva.timer
   ```

3. Conferir que o NEXT aparece (se ficar em "n/a", o timer nao vai disparar):

   ```
   systemctl list-timers pc-gcc-reserva
   ```

4. Teste manual (uma rodada agora):

   ```
   systemctl start pc-gcc-reserva.service
   journalctl -u pc-gcc-reserva.service -n 20 --no-pager
   ```

## O que o endpoint faz por rodada

- Limpa reservas vencidas (marca `vencido`, loga desperdicio).
- Repoe ate 1 hash nao-vencido, so quando a reserva zera (teto DURO 1; nunca gera se o GCC nao devolver).
- Atualiza `gcc_reserva_estado` e, se o GCC estiver fora, manda e-mail pro Cesar
  ("GCC sem gerar hash desde HH:MM, reserva atual: N", cooldown 1h) + um "voltou"
  quando recupera.

A reserva tambem se repoe sozinha apos cada venda (fire-and-forget no
`senatran-consulta.ts`); o timer e a rede de seguranca pra quando nao ha vendas.
