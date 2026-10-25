# Teselia server image: the relay, the landing page at / and the web app at /app/. Build from the
# repository root:
#   docker build -f apps/server/Dockerfile -t teselia-server .
#
# Node runs the server's TypeScript sources directly (type stripping), so only the web app has a
# build step. The workspace layout is kept because Node only strips types outside node_modules.

# The built web app is the same on every platform, so it is built once, natively.
FROM --platform=$BUILDPLATFORM node:24-slim AS web
RUN npm install --global pnpm@10.28.0
WORKDIR /src
COPY . .
RUN pnpm install --frozen-lockfile --filter @teselia/web...
# VITE_SERVER_URL "/" makes every server propose itself for new groups.
RUN TESELIA_BASE=/app/ VITE_SERVER_URL=/ pnpm --filter @teselia/web build

FROM node:24-slim AS install
RUN npm install --global pnpm@10.28.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/protocol/package.json packages/protocol/
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
RUN pnpm install --prod --frozen-lockfile --filter @teselia/server...

FROM node:24-slim
LABEL org.opencontainers.image.title="Teselia server" \
      org.opencontainers.image.description="Zero-knowledge relay for Teselia groups, with the web app" \
      org.opencontainers.image.licenses="EUPL-1.2"
ENV NODE_ENV=production \
    TESELIA_DB=/data/teselia.db \
    TESELIA_PORT=8080 \
    TESELIA_WEB_ROOT=/app/web
WORKDIR /app
COPY --from=install /app ./
COPY packages/protocol/src packages/protocol/src
COPY packages/core/src packages/core/src
COPY apps/server/src apps/server/src
COPY apps/site web
COPY --from=web /src/apps/web/dist web/app
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/server/src/main.ts"]
