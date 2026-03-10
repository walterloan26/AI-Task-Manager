import { WeeklyGoalsClient } from './WeeklyGoalsClient';
import { Target } from 'lucide-react';
import { cookies } from 'next/headers';

async function getWeeklyGoals(userId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const cookieStore = await cookies();
    
    const response = await fetch(`${baseUrl}/api/weekly-goals?userId=${userId}`, {
      cache: 'no-store',
      headers: {
        'Cookie': cookieStore.toString()
      }
    });
    
    if (!response.ok) {
      console.error('API responded with status:', response.status);
      return [];
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch weekly goals:', error);
    return [];
  }
}

export default async function WeeklyGoals({ userId }: { userId: string }) {
  const goals = await getWeeklyGoals(userId);
  
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Target className="w-5 h-5 mr-2" />
        Weekly Goals
      </h3>
      <WeeklyGoalsClient goals={goals} />
    </div>
  );
}