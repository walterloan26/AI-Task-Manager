// app/api/tasks/upcoming/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/authOptions';
import { prisma } from '@/lib/prisma';

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

    // Build where clause based on user role
    let whereClause: any = {
      status: {
        not: 'COMPLETED' // Only show non-completed tasks
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

    // Fetch tasks - since there's no dueDate, we'll sort by createdAt
    const tasks = await prisma.task.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc' // Show newest first, or you could use updatedAt
      },
      take: limit,
      select: {
        id: true,
        task: true,
        complexity: true,
        status: true,
        aiGenerated: true,
        aiConfidence: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            name: true,
            email: true
          }
        },
        createdBy: {
          select: {
            name: true,
            email: true
          }
        },
        assignedTo: {
          select: {
            name: true,
            email: true
          }
        },
        subtasks: {
          select: {
            id: true,
            title: true,
            completed: true,
            priority: true,
            estimateMinutes: true
          },
          where: {
            isDeleted: false
          },
          orderBy: {
            orderIndex: 'asc'
          }
        }
      }
    });

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

      return {
        id: task.id,
        title: task.task,
        complexity: task.complexity.toLowerCase(),
        priority: priority,
        status: task.status.toLowerCase(),
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

    // Get AI recommendation based on tasks
    const aiRecommendation = await generateAIRecommendation(formattedTasks, userId);

    return NextResponse.json({
      tasks: formattedTasks,
      aiRecommendation,
      totalPending: tasks.length
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