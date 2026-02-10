// lib/dashboard/stats.ts - FIXED VERSION
import { prisma } from "@/lib/prisma";

export async function getDashboardStats(userId: string, userRole: string = 'USER') {
  // Build where clause based on user role
  let whereClause: any;
  
  if (userRole === 'ADMIN') {
    // Admin can see all tasks regardless of owner
    whereClause = {};
    console.log(`📊 Admin ${userId} viewing ALL tasks`);
  } else {
    // Regular users only see tasks they OWN or are ASSIGNED to
    whereClause = {
      OR: [
        { ownerId: userId }, // Tasks they own
        { assignedToId: userId } // Tasks assigned to them
      ]
    };
    console.log(`📊 User ${userId} viewing OWNED/ASSIGNED tasks`);
  }

  const tasks = await prisma.task.findMany({
    where: whereClause,
    select: {
      id: true,
      task: true,
      ownerId: true,
      assignedToId: true,
      status: true,
      subtasks: {
        select: { 
          completed: true,
        },
      },
    },
  });

  console.log(`📊 Found ${tasks.length} tasks for user ${userId} (role: ${userRole})`);
  
  // Debug: Show sample tasks
  if (tasks.length > 0) {
    tasks.slice(0, 2).forEach((task, index) => {
      console.log(`  Task ${index + 1}:`, {
        id: task.id.substring(0, 8),
        title: task.task.substring(0, 30) + '...',
        ownerId: task.ownerId,
        assignedToId: task.assignedToId,
        isOwnedByUser: task.ownerId === userId,
        isAssignedToUser: task.assignedToId === userId,
        subtasks: task.subtasks.length,
        completedSubtasks: task.subtasks.filter(s => s.completed).length
      });
    });
  }

  let completed = 0;
  let inProgress = 0;
  let pending = 0;

  for (const task of tasks) {
    const totalSubtasks = task.subtasks.length;
    const doneSubtasks = task.subtasks.filter(s => s.completed).length;

    if (totalSubtasks === 0 || doneSubtasks === 0) {
      pending++;
    } else if (doneSubtasks === totalSubtasks) {
      completed++;
    } else {
      inProgress++;
    }
  }

  // FIXED: Use tasks.length instead of undefined 'total' variable
  console.log(`📈 Stats: Total=${tasks.length}, Completed=${completed}, InProgress=${inProgress}, Pending=${pending}`);

  return {
    total: tasks.length,
    completed,
    inProgress,
    pending,
  };
}