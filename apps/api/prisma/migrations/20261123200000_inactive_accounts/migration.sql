-- Purge des comptes inactifs : date de dernière activité et prévenance.
ALTER TABLE "users"
  ADD COLUMN "last_active_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "inactivity_warned_at" TIMESTAMPTZ(3);

-- Comptes existants : dernière session connue, sinon la création du compte.
UPDATE "users" u
SET "last_active_at" = GREATEST(
  u."created_at",
  COALESCE((SELECT MAX(r."created_at") FROM "refresh_tokens" r WHERE r."user_id" = u."id"), u."created_at")
);

CREATE INDEX "users_last_active_at_idx" ON "users"("last_active_at");
