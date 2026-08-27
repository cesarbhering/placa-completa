# Runbook — staging.placacompleta.com.br

Ambiente de staging: espelho de produção com gate de senha. Serve a branch
`staging` (fork de `dev`). Prod (`main`) e homolog (`dev`) não são afetados.

## O que é

| Item | Valor |
|---|---|
| URL | https://staging.placacompleta.com.br |
| Branch servida | `staging` |
| Container | `pc-premium-staging` |
| Porta (host) | `127.0.0.1:8396` → `:3000` |
| Env file (VPS) | `/root/premium-staging.nuxt.env` (chmod 600, fora do git) |
| Rede docker | `coolify` |
| Roteamento | tunnel `placacompleta` (cloudflared) → ingress `localhost:8396` |

### Endpoints (por decisão do produto)

| Serviço | Staging |
|---|---|
| Supabase (DB) | **staging** `nqhlxsvggrumgcceamwg` |
| GCC / SERPRO | **produção** (checkout usa `ambiente=producao` por padrão no staging) |
| AbacatePay (Pix) | **produção** `abc_prod_` — **Pix REAL, cobra de verdade** |
| wdapi2 (placa) | real (via cache `placa_cache`) |

### Flags (assadas no build)

- `NUXT_PUBLIC_STAGING=true` → `public.staging`; `public.gated = homolog || staging`
  liga o **overlay de senha** (uma vez, salvo em localStorage).
- **Não** seta `NUXT_PUBLIC_HOMOLOG` → sem dropdown de ambiente e sem botão
  "simular pagamento" (fluxo prod-like).
- Gate: senha em `NUXT_PREMIUM_PAGE_PASSWORD` (runtime; hoje `Temporaria123!`).

## Deploy (rotina)

Toda vez que a branch `staging` mudar:

```bash
bash /root/deploy-staging.sh
```

Faz: `git reset --hard origin/staging` → build com `--build-arg NUXT_PUBLIC_STAGING=true`
→ recria o container na 8396 → volta pra `dev` → verifica a URL. O ingress do
tunnel **não** é tocado (já está configurado).

### Promover trabalho de `dev` → `staging`

```bash
cd /root/placa-completa
git fetch origin
git branch -f staging origin/dev   # ou: git checkout staging && git merge dev
git push origin staging
bash /root/deploy-staging.sh
```

### Trocar a senha do gate (sem rebuild)

Editar `NUXT_PREMIUM_PAGE_PASSWORD` em `/root/premium-staging.nuxt.env` e recriar
o container (é validada em runtime):

```bash
docker rm -f pc-premium-staging
docker run -d --name pc-premium-staging --restart unless-stopped --network coolify \
  -p 127.0.0.1:8396:3000 --env-file /root/premium-staging.nuxt.env <ultima-imagem>
```

## Roteamento do tunnel (feito uma vez — só se precisar refazer)

O subdomínio já está roteado. Se algum dia precisar recriar:

```bash
bash /root/wire-staging-tunnel.sh
```

> ⚠️ Mudança em `/etc/cloudflared/config.yml` exige **`systemctl restart cloudflared`**.
> **NUNCA** `kill -HUP` nem `systemctl reload`: nessa versão o SIGHUP **encerra** o
> cloudflared (não recarrega) e o systemd não reinicia → prod+homolog+staging caem
> (502). Recuperação: `systemctl start cloudflared`.

## Diagnóstico rápido

```bash
docker ps --filter name=pc-premium-staging          # container up?
systemctl is-active cloudflared                      # tunnel up?
curl -sI https://staging.placacompleta.com.br/       # 200?
docker logs pc-premium-staging --tail 30             # erros do app
```

- **502 nos três hosts** → cloudflared caiu: `systemctl start cloudflared`.
- **502 só no staging** → container fora: rodar `deploy-staging.sh` ou `docker start pc-premium-staging`.
- **gate não aparece** → conferir `public:{staging:true,gated:true}` no HTML servido
  (a flag é assada no build; sem o `--build-arg` ela vem `false`).
