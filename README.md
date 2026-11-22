# Watchlist

Watchlist partagée « seul ou ensemble » : pour chaque titre, chaque membre du groupe indique s'il accepte que les autres le regardent sans lui.

## Structure

```
apps/web         Vue 3 + Vite + Vuetify (PWA, mobile d'abord)
apps/api         NestJS + Prisma (PostgreSQL)
packages/shared  Types, enums et schémas Zod communs au front et à l'API
docker/          Compose de développement (et plus tard de production)
```

## Démarrer en local

Prérequis : Node 22+, pnpm 10, Docker.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up        # Postgres sur 127.0.0.1:5432
pnpm dev          # API sur :3000, front sur :5173 (Vite relaie /api)
```

Vérifier : http://localhost:5173 et http://localhost:5173/api/health

## Commandes

| Commande                                | Rôle                                             |
| --------------------------------------- | ------------------------------------------------ |
| `pnpm lint`                             | oxlint sur tous les paquets                      |
| `pnpm typecheck`                        | TypeScript (tsc, vue-tsc)                        |
| `pnpm test`                             | Tests unitaires (Vitest partout)                 |
| `pnpm --filter @watchlist/api test:e2e` | Tests de bout en bout de l'API (Postgres requis) |
| `pnpm build`                            | Build de production                              |
| `pnpm format`                           | Prettier                                         |
