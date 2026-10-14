# Fila do relatório e cache por fonte (Relatório 2.0, 14/out/2026)

- `pc-premium-jobs.timer`: a cada 1 min chama `pc-premium-jobs-run`, que faz `POST /api/premium/jobs/run` com `x-admin-secret` pelo Traefik local.
  - O site reivindica até 5 jobs vencidos (RPC `premium_jobs_reivindicar`) e executa dentro do container, registrado em voo.
  - Respostas 202, 409 e 503 são normais.
  - Backoff e teto ficam no banco (`premium_jobs_resultado`: 1 min, 5 min, 30 min, 6 h; esgota na 4ª falha).
  - Só habilitar depois que o endpoint estiver em prod: `systemctl enable --now pc-premium-jobs.timer`.
- `pc-fonte-cache-limpar.timer`: às 04h30 chama `fonte_cache_limpar()`, que remove o cache vencido há mais de 7 dias e o log `api_chamadas` com mais de 90 dias.
- Instalação: `install -m 755 pc-premium-jobs-run pc-fonte-cache-limpar /usr/local/bin/`. Copiar os `.service`/`.timer` para `/etc/systemd/system/` e rodar `systemctl daemon-reload`.
