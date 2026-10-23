# pc-monitor: monitoramento de produção

Monitoramento de produção que roda na VPS, e não dentro do site. Nasceu de uma ordem do Cesar em 12/out/2026, depois da queda de 11-12/out: a sonda única de 2 h gerava alarme falso e não avisou direito.

Regra central: **só alerta com falha CONFIRMADA**. Cada tipo de problema tem um e-mail com assunto próprio e um aviso de "VOLTOU" com a duração. Nunca usa "VPS sobrecarregada" como diagnóstico: se o site leva mais de 20 s para o cliente, é incidente.

## Alvos

| Alvo | Timer | O que testa | Confirmação | E-mail | Repete | Destino |
|---|---|---|---|---|---|---|
| **site** | `pc-site-check` (5 min) | `GET /` (precisa ter "PlacaCompleta") e `GET /api/app-status` (precisa ter "forceUpdate") pela URL pública, ou seja, Cloudflare, túnel, Traefik e container. Timeout de 15 s; acima de 20 s conta como falha. | 2 falhas, 60 s entre elas | `SITE FORA DO AR: <tipo>` | a cada 1 h | Cesar e helena@ |
| **checkout** | `pc-checkout-probe` (30 min) e pós-deploy | Fluxo real no Chromium: consulta grátis, botão da Completa, botão de pagar. Não gera Pix nem pedido. | 3 falhas, 60 s entre elas | `CHECKOUT COM ERRO: <tipo>` | a cada 1 h | Cesar e helena@ |
| **fila** | `pc-fila-check` (5 min) | View `premium_jobs_saude` no prod (Management API): job pendente atrasado mais de 15 min ou lease vencido | já confirmado por definição | `FILA DO RELATORIO PARADA` | a cada 1 h | Cesar e helena@ |
| **fila (esgotados)** | o mesmo | Jobs que esgotaram as 4 tentativas (1 min, 5 min, 30 min, 6 h) | não se aplica | `RELATORIO COM FONTE ESGOTADA (n)`, um por lote | não | Cesar e helena@ |
| **monitor** | `pc-monitor-meta` (5 min) | As outras 4 checagens (site, checkout, fila, túnel) estão rodando? Unit que saiu com erro (crash) ou estado sem verificação há mais de 15 min (checkout: 2 h) | 2 falhas, 60 s entre elas | `MONITOR QUEBRADO`, com a unit e a última linha do erro | a cada 1 h | Cesar e helena@ |
| **disco** | `pc-recursos-check` (5 min) | Uso de `/` acima de 85% | 2 leituras, 60 s entre elas | `DISCO DA VPS ACIMA DE 85%` | a cada 1 h | Cesar e helena@ |
| **carga** | o mesmo | Load de 15 min dividido pelos núcleos acima de 3 (= 15 min sobrecarregada) | 2 leituras, 60 s entre elas | `VPS SOBRECARREGADA`, com os 3 containers que mais consomem | a cada 1 h | Cesar e helena@ |
| **deploy** | `pc-deploy-check` (5 min) | HEAD da `main` no GitHub x commit da imagem do site no ar | divergente por mais de 15 min | `SITE DESATUALIZADO (a main nao chegou ao ar)`, com os últimos deploys do Coolify | a cada 1 h | Cesar e helena@ |
| **tunel** | `pc-tunel-check` (5 min) | `curl -x socks5h://127.0.0.1:1080 https://ifconfig.me` (15 s): o túnel residencial do Mac | 2 falhas, 60 s entre elas | `TÚNEL DO MAC CAIU`, com o comando de subida | **não** (1 por queda) | só o Cesar |

Todo alvo que abre incidente manda `... VOLTOU (fora por Xh)` quando normaliza.

**Tipos de motivo:**
- **site:** `timeout`, `conexao`, `http_5xx`, `http_4xx`, `conteudo`, `lento`.
- **checkout:** `api` (4xx ou 5xx em `/api/premium` ou `/api/consulta`), `fluxo_timeout`, `fluxo_travado`, `tela_erro`.
- **tunel:** `conexao`, `timeout`, `erro`.

**Detalhes do checkout:**
- Se a home não abre, a sonda **não** manda "checkout com erro". O alerta fica com o site.
- **CPU da VPS:** o Chromium roda com nice 10. Se a CPU estiver com menos de 10% ociosa (amostra de 2 s em `/proc/stat`), a sonda espera 2 min, até 3 vezes, e então pula a rodada sem veredito. Não usa mais o load: com teto de CPU nos containers, threads presas na quota contam no load (21/out: load 20 com 47% ociosa).
- **Pós-deploy (`--pos-deploy`, usado pelo `pc-deploy-watch`):** espera o deployment do site sair de in_progress no Coolify (até 20 min) e roda sem adiar, para todo deploy ter veredito. O `pc-deploy-watch` agora é versionado aqui.
- **Pós-deploy:** o `pc-deploy-watch` chama `node /usr/local/bin/pc-checkout-probe.mjs` após cada deploy. Um lock (`/run/pc-checkout-probe.lock`) evita duas sondas ao mesmo tempo.
- **Regra da casa:** todo deploy termina com a sonda do checkout verde.

**Monitor quebrado (desde 15/out/2026):**
- Em 15/out o `node_modules` usado pela sonda foi esvaziado e ela passou a quebrar com `ERR_MODULE_NOT_FOUND`, sem alerta nenhum.
- Hoje toda checagem sai com código 0 quando a rodada termina, inclusive com falha confirmada (o alerta já foi registrado). Saída diferente de 0 significa que a CHECAGEM quebrou, e o `pc-monitor meta` transforma isso em `MONITOR QUEBRADO`.
- Se o próprio `pc-monitor meta` quebrar, o `OnFailure` chama o `pc-monitor-panico`, que manda e-mail direto, sem depender do pc-monitor, no máximo 1 por hora.
- Checagem com o timer desligado de propósito não conta como quebra.

**Dependências da sonda:**
- A sonda usa um diretório próprio, `/opt/pc-checkout-probe`, com o playwright pinado em `probe-package.json` e o Chromium em `/opt/pc-checkout-probe/browsers`.
- **Nunca** usa o `node_modules` de um checkout de trabalho do site. Agentes e worktrees mexem nele.
- O `instalar.sh` monta o diretório. `PROBE_HOME` aponta para outro lugar em testes.

**Privacidade:** o IP de saída do túnel (a casa do Cesar) nunca é gravado. As mensagens de erro vão sem placa, e-mail, IP ou token.

**Recursos da VPS (desde 21/out/2026):** a VPS chegou a load 25 em 6 núcleos com o flaresolverr em swap, e o disco a 82%. Agora os leilões têm teto de CPU, o site tem prioridade (cpu-shares 4096) e o flaresolverr roda sem swap. O alerta de carga cita os containers que mais consomem.

**Deploy perdido ou velho (desde 21/out/2026):** um incidente do GitHub engoliu o push da `main` e o merge não foi ao ar. Agora o `pc-deploy-check` avisa quando a `main` não chega ao ar em 15 min. O `pc-coolify-dedup` (em `ops/coolify/`) cancela qualquer deploy, na fila ou em andamento, de commit ANCESTRAL do que já está no ar (webhook atrasado) e manda o e-mail `DEPLOY ANTIGO CANCELADO`.

## Arquivos

| Arquivo | O que é |
|---|---|
| `pc-monitor` | Motor de estado e alerta (Python, só stdlib), com as checagens de site, fila, túnel e o meta. Subcomandos: `site`, `fila`, `tunel`, `meta`, `alerta <alvo> ok\|falha <tipo> <motivo> [detalhe]`, `estado` |
| `pc-monitor-panico` | E-mail direto quando o próprio `pc-monitor meta` falha (via `OnFailure`) |
| `probe-package.json` | Dependências da sonda, instaladas em `/opt/pc-checkout-probe` |
| `pc-checkout-probe.mjs` | Fluxo Playwright, com classificação e tentativas; registra o resultado via `pc-monitor alerta checkout ...` |
| `pc-*-check.service/.timer`, `pc-checkout-probe.service/.timer` | Units systemd, todas com `OnActiveSec` + `OnUnitActiveSec` |
| `instalar.sh` | Instala tudo e faz backup do que existia. `./instalar.sh --voltar <dir-do-backup>` desfaz |

**Na VPS:**
- Estado em `/var/lib/pc-monitor/<alvo>.json`.
- Histórico em `/var/log/pc-monitor/<alvo>.log`, com uma linha JSON por verificação.
- `pc-monitor estado` imprime o estado dos 5 alvos em JSON. É o que os coletores da TV leem: `saude.json` mostra `sonda_site`, `sonda_checkout` e `fila_relatorio`; `tecnologia.json` mostra `tunel_mac`.

**Credenciais lidas (só o caminho, nunca o valor):**
- token da Management API do Supabase em `~/.supabase/access-token` (alvo fila);
- `pc-mail` (ForwardEmail) para os e-mails.

## Como testar sem mandar e-mail

- `PCMON_DRY=1 pc-monitor site`: imprime o e-mail que sairia em vez de enviar.
- `PCMON_URL` troca a URL do site. `PCMON_BIN` e `PROBE_LOCK` apontam a sonda para outro motor e outro lock.
- `PCMON_TUNEL_CMD` troca o comando de subida do túnel que vai no e-mail.
- Para não sujar o estado real, use uma cópia do script com `ESTADO_DIR` e `LOG_DIR` apontando para uma pasta temporária.

## Instalar ou atualizar

```bash
cd ops/monitor && sudo ./instalar.sh           # deps da sonda em /opt, os 5 alvos e os timers
systemctl list-timers 'pc-*-check.timer' pc-checkout-probe.timer pc-monitor-meta.timer   # NEXT preenchido
```

Pastas irmãs:
- `ops/premium-jobs/`: disparo da fila do relatório e limpeza do cache por fonte.
- `ops/coolify/`: `pc-coolify-dedup`, que cancela deploys intermediários na fila do Coolify.

A visão geral da VPS fica no repo `placa-completa-infra` (README).

## Calibração: as 10 falhas da sonda antiga (28/set a 12/out: 173 OK, 10 FALHA)

| Quando | Erro | Home no momento | Veredito |
|---|---|---|---|
| 29/09 15:08 | resultado da consulta grátis não apareceu em 90 s | 200 em 0,2 s, load 1,8 | **Falso positivo**: falha isolada (a rodada seguinte passou), site rápido e VPS folgada. A confirmação 3x elimina. |
| 30/09 18:06 | idem | 200 em 0,2 s, load 2,5 | **Falso positivo**, mesmo caso. |
| 08/10 13:55 | `ERR_CONNECTION_RESET` no goto | 200 em 1,1 s logo depois | **Falso positivo**: reset único e transitório. |
| 11/10 21:25 a 12/10 09:25 (7 rodadas) | a home não carregou | sem resposta em 20 s, as 7 vezes | **Real**: site fora (504) de ~21h a 10h55. O e-mail antigo culpava a VPS e saía no máximo a cada 2 h. O monitor novo teria mandado "SITE FORA DO AR" por volta de 21h05, repetido de hora em hora, e "SITE VOLTOU (fora por ~14h)". |

Resultado: 3 falsos positivos, todos isolados, e 7 falhas reais, todas do mesmo incidente.

## Regras que vieram dos incidentes

- **Nunca** conectar o container do site a outra rede docker. Isso causou a queda de 11-12/out: o Traefik passou a rotear para a rede errada.
- Deploy espera as consultas em andamento (`em_voo`): stop grace de 150 s e HEALTHCHECK no Dockerfile. Todo deploy termina com a sonda do checkout.
- Timer systemd sempre com `OnActiveSec`. Depois de mexer, conferir NEXT no `list-timers`.
- Monitoramento não pode depender de arquivo que agente mexe: a sonda tem as próprias dependências, e checagem quebrada vira alerta.
- Alerta novo tem que dizer o que fazer (o túnel manda o comando de subida) e não pode virar ruído (no máximo 1 e-mail por queda quando o Cesar pedir).
