# ableton-mind MCP server — Docker image
#
# Use case primário: rodar o **server MCP** (TypeScript) num container que
# conecta no bridge Python rodando NO HOST (Ableton Live precisa estar local).
#
# A imagem NÃO contém Ableton Live nem o Remote Script — esses ficam no host.
# Container só roda Node 20 + dist/.
#
# Build:    docker build -t ableton-mind .
# Run:      docker run --rm -i --network host \
#             -e ABLETON_MIND_HOST=127.0.0.1 \
#             -e ABLETON_MIND_PORT=9876 \
#             ableton-mind

FROM node:20-alpine AS builder
WORKDIR /app

# Copy manifests primeiro para cache de deps.
COPY package.json package-lock.json* tsup.config.ts tsconfig.json ./
RUN npm install --no-audit --no-fund

# Copy source + recipes + knowledge.
COPY src ./src
COPY recipes ./recipes

RUN npm run build

# ----- runtime image --------------------------------------------------------
FROM node:20-alpine
WORKDIR /app

# Não precisa de deps de build no runtime.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/recipes ./recipes
COPY --from=builder /app/src/knowledge ./knowledge
COPY package.json README.md LICENSE ./

# Production deps only.
RUN npm install --omit=dev --no-audit --no-fund

ENV NODE_ENV=production \
    ABLETON_MIND_HOST=127.0.0.1 \
    ABLETON_MIND_PORT=9876 \
    ABLETON_MIND_LOG_LEVEL=info

# stdio MCP transport — usa stdin/stdout.
CMD ["node", "dist/index.js"]
