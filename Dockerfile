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

# Workaround npm bug with optionalDependencies when lockfile is from another platform
RUN rm -f package-lock.json && \
    npm install --include=optional --no-audit --no-fund

COPY . .

ENV NITRO_PRESET=node-server
ENV NODE_ENV=production

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

COPY --from=builder /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
