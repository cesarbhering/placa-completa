# pc-monitor: site e checkout

Monitoramento de produção na VPS (ordem do Cesar, 12/out/2026). Substitui a sonda única de 2 h, que gerava alarme falso e não avisou direito na queda de 11-12/out.

## Duas checagens, dois alertas

| Alvo | O que testa | Frequência | Confirmação | E-mail |
|---|---|---|---|---|
| **site** (`pc-site-check.timer`) | `GET /` (precisa ter "PlacaCompleta") e `GET /api/app-status` (precisa ter "forceUpdate") pela URL pública, ou seja, Cloudflare, túnel, Traefik e container. Timeout de 15 s; resposta acima de 20 s conta como falha. | 5 min | 2 falhas seguidas, 60 s entre elas | `SITE FORA DO AR: <tipo>` |
| **checkout** (`pc-checkout-probe.timer` e pós-deploy) | Fluxo real no Chromium: consulta grátis, botão da Completa, botão de pagar. Não gera Pix. | 30 min | 3 falhas seguidas, 60 s entre elas | `CHECKOUT COM ERRO: <tipo>` |

- Os e-mails vão para cesarcbhering@gmail.com e helena@placacompleta.com.br. Enquanto o problema durar, o alerta se repete a cada 1 h (`[ainda, ha 2h00] ...`). Na volta sai `... VOLTOU (fora por Xh)`.
- **Tipos**. Site: `timeout`, `conexao`, `http_5xx`, `http_4xx`, `conteudo`, `lento`. Checkout: `api` (4xx/5xx em `/api/premium` ou `/api/consulta`), `fluxo_timeout`, `fluxo_travado`, `tela_erro`.
- Se a home não abre, a sonda do checkout **não** manda "checkout com erro". O alerta é do site.
- **Carga da VPS**: o Chromium roda com nice 10. Com load acima de 2x o número de núcleos, a sonda espera 2 min, até 3 vezes, e então pula a rodada sem dar veredito. Nunca usa "VPS sobrecarregada" como diagnóstico: se o site leva mais de 20 s para o cliente, é incidente.
- `pc-deploy-watch` continua chamando `node /usr/local/bin/pc-checkout-probe.mjs` após cada deploy (sem mudança). Um lock evita duas sondas ao mesmo tempo.

## Arquivos

- `pc-monitor`: motor de estado e alerta (Python, stdlib), mais a checagem do site. Subcomandos: `site`, `alerta <site|checkout> ok|falha ...`, `estado`. O subcomando `estado` gera o JSON que o coletor da TV lê.
- `pc-checkout-probe.mjs`: o fluxo Playwright, com classificação e tentativas.
- Estado em `/var/lib/pc-monitor/<alvo>.json`. Histórico em `/var/log/pc-monitor/<alvo>.log`, com uma linha JSON por verificação.
- `instalar.sh`: instala e faz backup do que existia. `./instalar.sh --voltar <backup>` desfaz.

Testes sem enviar e-mail: `PCMON_DRY=1`. Para apontar a sonda para outro motor ou outro lock: `PCMON_BIN` e `PROBE_LOCK`.

## Calibração: as 10 falhas da sonda antiga (28/set a 12/out: 173 OK, 10 FALHA)

| Quando | Erro | Home no momento | Veredito |
|---|---|---|---|
| 29/09 15:08 | resultado da consulta grátis não apareceu em 90 s | 200 em 0,2 s, load 1,8 | **Falso positivo** da sonda: falha isolada (a rodada seguinte passou), site rápido e VPS folgada. Lentidão pontual da consulta ou um marcador do A/B. A confirmação 3x elimina. |
| 30/09 18:06 | idem | 200 em 0,2 s, load 2,5 | **Falso positivo**, mesmo caso. |
| 08/10 13:55 | `ERR_CONNECTION_RESET` no goto | 200 em 1,1 s logo depois | **Falso positivo**: reset de conexão único, transitório. A confirmação 2x/3x elimina. |
| 11/10 21:25 a 12/10 09:25 (7 rodadas, de 2 em 2 h) | `waitForSelector` timeout: a home não carregou | **sem resposta em 20 s**, as 7 vezes | **Real**: site fora (504), de ~21h a 10h55. A sonda acertou, mas o e-mail dizia "VPS sobrecarregada, não checkout travado" e saía no máximo a cada 2 h. O monitor novo teria mandado "SITE FORA DO AR" por volta de 21h05, repetido de hora em hora, e "SITE VOLTOU (fora por ~14h)". |

Resultado: 3 falsos positivos (todos isolados, nenhum se repetiria com a confirmação) e 7 falhas reais, todas do mesmo incidente.

## Fila do relatório (premium_jobs), desde 14/out/2026

- `pc-monitor fila` (`pc-fila-check.timer`, a cada 5 min) lê a view `premium_jobs_saude` no prod pela Management API.
- Se há job pendente atrasado mais de 15 min ou com lease vencido, manda `FILA DO RELATORIO PARADA`, repetido a cada 1 h, e `VOLTOU` quando normaliza.
- Jobs que esgotaram as 4 tentativas geram um e-mail único por lote, `RELATORIO COM FONTE ESGOTADA (n)`, com fonte e erro curto.
- A TV mostra isso em `saude.json` → `fila_relatorio`.
- O disparo da fila e a limpeza do cache ficam em `ops/premium-jobs/`.

## Túnel residencial do Mac (desde 14/out/2026)

- `pc-monitor tunel` (`pc-tunel-check.timer`, a cada 5 min) faz `curl -x socks5h://127.0.0.1:1080 https://ifconfig.me` com timeout de 15 s.
- 2 falhas seguidas, com 60 s entre elas, mandam UM e-mail `TÚNEL DO MAC CAIU` só ao Cesar, com o comando de subida. Esse alerta não se repete. Quando o túnel volta, sai `TÚNEL DO MAC VOLTOU (fora por X)`.
- O IP de saída (a casa do Cesar) nunca é gravado.
- Na TV: `tecnologia.json` → `tunel_mac`.
