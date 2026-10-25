# Teselia server image. Build from the repository root:
#   docker build -f apps/server/Dockerfile -t teselia-server .
#
# Node runs the TypeScript sources directly (type stripping), so there is no build step. The
# workspace layout is kept because Node only strips types outside node_modules.

FROM node:24-slim AS install
RUN npm install --global pnpm@10.28.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/protocol/package.json packages/protocol/
COPY apps/server/package.json apps/server/
RUN pnpm install --prod --frozen-lockfile --filter @teselia/server...

FROM node:24-slim
LABEL org.opencontainers.image.title="Teselia server" \
      org.opencontainers.image.description="Zero-knowledge relay for Teselia groups" \
      org.opencontainers.image.licenses="EUPL-1.2"
ENV NODE_ENV=production \
    TESELIA_DB=/data/teselia.db \
    TESELIA_PORT=8080
WORKDIR /app
COPY --from=install /app ./
COPY packages/protocol/src packages/protocol/src
COPY apps/server/src apps/server/src
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/server/src/main.ts"]
