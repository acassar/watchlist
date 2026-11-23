#!/usr/bin/env bash
# Sauvegarde quotidienne de la base Canapact (cron de l'utilisateur deploy sur le VPS) :
#   30 3 * * * /srv/canapact/backup.sh >> /srv/canapact/backups/backup.log 2>&1
#
# 1. pg_dump (format custom, déjà compressé) dans /srv/canapact/backups ;
# 2. suppression des copies locales de plus de BACKUP_KEEP_DAYS jours ;
# 3. si BACKUP_RCLONE_REMOTE est défini (ex. « swissbackup:canapact »), copie
#    hors du VPS avec rclone puis suppression des copies distantes de plus de
#    BACKUP_REMOTE_KEEP_DAYS jours.
#
# Les durées doivent correspondre à la politique de confidentialité : un compte
# supprimé reste dans les sauvegardes jusqu'à leur expiration.
#
# Restauration (écrase la base actuelle) :
#   docker compose -f /srv/canapact/compose.yml exec -T postgres \
#     pg_restore -U canapact -d canapact --clean --if-exists < fichier.dump
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$DIR/backups}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"
BACKUP_REMOTE_KEEP_DAYS="${BACKUP_REMOTE_KEEP_DAYS:-30}"
BACKUP_RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-}"
# Réglages facultatifs dans backup.env (non versionné), à côté du script.
if [[ -f "$DIR/backup.env" ]]; then
  # shellcheck disable=SC1091
  source "$DIR/backup.env"
fi

umask 077
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/canapact-$(date -u +%Y%m%dT%H%M%SZ).dump"

echo "$(date -Is) sauvegarde -> $file"
docker compose -f "$DIR/compose.yml" exec -T postgres \
  pg_dump -U canapact -d canapact --format=custom > "$file.partial"
mv "$file.partial" "$file"

find "$BACKUP_DIR" -name 'canapact-*.dump' -mtime "+$((BACKUP_KEEP_DAYS - 1))" -delete
find "$BACKUP_DIR" -name 'canapact-*.dump.partial' -delete

if [[ -n "$BACKUP_RCLONE_REMOTE" ]]; then
  rclone copy "$file" "$BACKUP_RCLONE_REMOTE"
  rclone delete --min-age "${BACKUP_REMOTE_KEEP_DAYS}d" --include 'canapact-*.dump' "$BACKUP_RCLONE_REMOTE"
  echo "$(date -Is) copie hors du VPS : $BACKUP_RCLONE_REMOTE"
fi
echo "$(date -Is) terminé"
