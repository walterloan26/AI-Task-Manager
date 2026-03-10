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

    // Get tasks assigned to the user
    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: userId
      },
      select: {
        complexity: true
      }
    });

    console.log(`Found ${tasks.length} tasks`);

    // Count tasks by complexity (using the actual values from your DB)
    const complexityCount = {
      LOW: 0,
      MEDIUM: 0,
      COMPLEX: 0
    };

    tasks.forEach(task => {
      if (task.complexity === 'LOW') complexityCount.LOW++;
      else if (task.complexity === 'MEDIUM') complexityCount.MEDIUM++;
      else if (task.complexity === 'COMPLEX') complexityCount.COMPLEX++;
      else {
        console.log(`Unknown complexity value: ${task.complexity}`);
      }
    });

    console.log('Complexity counts:', complexityCount);

    // Map to display names for the chart
    const data = [
      { name: 'Low', value: complexityCount.LOW },
      { name: 'Medium', value: complexityCount.MEDIUM },
      { name: 'High', value: complexityCount.COMPLEX }
    ];
    
    console.log('Returning data:', data);
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error in priority-distribution API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}