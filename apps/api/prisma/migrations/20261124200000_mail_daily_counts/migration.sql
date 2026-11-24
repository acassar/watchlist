-- Compteur journalier des emails envoyés (quota du fournisseur).
CREATE TABLE "mail_daily_counts" (
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "mail_daily_counts_pkey" PRIMARY KEY ("day")
);
