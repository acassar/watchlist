# Watchlist

Watchlist partagée « seul ou ensemble » : pour chaque titre, chaque membre du groupe indique s'il accepte que les autres le regardent sans lui.

## Structure

```
apps/web         Vue 3 + Vite + Vuetify (PWA, mobile d'abord)
apps/api         NestJS + Prisma (PostgreSQL)
packages/shared  Types, enums et schémas Zod communs au front et à l'API
docker/          Compose de développement
deploy/          Production : compose, Nginx, sauvegardes, guide (deploy/README.md)
```

## Démarrer en local

Prérequis : Node 22+, pnpm 10, Docker.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up        # Postgres sur 127.0.0.1:5432
pnpm db:migrate   # applique les migrations Prisma
pnpm dev          # API sur :3000, front sur :5173 (Vite relaie /api)
```

Vérifier : http://localhost:5173 et http://localhost:5173/api/health

En dev, les emails (vérification, mot de passe oublié) ne partent pas : ils s'affichent dans les logs de l'API (`MAIL_TRANSPORT=console`). Copiez le lien affiché dans le navigateur.

## Authentification

- JWT d'accès de 15 min gardé en mémoire côté front, refresh token rotatif de 30 jours dans un cookie `httpOnly`, `SameSite=Strict`, limité à `/api/auth`, hashé en base. Un refresh token réutilisé révoque toute la session de l'appareil.
- Toutes les routes API exigent un JWT, sauf celles marquées `@Public()`.
- Emails via un adaptateur (`MAIL_TRANSPORT`) : `console` en dev, `memory` en test, `brevo` en prod (`BREVO_API_KEY`).
- Rate limiting par IP sur les routes d'auth (`AUTH_RATE_LIMIT` par minute). Derrière Nginx, régler `TRUST_PROXY`.
- « Se connecter avec Google » (Passport, OAuth 2.0 + PKCE) : activé seulement si `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` sont renseignés (sinon le bouton est masqué). URI de redirection à déclarer chez Google : `${APP_URL}/api/auth/google/callback`. L'état OAuth vit dans un cookie signé (pas de session serveur).
- Liaison Google ↔ email automatique quand l'adresse est vérifiée des deux côtés. Un compte email jamais vérifié est repris par le propriétaire prouvé de l'adresse (mot de passe et liens en attente effacés : protection contre le pré-détournement de compte). Ajouter un mot de passe à un compte Google exige le clic sur un lien envoyé par email.

| Route                                  | Rôle                                                    |
| -------------------------------------- | ------------------------------------------------------- |
| `POST /api/auth/register`              | Inscription (202, même réponse si l'adresse existe)     |
| `POST /api/auth/verify-email`          | Clic sur le lien : active le compte et ouvre la session |
| `POST /api/auth/verify-email/resend`   | Renvoie le lien de vérification                         |
| `POST /api/auth/login`                 | Connexion                                               |
| `POST /api/auth/refresh`               | Nouveau JWT (rotation du cookie)                        |
| `POST /api/auth/logout`                | Déconnexion de cet appareil                             |
| `POST /api/auth/password/forgot`       | Envoie un lien de réinitialisation                      |
| `POST /api/auth/password/reset`        | Nouveau mot de passe, ferme toutes les sessions         |
| `POST /api/auth/password/link/confirm` | Ajout d'un mot de passe à un compte Google              |
| `GET /api/auth/providers`              | Moyens de connexion activés (`{ google }`)              |
| `GET /api/auth/google?next=/chemin`    | Départ vers Google (redirection)                        |
| `GET /api/auth/google/callback`        | Retour de Google : session puis redirection vers `next` |
| `GET /api/me`                          | Profil de l'utilisateur connecté                        |

## Groupes et invitations

- Un utilisateur peut être dans plusieurs groupes ; un groupe d'un seul membre est permis. Rôles : propriétaire (un par groupe) et membre.
- Guard `GroupMemberGuard` sur toute route `:groupId` : un non-membre reçoit 404 (on ne révèle pas l'existence du groupe). `@OwnerOnly()` réserve une route au propriétaire.
- Invitation = un lien (`/join#token=…`, jeton de 256 bits dont seul le hash est stocké, montré une seule fois) et un code de 8 caractères à dicter. Valable 7 jours par défaut, révocable, nombre d'utilisations limitable. Tout membre peut inviter ; l'auteur ou le propriétaire peut révoquer.
- Quitter : le dernier membre supprime le groupe ; un propriétaire qui part passe la main au membre arrivé le plus tôt ; les invitations du partant sont révoquées. Ses statuts seront supprimés (étape 6), ses titres resteront (« ancien membre »).
- Limites : 20 membres et 20 invitations actives par groupe. Aperçu et acceptation limités en débit par IP (`AUTH_RATE_LIMIT`).

| Route                                                   | Rôle                                       |
| ------------------------------------------------------- | ------------------------------------------ |
| `GET /api/groups`                                       | Mes groupes                                |
| `POST /api/groups`                                      | Créer un groupe (j'en suis propriétaire)   |
| `GET /api/groups/:groupId`                              | Détail et membres                          |
| `PATCH /api/groups/:groupId`                            | Renommer (propriétaire)                    |
| `POST /api/groups/:groupId/leave`                       | Quitter le groupe                          |
| `DELETE /api/groups/:groupId/members/:userId`           | Retirer un membre (propriétaire)           |
| `GET /api/groups/:groupId/invitations`                  | Invitations encore utilisables             |
| `POST /api/groups/:groupId/invitations`                 | Nouvelle invitation (lien + code)          |
| `DELETE /api/groups/:groupId/invitations/:invitationId` | Révoquer (auteur ou propriétaire)          |
| `POST /api/invitations/preview`                         | Aperçu avant de rejoindre (`token`/`code`) |
| `POST /api/invitations/accept`                          | Rejoindre (`token` ou `code`)              |

## PWA et partage

- PWA installable (`vite-plugin-pwa`, `apps/web/vite.config.ts`) : manifest « Canapact », icônes dans `apps/web/public/` (source `icon.svg`). Le service worker ne met en cache que l'interface ; `/api` passe toujours par le réseau (pas de mode hors ligne pour les données). Il n'est actif qu'en build (`pnpm --filter @watchlist/web build && pnpm --filter @watchlist/web preview`), et seulement en HTTPS ou sur `localhost`.
- Android : `share_target` en GET vers `/share`. L'app YouTube met souvent le lien dans `text` : on prend la première URL YouTube de n'importe quel champ (`findSharedLink`, dans `@watchlist/shared`).
- Écran « Ajouter à quel groupe ? » : toujours affiché, dernier groupe utilisé en tête, sauté s'il n'y a qu'un groupe. Non connecté : le lien est gardé 24 h sur l'appareil pendant la connexion ou l'inscription, puis on y revient.
- iOS (pas de Web Share Target) : bouton « Coller le lien » dans le « + » et sur la page `/add` (aussi en raccourci de l'icône). Le Raccourci Apple viendra plus tard.

## Commandes

| Commande                                | Rôle                                             |
| --------------------------------------- | ------------------------------------------------ |
| `pnpm lint`                             | oxlint sur tous les paquets                      |
| `pnpm typecheck`                        | TypeScript (tsc, vue-tsc)                        |
| `pnpm test`                             | Tests unitaires (Vitest partout)                 |
| `pnpm --filter @watchlist/api test:e2e` | Tests de bout en bout de l'API (Postgres requis) |
| `pnpm build`                            | Build de production                              |
| `pnpm format`                           | Prettier                                         |

## Déploiement

Chaque merge sur `main` (CI verte) publie les images sur GHCR et met à jour le VPS. Guide et mise en place : [deploy/README.md](deploy/README.md).
