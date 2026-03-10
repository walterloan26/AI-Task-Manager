import { AchievementBadgesClient } from './AchievementBadgesClient';
import { Award } from 'lucide-react';
import { cookies } from 'next/headers';

async function getAchievements(userId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const cookieStore = await cookies();
    
    const response = await fetch(`${baseUrl}/api/achievements?userId=${userId}`, {
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
    console.error('Failed to fetch achievements:', error);
    return [];
  }
}

export default async function AchievementBadges({ userId }: { userId: string }) {
  const achievements = await getAchievements(userId);
  
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Award className="w-5 h-5 mr-2" />
        Achievements
      </h3>
      <div className="min-h-[200px]">
        {achievements.length > 0 ? (
          <AchievementBadgesClient achievements={achievements} />
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-500">
            No achievements yet
          </div>
        )}
      </div>
    </div>
  );
}