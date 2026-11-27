-- Vidéo devenue indisponible : on ne garde plus que son identifiant.
ALTER TABLE "media_items" ADD COLUMN "unavailable" BOOLEAN NOT NULL DEFAULT false;

-- Vidéos déjà repérées comme supprimées (durée effacée lors d'un
-- rafraîchissement, titre gardé) : impossible de les distinguer d'une vidéo
-- sans durée connue. On les fait toutes revérifier au prochain passage du
-- rafraîchissement (dans l'heure qui suit le démarrage), au lieu d'attendre
-- 29 jours de plus avec un titre qu'on n'a plus le droit de garder.
UPDATE "media_items" SET "fetched_at" = to_timestamp(0) WHERE "duration_sec" IS NULL;
