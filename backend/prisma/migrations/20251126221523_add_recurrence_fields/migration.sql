-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "is_recurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurrence" TEXT[];
