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
# IMPORTANTE: o Docker junta estas linhas numa so antes de entregar ao bash,
# entao nao pode haver comentario com # aqui dentro: ele comeria o resto do
# comando. Toda a explicacao fica aqui em cima.
#
# O npm ci NAO garante dependencia opcional: quando o download de uma delas
# falha, o install termina com SUCESSO e o pacote some calado. Foi o que
# derrubou tres deploys seguidos: faltou o binario do sass-embedded e o build
# morreu dez minutos depois com "Tried writing to closed dispatcher", que manda
# todo mundo olhar pro arquivo de estilo errado. A prova estava no proprio log
# do Coolify: o build bom instalou 1113 pacotes, os tres quebrados, 1112.
#
# Por isso a checagem nao so acusa: ela CURA. Faltou o binario, apaga
# node_modules e instala de novo, dentro do mesmo laco de 4 tentativas. So
# desiste se as quatro vierem sem ele.
#
# Nao declarei sass-embedded-linux-x64 como dependencia fixa de proposito: ele
# tem restricao de os/cpu, e um npm ci em Mac passaria a falhar com
# EBADPLATFORM. A correcao nao pode quebrar a maquina de quem desenvolve.
RUN bash -c 'set -e; \
    instalar() { \
        npm ci --include=optional --no-audit --no-fund \
            --fetch-retries=5 \
            --fetch-retry-mintimeout=20000 \
            --fetch-retry-maxtimeout=120000 \
            --fetch-timeout=300000; \
    }; \
    tem_sass() { \
        node -e "require(\"sass-embedded\")" >/dev/null 2>&1 \
            && { [ -d node_modules/sass-embedded-linux-x64 ] || [ -d node_modules/sass-embedded-linux-musl-x64 ]; }; \
    }; \
    for tentativa in 1 2 3 4; do \
        if instalar && tem_sass; then \
            echo "npm ci ok, com o binario do sass-embedded."; \
            exit 0; \
        fi; \
        if tem_sass; then \
            echo "npm ci falhou (tentativa $tentativa de 4)."; \
        else \
            echo "npm ci passou SEM o binario do sass-embedded (tentativa $tentativa de 4). Refazendo."; \
            rm -rf node_modules; \
        fi; \
        sleep $((tentativa * 15)); \
    done; \
    echo "npm ci falhou nas 4 tentativas, ou nunca trouxe o sass-embedded."; \
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
#
# O `pkill` so acontece DEPOIS de o artefato existir, e mesmo assim mira so o
# esbuild. Fica registrado porque a suspeita volta toda vez que um build falha:
# ele nao encosta no processo do sass-embedded, que e quem morre no erro
# "Tried writing to closed dispatcher". Se um dia precisar mirar mais coisa,
# lembre que matar o compilador de SCSS no meio do build produz exatamente
# aquele erro, e ele nao diz quem matou.
#
# Log do build (30/out/2026): a saida do npm run build vai pro log do Coolify
# como antes E pra /tmp/nuxt-build.log. Se o artefato nao aparecer, o passo
# imprime o codigo de saida e as ultimas 200 linhas antes de falhar, pra causa
# (OOM, pacote faltando, erro do Rollup) nunca mais sumir atras do test -f.
RUN bash -c 'set -e; \
    npm run build > >(tee /tmp/nuxt-build.log) 2>&1 & BUILD_PID=$!; \
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
    BUILD_RC=0; wait $BUILD_PID 2>/dev/null || BUILD_RC=$?; \
    if [ ! -f .output/server/index.mjs ]; then \
        echo "=== nuxt build sem .output/server/index.mjs (npm run build saiu com $BUILD_RC) ==="; \
        echo "=== ultimas 200 linhas do build ==="; \
        tail -n 200 /tmp/nuxt-build.log || true; \
        echo "=== memoria no fim do build ==="; \
        (free -m || cat /proc/meminfo | head -5) 2>/dev/null || true; \
        exit 1; \
    fi'

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
# Relogio do processo em BRT: e-mails de erro/estorno e logs formatavam a hora
# em UTC sem dizer o fuso, e o Cesar lia como se fosse horario de Brasilia.
ENV TZ=America/Sao_Paulo
# SIGTERM: o site segue servindo e espera as buscas pos-entrega em voo (teto
# 120 s, server/plugins/aguardar-em-voo.ts). O shutdown nativo do Nitro fecha
# o listener na hora, por isso fica desligado. Coolify: stop grace 150 s.
ENV NITRO_SHUTDOWN_DISABLED=1

# curl pro healthcheck (Docker e Coolify). /api/app-status da 503 depois do
# SIGTERM e o Traefik tira o container do balanceamento.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
HEALTHCHECK --interval=5s --timeout=3s --start-period=20s --retries=3 \
  CMD curl -fsS -o /dev/null http://127.0.0.1:3000/api/app-status || exit 1

COPY --chown=node:node --from=builder /app/.output ./.output

USER node

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
