-- Vidéo devenue indisponible : on ne garde plus que son identifiant.
ALTER TABLE "media_items" ADD COLUMN "unavailable" BOOLEAN NOT NULL DEFAULT false;

-- Vidéos déjà repérées comme supprimées (durée effacée lors d'un
-- rafraîchissement) : impossible de les distinguer d'une vidéo sans durée
-- connue, le prochain rafraîchissement s'en chargera.
