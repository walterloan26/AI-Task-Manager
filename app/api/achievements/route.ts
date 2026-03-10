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

    // Calculate achievements based on user data
    const achievements = await calculateAchievements(userId);
    
    return NextResponse.json(achievements);
  } catch (error) {
    console.error('Error in achievements API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function calculateAchievements(userId: string) {
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

  const tasksToday = await prisma.task.count({
    where: {
      assignedToId: userId, // Use assignedToId
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    }
  });

  // Get user info for additional context
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      lastLoginAt: true
    }
  });

  // Define achievements based on actual data
  const achievements = [
    { 
      id: '1', 
      name: 'Early Bird', 
      icon: '🌅', 
      earned: tasksToday > 0 // Has tasks created today
    },
    { 
      id: '2', 
      name: 'Task Master', 
      icon: '👑', 
      earned: completedTasks >= 10 // Completed 10 tasks (adjust threshold)
    },
    { 
      id: '3', 
      name: 'Getting Started', 
      icon: '🚀', 
      earned: totalTasks >= 1 // Has at least one task
    },
    { 
      id: '4', 
      name: 'Goal Crusher', 
      icon: '🎯', 
      earned: completedTasks >= 5 // Completed 5 tasks
    },
    { 
      id: '5', 
      name: 'Busy Bee', 
      icon: '🐝', 
      earned: totalTasks >= 10 // Has 10+ tasks assigned
    },
    { 
      id: '6', 
      name: 'Veteran', 
      icon: '⭐', 
      earned: user && user.createdAt ? 
        (new Date().getTime() - user.createdAt.getTime()) > 30 * 24 * 60 * 60 * 1000 : false // 30+ days old account
    },
  ];

  return achievements;
}