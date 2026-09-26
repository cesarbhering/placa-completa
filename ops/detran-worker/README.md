# detran-worker

Ponte HTTP **interna** entre o container Nuxt (serviço premium) e a consulta
DETRAN-SP. Roda **no host, como root** (o container não tem o `browser-harness`).

## Motor (caminho B — API direta, rework 24/set)

Em vez de navegar a SPA (~66s), o worker:

1. **Extrai UMA sessão** pelo browser (`browser-harness`, profile `gov-br`):
   login gov.br automático + bridge → `cdp("Network.getAllCookies")` (pega os
   cookies **httpOnly** — JSESSIONID, UX-Token, glide_session_store — que
   `document.cookie` não vê) + `window.g_ck`. Monta o header `Cookie` (só os
   cookies de domínio `detran.sp.gov.br`) e cacheia `{cookie, g_ck, ua}`.
2. **Consulta em HTTP puro** (`detran_api.py`, ~2s): 4 GETs na API interna do
   ServiceNow (base + `debitos-milt`/`debitos-ipva`/`debitos-licenciamento`),
   com `X-UserToken: <g_ck>`, `X-Use-Polaris: false`, o header Cookie e a mesma
   `User-Agent` da extração. Parseia no **mesmo contrato do runner antigo**.

A sessão dura ~30min FIXO (não rolling) → **TTL de 25min**; expira no meio
(401/403) → re-extrai 1× e repete. A sessão persiste em `session.json` (0600)
pra sobreviver a restart do worker.

**Regra do fallback (evita auto-martelo do login gov.br):** o **fallback para o
runner de navegação** (`/root/detran-sp-runner.py`, plano B) só entra quando a
falha foi a **API com sessão válida** (glitch de rede/API) — aí o runner navega
reusando o browser já logado, sem novo login. Se a **sessão não existe** (login/
daemon falhou), NÃO cai no runner (ele também loga e só dobraria o login
travado): é **fail-open** (relatório sai sem o bloco; o self-heal do report.get
cobre depois). Além disso, após uma extração falhar há um **backoff**
(`DETRAN_EXTRACT_BACKOFF_S`, 5min): não re-extrai a cada consulta/reabertura —
login travado não vinga em segundos e re-tentar só agrava o throttle. E o
`ensure_daemon` limpa o **spawnlock** residual antes de subir o daemon
(stale-daemon recorrente).

**LGPD:** o `base` da API traz `nomeProprietario` + `idProprietario` (nome +
CPF/CNPJ do dono). O parser **nunca** lê nem persiste isso — só campos técnicos
do veículo (`detran_api._veiculo_do_base` + teste que garante ausência na saída).

Arquivos: `detran-worker.py` (ponte + sessão + fallback), `detran_api.py`
(fetch HTTP + parser), `detran_api_test.py` (24 checks, fiel ao FHB6G05 real).

## Contrato

`POST /consultar` — header `X-Worker-Secret: <segredo>`, corpo JSON:

```json
{ "placa": "FHB6G05", "renavam": "00996754997", "uf": "SP" }
```

Resposta: o JSON do runner (ver `detran-sp-runner.py`), por exemplo
`{ "ok": true, "encontrado": true, "status": "com_debito", "multas_total_centavos": 14161, ... }`
ou, em falha, `{ "ok": false, "stage": "..." }`. O Nuxt trata qualquer não-200 /
`ok:false` como **fail-open** (relatório sai sem o bloco de multas).

`GET /health` → `{ "ok": true, "daemon_alive": <bool> }` (sem auth).

`POST /warm` — header `X-Worker-Secret` — **re-extrai a sessão** (browser +
login) e reinicia o relógio de ociosidade. Serve pro **pre-warm** agendado
(timer systemd a cada ~25min no pico de vendas Bing ~7h-13h), pra manter a
sessão quente e a 1ª consulta do cliente não pagar o cold-start do browser.
Responde `{ "ok": <bool>, "warm": true, "sessao_valida": <bool>, "n_cookies_detran": <int> }`.

## Segurança (crítico)

- Bind **explícito em `10.0.1.1:8477`** (gateway do bridge coolify), **NUNCA
  0.0.0.0** — dados de multa por placa/renavam são PII e não podem ter superfície
  pública. O bind interno já o torna inalcançável de fora da VPS.
- Auth por header `X-Worker-Secret`, comparação constant-time (`hmac.compare_digest`),
  401 sem/errado. Sem `DETRAN_WORKER_SECRET` setado, o worker recusa tudo (401).

## Concorrência = 1

O daemon usa UM profile gov.br persistente compartilhado; consultas simultâneas
se atropelam e podem deslogar a sessão. Um lock global serializa (1 por vez);
excedente recebe **429** após esperar `DETRAN_LOCK_WAIT_S`.

## Lifecycle do daemon

Start-on-demand: a cada consulta garante o daemon `pcdetran` vivo
(`start_remote_daemon("pcdetran", profileName="gov-br", proxyCountryCode="br")`),
e para-o após `DETRAN_IDLE_STOP_S` (padrão 600s) sem uso (billing por tempo). O
runner é auto-curável no login gov.br (captcha auto-resolve). Cold start (~15-60s
+ relogin se a sessão expirou) na 1ª consulta da janela.

## Env vars

| var | padrão | uso |
|-----|--------|-----|
| `DETRAN_WORKER_HOST` | `10.0.1.1` | bind (não mudar sem motivo; nunca 0.0.0.0) |
| `DETRAN_WORKER_PORT` | `8477` | porta |
| `DETRAN_WORKER_SECRET` | — | **obrigatório**; mesmo valor no `NUXT_DETRAN_WORKER_SECRET` do Coolify |
| `DETRAN_RUNNER` | `/root/detran-sp-runner.py` | caminho do runner |
| `BROWSER_HARNESS_BIN` | `~/.local/bin/browser-harness` | binário do harness |
| `DETRAN_DAEMON` | `pcdetran` | nome do daemon cloud |
| `DETRAN_PROFILE` | `gov-br` | profile com a sessão gov.br |
| `DETRAN_SESSION_FILE` | `/opt/detran-worker/session.json` | cache da sessão (0600) |
| `DETRAN_SESSION_TTL_S` | `1500` | validade da sessão (25min; TTL real ~30min FIXO) |
| `DETRAN_EXTRACT_TIMEOUT_S` | `180` | timeout da extração (browser + login gov.br) |
| `DETRAN_EXTRACT_BACKOFF_S` | `300` | após extração falhar, não re-extrai por este tempo (não martela o login travado) |
| `DETRAN_API_TIMEOUT_S` | `30` | timeout de cada GET da API |
| `DETRAN_IDLE_STOP_S` | `600` | ociosidade antes de parar o daemon |
| `DETRAN_RUN_TIMEOUT_S` | `220` | timeout do runner de fallback |
| `DETRAN_LOCK_WAIT_S` | `8` | espera pelo lock antes de 429 |

Precisa no ambiente: `PATH` com `~/.local/bin`, `BROWSER_USE_API_KEY`
(`/root/.browser-use.env`). O runner lê `/root/.secrets/govbr.env` pro login.

## systemd (infra)

Deploy sugerido em `/opt/detran-worker/detran-worker.py`. Unit como root, com
anti-crash-loop (`StartLimitIntervalSec`/`StartLimitBurst`) — regra do incidente
superbid (worker que reinicia em loop derruba a VPS). Esboço:

```ini
[Unit]
Description=detran-worker (ponte multas DETRAN-SP)
After=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=simple
User=root
Environment=PATH=/root/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
EnvironmentFile=/root/.browser-use.env
EnvironmentFile=/root/.secrets/detran-worker.env
ExecStart=/usr/bin/python3 /opt/detran-worker/detran-worker.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

`/root/.secrets/detran-worker.env` deve conter ao menos `DETRAN_WORKER_SECRET=...`.

## Teste antes de plugar o Nuxt

De dentro de um container coolify (ou do host, apontando pro bind):

```bash
curl -s -X POST http://10.0.1.1:8477/consultar \
  -H "X-Worker-Secret: $DETRAN_WORKER_SECRET" \
  -H 'content-type: application/json' \
  -d '{"placa":"FHB6G05","renavam":"00996754997","uf":"SP"}'
```

Só depois de o standalone responder o JSON esperado, ligar
`NUXT_DETRAN_WORKER_URL=http://10.0.1.1:8477` + `NUXT_DETRAN_WORKER_SECRET` no
Coolify (homolog primeiro).
