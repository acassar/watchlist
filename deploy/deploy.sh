#!/usr/bin/env bash
# Exécuté sur le VPS par le workflow Deploy, dans /srv/canapact :
#   printf '%s' "$GHCR_TOKEN" | ssh vps bash /srv/canapact/deploy.sh <sha> <utilisateur GHCR>
#
# Le workflow a déjà copié compose.next.yml : le compose de prod où la version
# (SHA) est écrite en dur, pour qu'un `docker compose up -d` lancé à la main plus
# tard garde la même version.
#
# Ordre pensé pour ne jamais couper le site pour rien :
#   1. tirer les images (rien n'est arrêté si ça échoue) ;
#   2. appliquer les migrations avec la nouvelle image, les conteneurs en
#      service continuent de tourner (si elles échouent, on s'arrête là) ;
#   3. remplacer api et web ; si la nouvelle version n'est pas en bonne santé,
#      relancer la précédente (sans repasser par les migrations).
set -euo pipefail

TAG="${1:-}"
GHCR_USER="${2:-}"
if [[ ! "$TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "SHA invalide : '$TAG'" >&2
  exit 2
fi
cd "$(dirname "${BASH_SOURCE[0]}")"
[[ -f compose.next.yml ]] || { echo "compose.next.yml absent" >&2; exit 2; }
chmod +x backup.sh 2>/dev/null || true

# 1. Images. Session GHCR dans un dossier temporaire, effacé quoi qu'il arrive :
# le jeton (valable le temps du job GitHub) ne reste jamais sur le VPS.
docker_config="$(mktemp -d)"
trap 'rm -rf "$docker_config"' EXIT
if [[ -d "$HOME/.docker/cli-plugins" ]]; then
  ln -s "$HOME/.docker/cli-plugins" "$docker_config/cli-plugins"
fi
if [[ -n "$GHCR_USER" && ! -t 0 ]]; then
  DOCKER_CONFIG="$docker_config" docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
fi
echo "==> Images $TAG"
DOCKER_CONFIG="$docker_config" docker compose -f compose.next.yml pull --quiet
rm -rf "$docker_config"

# 2. Migrations, avant de toucher aux conteneurs en service.
echo "==> Migrations"
docker compose -f compose.next.yml run --rm -T migrate

# 3. Bascule.
echo "==> Démarrage"
if [[ -f compose.yml ]]; then cp compose.yml compose.prev.yml; fi
mv compose.next.yml compose.yml
if ! docker compose up -d --wait --wait-timeout 180 --remove-orphans; then
  echo "!! La nouvelle version ne démarre pas correctement." >&2
  docker compose ps -a >&2 || true
  docker compose logs --tail 80 api web >&2 || true
  if [[ -f compose.prev.yml ]]; then
    echo "==> Retour à la version précédente" >&2
    mv compose.prev.yml compose.yml
    docker compose up -d --no-deps --pull never --wait --wait-timeout 180 api web >&2 || true
  fi
  exit 1
fi

# Ménage : seulement les images de Canapact, en gardant la version en service et
# la précédente (retour en arrière sans registre). Les autres images du VPS ne
# sont pas touchées.
keep="$(grep -ho 'ghcr\.io/acassar/watchlist-[a-z]*:[0-9a-f]\{40\}' compose.yml compose.prev.yml 2>/dev/null | sort -u || true)"
if [[ -n "$keep" ]]; then
  docker image ls --filter 'reference=ghcr.io/acassar/watchlist-*' --format '{{.Repository}}:{{.Tag}}' |
    grep -v ':<none>$' | grep -vxF "$keep" | xargs -r docker image rm >/dev/null 2>&1 || true
fi
docker image prune -f --filter 'label=org.opencontainers.image.source=https://github.com/acassar/watchlist' >/dev/null || true
echo "==> Version $TAG en service"
