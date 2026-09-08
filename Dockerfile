# ------------------------------------------------------------
# Build stage — install deps + build Nuxt
# ------------------------------------------------------------
FROM node:22.12.0-bookworm-slim AS builder

WORKDIR /app

# Native build deps for some Nuxt modules (sharp, sqlite, etc)
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        python3 \
        make \
        g++ \
        git \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./

# Build deterministico: npm ci respeita o package-lock.json commitado.
# (O workaround antigo deletava o lockfile e resolvia versoes novas a cada
# build - em 23/jul/2026 isso quebrou o deploy com um bug do npm 10.9
# disparado por release nova de dependencia. Dev e build sao Linux x64,
# entao o motivo original do workaround nao existe mais.)
# Rede do registry cai sob carga: dois deploys de producao morreram no mesmo
# dia com ECONNRESET, os dois enquanto a VPS estava com load alto por causa da
# pipeline de leiloes. Nao e bug do lockfile nem de dependencia, e a conexao
# sendo derrubada no meio do download.
#
# Duas camadas de teimosia, porque cobrem falhas diferentes: os --fetch-retry*
# fazem o npm insistir em CADA pacote que falhar, e o laco de fora refaz o
# comando inteiro quando a falha derruba o processo antes disso. Sem o laco, um
# ECONNRESET na hora errada ainda mata o build.
#
# Espera crescente entre as tentativas (15s, 30s, 45s): se o motivo e a maquina
# estar afogada, tentar de novo no mesmo instante so soma carga.
RUN bash -c 'set -e; \
    for tentativa in 1 2 3 4; do \
        if npm ci --include=optional --no-audit --no-fund \
                --fetch-retries=5 \
                --fetch-retry-mintimeout=20000 \
                --fetch-retry-maxtimeout=120000 \
                --fetch-timeout=300000; then \
            exit 0; \
        fi; \
        echo "npm ci falhou (tentativa $tentativa de 4). Nova tentativa em $((tentativa * 15))s."; \
        sleep $((tentativa * 15)); \
    done; \
    echo "npm ci falhou nas 4 tentativas."; \
    exit 1'

COPY . .

ENV NITRO_PRESET=node-server
ENV NODE_ENV=production

# Config publica do Nuxt (public.homolog) e assada no bundle do client em build:
# o override de runtime via NUXT_PUBLIC_* nao chega no client. Default false =
# prod intocada (Coolify nao passa o build-arg). Imagem de homolog builda com
# --build-arg NUXT_PUBLIC_HOMOLOG=true pra ligar overlay/gate/painel de teste.
ARG NUXT_PUBLIC_HOMOLOG=false
ENV NUXT_PUBLIC_HOMOLOG=$NUXT_PUBLIC_HOMOLOG
# Imagem de staging builda com --build-arg NUXT_PUBLIC_STAGING=true: liga o gate
# de senha (via public.gated) sem as ferramentas de teste do homolog.
ARG NUXT_PUBLIC_STAGING=false
ENV NUXT_PUBLIC_STAGING=$NUXT_PUBLIC_STAGING

# Workaround Nuxt 3 ESM worker zombie: nuxt build sometimes won't exit after
# completing because esbuild workers stay alive. We watch for the output
# artifact, then force-kill the workers so the RUN step can return.
RUN bash -c 'set -e; \
    npm run build & BUILD_PID=$!; \
    while kill -0 $BUILD_PID 2>/dev/null; do \
        if [ -f .output/server/index.mjs ]; then \
            sleep 5; \
            pkill -9 -f esbuild 2>/dev/null || true; \
            kill -TERM $BUILD_PID 2>/dev/null || true; \
            sleep 2; \
            kill -9 $BUILD_PID 2>/dev/null || true; \
            break; \
        fi; \
        sleep 2; \
    done; \
    wait $BUILD_PID 2>/dev/null || true; \
    test -f .output/server/index.mjs'

# Reduce node_modules size (Nitro already bundled what it needs into .output)
RUN npm prune --omit=dev || true

# ------------------------------------------------------------
# Runtime stage — only .output + minimal Node
# ------------------------------------------------------------
FROM node:22.12.0-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV NITRO_PRESET=node-server
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --chown=node:node --from=builder /app/.output ./.output

USER node

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
