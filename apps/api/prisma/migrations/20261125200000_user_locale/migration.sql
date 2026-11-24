-- Langue de l'interface et des emails. Les comptes existants restent en français.
ALTER TABLE "users" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'fr';
