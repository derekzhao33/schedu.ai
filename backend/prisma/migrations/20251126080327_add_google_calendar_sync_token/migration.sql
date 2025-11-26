-- AlterTable
ALTER TABLE "User" ADD COLUMN     "google_calendar_last_sync" TIMESTAMP(3),
ADD COLUMN     "google_calendar_sync_token" TEXT;
