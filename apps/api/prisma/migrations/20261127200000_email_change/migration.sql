-- Changement de mot de passe et d'adresse depuis les réglages.
ALTER TYPE "email_token_type" ADD VALUE 'CHANGE_EMAIL';
ALTER TYPE "email_token_type" ADD VALUE 'REVERT_EMAIL';

-- Nouvelle adresse (CHANGE_EMAIL) ou ancienne adresse à remettre (REVERT_EMAIL).
ALTER TABLE "email_tokens" ADD COLUMN "email" TEXT;
-- Compte Google lié au moment du changement (REVERT_EMAIL), remis si besoin.
ALTER TABLE "email_tokens" ADD COLUMN "google_id" TEXT;

-- Changements d'adresse confirmés (limite sur 30 jours glissants).
CREATE TABLE "email_changes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_changes_user_id_changed_at_idx" ON "email_changes"("user_id", "changed_at");

ALTER TABLE "email_changes" ADD CONSTRAINT "email_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
