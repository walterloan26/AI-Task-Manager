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
    "orderIndex" INTEGER,
    CONSTRAINT "Subtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Subtask" ("completed", "createdAt", "description", "estimateMinutes", "id", "priority", "taskId", "title", "updatedAt") SELECT "completed", "createdAt", "description", "estimateMinutes", "id", coalesce("priority", 'Medium') AS "priority", "taskId", "title", "updatedAt" FROM "Subtask";
DROP TABLE "Subtask";
ALTER TABLE "new_Subtask" RENAME TO "Subtask";
CREATE INDEX "Subtask_taskId_orderIndex_idx" ON "Subtask"("taskId", "orderIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
