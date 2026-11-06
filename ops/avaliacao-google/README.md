# Avaliação no Google (05/nov/2026)

E-mail de acompanhamento 3 dias depois da entrega, uma vez na vida por e-mail.
Vai para todo cliente elegível, sem filtro por nota e sem brinde (regra do Google).

- `pc-avaliacao-google.timer`: todo dia às 10h chama `pc-avaliacao-google-run`, que faz `POST /api/premium/avaliacao/run` com `x-admin-secret` pelo Traefik local.
- Fora: valor 0, status diferente de `entregue` (reembolsado inclusive), entregue antes de `AVALIACAO_DESDE`, entregue há menos de 3 ou mais de 10 dias, e-mails em `/root/.pix-recover-excluir` e `/root/.resend-unsubscribed.txt`, quem já recebeu (`avaliacao_google_envios`). Fora de prod o endpoint não envia.
- Instalação (fica DESLIGADO até o ok do Cesar):
  - `install -m 755 pc-avaliacao-google-run /usr/local/bin/`
  - copiar `.service`/`.timer` para `/etc/systemd/system/` e `systemctl daemon-reload`
  - `/etc/default/pc-avaliacao-google` com `AVALIACAO_DESDE=<ISO do deploy>`
- Ligar: `pc-avaliacao-google-run --dry-run` (confere a prévia) e depois `systemctl enable --now pc-avaliacao-google.timer`.
