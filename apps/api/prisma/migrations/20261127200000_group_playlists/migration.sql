-- Synchro d'une playlist YouTube par membre et par groupe.
-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "playlists_synced_at" TIMESTAMPTZ(3),
ADD COLUMN     "playlists_waiting" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "group_playlists" (
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "playlist_id" TEXT NOT NULL,
    "linked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "import_from" TIMESTAMPTZ(3),
    "error" TEXT,

    CONSTRAINT "group_playlists_pkey" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "youtube_daily_units" (
    "day" DATE NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "youtube_daily_units_pkey" PRIMARY KEY ("day")
);

-- AddForeignKey
ALTER TABLE "group_playlists" ADD CONSTRAINT "group_playlists_group_id_user_id_fkey" FOREIGN KEY ("group_id", "user_id") REFERENCES "group_members"("group_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

