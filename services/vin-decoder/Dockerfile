# Node + Fastify + SQLite (better-sqlite3, precisa compilar nativo). Build
# multi-stage: estagio de build com toolchain, imagem final so com o
# resultado — mantem a imagem final pequena.
FROM node:20-alpine AS build
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

FROM node:20-alpine
RUN apk add --no-cache tini
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
ENV PORT=3000
ENV VIN_DB_PATH=/data/vin.db
VOLUME ["/data"]
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
