// app/api/tasks/stats/debug/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/authOptions';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const isAdmin = session.user.role === 'ADMIN';
    
    let whereClause: any;
    if (isAdmin) {
      whereClause = {};
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
            title: true,
            completed: true,
          },
        },
      },
    });

    const analysis = tasks.map(task => {
      const totalSubtasks = task.subtasks.length;
      const doneSubtasks = task.subtasks.filter(s => s.completed).length;
      let status = '';
      
      if (totalSubtasks === 0 || doneSubtasks === 0) {
        status = 'PENDING';
      } else if (doneSubtasks === totalSubtasks) {
        status = 'COMPLETED';
      } else {
        status = 'IN_PROGRESS';
      }
      
      return {
        task: task.task,
        status,
        progress: `${doneSubtasks}/${totalSubtasks}`,
        subtasks: task.subtasks.map(s => ({
          title: s.title,
          completed: s.completed,
        })),
      };
    });

    const completed = analysis.filter(t => t.status === 'COMPLETED').length;
    const inProgress = analysis.filter(t => t.status === 'IN_PROGRESS').length;
    const pending = analysis.filter(t => t.status === 'PENDING').length;

    return NextResponse.json({
      summary: {
        total: tasks.length,
        completed,
        inProgress,
        pending,
      },
      detailed: analysis,
      userRole: session.user.role,
      isAdmin,
    });
    
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debug info' },
      { status: 500 }
    );
  }
}