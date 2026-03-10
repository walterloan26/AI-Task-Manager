import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/authOptions';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const goals = await generateWeeklyGoals(userId);
    
    return NextResponse.json(goals);
  } catch (error) {
    console.error('Error in weekly-goals API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function generateWeeklyGoals(userId: string) {
  // Get tasks assigned to the user
  const totalTasks = await prisma.task.count({
    where: { assignedToId: userId } // Use assignedToId
  });

  const completedTasks = await prisma.task.count({
    where: { 
      assignedToId: userId, // Use assignedToId
      status: 'COMPLETED'
    }
  });

  const highPriorityTasks = await prisma.task.count({
    where: { 
      assignedToId: userId, // Use assignedToId
      complexity: 'HIGH',
      status: { not: 'COMPLETED' }
    }
  });

  const pendingTasks = await prisma.task.count({
    where: {
      assignedToId: userId,
      status: 'PENDING'
    }
  });

  // Generate dynamic goals based on actual data
  const goals = [
    {
      id: '1',
      title: `Complete ${Math.min(5, highPriorityTasks)} high-priority tasks`,
      completed: highPriorityTasks === 0
    },
    {
      id: '2',
      title: 'Maintain 80% completion rate',
      completed: totalTasks > 0 ? (completedTasks / totalTasks) >= 0.8 : false
    },
    {
      id: '3',
      title: `Clear ${Math.min(3, pendingTasks)} pending tasks`,
      completed: pendingTasks === 0
    }
  ];

  return goals;
}