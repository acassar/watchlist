# Déploiement de Canapact sur le VPS

URL : https://canapact.fr (l'ancienne adresse canapact.adrien-cassar.fr redirige en 301)

## Comment ça marche

```
merge sur main ─> CI verte ─> workflow Deploy
   1. construit les images api et web, les publie sur GHCR
      (ghcr.io/acassar/watchlist-api|web, tags <sha> et latest)
   2. SSH sur le VPS (utilisateur deploy), deploy.sh dans /srv/canapact :
      a. tire les images de ce commit (rien n'est arrêté si ça échoue)
      b. applique les migrations, le site actuel continue de tourner
         (si elles échouent, on s'arrête là : le site reste sur l'ancienne version)
      c. remplace api et web (up --wait) ; si la nouvelle version n'est pas en
         bonne santé, relance automatiquement la précédente
   3. vérifie https://canapact.fr/api/health
```

Sur le VPS :

```
Internet ─443─> Nginx du VPS (TLS Let's Encrypt, journaux)
                  └─> 127.0.0.1:8080  conteneur web (Nginx : front + relais /api)
                                         └─> api:3000  conteneur API (NestJS)
                                                └─> postgres:5432 (volume pgdata)
```

- Le service `migrate` applique les migrations Prisma avant chaque démarrage de l'API.
- `/srv/canapact/compose.yml` est figé sur le SHA déployé : un `docker compose up -d` lancé à la main garde la même version. La version précédente est gardée dans `compose.prev.yml`, et ses images restent sur le VPS.
- Les secrets de l'application vivent uniquement sur le VPS, dans `/srv/canapact/.env` (modèle : `env.prod.example`). GitHub ne connaît que l'accès SSH.
- `TRUST_PROXY=loopback,uniquelocal` : l'API voit l'IP du client (rate limiting). Le Nginx du VPS écrase `X-Forwarded-For` pour qu'un client ne puisse pas la falsifier.
- Les images sont tirées avec le jeton temporaire du job GitHub : pas de jeton GHCR stocké sur le VPS.

## Fichiers

| Fichier                           | Rôle                                                        |
| --------------------------------- | ----------------------------------------------------------- |
| `../Dockerfile`                   | Images de prod (cibles `api` et `web`)                      |
| `compose.prod.yml`                | Compose de prod (copié en `/srv/canapact/compose.yml`)      |
| `env.prod.example`                | Modèle de `/srv/canapact/.env`                              |
| `nginx/web.conf`                  | Nginx du conteneur web (cache PWA, en-têtes, relais `/api`) |
| `nginx/canapact.host.conf`        | Site à ajouter au Nginx du VPS                              |
| `deploy.sh`                       | Mise à jour sur le VPS (lancé par le workflow)              |
| `backup.sh`                       | Sauvegarde quotidienne `pg_dump` (+ copie hors VPS)         |
| `../.github/workflows/deploy.yml` | Workflow de déploiement                                     |

## Mise en place (une fois)

Chaque étape donne les commandes et un prompt à donner à Claude sur le VPS.

### 1. Utilisateur de déploiement

Prérequis : Docker et Docker Compose 2.20 ou plus (`docker compose version`).

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo install -d -o deploy -g deploy -m 750 /srv/canapact
# Clé SSH dédiée au déploiement (la privée ira dans GitHub, puis sera effacée ici)
sudo -u deploy ssh-keygen -t ed25519 -N "" -C "github-deploy-canapact" -f /home/deploy/.ssh/id_github
sudo -u deploy sh -c 'cat ~/.ssh/id_github.pub >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
```

> Le groupe `docker` donne l'équivalent d'un accès root : la clé ne doit servir qu'au workflow.

> Prompt : « Sur ce serveur Debian/Ubuntu, vérifie que Docker et Docker Compose 2.20+ sont installés. Crée un utilisateur `deploy` sans mot de passe, ajoute-le au groupe `docker`, crée `/srv/canapact` (propriétaire deploy, droits 750). Génère pour lui une clé SSH ed25519 sans phrase de passe `~deploy/.ssh/id_github` et ajoute sa clé publique à son `authorized_keys`. Ne modifie pas la configuration de sshd ni de Nginx. Montre-moi à la fin le résultat de `id deploy` et `docker compose version`. »

### 2. Secrets de l'application

Créer `/srv/canapact/.env` à partir de `env.prod.example` (droits 600, propriétaire deploy), en générant `POSTGRES_PASSWORD` (`openssl rand -hex 32`) et `JWT_SECRET` (`openssl rand -base64 48`).

> Prompt : « Crée `/srv/canapact/.env` (propriétaire deploy, droits 600) avec ce contenu : [coller env.prod.example]. Génère POSTGRES_PASSWORD avec `openssl rand -hex 32` et JWT_SECRET avec `openssl rand -base64 48`. Laisse vides les clés que je n'ai pas fournies et ne m'affiche pas les secrets générés. »

### 3. Site Nginx et HTTPS

```bash
sudo cp canapact.host.conf /etc/nginx/sites-available/canapact.fr
sudo ln -s /etc/nginx/sites-available/canapact.fr /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d canapact.fr -d www.canapact.fr -d canapact.adrien-cassar.fr --redirect
```

> Prompt : « Ce serveur a un Nginx qui sert déjà d'autres sites, ne les modifie pas. Ajoute un site pour canapact.fr avec cette configuration : [coller nginx/canapact.host.conf]. Adapte le chemin si Nginx n'utilise pas sites-available/sites-enabled. Vérifie avec `nginx -t` avant de recharger. Puis obtiens un certificat Let's Encrypt avec `certbot --nginx -d canapact.fr -d www.canapact.fr -d canapact.adrien-cassar.fr --redirect` (installe certbot et son plugin Nginx s'il manque). Vérifie que les autres sites répondent toujours. »

`www.canapact.fr` et l'ancienne adresse `canapact.adrien-cassar.fr` redirigent en 301 vers `https://canapact.fr` en gardant le chemin : les liens déjà envoyés par email (vérification, invitation) restent valables. Le cookie de session étant lié à l'adresse, chacun doit se reconnecter une fois sur canapact.fr, et une PWA installée depuis l'ancienne adresse est à réinstaller.

Avant le premier déploiement, l'adresse répond 502 : c'est normal.

### 4. Secrets GitHub

Dans le dépôt : Settings > Environments > New environment `production`, puis ces secrets :

| Secret            | Valeur                                                    |
| ----------------- | --------------------------------------------------------- |
| `VPS_HOST`        | IP ou nom du VPS                                          |
| `VPS_USER`        | `deploy`                                                  |
| `VPS_PORT`        | Port SSH, seulement s'il n'est pas 22                     |
| `VPS_SSH_KEY`     | Contenu de `/home/deploy/.ssh/id_github` (clé privée)     |
| `VPS_KNOWN_HOSTS` | Sortie de `ssh-keyscan -p <port> <host>` depuis ton poste |

Ensuite, effacer la clé privée du VPS : `sudo rm /home/deploy/.ssh/id_github`.

### 5. Emails (Brevo)

Créer un compte Brevo, authentifier le domaine expéditeur (enregistrements SPF/DKIM/DMARC dans la zone DNS Infomaniak de canapact.fr), puis renseigner `MAIL_FROM_EMAIL` et `BREVO_API_KEY` dans `.env`.

Expéditeur : `bonjour@canapact.fr`. Domaine `canapact.fr` authentifié en enregistrements DNS individuels (pas de délégation NS à Brevo, qui casserait l'enregistrement A). La réception (`contact@`, alias `bonjour@`) passe par la messagerie kSuite d'Infomaniak : un seul enregistrement SPF, qui inclut Infomaniak et Brevo. Clé API restreinte à « Emails transactionnels » ; elle expire au bout d'un an (créée le 23/11/2026) ou après 90 jours sans envoi : la renouveler avant.

### 6. Google et YouTube (facultatif)

- Connexion Google : ajouter l'URI de redirection `https://canapact.fr/api/auth/google/callback` au client OAuth, puis `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` dans `.env`.
- Durée des vidéos : `YOUTUBE_API_KEY` dans `.env`.

Après une modification de `.env` : `cd /srv/canapact && docker compose up -d`.

### 7. Sauvegardes et journaux

```bash
# crontab de deploy (crontab -e)
30 3 * * * /srv/canapact/backup.sh >> /srv/canapact/backups/backup.log 2>&1
```

- Copie hors VPS (choix : Backblaze B2, région EU Central, à mettre en place) : bucket privé avec la règle de cycle de vie « Keep only the last version », clé d'application limitée à ce bucket. Sur le VPS (utilisateur deploy), un remote rclone `b2` (`hard_delete = true`) puis un remote `crypt` `canapact-crypt` par-dessus (mots de passe rangés hors du VPS : sans eux, les sauvegardes sont illisibles). Puis `BACKUP_RCLONE_REMOTE=canapact-crypt:` dans `/srv/canapact/backup.env`. Durées : `BACKUP_KEEP_DAYS` (local, 7 par défaut), `BACKUP_REMOTE_KEEP_DAYS` (distant, 30 par défaut).
- Journaux Nginx : durée fixée par `/etc/logrotate.d/nginx` (souvent 14 jours). Journaux des conteneurs : 3 × 10 Mo par service.
- Reporter ces durées et le lieu des sauvegardes dans `apps/web/src/features/legal/publisher.ts` (`operations`).

## Au quotidien

```bash
cd /srv/canapact
docker compose ps                     # état
docker compose logs -f api            # journaux de l'API
docker compose up -d                  # après une modification du .env (même version)
./backup.sh                           # sauvegarde immédiate
```

Revenir à une version précédente : onglet Actions > Deploy > Run workflow (branche `main`), avec le SHA de la version voulue. L'image est redéployée telle quelle, sans reconstruction. Les migrations ne sont jamais annulées : l'ancienne version tourne sur le schéma actuel (sans souci tant que les migrations ne font qu'ajouter).

Si une migration a échoué au déploiement, le site est resté sur l'ancienne version mais Prisma bloque les déploiements suivants (erreur P3009). Corriger la migration dans une PR, puis sur le VPS, avant de merger :

```bash
cd /srv/canapact
# compose.next.yml = la version qui a échoué, restée là
docker compose -f compose.next.yml run --rm migrate node_modules/.bin/prisma migrate resolve --rolled-back <nom_de_la_migration>
```

Avant ça, vérifier si la migration a été appliquée en partie (tables ou colonnes déjà créées) et remettre la base dans l'état d'avant si besoin.

Restauration d'une sauvegarde (écrase la base) :

```bash
docker compose stop api
docker compose exec -T postgres pg_restore -U canapact -d canapact --clean --if-exists < backups/<fichier>.dump
docker compose start api
```
