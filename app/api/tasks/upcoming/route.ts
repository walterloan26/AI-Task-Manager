// app/api/tasks/upcoming/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/authOptions';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'

async function getUpcomingTasks(userId: string, isAdmin: boolean, limit: number) {

  let whereClause: any = {
    status: {
      in: ['PENDING', 'IN_PROGRESS']
    }
  };

  if (!isAdmin) {
    whereClause = {
      ...whereClause,
      OR: [
        { ownerId: userId },
        { assignedToId: userId }
      ]
    };
  }

  const tasks = await prisma.task.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: limit * 2,
    select: {
      id: true,
      task: true,
      complexity: true,
      status: true,
      aiGenerated: true,
      aiConfidence: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: { name: true, email: true } },
      createdBy: { select: { name: true, email: true } },
      assignedTo: { select: { name: true, email: true } },
      subtasks: {
        select: {
          id: true,
          title: true,
          completed: true,
          priority: true,
          estimateMinutes: true
        },
        where: { isDeleted: false },
        orderBy: { orderIndex: 'asc' }
      }
    }
  });

  return { tasks, whereClause };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const userId = session.user.id;
    const isAdmin = session.user.role === 'ADMIN';

    const { tasks, whereClause } = await getUpcomingTasks(userId, isAdmin, limit);

    // Calculate progress for each task based on subtasks
    const formattedTasks = tasks.map(task => {
      const totalSubtasks = task.subtasks.length;
      const completedSubtasks = task.subtasks.filter(s => s.completed).length;
      const progress = totalSubtasks > 0 
        ? Math.round((completedSubtasks / totalSubtasks) * 100) 
        : 0;

      // Determine priority based on subtask priorities or complexity
      const hasHighPrioritySubtasks = task.subtasks.some(s => s.priority === 'HIGH');
      const priority = hasHighPrioritySubtasks ? 'high' : 
                      task.complexity === 'HIGH' ? 'high' :
                      task.complexity === 'MEDIUM' ? 'medium' : 'low';

      // Priority weight
      const priorityWeight =
        priority === 'high' ? 3 :
        priority === 'medium' ? 2 : 1;

      // Status weight
      const statusWeight =
        task.status === 'IN_PROGRESS' ? 2 : 1;

      // Final score (priority + progress + active work)
      const score =
        (priorityWeight * 50) +
        (statusWeight * 30) +
        progress;

      return {
        id: task.id,
        title: task.task,
        complexity: task.complexity.toLowerCase(),
        priority: priority,
        score,
        status: task.status === 'IN_PROGRESS'
          ? 'in-progress'
          : task.status.toLowerCase(),
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        progress,
        totalSubtasks,
        completedSubtasks,
        owner: task.owner,
        createdBy: task.createdBy,
        assignedTo: task.assignedTo,
        subtasks: task.subtasks,
        aiGenerated: task.aiGenerated,
        aiConfidence: task.aiConfidence
      };
    });
    // ---- SORT TASKS BY SMART PRIORITY ----
    formattedTasks.sort((a, b) => b.score - a.score);

    // Only return the best tasks
    const topTasks = formattedTasks.slice(0, limit);

    // Get AI recommendation based on tasks
    const aiRecommendation = await generateAIRecommendation(topTasks, userId);
    const totalPending = await prisma.task.count({
      where: whereClause
    })

    return NextResponse.json({
      tasks: topTasks,
      aiRecommendation,
      totalPending
    });

  } catch (error) {
    console.error('Error fetching upcoming tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upcoming tasks' },
      { status: 500 }
    );
  }
}

async function generateAIRecommendation(tasks: any[], userId: string) {
  if (tasks.length === 0) {
    return {
      message: "You're all caught up! Create new tasks to get personalized recommendations.",
      action: "Create Task"
    };
  }

  // Find tasks with high priority
  const highPriorityTasks = tasks.filter(t => t.priority === 'high');
  
  if (highPriorityTasks.length > 0) {
    const task = highPriorityTasks[0];
    const subtaskInfo = task.totalSubtasks > 0 
      ? ` (${task.completedSubtasks}/${task.totalSubtasks} subtasks completed)` 
      : '';
    
    return {
      message: `Focus on "${task.title}"${subtaskInfo} - it's high priority and has ${task.totalSubtasks} subtasks to complete.`,
      action: "View Task"
    };
  }

  // Find tasks with most progress (almost done)
  const almostDone = tasks.find(t => t.progress > 0 && t.progress < 100);
  if (almostDone) {
    return {
      message: `You're ${almostDone.progress}% done with "${almostDone.title}". Great progress!`,
      action: "Continue"
    };
  }

  // Default to newest task
  const newestTask = tasks[0];
  return {
    message: `Start with "${newestTask.title}" - it's your most recent task.`,
    action: "Begin"
  };
}