// lib/dashboard/productivity.ts
import { prisma } from "@/lib/prisma";

export async function getProductivityScore(userId: string): Promise<number> {
  // Get tasks created in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { assignedToId: userId }
      ],
      createdAt: {
        gte: thirtyDaysAgo
      }
    },
    include: {
      subtasks: {
        select: {
          completed: true,
          estimateMinutes: true
        }
      }
    }
  });

  if (tasks.length === 0) return 0;

  let totalScore = 0;
  let maxPossibleScore = 0;

  tasks.forEach(task => {
    const taskSubtasks = task.subtasks;
    
    if (taskSubtasks.length === 0) return;

    // Calculate completion rate for this task
    const completedCount = taskSubtasks.filter(s => s.completed).length;
    const completionRate = completedCount / taskSubtasks.length;
    
    // Weight by number of subtasks (more complex tasks have more weight)
    const taskWeight = Math.min(taskSubtasks.length, 5); // Cap at 5 to prevent outliers
    
    totalScore += completionRate * taskWeight * 20; // Scale to percentage
    maxPossibleScore += taskWeight * 20;
  });

  // Calculate final percentage
  const productivityScore = maxPossibleScore > 0 
    ? Math.round((totalScore / maxPossibleScore) * 100)
    : 0;

  return productivityScore;
}

// Optional: Get completion rate for additional metrics
export async function getTaskCompletionRate(userId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { assignedToId: userId }
      ],
      createdAt: {
        gte: thirtyDaysAgo
      }
    },
    include: {
      subtasks: true
    }
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => 
    task.subtasks.length > 0 && 
    task.subtasks.every(s => s.completed)
  ).length;

  const totalSubtasks = tasks.reduce((sum, task) => sum + task.subtasks.length, 0);
  const completedSubtasks = tasks.reduce(
    (sum, task) => sum + task.subtasks.filter(s => s.completed).length, 
    0
  );

  return {
    taskCompletionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    subtaskCompletionRate: totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0,
    tasksCompleted: completedTasks,
    totalTasks,
    subtasksCompleted: completedSubtasks,
    totalSubtasks
  };
}