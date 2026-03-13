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
    console.log("goals", goals)
    
    return NextResponse.json(goals);
  } catch (error) {
    console.error('Error in weekly-goals API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function generateWeeklyGoals(userId: string) {
  // Get all tasks for the user
  const tasks = await prisma.task.findMany({
    where: { assignedToId: userId },
    include: {
      subtasks: true
    }
  });

  // Calculate completed tasks based on subtasks
  let completedTasksCount = 0;
  const totalTasksCount = tasks.length;

  tasks.forEach(task => {
    const subtasks = task.subtasks || [];
    const completedSubtasks = subtasks.filter(st => st.completed).length;
    const allSubtasksCompleted = subtasks.length > 0 && completedSubtasks === subtasks.length;
    
    if (subtasks.length === 0) {
      if (task.status === 'COMPLETED') {
        completedTasksCount++;
      }
    } else {
      if (allSubtasksCompleted) {
        completedTasksCount++;
      }
    }
  });

  // Get tasks by priority
  const highPriorityTasks = tasks.filter(t => t.complexity === 'COMPLEX');
  const mediumPriorityTasks = tasks.filter(t => t.complexity === 'MEDIUM');
  const lowPriorityTasks = tasks.filter(t => t.complexity === 'SIMPLE');

  // Calculate completed tasks by priority
  const completedHighPriorityTasks = highPriorityTasks.filter(task => {
    const subtasks = task.subtasks || [];
    const completedSubtasks = subtasks.filter(st => st.completed).length;
    const allSubtasksCompleted = subtasks.length > 0 && completedSubtasks === subtasks.length;
    
    if (subtasks.length === 0) {
      return task.status === 'COMPLETED';
    } else {
      return allSubtasksCompleted;
    }
  }).length;

  const completedMediumPriorityTasks = mediumPriorityTasks.filter(task => {
    const subtasks = task.subtasks || [];
    const completedSubtasks = subtasks.filter(st => st.completed).length;
    const allSubtasksCompleted = subtasks.length > 0 && completedSubtasks === subtasks.length;
    
    if (subtasks.length === 0) {
      return task.status === 'COMPLETED';
    } else {
      return allSubtasksCompleted;
    }
  }).length;

  const completedLowPriorityTasks = lowPriorityTasks.filter(task => {
    const subtasks = task.subtasks || [];
    const completedSubtasks = subtasks.filter(st => st.completed).length;
    const allSubtasksCompleted = subtasks.length > 0 && completedSubtasks === subtasks.length;
    
    if (subtasks.length === 0) {
      return task.status === 'COMPLETED';
    } else {
      return allSubtasksCompleted;
    }
  }).length;

  // Get pending tasks
  const pendingTasks = tasks.filter(task => {
    const subtasks = task.subtasks || [];
    const completedSubtasks = subtasks.filter(st => st.completed).length;
    const allSubtasksCompleted = subtasks.length > 0 && completedSubtasks === subtasks.length;
    
    if (subtasks.length === 0) {
      return task.status !== 'COMPLETED';
    } else {
      return !allSubtasksCompleted;
    }
  }).length;

  // Calculate completion rate
  const completionRate = totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) * 100 : 0;
  const meetsGoal = completionRate >= 80;

  console.log("Priority stats:", {
    high: { completed: completedHighPriorityTasks },
    medium: { completed: completedMediumPriorityTasks },
    low: { completed: completedLowPriorityTasks }
  });

  // Generate dynamic goals based on actual data
  const goals = [
    {
      id: '1',
      title: `Complete 2 high-priority tasks`,
      completed: completedHighPriorityTasks >= 2
    },
    {
      id: '2',
      title: `Maintain 80% completion rate (${completionRate.toFixed(1)}% currently)`,
      completed: meetsGoal
    },
    {
      id: '3',
      title: pendingTasks > 0
        ? `Clear ${Math.min(3, pendingTasks)} pending task${Math.min(3, pendingTasks) !== 1 ? 's' : ''}`
        : `Clear pending tasks (all done!)`,
      completed: pendingTasks === 0
    },
    {
      id: '4',
      title: `Complete 2 medium-priority tasks`,
      completed: completedMediumPriorityTasks >= 2
    },
    {
      id: '5',
      title: `Complete 2 low-priority tasks`,
      completed: completedLowPriorityTasks >= 2
    }
  ];

  console.log("Goals:", goals);
  
  return goals;
}