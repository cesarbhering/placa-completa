# Pedido de nota pós-entrega (05/nov/2026)

E-mail 3 dias depois da entrega, uma vez na vida por e-mail, com cinco botões de nota (1 a 5).
Cada botão leva para `/feedback/<token>?nota=N`, que grava a nota. Nota 4 ou 5: convite para avaliar no Google.
Nota 1 a 3: "O que podemos melhorar?" (nota 1 ou 2 com comentário avisa o Lead em helena@). Sem cupom e sem brinde.

- `pc-avaliacao-google.timer`: todo dia às 10h chama `pc-avaliacao-google-run`, que faz `POST /api/premium/avaliacao/run` com `x-admin-secret` pelo Traefik local.
- Ficam de fora: valor 0, status diferente de `entregue` (reembolsado inclusive), entregue antes de `AVALIACAO_DESDE`, entregue há menos de 3 ou mais de 10 dias, e-mails em `/root/.pix-recover-excluir` e `/root/.resend-unsubscribed.txt`, quem já tem linha em `feedback_solicitacoes` (é a trava de "uma vez na vida"). Fora de prod o endpoint não envia.
- Tabela: só `feedback_solicitacoes` (já existe em prod e staging). Nenhuma migração.
- Instalação (fica DESLIGADO até o ok do Cesar):
  - `install -m 755 pc-avaliacao-google-run /usr/local/bin/`
  - copiar `.service`/`.timer` para `/etc/systemd/system/` e `systemctl daemon-reload`
  - `/etc/default/pc-avaliacao-google` com `AVALIACAO_DESDE=<ISO do deploy>`
- Ligar: `pc-avaliacao-google-run --dry-run` (confere a prévia) e depois `systemctl enable --now pc-avaliacao-google.timer`.
