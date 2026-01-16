/*
  Warnings:

  - Made the column `orderIndex` on table `Subtask` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Subtask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimateMinutes" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "taskId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "orderIndex" INTEGER NOT NULL,
    CONSTRAINT "Subtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Subtask" ("completed", "createdAt", "description", "estimateMinutes", "id", "orderIndex", "priority", "taskId", "title", "updatedAt") SELECT "completed", "createdAt", "description", "estimateMinutes", "id", "orderIndex", "priority", "taskId", "title", "updatedAt" FROM "Subtask";
DROP TABLE "Subtask";
ALTER TABLE "new_Subtask" RENAME TO "Subtask";
CREATE INDEX "Subtask_taskId_orderIndex_idx" ON "Subtask"("taskId", "orderIndex");
CREATE UNIQUE INDEX "Subtask_taskId_orderIndex_key" ON "Subtask"("taskId", "orderIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
