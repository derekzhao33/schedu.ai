-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "google_event_id" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "google_access_token" TEXT,
ADD COLUMN     "google_refresh_token" TEXT,
ADD COLUMN     "google_token_expiry" TIMESTAMP(3);
