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

    // Get last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    // Query tasks assigned to the user
    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: userId, // Use assignedToId for tasks assigned to user
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        createdAt: true,
        status: true
      }
    });

    // Create a map of days
    const daysMap = new Map();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Initialize all days with 0
    days.forEach(day => daysMap.set(day, 0));

    // Count completed tasks per day
    tasks.forEach(task => {
      if (task.status === 'COMPLETED') {
        const dayName = days[task.createdAt.getDay()];
        daysMap.set(dayName, (daysMap.get(dayName) || 0) + 1);
      }
    });

    // Convert to array format for chart
    const data = days.map(day => ({
      date: day,
      completed: daysMap.get(day) || 0
    }));
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in weekly-activity API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}