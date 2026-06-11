FROM node:24.14.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src
COPY tsconfig.json ./
RUN npm run build

FROM node:24.14.0-bookworm-slim AS runtime

WORKDIR /app

ARG VCS_REF=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="infisical-mcp-server"
LABEL org.opencontainers.image.description="Unofficial Infisical MCP fork runtime"
LABEL org.opencontainers.image.source="https://github.com/garvae/infisical-mcp-server"
LABEL org.opencontainers.image.revision=$VCS_REF
LABEL org.opencontainers.image.created=$BUILD_DATE

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV MCP_TRANSPORT=streamable-http
ENV MCP_HTTP_HOST=0.0.0.0
ENV MCP_HTTP_PORT=3333
ENV MCP_HTTP_PATH=/mcp
ENV MCP_HTTP_BODY_LIMIT_BYTES=4194304
ENV MCP_HTTP_SESSION_TTL_MS=300000
ENV MCP_BUILD_REVISION=$VCS_REF
ENV MCP_BUILD_TIMESTAMP=$BUILD_DATE

EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch(`http://127.0.0.1:${process.env.MCP_HTTP_PORT}/health`).then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
