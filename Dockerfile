# ableton-mind MCP server — Docker image
#
# Primary use case: run the TypeScript MCP server in a container that connects
# to the Python bridge running on the host (Ableton Live must be local).
#
# The image does not include Ableton Live or the Remote Script; those stay on
# the host. The container only runs Node 20 + dist/.
#
# Build:    docker build -t ableton-mind .
# Run:      docker run --rm -i --network host \
#             -e ABLETON_MIND_HOST=127.0.0.1 \
#             -e ABLETON_MIND_PORT=9876 \
#             ableton-mind

FROM node:20-alpine AS builder
WORKDIR /app

# Copy manifests first for dependency cache.
COPY package.json package-lock.json* tsup.config.ts tsconfig.json ./
RUN npm install --no-audit --no-fund

# Copy source + recipes + knowledge + scripts (build:postbuild copies assets).
COPY src ./src
COPY recipes ./recipes
COPY scripts ./scripts

RUN npm run build

# ----- runtime image --------------------------------------------------------
FROM node:20-alpine
WORKDIR /app

# Build dependencies are not needed at runtime.
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
