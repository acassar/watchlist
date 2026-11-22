-- CreateEnum
CREATE TYPE "media_source" AS ENUM ('YOUTUBE', 'TMDB', 'MANUAL');

-- CreateEnum
CREATE TYPE "watch_status" AS ENUM ('OK_ALONE', 'TOGETHER', 'NOT_INTERESTED');

-- CreateTable
CREATE TABLE "media_items" (
    "id" UUID NOT NULL,
    "source" "media_source" NOT NULL,
    "external_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "author" TEXT,
    "duration_sec" INTEGER,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_titles" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "media_item_id" UUID NOT NULL,
    "added_by" UUID,
    "added_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "watched_together_at" TIMESTAMPTZ(3),

    CONSTRAINT "group_titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_statuses" (
    "group_title_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "watch_status" NOT NULL,
    "watched_alone_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "member_statuses_pkey" PRIMARY KEY ("group_title_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_items_source_external_id_key" ON "media_items"("source", "external_id");

-- CreateIndex
CREATE INDEX "group_titles_group_id_added_at_idx" ON "group_titles"("group_id", "added_at");

-- CreateIndex
CREATE UNIQUE INDEX "group_titles_group_id_media_item_id_key" ON "group_titles"("group_id", "media_item_id");

-- CreateIndex
CREATE INDEX "member_statuses_user_id_idx" ON "member_statuses"("user_id");

-- AddForeignKey
ALTER TABLE "group_titles" ADD CONSTRAINT "group_titles_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_titles" ADD CONSTRAINT "group_titles_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "media_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_titles" ADD CONSTRAINT "group_titles_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_statuses" ADD CONSTRAINT "member_statuses_group_title_id_fkey" FOREIGN KEY ("group_title_id") REFERENCES "group_titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_statuses" ADD CONSTRAINT "member_statuses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
