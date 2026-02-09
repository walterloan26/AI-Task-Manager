// lib/dashboard/stats.ts
import { prisma } from "@/lib/prisma";

export async function getDashboardStats(userId: string) {
  const tasks = await prisma.task.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      subtasks: {
        select: { completed: true },
      },
    },
  });

  let completed = 0;
  let inProgress = 0;
  let pending = 0;

  for (const task of tasks) {
    const total = task.subtasks.length;
    const done = task.subtasks.filter(s => s.completed).length;

    if (total === 0 || done === 0) {
      pending++;
    } else if (done === total) {
      completed++;
    } else {
      inProgress++;
    }
  }

  return {
    total: tasks.length,
    completed,
    inProgress,
    pending,
  };
}
