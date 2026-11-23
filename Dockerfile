# syntax=docker/dockerfile:1
# Images de production. Deux cibles :
#   docker build --target api -t canapact-api .
#   docker build --target web -t canapact-web .

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

# --- Build commun : dépendances puis sources (le cache des dépendances survit aux changements de code).
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @watchlist/shared build \
 && pnpm --filter @watchlist/api build \
 && pnpm --filter @watchlist/web build
# API autonome : dépendances de prod seulement (Prisma CLI compris, pour les migrations).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @watchlist/api deploy --prod --legacy /out \
 && rm -rf /out/dist /out/src /out/test /out/*.tsbuildinfo /out/vitest.config*.ts \
 && cp -r apps/api/dist /out/dist

# --- API NestJS. La même image applique les migrations (service « migrate » du compose).
FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/main.js"]

# --- Front : fichiers statiques servis par Nginx, qui relaie aussi /api vers l'API.
FROM nginx:1.28-alpine AS web
COPY deploy/nginx/web.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1/healthz"]
