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
        subtasks: {
          select: { 
            completed: true,
          },
        },
      },
    });

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

    return NextResponse.json({
      total: tasks.length,
      completed,
      inProgress,
      pending,
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