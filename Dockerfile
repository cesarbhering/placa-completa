# syntax=docker/dockerfile:1.7
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

RUN npm run build

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
