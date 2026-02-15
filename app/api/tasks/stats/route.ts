// app/api/tasks/stats/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/authOptions';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const isAdmin = session.user.role === 'ADMIN';
    
    // Build where clause based on user role
    let whereClause: any;
    
    if (isAdmin) {
      whereClause = {}; // Admin sees all tasks
    } else {
      whereClause = {
        OR: [
          { ownerId: session.user.id },
          { assignedToId: session.user.id }
        ]
      };
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      select: {
        id: true,
        task: true,
        subtasks: {
          select: { 
            completed: true,
            title: true,
          },
        },
      },
    });

    console.log('📊 Stats API: Calculating for', {
      userId: session.user.id,
      role: session.user.role,
      totalTasks: tasks.length,
      tasks: tasks.map(t => ({
        task: t.task,
        totalSubtasks: t.subtasks.length,
        completedSubtasks: t.subtasks.filter(s => s.completed).length,
        subtasks: t.subtasks.map(s => ({ title: s.title, completed: s.completed }))
      }))
    });

    let completed = 0;
    let inProgress = 0;
    let pending = 0;
    let totalSubtasks = 0;
    let completedSubtasks = 0;

    for (const task of tasks) {
      const taskTotalSubtasks  = task.subtasks.length;
      const taskCompletedSubtasks  = task.subtasks.filter(s => s.completed).length;

      totalSubtasks += taskTotalSubtasks;
      completedSubtasks += taskCompletedSubtasks;

      if (taskTotalSubtasks === 0 || taskCompletedSubtasks  === 0) {
        pending++;
        console.log(`📊 Task "${task.task}": PENDING (${taskCompletedSubtasks }/${taskTotalSubtasks})`);
      } else if (taskCompletedSubtasks  === taskTotalSubtasks) {
        completed++;
        console.log(`📊 Task "${task.task}": COMPLETED (${taskCompletedSubtasks }/${taskTotalSubtasks})`);
      } else {
        inProgress++;
        console.log(`📊 Task "${task.task}": IN PROGRESS (${taskCompletedSubtasks }/${taskTotalSubtasks})`);
      }
    }

    return NextResponse.json({
      total: tasks.length,
      completed,
      inProgress,
      pending,
      completedSubtasks,  
      totalSubtasks,     
      userRole: session.user.role,
      isAdmin,
    });
    
  } catch (error) {
    console.error('Error fetching task stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

// Add this temporarily to debug
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get ALL tasks regardless of ownership (for debugging)
  const allTasks = await prisma.task.findMany({
    select: {
      id: true,
      task: true,
      ownerId: true,
      assignedToId: true,
      subtasks: {
        select: {
          title: true,
          completed: true,
        },
      },
    },
  });

  return NextResponse.json({
    debug: true,
    userId: session.user.id,
    userRole: session.user.role,
    allTasks,
  });
}